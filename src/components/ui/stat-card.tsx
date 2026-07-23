import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Carte de statistique réutilisable (inspirée d'un composant 21st.dev, adaptée
// au style Market-Pro : pastille d'icône colorée + valeur en gros chiffres).
type Tone = "default" | "positive" | "warning" | "danger";

const CHIP: Record<Tone, string> = {
  default: "bg-emerald-50 text-emerald-600",
  positive: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
};

const VALUE: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-red-700",
};

export function StatCard({
  title,
  value,
  icon,
  hint,
  tone = "default",
  className,
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Card className={cn("gap-1", tone === "warning" && "ring-amber-300/60", className)}>
      <div className="flex items-center justify-between gap-2 px-4">
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</span>
        {icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", CHIP[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="px-4">
        <div className={cn("text-xl font-bold tabular-nums tracking-tight sm:text-2xl", VALUE[tone])}>
          {value}
        </div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
