import type { LucideIcon } from "lucide-react";
import { IconBox } from "../../../../components/shared/IconBox";

export type SideFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function SideFeatureItem({ icon, title, description }: SideFeature) {
  return (
    <li className="flex items-start gap-5">
      <IconBox icon={icon} className="bg-primary/10" />
      <div className="min-w-0 pt-0.5">
        <h3 className="text-base font-semibold leading-6 text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 max-w-52 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </li>
  );
}
