# Workspace consistency review

Reviewed 23 October 2026. This review follows the earlier `ui-consistency-audit.md` and the subsequent header, summary-card, icon, text-color, progress-bar, and hover changes. The earlier audit records the original UI; its findings are not a description of the current implementation.

## Scope and evidence

Reviewed the seven workspace routes: Overview, My Roadmap, Skill Profile, Market Insights, Applications, Progress, and Assessments. Compared the My Applications, Companies, and Recommendations sub-tabs, shared headers, summary cards, filter controls, principal actions, section headings, and full-page loading/error/empty states. Inspected related list, detail, sidebar, legend, and dialog code to identify exceptions.

This is a source-level review. No current browser session, computed-style inspection, or screenshot comparison was performed. Build and unit tests cannot establish visual alignment, contrast, text wrapping, touch behavior, or absence of clipping.

## Mismatches corrected in this pass

| Area | Previous difference | Result |
| --- | --- | --- |
| Page titles | Overview reached 30px at `lg`; other tabs used 28px at `xl` | All seven normal workspace titles use the shared 20 / 24 / 28px scale and tight line height |
| Context and subtitle styling | Overview had different spacing, tracking, and subtitle colors | Shared context, title, and description styles; each page retains its own content |
| Section headings | Overview and Progress activity/profile panels used 18-20px, other sections 16px | Comparable sections use 16px bold text with a 24px line height |
| Vertical rhythm | Overview increased page gaps at `sm`; Skill Profile reduced gaps below 960px height | Standard 20px main-section gaps; consistent 16px page bottom padding |
| Filters | Companies used 12px text; Applications used 14px; border and focus styling varied | Main select filters share 40px minimum height, 14px text, theme borders, and keyboard focus rings |
| Main actions | List actions used 36px / 12px; Add Application changed text size by breakpoint | Main actions share 40px minimum height, 14px semibold text, 16px icons, and focus/disabled styling |
| Header actions | Skill Profile used a 56px stacked icon action; Applications used a horizontal action | Shared horizontal outline-action styling; existing destinations and labels preserved |
| Dense labels | Company/recommendation metadata and Skill Profile/Assessments status text used 9-11px | These list-page labels use 12px text |
| Ordinary panel treatment | Blue/slate borders differed; Recommendations explanation panel had square corners | Corrected selected ordinary panels to theme borders and rounded corners |
| Chart padding | Market Insights chart used 24 / 32 / 40px padding compared with 16 / 20px elsewhere | Chart container uses the same ordinary-panel padding |
| Interview status | Summary icon was amber while the application status badge was purple | Summary uses the purple/info tone |
| Full-page states | Progress errors had no title/card; empty state, retries, and title sizes differed | Progress, Roadmap, Skill Profile, and Overview share full-page state framing and typography where applicable |
| Roadmap title collision | Desktop progress badge was absolutely positioned over the header area | Progress badge is in normal flow below the legend; centered canvas layout is preserved |

Shared styles live in `frontend/src/features/workspace/workspaceStyles.ts`. The normal five-tab header uses `WorkspacePageHeader`; Overview and Roadmap use the same typography styles in their specialized layouts.

## Confirmed shared summary-card behavior

- One `StatCard` implementation controls minimum height, padding, font family, label/value/detail sizes, corners, borders, hover highlighting, and keyboard focus for interactive cards.
- Labels, values, and details remain black, as requested. Icons retain their semantic colors. Progress fills and tracks inherit the icon tone.
- Completed, In progress, and Upcoming use the shared status-icon mapping. Application-specific statuses retain their own mapping.
- Null progress displays an empty track labeled as unavailable rather than reporting a zero score. Zero progress remains a valid 0% measurement.
- Skill Profile progress uses each skill count divided by total roadmap skills. Project counts remain separate supporting information.
- Three-, four-, and five-card groups use equal-width columns within their own group. Different column counts and nested panel gutters intentionally produce different absolute widths.
- Static cards retain their informational behavior; filter cards remain buttons with `aria-pressed`. Selection does not change border width or card dimensions.

## Deliberate hierarchy and remaining visual review

1. **Canvas density:** Roadmap nodes, legend, and canvas details still use compact typography, including 8-11px text. Enlarging those labels requires validating node dimensions, edge placement, and canvas zoom together. Their typography is an explicit exception to ordinary list-page metadata.
2. **Detail/dialog density:** Some application details, evidence forms, and assessment dialogs still have compact 9-11px annotations and contextual actions. This pass does not claim that every nested dialog has been migrated to the new ordinary-page scale. Check them with long content and 200% zoom before changing their geometry.
3. **Hero and card titles:** Overview's next-action hero is larger than a normal section heading; individual list-card titles remain 14px. These roles intentionally differ from 16px section headings and 20-28px page titles.
4. **Page composition:** Roadmap remains centered and fills the available canvas height; other pages scroll vertically. Overview retains its date and target-role content. Contextual utility buttons and sidebar navigation have separate size roles.
5. **Font loading:** No competing font-family overrides were found under `frontend/src`. Geist is imported globally; heading font aliases the sans font. The Thai fallback is declared but has no explicit font import, so actual Thai rendering needs browser verification.
6. **Theme behavior:** Existing hardcoded colors remain in some detail components, and summary text is explicitly black per the user's instruction. Full dark-theme parity and color contrast have not been verified.
7. **Native controls:** Select appearance can vary by browser and operating system even with shared CSS. Font metrics and dropdown menu rendering require a live browser check.

## Validation

- Production TypeScript/Vite build.
- Full frontend ESLint check.
- Existing frontend unit suite: 35 tests passed.
- `git diff --check`.

Browser acceptance checks still required: all seven routes and three Applications sub-tabs at approximately 390, 768, 1280, and 1536px widths; short landscape height; sidebar open/closed; long role and skill names; Thai text; keyboard focus; 200% zoom; and loading, error, empty, selected, and unavailable-data states. Verify actual title baselines, card heights, overflow, contrast, and progress-track rendering. No claim of pixel-perfect consistency is made without those checks.
