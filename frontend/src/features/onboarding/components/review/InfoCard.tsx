import { useId, type MouseEvent, type ReactNode, type Ref } from "react";
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
  ref?: Ref<HTMLElement>;
  invalid?: boolean;
};

export function InfoCard({
  title,
  icon,
  color,
  children,
  onEdit,
  className,
  ref,
  invalid = false,
}: InfoCardProps) {
  const titleId = useId();
  return (
    <section
      ref={ref}
      tabIndex={-1}
      data-invalid={invalid || undefined}
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 scroll-mt-6 flex-col rounded-lg border border-border bg-panel p-4 outline-none sm:p-5",
        invalid && "border-destructive ring-2 ring-destructive/20",
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
      <div className="flex-1">{children}</div>
    </section>
  );
}
