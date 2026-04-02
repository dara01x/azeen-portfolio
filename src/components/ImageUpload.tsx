import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export function ImageUpload({ images = [], onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const localImageUrls = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => URL.createObjectURL(file));

    if (localImageUrls.length > 0) {
      onChange([...images, ...localImageUrls]);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {images.map((img, i) => (
        <div key={i} className="group relative aspect-video rounded-xl border bg-muted overflow-hidden">
          <img src={img} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(images.filter((_, idx) => idx !== i))}
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
  );
}
