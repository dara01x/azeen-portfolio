import { cn } from "@/lib/utils";

type StatusType = "available" | "sold" | "archived" | "active" | "inactive" | "completed" | "disabled";

const statusStyles: Record<StatusType, string> = {
  available: "bg-success/10 text-success border-success/20",
  active: "bg-success/10 text-success border-success/20",
  sold: "bg-destructive/10 text-destructive border-destructive/20",
  archived: "bg-muted text-muted-foreground border-border",
  inactive: "bg-muted text-muted-foreground border-border",
  disabled: "bg-muted text-muted-foreground border-border",
  completed: "bg-primary/10 text-primary border-primary/20",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status as StatusType] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", style)}>
      {status.replace("_", " ")}
    </span>
  );
}
