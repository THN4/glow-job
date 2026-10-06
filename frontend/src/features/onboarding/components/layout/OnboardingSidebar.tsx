import backgroundImage from "../../../../assets/images/glowjob-background.png";
import type { OnboardingStep } from "../../types";
import { SideFeatureItem } from "./SideFeatureItem";
import { OnboardingBrandProgress } from "./OnboardingBrandProgress";
import { getSidebarContent, type SidebarContent } from "./sidebarContent";

type OnboardingSidebarProps = {
  currentStep: OnboardingStep;
  content?: SidebarContent;
  progressLabel?: string;
  analyzing?: boolean;
};

export function OnboardingSidebar({
  currentStep,
  content,
  progressLabel,
  analyzing = false,
}: OnboardingSidebarProps) {
  const { headline, description, features } =
    content ?? getSidebarContent(currentStep, analyzing);
  return (
    <aside className="isolate hidden shrink-0 bg-accent sidebar-expanded:sticky sidebar-expanded:top-0 sidebar-expanded:block sidebar-expanded:h-dvh sidebar-expanded:w-[24%] sidebar-expanded:min-w-60 sidebar-expanded:max-w-[401px] sidebar-expanded:overflow-y-auto sidebar-expanded:px-7 sidebar-expanded:py-5 xl:px-10">
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 hidden h-[480px] w-full object-fill sidebar-expanded:block"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-linear-to-b from-accent via-accent/90 to-transparent sidebar-expanded:block"
        aria-hidden="true"
      />
      <OnboardingBrandProgress currentStep={currentStep} progressLabel={progressLabel} analyzing={analyzing} />
      <div className="hidden sidebar-expanded:block">
        <h2 className="mt-11 text-2xl font-bold leading-[1.15] tracking-tight text-foreground">
          {headline}
        </h2>
        <p className="mt-4 text-sm leading-[1.35] text-muted-foreground">
          {description}
        </p>
        <ul className="mt-6 space-y-7 pb-40">
          {features.map((feature) => (
            <SideFeatureItem key={feature.title} {...feature} />
          ))}
        </ul>
      </div>
    </aside>
  );
}
