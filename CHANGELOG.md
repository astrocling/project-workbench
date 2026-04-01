# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]
### Removed

- **Projects — At Risk filter**: The "At Risk" tab on `/projects` and `GET /api/projects/at-risk` were removed. Portfolio risk and recovery signals remain on the PM, PGM, and CAD dashboards.

### Added

- **Documentation — Projects list**: User Guide and Technical Reference describe `/projects` (filters, sorting, pagination, My Projects and Person linking, portfolio metrics on dashboards). Technical Reference adds a **Projects list page** section with implementation details (`getDashboardContext`, query params, Prisma `select`, pagination behavior for key-role sorts). README links to this in the Technical Reference blurb.

- **CDA — Report hours only**: Documented in the User Guide and Technical Reference. Project setting `cdaReportHoursOnly` hides budget-dollar columns on the CDA Overall row in status copy, CDA status report preview/PDF, and locks the choice in each report snapshot at creation time.

- **PM / PGM / CAD dashboards — Request column**: The projects table includes a **Request** column (sortable) that shows when at least one **visible** project assignment has **Ready** turned on in the Resourcing tab **Planned** grid (stored in `ReadyForFloatUpdate`). Amber dot = open request; muted dot = none. Toggling Ready revalidates portfolio dashboard cache so the indicator updates promptly.
- **PM / PGM / CAD dashboards — 1-wk recovery column**: The projects table on each dashboard includes a **1-wk recovery** column showing revenue recovery % for the **most recent completed week** (the same week as the portfolio **This week** revenue recovery card). The existing **4-wk recovery** column still shows recovery over the rolling previous four completed weeks. Both columns are sortable.
- **Split-week actual hours**: For weeks that span two calendar months (Monday–Sunday across a month boundary), actual hours can be recorded **per calendar month** so CDA monthly actuals and rollups stay correct. The Resourcing **Actual** grid shows two sub-cells (with month labels) for those weeks; hours are stored in `ActualHoursMonthSplit` and must be in quarter-hour increments. Legacy rows can be backfilled with `npm run migrate:split-week-actuals` (see Technical documentation). The CDA tab derives month-to-date actuals from these splits plus single-month weeks.

### Changed
- **Resourcing — split-week Actuals**: For weeks that span two months, the **first** month’s half becomes editable once that calendar month has ended (UTC), so you can enter December’s share during an in-progress December–January week. The **second** month’s half still unlocks only after the week is completed (same as other Actual cells).

### Fixed
- **Resourcing grids**: The final (rightmost) week column is no longer clipped when the grid is scrolled fully to the right.

## [0.2.6] - 2026-03-18

### Added

- **Timeline bars — multiple colors**: Each timeline bar can have a color (preset palette: Blue, Green, Amber, Teal, Slate, Violet). The Timeline tab Add/Edit bar forms include a Color dropdown and swatch buttons. Color is stored per bar and shown in the Timeline tab, status report preview, and PDF export. Bars without a color use the default blue.

### Changed

- **Timeline page and status report timeline — aligned layout**: The timeline on the project Timeline tab and the timeline on status reports (preview and PDF) now use the same layout. Both use **week-proportional** month columns (via `getWeeksInMonthsForRange()` in `lib/monthUtils.ts`) so bar positions align with month boundaries. Bars use full row height with top/bottom padding (no lane stacking); overlapping bars in the same row overlap visually. On the status report, the timeline shows only the “previous months” range (e.g. 1–4 months before the report date): bars are **clipped** to that range so position and width match the shortened axis (`getVisibleBarSegments()` in `StatusReportView.tsx` and `StatusReportDocument.tsx`). Status report row height is compact (20px) to limit vertical space.

## [0.2.5] - 2026-03-18

### Added

- **Sync actuals from Float (past weeks)**: New action to copy Float scheduled hours into Weekly Actuals for completed weeks only, so revenue recovery (plan vs actual) is correct when past weeks had Float data but no manual actuals. Available on the project Edit page via “Sync actuals from Float (past weeks)” with confirmation. By default existing actuals are not overwritten; use `POST /api/projects/[id]/sync-actuals-from-float?overwrite=true` to replace them with Float values.
- **Sync plan from Float (past weeks)**: New action to copy Float scheduled hours into the Project Plan (PlannedHours) for completed weeks only, so the plan grid and revenue recovery forecast show the same values as the Float Actuals table for past weeks. Available on the project Edit page via “Sync plan from Float (past weeks)” with confirmation.

