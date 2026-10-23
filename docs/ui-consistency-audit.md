# UI consistency audit

Reviewed: 23 October 2026. Scope: all seven workspace navigation pages and the three Applications sub-tabs (My Applications, Companies, Recommendations), including their shared headers, statistics, cards, filters, and common UI primitives.

This is a source-level audit of routed UI. No application styles were changed. Browser rendering, computed styles, actual font loading, overflow, contrast, and alignment at specific viewport sizes remain unverified. Onboarding and the CV flow are separate layouts and are outside the main comparison.

## Page comparison

Sizes below describe the normal loaded page title. Pixel equivalents assume a 16px root font. `sm`, `lg`, and `xl` refer to the project's Tailwind breakpoints.

| Page | Title size | Header alignment | Inner maximum width | Main observation |
| --- | --- | --- | --- | --- |
| Overview | 20px / sm 24px / lg 30px | Left | 1500px | Largest desktop title; extra header padding; title is the target role |
| My Roadmap | 20px / sm 24px / xl 28px | Center | 1500px | Centered header and legend differ from other pages |
| Skill Profile | 20px / sm 24px / xl 28px | Left | 1500px | Uses shared theme text colors; reduces vertical gaps on shorter screens |
| Market Insights | 24px / sm 28px | Left | 1500px | Larger title earlier than Skill Profile and Applications |
| Applications | 20px / sm 24px / xl 28px | Left | 1500px | Shared header across all three sub-tabs; subtitle scales to 16px |
| Progress | 24px / sm 28px | Left | 1500px | Same title mismatch as Market Insights; subtitle stays 14px |
| Assessments | 20px / sm 24px | Left | 1200px | Narrower content; no 28px desktop title; no context line above title |

All pages also sit inside the common 1500px layout with `p-4 sm:p-6` at `frontend/src/app/layouts/workspaceLayout.tsx:93`. The Assessments width difference becomes visible when available inner space exceeds 1200px; its centered content then starts farther right.

## Findings

### 1. High: page titles and subtitles use different responsive scales

At a small viewport, Progress and Market Insights use 24px titles while most pages use 20px. At `sm`, they reach 28px while most others remain at 24px until `xl`. Overview reaches 30px at `lg`, and Assessments stops at 24px. Applications, Skill Profile, and Roadmap use `leading-tight`; Progress and Market Insights use the default line height for their sizes. Equivalent titles therefore differ in size and line height.

Subtitle differences also change header height: Applications and Skill Profile use `mt-2 text-sm leading-6 ... sm:text-base`; Progress and Market Insights use `mt-2 text-sm`; Assessments uses `mt-1 text-sm`. Context-line letter spacing differs (`tracking-wide` versus `tracking-[0.12em]`).

Evidence: `frontend/src/features/workspace/pages/OverviewPage.tsx:274`, `frontend/src/features/roadmap/components/RoadmapHeader.tsx:23`, `frontend/src/features/skill-profile/components/SkillProfileHeader.tsx:13`, `frontend/src/features/applications/components/shared/ApplicationsHeader.tsx:34`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:52`, `frontend/src/features/roadmap/pages/ProgressPage.tsx:48`, `frontend/src/features/assessments/pages/AssessmentsPage.tsx:92`.

### 2. High: heading positions do not align across pages

Assessments has a 1200px inner cap compared with 1500px elsewhere. Roadmap centers its heading and omits the context line above the title. Overview adds `py-1 sm:py-2`. Assessments also omits the context line, and Market Insights only shows it when a target role exists. Even after equalizing font sizes, these structures place titles at different horizontal and vertical positions.

The Roadmap canvas can justify a centered header, but that should be an explicit design exception. Different content does not by itself require different page gutters or title scales.

Evidence: `frontend/src/features/assessments/pages/AssessmentsPage.tsx:89`, `frontend/src/features/roadmap/components/RoadmapHeader.tsx:14`, `frontend/src/features/workspace/pages/OverviewPage.tsx:274`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:51`.

### 3. High: equivalent UI roles bypass the shared color tokens

The theme defines primary `#0B5FFF`, foreground `#0d1246`, muted foreground `#637fbd`, and border `#d7e6ff`. Applications and Skill Profile headers use semantic classes such as `text-foreground` and `text-muted-foreground`. Progress, Market Insights, and Assessments instead use `text-slate-900` and `text-slate-600`. Primary actions mix `bg-primary` with `bg-blue-600`; these represent different colors. Ordinary cards mix `border-blue-100`, `border-slate-200`, and the theme border.

Use semantic tokens for equivalent roles. Keep separate colors where they communicate a distinct status or chart category. Hardcoded white/slate surfaces also bypass the defined dark theme; dark-mode support itself was not verified.

Evidence: `frontend/src/index.css:453`, `frontend/src/features/applications/components/shared/ApplicationsTabs.tsx:43`, `frontend/src/features/applications/components/companies/CompaniesTab.tsx:82`, `frontend/src/features/roadmap/pages/ProgressPage.tsx:47`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:67`.

### 4. Medium: card corner treatment varies, including one square panel

Ordinary cards generally use `rounded-xl`, while Overview's roadmap and next-action panels use `rounded-2xl`. The Recommendations explanatory panel has a border and shadow but no radius class, unlike nearby cards. These are confirmed style differences; hero panels may intentionally have larger corners.

The project's radius scale is customized: `--radius` is 0.75rem, `rounded-lg` is 12px, `rounded-xl` is 16.8px, and `rounded-2xl` is 21.6px at a 16px root. Do not assume stock radius values when comparing designs.

Evidence: `frontend/src/features/workspace/pages/OverviewPage.tsx:145`, `frontend/src/features/workspace/pages/OverviewPage.tsx:196`, `frontend/src/features/applications/components/recommendations/CareerRecommendationsTab.tsx:67`, `frontend/src/index.css:444`, `frontend/src/index.css:499`.

### 5. Medium: selected statistics use different border and emphasis rules

Selected Application statistics use `border-2 border-blue-500 ring-2 ring-blue-200`. Selected Skill Profile statistics keep a 1px border and only change its color. Application values use 24px extrabold, Skill Profile values use 24px bold, and Progress/Market Insights values use 30px bold. Application statistics have a 68px minimum height; Skill Profile uses 78px, dropping to 66px on shorter viewports. Layout differences may reflect content, but selection and number styles should follow common variants.

Evidence: `frontend/src/features/applications/components/shared/ApplicationStats.tsx:41`, `frontend/src/features/skill-profile/components/SkillProfileStats.tsx:36`, `frontend/src/features/roadmap/pages/ProgressPage.tsx:59`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:69`.

