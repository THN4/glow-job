import { useId, type MouseEvent, type ReactNode } from "react";
import { Pencil, type LucideIcon } from "lucide-react";
import { IconBox, type IconColor } from "../../../../components/shared/IconBox";
import { Button } from "../../../../components/ui/button";
import { reviewCopy } from "../../../../lib/profileConstants";
import { cn } from "../../../../lib/utils";

type InfoCardProps = {
  title: string;
  icon: LucideIcon;
  color: IconColor;
  children: ReactNode;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export function InfoCard({
  title,
  icon,
  color,
  children,
  onEdit,
  className,
}: InfoCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "min-w-0 rounded-lg border border-border bg-panel p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-4">
        <IconBox icon={icon} color={color} />
        <h2
          id={titleId}
          className="min-w-0 flex-1 text-base font-semibold leading-6 sm:text-lg"
        >
          {title}
        </h2>
        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          aria-label={reviewCopy.editSection(title)}
          className="h-8 gap-1.5 border-input bg-card px-2 text-sm text-primary"
        >
          <Pencil className="size-4" aria-hidden="true" />
          {reviewCopy.edit}
        </Button>
      </div>
      {children}
    </section>
  );
}