### Fixed

- **Status report timeline — bar clipping and lanes**: The status report timeline (preview and PDF) now matches the main Timeline tab: bars are clipped to the visible “previous months” range so they do not overlap. Position and width use only the visible segment of each bar, and lanes are assigned from those visible segments so overlapping bars in the visible window are stacked in separate lanes. Implemented in `StatusReportView.tsx` and `StatusReportDocument.tsx` via `getVisibleBarSegments()` and the shared `assignLanes()` from `lib/timelineLanes.ts`.

## [0.2.4] - 2026-03-18

### Changed

- **Resourcing tab — no “load more weeks” clicks**: The Resourcing tab now loads the full project week range by default (project start → project end). This removes the need to click “Load earlier weeks” / “Load later weeks” to see the full grid.
- **Status report typography**: Updated the Status Report HTML/PDF view fonts for improved readability; preview and exported PDF remain identical because they share the same `StatusReportView`.
- **Status report preview + PDF — larger default rendering**: The status report preview now auto-scales to a larger, presentation-friendly size without clipping, and client-side PDF export generates a larger default page size (while preserving pixel-perfect match to the preview content).

## [0.2.3] - 2026-03-17

### Added

- **Projects list — icon actions and confirmations**: The Projects list Actions column now uses icon buttons: **Edit** (pencil), **Backfill** (refresh), and **Delete** (trash). Users with edit permission see Edit and Backfill; Admins also see Delete. **Delete** opens a confirmation modal: you must type the project name to confirm before the project and all its data are permanently removed. **Backfill** opens a confirmation dialog that explains it will update the project’s Float scheduled hours from import data (overwriting existing float hours for that project) and notes that this isn’t a common action—if you aren’t doing it on purpose (e.g. to fix missing historical data after a bug), it’s best to cancel.
- **Float import — integration test**: An integration test (`__tests__/api/admin/float-import-cleanup.test.ts`) verifies that after importing a CSV that omits a person from a project, that person’s future Float scheduled hours are deleted while their past weeks and assignment remain. Requires `DATABASE_URL` and a reachable database.

### Changed

- **Float import — preserve past weeks, clear future for removed people**: The import no longer overwrites or deletes past weeks’ Float scheduled hours, so revenue recovery and historical actuals are preserved when the Float export only covers a limited window (e.g. today through one year out). Only current and future weeks are updated from the CSV. If a person no longer appears on a project in the export, only their **future** Float scheduled hours for that project are removed; past weeks and their project assignment are left unchanged (you can remove them from the project manually in Settings → Assignments if desired).

## [0.2.2] - 2026-03-16

### Changed

- **Budget tab — negative values for contracts**: When adding contract lines (e.g. SOW, CO, Other), hours and dollars now accept negative numbers so you can model change orders (COs) that remove budget or hours. The API and form no longer restrict values to non-negative; low must still be ≤ high.

## [0.2.1] - 2026-03-13

### Fixed

- **Float import — actuals for removed people (hotfix)**: When a person was removed from a project in Float, the float import only upserted rows present in the CSV and never cleared existing `FloatScheduledHours`. Removed people’s old hours stayed in the database, so the Resourcing tab showed incorrect “float actuals” for them. The import now replaces float data per project: for each project that has data in the import, all existing `FloatScheduledHours` for that project are deleted before upserting from the CSV, so the export is the source of truth and removed people no longer have stale float hours.

## [0.2.0] - 2025-03-13

### Added

- **Dashboard projects table — status report indicator**: The projects table on the PM, PGM, and CAD dashboards now includes a Status column after Actuals. It shows the overall RAG (Red, Amber, Green) from each project’s most recent status report when that report is within the last 2 weeks. If the most recent report is older than 2 weeks, a blue indicator is shown (so you can tell reports exist but are stale). If there are no status reports, the indicator is gray. The Status column is sortable like the other columns.
- **Status report view — HTML rendering**: Status reports can be viewed in the browser as HTML instead of requiring PDF generation. This reduces server load and improves UX when opening or previewing a report; the same content is rendered in a dedicated view and in the preview modal.
- **Status report present mode and shareable links**: Status report view page supports a present mode for full-screen presentation. Reports have shareable links so you can open or present a specific report in a new tab. Icon styling on the status report page was updated for clarity and consistency.
- **Status report list — updated date and pagination**: The status reports table on the project Status Reports tab now shows an "Updated" date for each report and includes pagination so long lists are easier to browse.

