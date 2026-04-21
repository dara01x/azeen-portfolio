"use client";

import imageCompression from "browser-image-compression";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

type FetchFileFn = (source: File | Blob | string | URL) => Promise<Uint8Array>;

type FfmpegCore = {
  ffmpeg: FFmpeg;
  fetchFile: FetchFileFn;
};

export type ImageCompressionSettings = {
  maxBytes?: number;
  maxWidthOrHeight?: number;
  convertToWebp?: boolean;
};

export type VideoCompressionSettings = {
  maxBytes: number;
  maxInputBytes?: number;
};

const DEFAULT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_IMAGE_MAX_WIDTH_OR_HEIGHT = 2200;
const IMAGE_COMPRESSION_THRESHOLD_BYTES = 350 * 1024;
const NON_COMPRESSIBLE_IMAGE_TYPES = new Set(["image/gif", "image/svg+xml"]);
const VIDEO_COMPRESSION_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
const DEFAULT_VIDEO_MAX_INPUT_BYTES = 250 * 1024 * 1024;

const VIDEO_COMPRESSION_PRESETS = [
  { maxWidth: 1280, crf: 30, audioBitrateKbps: 96 },
  { maxWidth: 960, crf: 33, audioBitrateKbps: 80 },
  { maxWidth: 854, crf: 36, audioBitrateKbps: 64 },
];

let ffmpegCorePromise: Promise<FfmpegCore> | null = null;
let ffmpegQueue: Promise<void> = Promise.resolve();

function normalizeMimeType(type: string): string {
  return (type || "").toLowerCase();
}

function baseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "").trim();
  const normalized = withoutExt
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return normalized || "file";
}

function extensionFromMimeType(type: string): string {
  const normalized = normalizeMimeType(type);

  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("bmp")) return "bmp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("quicktime")) return "mov";
  if (normalized.includes("x-matroska")) return "mkv";

  return "bin";
}

function ensureFileNameForType(fileName: string, mimeType: string): string {
  const ext = extensionFromMimeType(mimeType);
  return `${baseName(fileName)}.${ext}`;
}

async function getFfmpegCore(): Promise<FfmpegCore> {
  if (!ffmpegCorePromise) {
    ffmpegCorePromise = (async () => {
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);

      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${VIDEO_COMPRESSION_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${VIDEO_COMPRESSION_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      ]);

      await ffmpeg.load({ coreURL, wasmURL });

      return {
        ffmpeg,
        fetchFile: fetchFile as FetchFileFn,
      };
    })();
  }

  return ffmpegCorePromise;
}

async function safeDeleteFile(ffmpeg: FFmpeg, fileName: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(fileName);
  } catch {
    // Ignore cleanup failures.
  }
}

function enqueueFfmpegTask<T>(task: () => Promise<T>): Promise<T> {
  const queuedTask = ffmpegQueue.then(task, task);

  ffmpegQueue = queuedTask
    .then(() => undefined)
    .catch(() => undefined);

  return queuedTask;
}

export async function compressImageForUpload(
  file: File,
  settings: ImageCompressionSettings = {},
): Promise<File> {
  if (!(file instanceof File)) {
    return file;
  }

  const sourceType = normalizeMimeType(file.type);
  if (!sourceType.startsWith("image/")) {
    return file;
  }

  if (NON_COMPRESSIBLE_IMAGE_TYPES.has(sourceType)) {
    return file;
  }

  const maxBytes = settings.maxBytes ?? DEFAULT_IMAGE_MAX_BYTES;
  const shouldCompress = file.size > maxBytes || file.size > IMAGE_COMPRESSION_THRESHOLD_BYTES;

  if (!shouldCompress) {
    return file;
  }

  const convertToWebp = settings.convertToWebp ?? true;
  const outputType = convertToWebp ? "image/webp" : sourceType || "image/jpeg";

  try {
    const compressedResult = await imageCompression(file, {
      maxSizeMB: maxBytes / (1024 * 1024),
      maxWidthOrHeight: settings.maxWidthOrHeight ?? DEFAULT_IMAGE_MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: outputType,
    });

    const compressedFile = compressedResult;
    const compressedFileType = compressedFile.type || outputType;

    const normalizedName = ensureFileNameForType(
      file.name,
      compressedFileType,
    );

    const renamedCompressedFile = new File([compressedFile], normalizedName, {
      type: compressedFileType,
      lastModified: Date.now(),
    });

    if (renamedCompressedFile.size >= file.size && file.size <= maxBytes) {
      return file;
    }

    return renamedCompressedFile;
  } catch {
    return file;
  }
}

export async function compressVideoForUpload(
  file: File,
  settings: VideoCompressionSettings,
): Promise<File> {
  if (!(file instanceof File)) {
    return file;
  }

  if (!file.type.startsWith("video/")) {
    return file;
  }

  if (file.size <= settings.maxBytes) {
    return file;
  }

  const maxInputBytes = settings.maxInputBytes ?? DEFAULT_VIDEO_MAX_INPUT_BYTES;
  if (file.size > maxInputBytes) {
    throw new Error(
      `Video is too large to process in browser. Please choose a video up to ${Math.round(maxInputBytes / (1024 * 1024))}MB.`,
    );
  }

  return enqueueFfmpegTask(async () => {
    const { ffmpeg, fetchFile } = await getFfmpegCore();
    const inputExt = extensionFromMimeType(file.type || "video/mp4");
    const inputName = `input-${Date.now()}.${inputExt}`;
    const outputNames: string[] = [];

    let bestCompressedFile: File | null = null;

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      for (const [index, preset] of VIDEO_COMPRESSION_PRESETS.entries()) {
        const outputName = `output-${Date.now()}-${index}.mp4`;
        outputNames.push(outputName);

        await ffmpeg.exec([
          "-i",
          inputName,
          "-vf",
          `scale='min(${preset.maxWidth},iw)':-2`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          String(preset.crf),
          "-c:a",
          "aac",
          "-b:a",
          `${preset.audioBitrateKbps}k`,
          "-movflags",
          "+faststart",
          "-y",
          outputName,
        ]);

        const outputData = await ffmpeg.readFile(outputName);
        if (!(outputData instanceof Uint8Array)) {
          continue;
        }

        const candidateFile = new File([outputData], `${baseName(file.name)}.mp4`, {
          type: "video/mp4",
          lastModified: Date.now(),
        });

        if (!bestCompressedFile || candidateFile.size < bestCompressedFile.size) {
          bestCompressedFile = candidateFile;
        }

        if (candidateFile.size <= settings.maxBytes) {
          break;
        }
      }
    } finally {
      await safeDeleteFile(ffmpeg, inputName);

      for (const outputName of outputNames) {
        await safeDeleteFile(ffmpeg, outputName);
      }
    }

    if (!bestCompressedFile) {
      throw new Error("Video compression failed. Please choose a smaller video file.");
    }

    if (bestCompressedFile.size >= file.size) {
      return file;
    }

    return bestCompressedFile;
  });
}