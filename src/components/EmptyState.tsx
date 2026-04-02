import { FileQuestion } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-2xl bg-muted p-5 mb-5">
        <FileQuestion className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[280px]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