### 6. Medium: buttons and filters use competing size and focus conventions

The shared Button defaults to 32px height and medium-weight 14px text, while workspace actions commonly use custom 36px or 40px minimum heights with semibold 12px or 14px text. Applications uses 14px filter text in My Applications and 12px in Companies, despite both using 40px controls. Market Insights uses another select border color. Focus styles vary between a ring, an outline, and only a border-color change.

Evidence: `frontend/src/components/ui/button.tsx:8`, `frontend/src/components/ui/button.tsx:29`, `frontend/src/features/applications/components/shared/ApplicationsTabs.tsx:43`, `frontend/src/features/applications/components/my-applications/ApplicationToolbar.tsx:39`, `frontend/src/features/applications/components/companies/CompaniesTab.tsx:53`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:35`.

### 7. Medium: body copy, section headings, and spacing lack a common hierarchy

Overview section headings use 18px / sm 20px, while Progress, Market Insights, and Skill Profile sections use 16px. Recommendations card descriptions use 12px and supporting paragraphs use 11px; company skill badges use 9px. Such small text needs a rendered readability check, especially on mobile. Dense canvas labels can be an intentional exception.

Main section gaps are usually 20px, but Overview switches to 24px at `sm`, and Skill Profile drops to 12px below 960px viewport height. Thus the same screen width can produce different density across tabs. Market Insights' chart card uses 24/32/40px responsive padding, whereas its statistics use 16px; this may be intentional for a chart, rather than a defect.

Evidence: `frontend/src/features/workspace/pages/OverviewPage.tsx:107`, `frontend/src/features/workspace/pages/OverviewPage.tsx:273`, `frontend/src/features/skill-profile/pages/SkillProfilePage.tsx:174`, `frontend/src/features/applications/components/recommendations/CareerRecommendationsTab.tsx:51`, `frontend/src/features/applications/components/companies/CompaniesTab.tsx:78`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:74`.

### 8. Medium: empty and error states change the page frame

Progress returns a padded, unboxed section for errors and missing roadmaps; Skill Profile and Roadmap use centered bordered cards with different title sizing. Market Insights uses a plain no-profile paragraph while keeping its header. Loading states in several pages replace the header entirely. Switching tabs with missing data therefore produces a different layout as well as different content.

Evidence: `frontend/src/features/roadmap/pages/ProgressPage.tsx:23`, `frontend/src/features/skill-profile/pages/SkillProfilePage.tsx:150`, `frontend/src/features/roadmap/pages/RoadmapPage.tsx:99`, `frontend/src/features/applications/pages/MarketInsightsPage.tsx:55`.

## What is already consistent

- Font family: Geist Variable is imported globally; the HTML element uses `font-sans`. `font-heading` resolves to the same family. No competing family overrides were found under `frontend/src`. Noto Sans Thai is listed as a fallback, but this review did not find a font import for it; availability and Thai glyph rendering need browser verification.
- Shared outer layout: workspace pages inherit the same outer padding and maximum width.
- Ordinary panels mostly use a 1px border, white background, rounded corners, and a small shadow. Two-pixel selected borders, tab underlines, decorative borders, and roadmap markers have distinct roles and should not all be forced to 1px.
- All three Applications sub-tabs share the same header and tab-strip component. The main drift within them is in filter text size, card borders, content density, and the square explanatory panel.

## Proposed baseline for a follow-up implementation

These are recommendations, not changes made by this audit.

1. Use a common page-header component: 20px / sm 24px / xl 28px bold titles with tight line height; 14px / sm 16px subtitles with a 24px line height. Define consistent placement of optional context lines and actions.
2. Keep the common content gutters and width; explicitly document any narrower reading layout or centered Roadmap exception.
3. Use semantic foreground, muted foreground, primary, card, and border tokens for equivalent UI roles.
4. Use `rounded-xl` for ordinary cards and `rounded-lg` for controls; reserve larger radii for intentional hero panels and full rounding for badges.
5. Define shared statistic, button, filter, and state-panel variants, including selected, hover, keyboard focus, disabled, loading, empty, and error states. Use a ring or inset treatment for selection when avoiding border-width shifts is desirable.
6. Use 16px section headings, 14px ordinary body copy, and 12px metadata as the default hierarchy. Record exceptions for compact cards, hero content, and canvas labels.

## Browser validation still required

Compare all seven routes and all three Applications sub-tabs at 390px, 768px, 1280px, and 1536px viewport widths, including a short landscape viewport. Repeat with the sidebar open and closed. Check loaded, no-profile, no-roadmap, empty-result, loading, and error states; keyboard focus; long titles; Thai text; 200% zoom; and horizontal overflow. Confirm title baselines, card alignment, computed font/radius/border values, and actual contrast. Source differences alone cannot establish a pixel-perfect visual result.
