import { cn } from "@/lib/utils";

type StatusType = "available" | "sold" | "archived" | "active" | "inactive" | "completed" | "disabled";

const statusConfig: Record<StatusType, { bg: string; text: string; dot: string }> = {
  available: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  active: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  sold: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  archived: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  inactive: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  disabled: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  completed: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as StatusType] || statusConfig.archived;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize", config.bg, config.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {status.replace("_", " ")}
    </span>
  );
}
