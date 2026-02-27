# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

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
