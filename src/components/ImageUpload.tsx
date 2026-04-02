import { ImagePlus } from "lucide-react";

export function ImageUpload({ images = [], onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {images.map((img, i) => (
        <div key={i} className="relative aspect-video rounded-lg border bg-muted overflow-hidden">
          <img src={img} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
      <button
        type="button"
        onClick={() => {/* placeholder for file upload */}}
        className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <ImagePlus className="h-6 w-6" />
      </button>
    </div>
  );
}
