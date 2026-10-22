import { ArrowUpRight, Check, Code2, Layers, Settings } from "lucide-react";
import { IconBox } from "../../../../components/shared/IconBox";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { goalCopy } from "../../../../lib/goalConstants";
import { cn } from "../../../../lib/utils";
import type { RoleRecommendation } from "../../types";

const icons = {
  development: Code2,
  full_stack: Layers,
  infrastructure: Settings,
};
export function RoleRecommendationCard({
  role,
  selected,
  onSelect,
}: {
  role: RoleRecommendation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "h-auto min-h-48 min-w-0 flex-col items-stretch justify-between gap-3 whitespace-normal rounded-xl border-blue-100 bg-card/90 p-4 text-left text-sm font-normal shadow-none transition-colors hover:border-primary/50 hover:bg-blue-50/60",
        selected && "border-primary bg-blue-50/80 ring-1 ring-primary hover:bg-blue-50/80",
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <IconBox icon={icons[role.category]}
          color={role.category === "full_stack" ? "blue" : "purple"} />
        <Badge
          variant="secondary"
          className="h-8 border-0 bg-icon-green px-3 text-base font-semibold text-success"
        >
          {goalCopy.recommendations.matchPercent(role.matchPercent)}
        </Badge>
      </span>
      <span className="block">
        <span className="block font-semibold leading-5 text-foreground">{role.title}</span>
        <span className="mt-2 block leading-[1.35] text-muted-foreground">{role.description}</span>
      </span>
      <span className="flex items-center justify-between pt-1 text-sm font-medium text-primary">
        <span>{selected ? "Selected" : "Select role"}</span>
        {selected
          ? <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" aria-hidden="true" /></span>
          : <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />}
      </span>
    </Button>
  );
}
