import backgroundImage from "../../../../assets/images/glowjob-background.png";
import type { OnboardingStep } from "../../types";
import { useLayoutEffect, useRef } from "react";
import { SideFeatureItem } from "./SideFeatureItem";
import { OnboardingBrandProgress } from "./OnboardingBrandProgress";
import { getSidebarContent, type SidebarContent } from "./sidebarContent";

type OnboardingSidebarProps = {
  currentStep: OnboardingStep;
  completedSteps?: readonly OnboardingStep[];
  content?: SidebarContent;
  progressLabel?: string;
  analyzing?: boolean;
};

export function OnboardingSidebar({
  currentStep,
  completedSteps,
  content,
  progressLabel,
  analyzing = false,
}: OnboardingSidebarProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [currentStep, analyzing]);
  const { headline, description, features } =
    content ?? getSidebarContent(currentStep, analyzing);
  return (
    <aside className="isolate hidden shrink-0 bg-accent sidebar-expanded:sticky sidebar-expanded:top-0 sidebar-expanded:flex sidebar-expanded:h-dvh sidebar-expanded:w-[24vw] sidebar-expanded:min-w-60 sidebar-expanded:max-w-[401px] sidebar-expanded:flex-col sidebar-expanded:overflow-hidden sidebar-expanded:px-7 sidebar-expanded:py-5 xl:px-10">
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
      <div className="relative z-10 shrink-0 bg-accent">
        <OnboardingBrandProgress currentStep={currentStep} completedSteps={completedSteps} progressLabel={progressLabel} analyzing={analyzing} />
      </div>
      <div ref={contentRef} tabIndex={0} aria-label="Onboarding guidance" className="onboarding-sidebar-scroll mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sidebar-expanded:block">
        <div className="onboarding-sidebar-copy">
        <h2 className="mt-7 whitespace-pre-line text-2xl font-bold leading-[1.15] tracking-tight text-foreground">
          {headline}
        </h2>
        <p className="mt-3 text-sm leading-[1.35] text-muted-foreground">
          {description}
        </p>
        <ul className="mt-5 space-y-5 pb-28">
          {features.map((feature) => (
            <SideFeatureItem key={feature.title} {...feature} />
          ))}
        </ul>
        </div>
      </div>
    </aside>
  );
}
