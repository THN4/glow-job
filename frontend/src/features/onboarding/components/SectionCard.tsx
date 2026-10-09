import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconBox, type IconColor } from "../../../components/shared/IconBox";
import { cn } from "../../../lib/utils";

type SectionLabelIds = { titleId: string; descriptionId: string };
type SectionCardProps = {
  icon: LucideIcon;
  color?: IconColor;
  title: string;
  description: string;
  children: ReactNode | ((ids: SectionLabelIds) => ReactNode);
  className?: string;
  contentClassName?: string;
  layout?: "row" | "stacked";
};

export function SectionCard({
  icon,
  color = "blue",
  title,
  description,
  children,
  className,
  contentClassName,
  layout = "row",
}: SectionCardProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "grid min-h-28 items-center gap-4 rounded-lg border border-border bg-panel p-4 sm:p-5",
        layout === "row"
          ? "xl:grid-cols-[340px_minmax(0,1fr)]"
          : "min-h-0 gap-y-3",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start gap-4",
          layout === "row" ? "xl:gap-7" : "sm:gap-10",
        )}
      >
        <IconBox icon={icon} color={color} />
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-semibold leading-6 text-foreground sm:text-lg"
          >
            {title}
          </h2>
          <p
            id={descriptionId}
            className="mt-1.5 text-sm leading-5 text-muted-foreground"
          >
            {description}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "min-w-0",
          layout === "stacked" && "sm:ml-21",
          contentClassName,
        )}
      >
        {typeof children === "function"
          ? children({ titleId, descriptionId })
          : children}
      </div>
    </section>
  );
}