### Changed

- **Status report slide layout**: The status report slide (PDF and HTML) layout was cleaned up for a clearer presentation. Layout and styling changes improve readability and visual hierarchy.
- **Status report notes formatting**: Meeting notes and other text areas in status reports now preserve formatting (e.g. line breaks and structure) when viewing and in the exported PDF.
- **Overview and resourcing performance**: Overview and resourcing pages received performance improvements for faster load and smoother interaction.
- **Project overview**: Project overview layout and content were updated for clarity and usability.
- **Helper text**: Helper text and labels were adjusted across the app for consistency and clarity.

### Fixed

- **Status report PDF export**: PDF export for status reports now generates and downloads correctly. Export uses the same data and layout as the HTML view and preview.
- **Build**: Resolved build errors and compatibility issues.

## [0.1.9] - 2025-03-11

### Added

- **Resourcing grid — hide rows (Settings → Assignments)**: You can hide individual people from the project Resourcing tab (Planned, Actual, Float grids) without removing them from the project. In project Settings → Assignments, each assignment has a "Hidden from grid" toggle. Hidden people no longer appear in the Resourcing tab; budget, revenue, and other features still include them. When a hidden person has hours in upcoming weeks (planned or Float), a "Has upcoming hours" indicator appears in Assignments and on the project Overview. The Overview shows an amber alert (like the roles-without-rate warning) listing those people with a link to manage them in Settings → Assignments.
- **Resourcing grids — horizontal scroll**: When the week columns overflow, a toolbar above the grids shows "Scroll left" and "Scroll right" buttons so users with a mouse (without horizontal scroll) can move across the table easily. Buttons are shown only when content overflows and are disabled at the start or end of scroll. Holding Shift and using the mouse wheel also scrolls the grids horizontally. Native scrollbar and trackpad two-finger horizontal scroll are unchanged.
- **Status report timeline — previous months**: When creating a status report (Standard or Milestones), you can choose how many months before the report date to show on the timeline: 1–4. A "Previous months on timeline" dropdown appears in the form; the value is stored in the report snapshot and shown as read-only when editing. The timeline in the PDF/preview is limited to that range (e.g. 2 = at most two months before the report date).
- **Dashboard projects table sorting**: The projects tables on the PM, PGM, and CAD dashboards are now sortable. Default sort is alphabetical by client (A–Z). Column headers (Project, Client, Budget burn, Buffer, 4‑wk recovery, Actuals) are clickable; each click toggles ascending/descending and the current sort is shown with an arrow. Sort and direction are reflected in the URL (`?sort=...&dir=...`); the client filter is preserved when changing sort.
- **Dashboard client filter**: PM, PGM, and CAD dashboards now include a client filter dropdown. The dropdown lists only clients that appear in that dashboard's scope (projects where you are PM, PGM, or CAD). Choosing a client filters metrics and the project table to that client; "All clients" clears the filter. The filter is driven by the `?client=` URL param. Invalid or stale client params redirect to the dashboard base URL so the view defaults to "All clients" on load and when returning to the page. A Client column was added to each dashboard's project table.
- **Account page and change password**: New Account page (`/account`) lets signed-in users change their password. Form requires current password, new password, and confirmation; new password must be at least 6 characters. Sidebar includes an "Account" link. API `POST /api/account/change-password` updates the password for the current user after verifying the current password.

### Changed

- **Resourcing grid roll-ups include hidden people**: When a person is hidden from the Resourcing tab (Settings → Assignments), their planned, actual, and float hours are still included in the footer totals so roll-ups reflect the full project.
- **Buffer % color coding**: Buffer percentages now use updated color rules everywhere they appear (PM/PGM/CAD dashboards, project Overview, Budget tab). Values under 7% show orange; negative values (over budget) show red; 7% and above show green. The "low buffer" warning threshold was updated from 5% to 7% to match (Overview and Budget tab messages).
- **Status reports — auto-prefill from previous**: When you create a new report, the form now opens with RAG values, explanations, completed/upcoming/risks text, and meeting notes prefilled from the most recent report on or before the selected report date. The "Pre-fill from previous report" button was removed. The API now returns the previous report using "on or before" the date so that creating a second report on the same day correctly prefills from the report you just saved.

