import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CONFIG = {
  sm: {
    wrapper: "py-10",
    icon: 36,
    title: "text-base font-semibold",
    desc: "text-sm",
    gap: "gap-3",
  },
  md: {
    wrapper: "py-16",
    icon: 48,
    title: "text-lg font-semibold",
    desc: "text-sm",
    gap: "gap-4",
  },
  lg: {
    wrapper: "py-24",
    icon: 56,
    title: "text-xl font-bold",
    desc: "text-base",
    gap: "gap-4",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        cfg.wrapper,
        cfg.gap,
        className
      )}
    >
      {/* 아이콘 컨테이너 */}
      <div className="flex items-center justify-center rounded-2xl bg-muted p-4">
        <Icon
          size={cfg.icon}
          strokeWidth={1.5}
          className="text-muted-foreground/60"
          aria-hidden="true"
        />
      </div>

      {/* 텍스트 */}
      <div className="max-w-xs space-y-1.5">
        <h3 className={cn(cfg.title, "text-foreground")}>{title}</h3>
        {description && (
          <p className={cn(cfg.desc, "text-muted-foreground leading-relaxed")}>{description}</p>
        )}
      </div>

      {/* 액션 버튼 */}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={action.onClick} className="h-10 px-5">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick} className="h-10 px-5">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
