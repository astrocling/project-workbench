# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

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

- **Roles without rates alert**: The warning that some roles on the project have no bill rate set now appears on Overview, Resourcing, Budget, Rates, and CDA tabs (previously only on Rates). On tabs other than Rates, the message includes a link to the Rates section in Settings to add rates.
- **Status report PDF**: Export is rendered client-side (instead of server-side) to reduce server load; the download button uses improved filename handling.
- **CDA tab**: Tabbed sub-navigation (Budget | Milestones) for switching between CDA budget view and the milestones list.
- **CDA milestones**: Report dates on milestones are now optional for flexibility.
- **Settings**: Rates and Assignments are now separate sections within the project Settings page (alongside Details, Links, Key roles, Resourcing).

### Fixed

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