### Fixed

- **Sign out**: Sign out now correctly redirects to the app login page instead of an external auth URL. Sidebar uses client-side `signOut({ callbackUrl: "/login" })`; changelog page sign-out link includes `callbackUrl=/login`.
- **Login after sign-in**: After successful sign-in, the login page now performs a full page navigation so the new session is recognized and the user is taken to the dashboard instead of remaining on the login form.
- **Build errors**: Resolved build errors in PM, PGM, and CAD dashboard pages and in the account change-password API.

## [0.1.8] - 2025-03-10

### Added

- **App layout with sidebar**: A shared layout for the main app wraps Projects, project detail/edit/new, and all dashboards. It includes a sticky left sidebar (AppSidebar), a top header with "Project Workbench" and the as-of date, and a main content area. Routes live under the `(app)` route group so the URL paths are unchanged (e.g. `/projects`, `/pm-dashboard`).
- **AppSidebar**: New sidebar component with navigation links (Projects, PM Dashboard, PGM Dashboard, CAD Dashboard, Admin when permitted, Changelog), theme toggle, sign out, and the current user’s display name. For users who are PM on any project, an "Open my projects" control opens each of those project overview pages in a new browser tab.
- **PM Dashboard** (`/pm-dashboard`): Dedicated page for projects where you are Project Manager. Shows portfolio-level metrics (Portfolio Value, Total Active Projects, Active CDA’s, Active Non-CDA), a table of those projects with Budget burn %, Buffer %, 4‑wk recovery %, and Actuals status (up-to-date / 1 week behind / more than 1 week behind). When revenue recovery data exists, shows three cards: recovery to date, this week, and previous 4 weeks. Displays an "Actuals Stale" banner when any project has completed weeks with planned hours but no actuals.
- **PGM Dashboard** (`/pgm-dashboard`): Same structure as PM Dashboard for projects where you are Program Manager (PGM). Portfolio metrics and project table are scoped to your PGM projects; revenue recovery and actuals-stale messaging apply to that set.
- **CAD Dashboard** (`/cad-dashboard`): Same structure for projects where you are Client Account Director (CAD). Portfolio metrics and project table are scoped to your CAD projects.
- **My PM slugs API**: New `GET /api/projects/my-pm-slugs` returns the list of project slugs for projects where the current user is PM. Used by the sidebar "Open my projects" feature; layout can pass this from server-side to avoid an extra client request.
- **Dashboard context**: `getDashboardContext(session)` resolves the current user’s Person id and PM project slugs (cached per user). Used by the app layout and by PM/PGM/CAD dashboard pages so personId and pmSlugs are available without duplicate lookups.
- **Portfolio metrics**: Cached helpers `getCachedPortfolioMetricsForPm`, `getCachedPortfolioMetricsForPgm`, and `getCachedPortfolioMetricsForCad` return portfolio value, active project counts, per-project table rows (burn, buffer, 4‑wk recovery, actuals status), and optional revenue recovery aggregates (to date, this week, previous 4 weeks). Shared `formatPortfolioDollars` for consistent currency display.
- **Revenue recovery shared UI**: `RevenueRecoveryShared` exports `RecoveryCardContent`, `formatWeekLabelShort`, and color/health helpers (`getRecoveryColorClass`, `getBurnHealthClass`, `getBufferHealthClass`) so PM, PGM, and CAD dashboards share the same card layout and styling for recovery and burn/buffer indicators.
- **Descriptive browser tab titles**: Each page now shows a specific title in the browser tab (e.g. "Projects | Project Workbench", "Project Name | Project Workbench" for project detail, "Edit: Project Name | Project Workbench" for project settings, "Sign in | Project Workbench", and section-specific titles for Admin, Changelog, and dashboards).
- **Resourcing API**: New `GET /api/projects/[id]/resourcing` returns all data for the Resourcing tab (project, assignments, planned/actual/float hours, ready-for-float, cell comments) in one request instead of seven.

