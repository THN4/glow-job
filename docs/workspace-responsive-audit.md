# Workspace responsive audit

Date: 23 October 2026. Branch: `fix/workspace-responsive`.

Scope: all six current workspace tabs, Applications sub-tabs (including Jobs for you and Career paths), the shared shell, headers, cards, filters, tables, details, and dialogs. Assessments is no longer a workspace tab; its old route redirects to Skill Profile.

This is a source-level audit. No current browser rendering or device screenshots were inspected. Findings distinguish confirmed CSS/structure behavior from layout risks that require a browser. No application code was changed in this pass.

## Highest-priority findings

### R1 — High: mobile and portrait-tablet users lose workspace navigation

Confirmed from source. `WorkspaceSidebar` starts hidden and only becomes visible through `sidebar-expanded`. The reopen button in `workspaceLayout.tsx` is also hidden outside that variant. No mobile drawer, bottom navigation, or alternate workspace menu is rendered.

The variant activates at either:

- Width at least 1280px, regardless of height/orientation.
- Landscape width at least 768px and height at least 480px.

Consequences: navigation is unavailable on a 390px-wide phone, 768 x 1024 portrait tablet, and 844 x 390 landscape phone. Rotating a tablet can remove navigation entirely rather than convert it to a drawer.

References: `frontend/src/index.css:445`, `frontend/src/features/workspace/components/WorkspaceSidebar.tsx:39`, `frontend/src/app/layouts/workspaceLayout.tsx:78`.

Recommended first fix: keep a navigation trigger available whenever the permanent sidebar is hidden, and open an accessible mobile drawer using the same navigation items.

### R2 — Medium: Applications selects a desktop table before its content area can fit it

Confirmed from CSS dimensions. The table replaces mobile cards at viewport width 1100px, but it has an 850px minimum width. With an expanded sidebar at 1100px, approximately 788px remain inside the workspace gutters. Horizontal table scrolling is therefore required immediately when desktop mode activates.

The horizontal scroll wrapper prevents this table from necessarily causing page overflow; the issue is that the responsive switch ignores the available panel width. The card version is hidden at the same viewport breakpoint.

References: `frontend/src/features/applications/components/my-applications/ApplicationsTable.tsx:11`, `frontend/src/features/applications/components/my-applications/MyApplicationsTab.tsx:66`.

Recommended fix: choose table/card mode by content-container width, or delay the table until the usable width is sufficient. Preserve the scroll wrapper for unusually wide content.

### R3 — Medium: page layouts respond to viewport width rather than remaining workspace width

Confirmed rule mismatch; the degree of crowding needs browser verification. Opening the sidebar consumes 24vw, subject to 240px minimum and 401px maximum width, without changing viewport breakpoints. For example, a 1024px landscape viewport has only about 730px of usable content, but still activates `lg` layouts.

Affected areas include:

- Skill Profile: three skill columns at `lg`, two-column expanded checklist content at `md`.
- Progress: two detail columns at `lg`, with a 280px minimum right column.
- Company and application details: two columns at `lg`, with 250px/260px minimum side columns.
- Applications filters and Overview hero details: multiple columns already at `sm`.

The same device in portrait can have substantially more usable content width while activating fewer viewport-based columns. Sidebar collapse also changes available space without switching layouts.

References: `frontend/src/features/skill-profile/pages/SkillProfilePage.tsx:187`, `frontend/src/features/roadmap/pages/ProgressPage.tsx:70`, `frontend/src/features/applications/components/companies/CompanyOpeningDetail.tsx:49`, `frontend/src/features/applications/components/shared/ApplicationDetailsPanel.tsx:91`.

Recommended fix: use container queries or shared minimum-card-width rules for content layouts. Do not force identical column counts on groups with different item counts.

### R4 — Medium: Companies filters and My Applications search compress earlier than other filters

Confirmed structural difference; actual truncation depends on text metrics. Companies places three `FilterSelect` controls in one row at `sm`. Their icons, labels, chevrons, gaps, and padding occupy fixed space; only the selected value truncates. Employment values can receive very little room, especially with the sidebar visible.

My Applications uses a search field plus two fixed 150px filters at `sm`. Jobs for you keeps two filters per row until `xl`, so comparable filter groups have different density at the same available width.

References: `frontend/src/features/applications/components/companies/CompaniesTab.tsx:54`, `frontend/src/features/applications/components/shared/FilterSelect.tsx:17`, `frontend/src/features/applications/components/my-applications/ApplicationToolbar.tsx:23`, `frontend/src/features/applications/components/recommendations/JobRecommendationsToolbar.tsx:38`.

Recommended fix: share a filter-group layout based on a minimum readable control width. Allow a search field to span a full row when space is constrained.

### R5 — High-priority browser check: Roadmap can lose its usable canvas height on short screens

Risk, not a reproduced clipping defect. Roadmap uniquely disables outer vertical scrolling and fills the viewport. Its header, legend, progress badge, rebuild button, and canvas toolbar do not shrink. Only the remaining canvas is flexible. Wrapped labels, a long role, 200% zoom, or a short landscape viewport can consume most or all of its usable height.

At 640px and above the canvas switches from a vertically scrollable stages list to the graph even on a short landscape phone. Height-aware spacing rules reduce margins, but there is no explicit fallback when the non-shrinking header and toolbar exceed the available height.

