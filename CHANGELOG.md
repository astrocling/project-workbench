# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

- **Search crawler blocking**: `robots.txt` and related config now disallow all crawlers so the internal app is not indexed by search engines.

### Changed

- **CDA — hours per month remaining**: The value is now based only on planned hours: total planned for the current month and all remaining months, divided by the number of those months. It no longer uses actuals, so it does not change when you add or edit hours in the current month.

### Fixed

## [0.1.4] - 2025-03-03

### Added

- **Status Reports tab**: New project tab with a summary table of estimated budget (high/low), $ spent, $ remaining, budgeted/actual/remaining hours, and a % budget used (high est.) circle chart. Copy table and copy chart buttons support pasting into status reports (e.g. Word/Google Docs). Tab is available from project detail navigation.
- **CDA tab — copy for status report**: On the CDA tab, a "Copy for status report" section with an overall summary table (Budget $ and Hours: Planned, Actuals, Remaining), copy-table and copy-chart actions for the total contract hours burned donut, and per-month status report tables with copy-table and copy-chart for the selected month’s burn chart. Tables use brand styling and format numbers for report paste (e.g. two decimals).

### Changed

- **Roles without rates alert**: The warning that some roles on the project have no bill rate set now appears on Overview, Resourcing, Budget, Rates, CDA, and Status Reports tabs (previously only on Rates). On tabs other than Rates, the message includes a link to the Rates tab to add rates.
- **CDA / Status report styling**: Overall summary table and copyable sections use consistent styling and brand colors for status-report copy.

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