### Changed

- **Projects and dashboards under app layout**: Projects list (`/projects`), project detail (`/projects/[slug]`), project edit and new project, and the three dashboards now render inside the shared `(app)` layout (sidebar + header + main). The previous full-page projects view (with its own header and chrome) was removed in favor of this single app shell.
- **Single dashboard routes**: Removed duplicate root-level dashboard pages (`app/cad-dashboard`, `app/pm-dashboard`, `app/pgm-dashboard`) that conflicted with the `(app)` versions. Only the dashboard pages under `app/(app)/` remain, so `/pm-dashboard`, `/pgm-dashboard`, and `/cad-dashboard` each resolve to one page with the sidebar layout.
- **Resourcing tab**: Uses the single resourcing API so opening the tab triggers one request instead of seven.
- **Budget, Status Reports, and CDA tabs**: The project detail page now passes full budget data (budget lines, rollups, people summary) to these tabs so they can show data immediately without an extra budget API call on first load.
- **At-risk filter**: The at-risk projects response is cached for 60 seconds so repeated visits or refreshes reuse the result.
- **Edit project (Settings)**: The edit layout now fetches eligible key-role people on the server and passes them via context, so the Settings page no longer requests them on mount.
- **Project detail performance**: The server now passes initial project data, assignments, budget status (last week with actuals, missing actuals, rollups), and missing-rate role names to the client. Overview and the header use this data on first load instead of firing multiple overlapping API requests, reducing load time and server CPU.
- **Budget API**: Project role rates are loaded in a single query and used in memory instead of one query per assignment (removes N+1).
- **Project ID resolution**: `getProjectId` is cached for 30 seconds so parallel project-scoped API calls (project, assignments, rates, budget, etc.) share one DB lookup.
- **Project and metadata**: Project detail page and `generateMetadata` use a shared cached project lookup (`getCachedProjectBySlugOrId`) so metadata and page body do not duplicate the project query.
- **Lazy tab content**: Resourcing, Budget, Timeline, Status Reports, and CDA tabs are loaded with `next/dynamic`; each tab’s JavaScript and data load only when that tab is selected.
- **Edit project (Settings)**: The edit layout fetches the project on the server and provides it via context. The client no longer fetches the project on mount and only requests eligible-key-roles when needed.

### Fixed

- **Resourcing grids**: Fixed error when loading project detail with cached project data (`ph.weekStartDate.toISOString is not a function`). Cached or serialized date fields are now handled whether they are `Date` objects or ISO date strings.

## [0.1.7] - 2025-03-09

### Added

- **Status report text areas — links**: Completed activities, upcoming activities, risks/issues/decisions, meeting notes, and RAG explanation fields now support links in the exported PDF. Paste a URL (e.g. `https://…`) and it becomes a clickable link; use `[link text](url)` for custom link text. Input remains plain text in the form; parsing happens at render time. A short hint under Completed activities explains the syntax.
- **Resourcing grids — keyboard navigation**: In the Project Planning and Weekly Actuals grids, Arrow Up and Arrow Down move focus to the previous or next row in the same week column (Excel-style). Tab still moves across columns; the cell comment button is no longer in the tab order so Tab goes directly to the next cell.

### Changed

### Fixed

- **Project key roles (PM, PGM, CAD)**: Users with a key role (Project Manager, Program Manager, or Client Account Director) now always appear in the Key roles dropdown in project Settings, even when they have no matching Person record by email or exact name. Previously, only users whose email or full name matched an existing Person could be selected; others (e.g. different name format or nickname) were missing. The API now creates a Person for any key-role user who does not match an existing one so they can be assigned to projects.
- **Rates page — scroll no longer changes values**: Scrolling over the bill rate inputs on the Rates tab in project Settings no longer accidentally changes the numbers. The inputs now blur on wheel so the page scrolls instead of incrementing or decrementing the value.

## [0.1.6] - 2025-03-06

### Changed

- **CDA hours remaining**: Calculation updated for greater accuracy (hours per month remaining and related CDA balance logic).

## [0.1.5] - 2025-03-05

### Added

