import backgroundImage from "../../../../assets/images/glowjob-background.png";
import { Logo } from "../../../../components/shared/Logo";
import type { OnboardingStep } from "../../types";
import { SideFeatureItem } from "./SideFeatureItem";
import { SideProgress } from "./SideProgress";
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
    <aside className="relative isolate shrink-0 overflow-hidden border-b border-border bg-accent px-5 py-4 sm:px-8 lg:min-h-screen lg:w-[24%] lg:max-w-[401px] lg:border-b-0 lg:px-7 lg:py-5 xl:px-10">
      <img
        src={backgroundImage}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 hidden h-[480px] w-full object-fill lg:block"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-linear-to-b from-accent via-accent/90 to-transparent lg:block"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-5 lg:block">
        <div className="flex items-center gap-0">
          <Logo className="w-20 lg:w-24 shrink-0" />
          <span
            aria-hidden="true"
            className="text-2xl font-bold leading-tight tracking-tight"
          >
            Glow<span className="text-primary">Job</span>
          </span>
        </div>
        <div className="w-36 shrink-0 sm:w-52 lg:mt-3 lg:w-full">
          <SideProgress
            currentStep={currentStep}
            label={progressLabel}
            analyzing={analyzing}
          />
        </div>
      </div>
      <div className="hidden lg:block">
        <h2 className="mt-11 text-3xl font-bold leading-[1.15] tracking-tight text-foreground xl:text-[40px]">
          {headline}
        </h2>
        <p className="mt-4 text-lg leading-[1.35] text-muted-foreground xl:text-xl">
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
