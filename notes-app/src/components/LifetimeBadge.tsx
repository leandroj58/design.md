import { daysLeft } from "@/lib/markdown";

export function LifetimeBadge({
  updatedAt,
  lifetimeDays,
}: {
  updatedAt: string;
  lifetimeDays: number;
}) {
  const left = daysLeft(updatedAt, lifetimeDays);
  const urgent = left <= 7;
  return (
    <span
      title={`Se archiva sola en ${left} día${left === 1 ? "" : "s"} si no la editás`}
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
        urgent ? "bg-accent/10 text-accent" : "text-muted"
      }`}
    >
      {left}d
    </span>
  );
}