- **Search crawler blocking**: `robots.txt` and related config now disallow all crawlers so the internal app is not indexed by search engines.
- **Status Reports tab**: New project tab to create, edit, delete, preview, and export status reports. Reports are listed by report date (newest first). "New report" opens a form; existing reports can be edited, previewed in a modal, or exported as PDF.
- **Report creation and variations**: When creating a report, you choose a report date and variation: **Standard** (timeline + project budget), **Milestones** (fixed fee, no budget — UI not yet available), or **CDA** (monthly / project CDA budgets). Optional "Copy from previous report" pre-fills completed activities, upcoming activities, risks/issues/decisions, and RAG values from the most recent report before the selected date.
- **Report content**: Each report has completed activities, upcoming activities, and risks/issues/decisions (plain text; first 5 items per section appear on the PDF). Optional meeting notes. RAG status for Overall, Scope, Schedule, and Budget (Red / Amber / Green) with optional explanation fields.
- **Status report summary (on tab)**: Summary table shows estimated budget (low/high), $ spent, $ remaining, budgeted/actual/remaining hours, and a "% Budget used (high est.)" donut chart. Copy-to-clipboard for the summary table. When the project has CDA enabled, the tab also shows CDA milestones (with "On status report" indicator for the first six incomplete milestones) and optional CDA donut chart(s) with "Copy for status report" table for pasting into external documents.
- **Status report PDF export**: Export any report as a 16:9 PDF slide. The PDF includes: biographical block (project name, client, reporting period; client sponsor(s), other contact, key staff from project Settings); RAG block (Overall, Scope, Schedule, Budget with explanations); three-column section for completed activities, upcoming activities, and risks/issues/decisions; for Standard/Milestones, a timeline section (month strip, bars, markers, and report-date line) when the project has timeline bars; budget summary table and burn donut (Standard/Milestones) or CDA section (CDA variation); brand footer. Filename is `status-report-{date}.pdf`.
- **Status report PDF preview**: In-browser preview modal loads the same data as the PDF and renders it with the same layout so you can verify content before exporting.
- **Status report snapshot**: When a new report is created, a snapshot of the reporting period, budget rollups/charts, CDA data (if CDA), and timeline (bars and markers) is stored with the report. Viewing or exporting always uses this snapshot, so later edits to the project (hours, dates, timeline, milestones) do not change existing reports.
- **Status report edit lock**: When editing a report, the report date is read-only and not sent to the API. Reporting period, financial charts, CDA data, and timeline remain fixed to the values at report creation; only narrative and RAG fields can be updated.
- **Actuals stale guard**: Creating a new status report is blocked when the project has missing actuals (completed weeks with planned hours but no actuals). The "New report" button is disabled and the create API returns 400 with a message to update hours in the Resourcing tab first.
- **Timeline tab**: New project tab showing a high-level timeline driven by project start and end dates (set in Settings). Displays a month strip and up to four rows of horizontal bars plus optional markers. If the project has no start/end dates, the tab prompts you to set them in Settings.
- **Timeline bars**: Add, edit, and delete timeline bars. Each bar has a label, start date, end date, and row index (1–4). Bars are rendered as horizontal spans with labels; same layout and colors (month header, bar fill) as in the status report PDF.
- **Timeline markers**: Add, edit, and delete timeline markers. Each marker has a shape (Badge Alert, Thumbs Up, Trending Up/Down, Rocket, Pencil Ruler, Pin), label, date, and row (1–4). Shapes use Lucide icons in the UI and matching vector paths in the status report PDF. Markers appear on the timeline with a vertical line and label pill.
- **Timeline "report date" line**: When the timeline is used in a status report context (e.g. preview or PDF), a vertical line can show "Report date" at the report date; otherwise the timeline shows "Today" at the current date.
- **Timeline in status reports**: For Standard and Milestones reports, the timeline (bars and markers) is included in the PDF from the report snapshot. CDA reports omit the timeline section. Timeline data is locked at report creation so later changes to bars/markers do not alter existing reports.
- **Project contact fields for status reports**: In Settings (Project details), optional fields for the status report biographical block: Client sponsor, Client sponsor 2, Other contact, Key staff name. These appear on status report PDFs when set.

### Changed