References: `frontend/src/app/layouts/workspaceLayout.tsx:91`, `frontend/src/features/roadmap/components/RoadmapHeader.tsx:15`, `frontend/src/features/roadmap/components/RoadmapCanvas.tsx:429`, `frontend/src/features/roadmap/components/RoadmapCanvas.tsx:496`, `frontend/src/features/roadmap/components/RoadmapCanvas.tsx:557`.

Recommended fix: define a minimum usable canvas height and a short-height fallback, such as allowing outer scrolling or retaining list mode on short landscape devices. Keep the existing fit/zoom behavior.

## Additional inconsistencies and checks

| Area | Observation | Assessment |
| --- | --- | --- |
| Shared headers | Text uses `flex-1 min-w-0`; actions do not shrink. `flex-wrap` alone does not guarantee that actions move below text at phone widths | Test long roles and header actions; consider an explicit narrow-screen stacked layout |
| Overview milestones | Below 640px the timeline has a 700px minimum width and local horizontal scrolling; at `sm` it compresses into the available space | Intentional timeline behavior, but unlike the Roadmap list fallback; verify discoverability and long labels |
| Market Insights | Chart labels/value columns jump from 80/48px to 144/64px at `sm`, regardless of sidebar space | Verify actual bar width and label wrapping at landscape tablet sizes |
| Career paths | Explanation panel becomes sticky at `lg`, including short landscape screens | Verify it does not obscure cards or consume excessive visible height; consider a height/container condition |
| Roadmap details | Fixed overlay below 1200px; 304px inline panel at 1200px and above | Different from Radix dialogs elsewhere. Check usable canvas width, keyboard focus, Escape, and background interaction |
| Add Application | Two-column form at 640px; job description has 360px minimum height and a separate scroll region in preview mode | Verify narrow tablet forms and nested scrolling; height is not adaptive like viewport-capped dialogs |
| Long skill names | Title/icon and non-shrinking status badge share a non-wrapping row; titles have no explicit anywhere-wrap rule | Test long unbroken names/URLs at 320px and in narrow three-column cards |

References: `WorkspacePageHeader.tsx:19`; `OverviewPage.tsx:125`; `MarketInsightsPage.tsx:79`; `CareerRecommendationsTab.tsx:69`; `RoadmapPage.tsx:146`; `frontend/src/index.css:334`; `AddApplicationForm.tsx:239`; `SkillProfilePage.tsx:206`. Component filenames here are under their feature directories in `frontend/src/features`.

## Per-tab coverage

| Tab | Existing responsive behavior | Main follow-up |
| --- | --- | --- |
| Overview | Shared summary grids; local timeline scroll; three-column hero details at `sm` | Timeline compression and hero density after sidebar expansion |
| My Roadmap | Phone stages list; graph at 640px; detail overlay below 1200px; fit/zoom observes resizing | Short-height canvas and detail-overlay behavior |
| Skill Profile | Summary grid; skill grid 1/2/3 columns; in-progress skill spans the row | Container-based columns, long titles, expanded checklist layout |
| Market Insights | Three summary columns at `lg`; chart uses fixed label/value columns | Container-based chart sizing and long career names |
| Applications | Horizontal tab navigation; cards/table at 1100px; custom filters; Jobs for you and Career paths grids | Table threshold, filter compression, detail columns, sticky explanation panel |
| Progress | Shared summary grids; detail columns at `lg`; viewport-capped re-plan dialog | Sidebar-aware detail columns and phone header/actions |

## Approximate available content width

Calculated from the current CSS with a 16px root font, sidebar open, and before scrollbars. These are arithmetic estimates, not browser measurements.

| Viewport | Permanent sidebar | Approximate content width |
| --- | --- | --- |
| 390 x 844 | Hidden | 358px |
| 640 x 360 | Hidden | 592px |
| 768 x 1024 | Hidden | 720px |
| 844 x 390 | Hidden | 796px |
| 1024 x 768 | Visible | 730px |
| 1100 x 800 | Visible | 788px |
| 1280 x 800 | Visible | 925px |
| 1536 x 864 | Visible | 1119px |

## Already consistent / should be retained

- The same workspace gutters and maximum width apply to all tabs.
- Summary cards share typography, padding, minimum height, hover behavior, and grid implementation. Different three/four/five-column maximums reflect different item counts.
- Application table/card visibility uses complementary 1100px rules, so both are not intentionally displayed together.
- The canvas observes size changes and has fit/zoom helpers; it does not simply assume a fixed desktop graph size.
- Re-plan, Evidence, and matching-information dialogs use viewport-height caps and internal scrolling. FilterSelect limits popup width and height to the available viewport.
- Most card groups can stack to one column; pagination and the Applications tab/action strip allow wrapping or local scrolling.

## Suggested implementation order

1. Restore workspace navigation at every viewport and orientation.
2. Establish shared content-width/container-query rules, then fix the Applications table threshold and filters.
3. Validate Roadmap on short landscape screens and implement a safe height fallback.
4. Refine headers, details, sticky panels, long-text wrapping, and touch controls using browser results.

Browser acceptance matrix: 320/390/640/768/1024/1100/1200/1280/1536px widths, portrait and landscape, short heights, sidebar open/closed, long role/skill/company names, Thai text, 200% zoom, keyboard navigation, and loading/error/empty states. Check page-level horizontal overflow separately from intentional table/timeline/canvas scrolling.

No build or tests were rerun for this documentation-only audit. Existing unit tests do not verify responsive rendering.
