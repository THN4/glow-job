# CV analysis adapter

`analyzeCv(file, { onProgress, signal })` in `api.ts` is the only data entry point for CV analysis.

The current demo reads the selected file bytes, then prepares and validates `MOCK_PROFILE` in five tasks. It does not upload the file, extract its contents, or call an AI service. The analysis and review pages identify the profile as sample data.

Technical skills use `{ name, level }` objects. `level` is `beginner`, `intermediate`, `advanced`, `expert`, `unknown`, or `null` when the user has not selected a level. New skills start as `null`; the reference demo includes a few sample ratings. Project and experience technology lists remain plain strings. The review card displays compact colored tags: beginner green, intermediate yellow, advanced orange, expert red, unknown soft grey, and unset neutral. Four subtle strength bars and accessible level descriptions supplement the colors; Unknown has no filled bars. Dropdowns and delete buttons remain in the edit dialogs, where colors update with the draft and only persist on Save.

The review page keeps its extraction warning and has no per-section confirmation checkboxes. Every existing technical skill must have a selected level before Review can continue. Explicitly selecting Unknown is valid; leaving Select level (`null`) is not. Null levels are allowed while importing or editing drafts, but never satisfy the navigation gate. Drafts can be saved and completed later. An empty skill list does not require inventing a skill.

Clicking Review Continue with missing skill levels scrolls to and highlights the Technical Skills block on the page. It does not open the editor; the user can choose Edit to make changes. Valid Review Continue marks the whole profile as `user_confirmed`. Changed profile content invalidates that acknowledgement; canceled or unchanged edits preserve it. Completed-step navigation still requires a reviewed profile with valid skill levels. Replacing a CV clears the acknowledgement.

Career Goal Continue remains clickable when incomplete, but advancement is blocked: the first incomplete role or deadline block is highlighted and scrolled into view with an inline message. Invalid profile-editor saves focus and scroll to the first invalid input. Scrolling respects reduced-motion preferences.

Each task emits `loading` before its operation and `done` only after it succeeds. Demo tasks stay visible for at least 1.2 seconds each (about six seconds total), configured by `DEMO_ANALYSIS_STEP_MIN_MS` in `analysisConstants.ts`. A slower operation must still finish before the task completes. A failed operation emits `error` immediately; later tasks stay pending. Canceling clears the current presentation delay. A rendering yield lets the current task state paint before synchronous validation.

To connect a backend, replace the demo operations and presentation delay in `analyzeCv` with the upload/job API and map actual server events to the typed `AnalysisTask` and `AnalysisStatus` values in `analysisTypes.ts`. Forward the `AbortSignal` to requests, stop job polling or streaming on cancellation, and only return a validated `Profile` after the server completes. Do not infer individual task completion from elapsed time or from the upload request finishing.

`OnboardingFlow` owns the active operation and cancels it when returning to upload or unmounting. Canceled results cannot overwrite the profile or navigate to Review. Retry starts with fresh task states. Selecting a different CV clears the previous completion history.

While processing, footer actions are hidden. Successful processing stays on the analysis screen with all five tasks complete. The profile is saved, the busy state ends, and Back and Continue buttons appear. Only clicking Continue advances to Review. Reopening an already processed CV shows this completed state without replacing profile edits or rerunning the demo. If processing fails, recovery actions allow returning to upload, retrying, or entering information manually.