- **CDA — hours per month remaining**: The value is now (total remaining hours in the project ÷ number of months remaining). Remaining hours = total planned − total actuals to date; months remaining = current month plus all future months. The value updates as you add or edit hours.
- **Roles without rates alert**: The warning that some roles on the project have no bill rate set now appears on Overview, Resourcing, Budget, Rates, CDA, and Status Reports tabs (previously only on Rates). On tabs other than Rates, the message includes a link to the Rates section in Settings to add rates.
- **Status report PDF**: Export is rendered client-side (instead of server-side) to reduce server load; the download button uses improved filename handling.
- **CDA tab**: Tabbed sub-navigation (Budget | Milestones) for switching between CDA budget view and the milestones list.
- **CDA milestones**: Report dates on milestones are now optional for flexibility.
- **Settings**: Rates and Assignments are now separate sections within the project Settings page (alongside Details, Links, Key roles, Resourcing).

### Fixed

## [0.1.4] - 2025-03-03

### Added

- **Status Reports tab**: New project tab with a summary table of estimated budget (high/low), $ spent, $ remaining, budgeted/actual/remaining hours, and a % budget used (high est.) circle chart. Copy table and copy chart buttons support pasting into status reports (e.g. Word/Google Docs). Tab is available from project detail navigation.
- **CDA tab — copy for status report**: On the CDA tab, a "Copy for status report" section with an overall summary table (Budget $ and Hours: Planned, Actuals, Remaining), copy-table and copy-chart actions for the total contract hours burned donut, and per-month status report tables with copy-table and copy-chart for the selected month's burn chart. Tables use brand styling and format numbers for report paste (e.g. two decimals).

### Changed

- **Roles without rates alert**: The warning that some roles on the project have no bill rate set now appears on Overview, Resourcing, Budget, Rates, CDA, and Status Reports tabs (previously only on Rates). On tabs other than Rates, the message includes a link to the Rates tab to add rates.
- **CDA / Status report styling**: Overall summary table and copyable sections use consistent styling and brand colors for status-report copy.

## [0.1.3] - 2025-03-02

### Added

- **CDA tab**: New project tab for monthly planned vs. month-to-date actuals. View and edit planned and MTD actual hours by month (0.25-hour increments) over the project date range, with charts and persistent storage. Available on project detail, project settings (edit), and new-project flows.

### Changed

### Fixed

- **Float last updated** on the projects list now shows in your local timezone. Previously it was rendered on the server and showed server time (e.g. UTC) in production; it now uses a client-side formatter so it matches the time shown on individual project pages and your local clock.

## [0.1.2] - 2025-02-27

### Added

- Cell comments on resourcing grids: add and edit comments on individual Planned and Actual grid cells to capture notes and context.
- Loading skeletons for the app shell and projects list to improve perceived performance while data loads.
- Projects page: default sort by client name (A–Z); all columns (Name, Client, Status, PMs, PGM, CAD) are sortable via column headers with toggle for ascending/descending.

### Changed

- Settings (project edit) page: reorganized into sections (Project details, External links, Key roles, Resourcing, Actions) with in-page navigation, sticky action bar, 2-column grids for dates and links, and consistent design tokens for dark mode.
- Buttons: primary and secondary buttons (including Cancel and New Project links) now use centered text for consistent appearance.
- Float import (Admin): reduced database load and faster imports by batching reads (roles, persons, projects in one round-trip each), batching assignment upserts in a single transaction, and bulk upserting Float scheduled hours in chunks via raw SQL instead of per-row queries. Same CSV input and data semantics; new people and unknown roles unchanged.
- Projects page: last Float import time is now cached (60s revalidate) and loaded in parallel with the project list to reduce wait and improve first contentful paint.

## [0.1.1] - 2025-02-26

### Added

- Metric and float links on projects.
- Speed and analytics insights (Vercel).
- Ability to delete lines from contracts in the budget tab.

### Changed

- End dates are now mandatory.
- Grids locked to 0.25 hour intervals.
- Rate card: value changes require typing a value (hours selector removed).
- Required fields enforced when adding contracts in the budget tab.
- Burn graph on budget page shows dollars instead of hours.
- Improved behavior during project creation.

### Fixed

- Overscroll issues in resourcing grids.

## [0.1.0] - 2025-02-25

### Added

- Initial Application build
- Float Imports
- Project creation
- Project Tracking through grids
- Budget management
- User Schemes and permissions
