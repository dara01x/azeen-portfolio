import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_SIZE_BYTES = 500 * 1024 * 1024;

type LocalImageEntry = {
  url: string;
  file: File;
};

export function ImageUpload({
  images = [],
  mainImage,
  onChange,
  onMainImageChange,
  onLocalFilesAdded,
}: {
  images: string[];
  mainImage?: string;
  onChange: (imgs: string[]) => void;
  onMainImageChange?: (imageUrl: string | undefined) => void;
  onLocalFilesAdded?: (entries: LocalImageEntry[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const resolvedMainImage =
    mainImage && images.includes(mainImage) ? mainImage : images[0] || undefined;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);

    const availableSlots = Math.max(0, MAX_IMAGE_COUNT - images.length);
    if (availableSlots <= 0) {
      setUploadError(`You can upload up to ${MAX_IMAGE_COUNT} images.`);
      return;
    }

    const selectedFiles = Array.from(files);
    const validImageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    const oversizedFiles = validImageFiles.filter((file) => file.size > MAX_IMAGE_SIZE_BYTES);
    const sizeAcceptedFiles = validImageFiles.filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES);
    const acceptedFiles = sizeAcceptedFiles.slice(0, availableSlots);

    if (acceptedFiles.length === 0) {
      setUploadError("No valid images were selected. Use image files up to 500MB each.");
      return;
    }

    const localImageEntries = acceptedFiles
      .map((file) => ({
        url: URL.createObjectURL(file),
        file,
      }));

    const localImageUrls = localImageEntries.map((entry) => entry.url);

    if (localImageUrls.length > 0) {
      const nextImages = [...images, ...localImageUrls];
      onLocalFilesAdded?.(localImageEntries);
      onChange(nextImages);

      if (!resolvedMainImage) {
        onMainImageChange?.(nextImages[0]);
      }
    }

    const droppedByCount = sizeAcceptedFiles.length - acceptedFiles.length;
    const ignoredNonImages = selectedFiles.length - validImageFiles.length;

    if (oversizedFiles.length > 0 || droppedByCount > 0 || ignoredNonImages > 0) {
      const messages: string[] = [];
      if (oversizedFiles.length > 0) {
        messages.push(`${oversizedFiles.length} file(s) were larger than 500MB`);
      }
      if (droppedByCount > 0) {
        messages.push(`${droppedByCount} file(s) exceeded the ${MAX_IMAGE_COUNT} image limit`);
      }
      if (ignoredNonImages > 0) {
        messages.push(`${ignoredNonImages} non-image file(s) were ignored`);
      }

      setUploadError(messages.join(". "));
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img, i) => (
          <div key={i} className="group relative aspect-video rounded-xl border bg-muted overflow-hidden">
            <img src={img} alt="" className="h-full w-full object-cover" />

            {img === resolvedMainImage ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                Cover
              </span>
            ) : null}

            {images.length > 1 && onMainImageChange && img !== resolvedMainImage ? (
              <button
                type="button"
                onClick={() => onMainImageChange(img)}
                className="absolute bottom-1.5 left-1.5 rounded bg-background/85 px-2 py-1 text-[10px] font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                Set cover
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const nextImages = images.filter((_, idx) => idx !== i);
                onChange(nextImages);

                if (img === resolvedMainImage) {
                  onMainImageChange?.(nextImages[0]);
                }
              }}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-foreground/60 text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-xs font-medium">Upload</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFilesSelected(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">Max {MAX_IMAGE_COUNT} images, 500MB each.</p>
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
    </div>
  );
}
