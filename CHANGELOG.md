# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.4] - 2026-06-09

Patch release: **Sync plan from Float** — production **500** / `FUNCTION_INVOCATION_FAILED` when Float import history is large. **Deploy:** no new migrations; redeploy Vercel only.

### Fixed

- **Sync plan from Float — OOM / 500 on production** — `POST /api/projects/[id]/sync-plan-from-float` loaded every `FloatImportRun` JSON blob into memory and upserted `PlannedHours` one row at a time, exhausting the 2GB Vercel function limit (~29s then crash). Logic moved to **`lib/syncPlanFromFloat.ts`**: stream import runs via **`iterateFloatImportRunsAsc`** (same pattern as backfill), batch SQL upserts (500 rows/chunk), single person lookup pass, **`maxDuration` 120s**, and structured error responses. Route: `app/api/projects/[id]/sync-plan-from-float/route.ts`.

### Documentation

- **User Guide** — troubleshooting row for **Sync plan from Float** failures.
- **Technical Reference** — `sync-plan-from-float` API row and *Float sync behavior* notes for **`syncPlannedHoursFromFloat`**.

## [1.2.3] - 2026-06-08

Patch release: **Float sync** — follow-up fixes when production still showed empty **Float Actuals** after **v1.2.2**. **Deploy:** no new migrations; redeploy, run **Admin → Float sync** (not Trigger.dev alone if you need the Resourcing cache cleared), hard-refresh the project page.

### Fixed

- **Float sync — project resolution for duplicates and renamed projects** — **`normalizeProjectNameForLookup`** now treats **`/`** like other punctuation (so `OHS/SPCS` matches `OHS-SPCS`). **`resolveProjectIdForMergedFloatEntry`** prefers the Workbench project whose **`floatExternalId`** matches the Float task when duplicate same-name rows exist (array order no longer picks the unlinked copy), trusts the linked project when Workbench was renamed but Float still uses the canonical name, and continues to reject cross-routing when Float **`project_id`** and display name disagree. Tests: **`__tests__/lib/resolveProjectIdForMergedFloatEntry.test.ts`**.

## [1.2.2] - 2026-06-08

Patch release: **Float sync** — duplicate Workbench projects with the same name no longer show an empty **Float Actuals** grid after sync or backfill. **Deploy:** no new migrations; redeploy as usual, then run **Admin → Float sync** once so mirrored hours and assignments are written to all affected projects.

### Fixed

- **Float sync — empty Float Actuals on duplicate project names** — When two or more Workbench projects shared the same normalized name (for example an older project created before **`floatExternalId`** linking and a newer linked copy), Admin Float sync wrote **`FloatScheduledHours`** and **`ProjectAssignment`** rows only to the project whose **`floatExternalId`** matched Float, while **`projectIdsInImport`** for orphan cleanup was derived from a **`projectsByName`** map that keeps only one id per lowercase name. Users opening the unlinked duplicate saw an empty **Float** grid even though sync succeeded; **Backfill** could briefly populate that project, then the next sync’s orphan cleanup removed rows that had no assignments on the duplicate. **`resolveFloatImportTargetProjectIds`** (`lib/floatImportApply.ts`) now mirrors sync data to the primary linked project **plus** same-name siblings with **`floatExternalId` null**, and **`projectIdsInImport`** is built from those resolved target ids only. Tests: **`__tests__/lib/resolveProjectIdForMergedFloatEntry.test.ts`**.

### Documentation

- **User Guide** — *Float sync* → **Duplicate Workbench project names**; troubleshooting row for empty Float grid after sync.
- **Technical Reference** — *Float sync behavior* → **`resolveFloatImportTargetProjectIds`**, **`projectIdsInImport`** resolution, duplicate-name mirroring vs duplicate Float project names.
- **README** — Float sync paragraph notes duplicate-name mirroring; documentation index references **v1.2.2**.

## [1.2.1] - 2026-05-28

Patch release: **CDA status reports** — refresh milestone dates on saved reports; preview loads fresh PDF data after refresh; milestone dates display without timezone day-shift. **Deploy:** no new migrations; redeploy as usual.

### Fixed

- **Status reports — CDA milestone dates stale on saved reports** — CDA variation reports snapshot **milestone** dates (phase, dev/UAT/deploy) when the report is **created**. Editing or recreating milestones on the **CDA** tab after that did not update older reports, so the slide could show outdated dates (for example May Sprint with old dev/UAT/deploy ranges). Editors can now **Refresh milestones on report** while **editing** a CDA report (Status Reports tab → Milestones summary), mirroring **Refresh timeline** for Standard/Milestones. API: **`POST /api/projects/[id]/status-reports/[reportId]/refresh-cda-milestones`** merges current **`CdaMilestone`** rows into the report snapshot’s **`cda.milestones`** only; CDA budget rows and other snapshot fields are unchanged. Implementation: `lib/statusReportPdfData.ts` (`buildCdaMilestonesFromProject`), `components/StatusReportsTab.tsx`.

- **Status reports — preview still showed old milestone dates after refresh** — The preview modal fetches **`GET .../status-reports/[reportId]/pdf/data`**, which used a 60-second Next.js **`unstable_cache`** layer that did not always invalidate immediately after milestone refresh. That route now calls **`buildStatusReportPdfData`** directly with **`Cache-Control: no-store`**; **`StatusReportPreview`** uses **`cache: "no-store"`** and bumps **`dataRefreshKey`** on every successful milestone refresh so the modal refetches.

- **CDA milestone date display — timezone day-shift** — Milestone tables on the CDA tab and status report slides formatted **`YYYY-MM-DD`** strings with **`new Date(iso)`** + local **`getDate()`**, which could show the **previous calendar day** in US timezones. Shared **`formatMonthDay`** (and Thu/Fri deploy helpers) in **`lib/formatIsoDate.ts`** parse date-only strings as calendar dates; used in **`CDATab`**, **`StatusReportsTab`**, **`StatusReportView`**, and **`StatusReportDocument`**.

### Documentation

- **User Guide** — *CDA tab* → **Milestones** sub-tab and snapshot behavior; *Status Reports tab* → **Refresh milestones (CDA)**; snapshot section notes locked CDA milestones; project tabs table mentions CDA milestone refresh.
- **Technical Reference** — **`POST refresh-cda-milestones`**; snapshot/`buildCdaMilestonesFromProject`; preview **`pdf/data`** no-cache path; **`lib/formatIsoDate.ts`**.
- **README** — production release tag example **v1.2.1**; documentation index mentions CDA milestone refresh.
- **`.cursor/rules/status-report.mdc`** — CDA milestone snapshot refresh API and preview data path.

## [1.2.0] - 2026-05-27

Minor release: **Modular** status reports (panels JSON + migrations), **Standard** optional budget block, compact timeline styling, **Admin → People** restore + job title on add, assignment **remove** confirmation with planned-hours cleanup, missing-actuals nudges scoped to **visible** assignees, overview/status-reports tab links + legacy redirect. **Deploy:** run migrations (`20260527135733_add_sprint_variation_and_panels`, `20260527150000_rename_sprint_to_modular`); Vercel build applies them via `prisma migrate deploy`. Redeploy Trigger.dev worker if you use missing-actuals schedules.

### Fixed

- **Slack — missing-actuals nudges for removed assignees** — Tue/Wed/Thu nudges no longer list people who are not on the project Resourcing grid. Selection in **`getMissingActualsProjects`** (`lib/missingActuals.ts`) now requires a **`ProjectAssignment`** with **`hiddenFromGrid: false`**, matching visible Resourcing rows and **`projectHasMissingActuals`**. Previously, stale **`PlannedHours`** rows could remain after a person or Float placeholder was removed from assignments, causing nudges for people with no row in the app. **Float sync** orphan cleanup now also deletes orphaned **`PlannedHours`** (same `(projectId, personId)` rule as **`FloatScheduledHours`**). **`DELETE /api/projects/[id]/assignments`** deletes that person’s **`PlannedHours`** on the project. Tests: **`__tests__/lib/missingActuals.test.ts`** (`filterPlannedRowsToVisibleAssignments`).

- **Project overview — Status Reports links** — On the **Overview** tab, **View all →**, **View all status reports →**, and **Create your first report →** now open the **Status Reports** tab via **`/projects/{slug}?tab=status-reports`** (same query-param routing as the tab bar). They previously used **`/projects/{slug}/status-reports`**, which 404'd. Legacy bookmarks and old Slack links to that path **redirect** to the tab via **`app/(app)/projects/[slug]/status-reports/page.tsx`** (mirrors the resourcing redirect). Individual report pills still link to **`/projects/{slug}/status-reports/{id}/view`**. Implementation: **`ProjectDetailTabs.tsx`**.

- **Admin → People — empty table and add person** — Restored **`GET/POST/PATCH /api/admin/people`** after a regression that reduced the route to a minimal GET-only stub returning a flat array. The People page expects **`{ people, newPersonNames }`** and POST/PATCH handlers; the stub left the table empty and left the add-person modal open (405 on POST). **`GET`** again returns full **`Person`** rows plus **`newPersonNames`** from the latest **`FloatImportRun`**. **`POST`** find-or-creates by name (case-insensitive) and accepts **`jobTitle`** (stored as **`Person.floatJobTitle`**). **`PATCH`** toggles Workbench **`active`**. **`app/admin/users/page.tsx`** parses **`people`** from the wrapped GET response so the Float person dropdown still works.

### Added

- **Settings → Assignments — remove confirmation** — **Remove** shows a browser confirmation before deleting an assignment. Copy explains that removal **permanently deletes all planned hours** for that person on the project and recommends **Hidden from grid** when past planned hours should stay for budgeting or actuals. Implementation: **`components/AssignmentsTab.tsx`**.

- **Admin → People — job title on add** — The **Add person** dialog requires a **Job title** selected from the Workbench role catalog (merged with job titles already on people). Job title is saved as **`floatJobTitle`** and drives assignment role resolution (see *Float sync behavior*).

- **Status reports — Standard show budget toggle** — When creating or editing a **Standard** variation report, editors can turn **Show project budget on report** on or off (default **on**). When off, the exported slide omits the bottom **HIGH/LOW** budget table and burn donut; timeline and narrative sections are unchanged. The choice is stored per report in the JSON **snapshot** (`showBudget`) and can be updated on **Update**; preview, share view, client PDF capture, and server PDF fallback all honor it. Implementation: `components/StatusReportsTab.tsx`, `lib/statusReportPdfData.ts` (`resolveShowBudget`), `StatusReportView.tsx` / `StatusReportDocument.tsx`. Tests: `__tests__/lib/statusReportPdfData.test.ts`.

- **Status reports — Modular variation** — New report variation **Modular (Story Points / Velocity)** for agile delivery slides. Bottom section uses composable **panels** stored in **`StatusReport.panels`**: **Sprint Schedule** (date range + phase label rows), **Story Point Metrics** (up to four named systems × Planned / Completed / In Progress / Carry Over), and **Donut KPIs** (default Utilization Rate and Average Velocity with manual 0–100% values). Types and defaults in **`lib/reportPanels.ts`**; form in **`StatusReportsTab.tsx`**; preview/PDF in **`StatusReportView.tsx`** / **`StatusReportDocument.tsx`**. Create stores a minimal snapshot (period only); panel data is editable on **Update**. Enum value **`Sprint`** renamed to **`Modular`** (`20260527150000_rename_sprint_to_modular`).

### Changed

- **Status reports — timeline layout and styling** — The timeline strip on Standard/Milestones slides (preview, client PDF, and server PDF fallback) is more compact and consistent. Row height reduced from 20px to **14px**; empty bar rows (no bars or markers) are **hidden**; month header padding tightened. Bars use natural date-based widths with a **4% minimum** sliver for visibility, full opacity, rounded corners, and labels that **truncate with ellipsis** (HTML) or character-count truncation (PDF) instead of bleeding outside narrow bars. Timeline **markers** in the HTML preview now render **Lucide-equivalent SVG icons** (matching the PDF), not placeholder circles. PDF pinned timeline slot height updated (`TIMELINE_SLOT_HEIGHT` **70**). Implementation: `TimelineBlock` in `components/StatusReportView.tsx` and `components/pdf/StatusReportDocument.tsx` — **both must stay in parity**.

### Documentation

- **User Guide** — *Settings → Assignments*: remove confirmation, planned-hours deletion vs **Hidden from grid**; *Automated missing-actuals Slack nudges* → only **visible** assignees; *Float sync* → orphan **`PlannedHours`** cleanup.
- **Technical Reference** — *Missing-actuals Slack nudges* → **`ProjectAssignment`** / **`hiddenFromGrid`** filter; *Float sync behavior* → orphan **`PlannedHours`** delete; **`DELETE /api/projects/[id]/assignments`**; maintainer scripts **`scripts/debug-missing-actuals-nudge.ts`**, **`scripts/debug-orphan-planned-hours.ts`**.
- **README** — missing-actuals nudge paragraph notes visible-assignment scope.
- **User Guide** — *Admin → People*: table listing, filters, add person (name + job title), Workbench active toggle; job titles from Float sync vs manual add.
- **Technical Reference** — **`/api/admin/people`** request/response shapes; Admin Users person-dropdown compatibility; Admin People UI notes; *Standard report show budget* (`showBudget` snapshot, POST/PATCH status-reports); *Timeline on status reports* (`TimelineBlock` parity, compact layout, bar labels, markers); *Workbench links in Slack messages* → legacy **`/projects/{slug}/status-reports`** redirect (parity with resourcing).
- **User Guide** — *Project detail → Overview*: status report summary links (**View all →**, **Create your first report →**) use **`?tab=status-reports`**; report history pills open the HTML view page.
- **User Guide** — *Status Reports tab*: **Show project budget on report** toggle for Standard variation (default on; hides bottom budget block when off).
- **User Guide** — *Status Reports tab*: **Modular** variation (sprint schedule, story points, donut KPIs; panels vs snapshot).
- **User Guide** — *Timeline on status report slides*: compact rows, empty rows hidden, label truncation, marker icons.
- **Technical Reference** — *Modular status reports* (`panels`, `lib/reportPanels.ts`, API POST/PATCH, rendering).
- **`.cursor/rules/status-report.mdc`** — Standard **`showBudget`** snapshot flag; Modular **`panels`** bottom section; timeline dual-file sync (`StatusReportView` + `StatusReportDocument`).

## [1.1.4] - 2026-05-21

Patch release: **Slack** missing-actuals nudges align with Resourcing **Actuals Stale** rules (**Planned > 0**, **null** actuals only); status health **View full report →** links use **`?tab=status-reports`**; **Download PDF** meeting notes render at readable width. **Deploy:** no new migrations; redeploy as usual.

### Fixed

- **Slack — missing-actuals nudge selection** — Tue/Wed/Thu nudges now use the same **Actuals Stale** rules as the Resourcing tab: **`PlannedHours > 0`**, **`actualHours === null`** (explicit **0** is not stale), and split-week checks via **`hasMissingActualsSplitWeek`**. Previously nudges used **Float scheduled hours** and treated **0** actual hours as missing. Implementation: **`lib/missingActuals.ts`** (`personWeekIsActualsStale`, `getMissingActualsProjects`). Tests: **`__tests__/lib/missingActuals.test.ts`**.
- **Slack — status-reports tab links** — Health-update Slack messages (**Post to Slack** from Status Reports) now link to **`/projects/{slug}?tab=status-reports`** (matching in-app tab routing) instead of the non-existent **`/projects/{slug}/status-reports`** path. Shared helper **`projectStatusReportsUrl()`** in **`lib/workbenchUrls.ts`** (alongside **`projectResourcingUrl()`** for resourcing and missing-actuals nudges).
- **Status reports — meeting notes PDF export** — **Download PDF** (client-side capture in **`lib/statusReportPdfCapture.ts`**) could render the meeting-notes page as a narrow unreadable strip: html2canvas captured the notes block at the wrong aspect ratio inside wide preview modals, and jsPDF **`addPage(..., "portrait")`** swapped page dimensions when width exceeded height while **`addImage`** still used the unswapped size. Capture now pins the notes container to **720px** (matching the slide), passes explicit html2canvas dimensions, omits portrait orientation on the custom notes page, and aligns page and image size via **`computeNotesPageSize()`**. **`StatusReportView`** sets a fixed **720px** width on the meeting-notes wrapper. Tests: **`__tests__/lib/statusReportPdfCapture.test.ts`**.

### Documentation

- **CHANGELOG** — This release section.
- **Technical Reference** — *Missing-actuals Slack nudges* → selection uses **Planned** + Resourcing stale rules (`hasMissingActuals` / `hasMissingActualsSplitWeek`), not Float; *Workbench links in Slack messages* → health update uses **`?tab=status-reports`** and **`projectStatusReportsUrl()`**; *Status report rendering* → meeting notes PDF capture (two-page export, **`computeNotesPageSize`**).
- **User Guide** — *Resourcing tab* → **Actuals Stale** (amber cells), **Automated missing-actuals Slack nudges**; *Status Reports* → stale blocking clarifies blank vs **0** actuals; *Post to Slack* → **View full report →** deep link format; meeting notes on a second PDF page and export behavior; release baseline **1.1.4**.
- **README** — Trigger.dev nudge paragraph describes prior-week scope and Planned/stale selection; Slack **`WORKBENCH_BASE_URL`** note covers resourcing and status-reports tab links; production release tag example updated to **v1.1.4**.
- **`.cursor/rules/status-report.mdc`** — Meeting notes PDF capture constraints for **`statusReportPdfCapture.ts`**.

## [1.1.3] - 2026-05-21

Patch release: **Slack** resourcing **Mark fulfilled** variance replies post **only when** Float/Planned actually mismatch after sync (Ready vs non-Ready rules); fulfillment thread text is **Marked as fulfilled**. **Deploy:** no new migrations; redeploy as usual.

### Fixed

- **Slack — resourcing fulfill variance** — **Mark fulfilled** no longer posts a variance reply on every fulfill. Variance is posted in the request thread **only when** something mismatches: for **Ready** people, post-sync **Float** must match **Planned** at fulfill time (otherwise **no Float changes detected** or **partial week updates**); for **non-Ready** people, only **Float** changes after sync count (pre-existing Float≠Planned gaps are ignored; **Planned** edits alone do not trigger variance). Fulfillment reply text is **Marked as fulfilled** (was “filled”). Logic in **`lib/resourcingFulfillVariance.ts`**; snapshot window keys stored on create (`snapshotStartKey` / `snapshotEndKey` wrapper on **`requestedPeople`** JSON).

### Documentation

- **CHANGELOG** — This release section.
- **Technical Reference** — *Slack integration* fulfill variance rules; **`ResourcingRequest.requestedPeople`** shape; **`lib/resourcingFulfillVariance.ts`**.
- **User Guide** — *Resourcing tab* → fulfillment and when Slack variance posts; release baseline **1.1.3**.
- **README** — Documentation index and production release tag example updated to **v1.1.3**.

## [1.1.2] - 2026-05-21

Patch release: **Slack** status health posts go to the linked **account** channel only (not the project channel); resourcing and missing-actuals Slack links use **`?tab=resourcing`** with a legacy redirect; **favicon** shows the Jakala mark. **Deploy:** no new migrations; redeploy as usual. Confirm each linked **Admin → Accounts** row has a **Slack channel** if editors use **Post to Slack**.

### Fixed

- **Slack — status posts use account channel** — **Post to Slack** from Status Reports now posts to the linked **account** Slack channel only (**Admin → Accounts**), not the project channel in **Settings → Links**. Channel resolution lives in **`lib/slackChannels.ts`** (`resolveAccountSlackChannel`); **`POST /api/projects/[id]/slack/health-update`** returns a clear **400** when the project has no linked account or the account has no channel configured. The project **Slack Channel ID** field remains for **Tuesday/Wednesday** missing-actuals nudges only.
- **Slack — resourcing tab links** — Resourcing-request and missing-actuals Slack messages now link to **`/projects/{slug}?tab=resourcing`** (matching in-app tab routing) instead of the non-existent **`/projects/{slug}/resourcing`** path. Shared URL helpers in **`lib/workbenchUrls.ts`**. Legacy **`/projects/{slug}/resourcing`** URLs redirect to the correct tab. Resourcing requests without a **Float link** (**Settings → Links**) show plain _Float not linked_ in Slack instead of omitting Float context entirely.
- **Browser tab icon (favicon)** — The tab icon now shows the Jakala **`j512`** mark instead of the default Vercel triangle. Browsers request **`/favicon.ico`** independently of HTML metadata; the app now uses Next.js file-based app icons (**`app/favicon.ico`**, **`app/icon.png`**, **`app/apple-icon.png`**) derived from **`public/brand/j512.png`**. Removed redundant **`metadata.icons`** from **`app/layout.tsx`**.

### Documentation

- **CHANGELOG** — This release section.
- **Technical Reference** — *Slack integration* → channel routing table (health updates → account channel only); **`lib/slackChannels.ts`**; Workbench links in Slack messages (`?tab=resourcing`, Float linked vs not linked, legacy redirect); *App shell* → browser tab / favicon assets and file conventions.
- **User Guide** — *Post to Slack* (account channel requirement); *Settings* / *Admin → Accounts* channel purposes; *Troubleshooting* (Slack health post errors); *Resourcing tab* → Slack message links and Float link behavior; *Sidebar* (tab icon); *Troubleshooting* (stale favicon cache); release baseline **1.1.2**.
- **README** — Documentation index and production release tag example updated to **v1.1.2**.

## [1.1.1] - 2026-05-19

Patch release: **Resourcing** column totals include people **hidden from grid** (rows stay hidden); **Float sync** removes orphaned `FloatScheduledHours` when someone is removed from a project; **Account** self-service profile for **Slack user ID** and **Float person** link. **Deploy:** no new migrations; redeploy as usual. Run **Admin → Float sync** after deploy if you need orphan float rows cleaned up project-wide.

### Added

- **Account — profile (self-service)** — **Account** (`/account`) adds a **Profile** section: set optional **Slack User ID** and link your login to a **Float person** (`Person.userId`) from people not already linked to another user. APIs: **`GET/PATCH /api/account/profile`** (`app/api/account/profile/route.ts`); shared link helper **`lib/userPersonLink.ts`**. Admins can still set the same fields under **Admin → Users → Edit**.

### Fixed

- **Resourcing — column totals vs hidden rows** — People marked **hidden from grid** (**Settings → Assignments**) no longer appear as rows in Planned / Actual / Float, but their hours **still count** in each week’s **column totals** and variance rows. **`GET /api/projects/[id]/resourcing`** returns **all** assignments with **`hiddenFromGrid`**; hour payloads (float, month splits, PTO/holiday, comments) include every assigned person. The client builds rollup person ids from **`assignments`**, not from orphan hour rows (`components/ResourcingGrids.tsx`, `app/api/projects/[id]/resourcing/route.ts`).
- **Float sync — orphaned float hours after removal** — When someone is removed from a Float project, **`applyFloatImportDatabaseEffects`** now deletes **all** `FloatScheduledHours` rows (any week) for **(projectId, personId)** pairs that have **no** `ProjectAssignment` on that project. This clears past-week stale rows that could survive the existing **future-only** cleanup when rows aged into completed weeks before deletion (`lib/floatImportApply.ts`).

### Documentation

- **CHANGELOG** — This release section.
- **User Guide** — *Resourcing tab* (hidden-from-grid totals); *Dashboards and Account* (profile + person link); *Float sync* (orphan cleanup); release baseline **1.1.1**.
- **Technical Reference** — *Resourcing API details* (assignments + rollup semantics); *Float sync behavior* (orphan-pair cleanup); API table **`GET/PATCH /api/account/profile`**; **`lib/userPersonLink.ts`**.
- **README** — Documentation index and production release tag example updated to **v1.1.1**.

## [1.1.0] - 2026-05-14

Minor release: **Industry groups** taxonomy on accounts and users (project inheritance via Float-linked **Account**), **Slack** integration (status health posts, resourcing change requests with fulfill flow, admin Slack/Accounts configuration, optional **Trigger.dev** missing-actuals nudges), **Jakala** sidebar branding and shell simplification (no layout-level `getDashboardContext`), and **status reports** blocked when project actuals are stale. **Deploy:** apply new Prisma migrations in order (`prisma migrate deploy`); set Slack-related env vars and Trigger worker secrets as documented in [docs/TECHNICAL.md](docs/TECHNICAL.md) and `.env.example`.

### Added

- **Industry groups (taxonomy)** — Admins maintain **`IndustryGroup`** rows (**Admin → Industry groups**): create, rename, archive/restore (soft archive via `archivedAt`). Assign a group to **Float-backed client accounts** (**Admin → Accounts**) and optionally to **Workbench users** (**Admin → Users**). Projects **inherit** the industry group from their linked **`accountId`** (set by Float sync—no per-project group field). New assignments cannot use an **archived** group; existing account/user links may keep a group after it is archived. APIs: `GET/POST /api/admin/industry-groups`, `PATCH /api/admin/industry-groups/[id]`; **`PATCH /api/admin/accounts/[id]`** and **`PATCH /api/admin/users/[id]`** accept **`industryGroupId`** (nullable). Project **Settings → Details** shows the effective group read-only with a link to **Admin → Accounts**. Helpers: `lib/industryGroupAssign.ts`. Cached project payload and **`GET/PATCH /api/projects/[id]`** include **`account.industryGroup`** (`lib/projectCache.ts`, `app/api/projects/[id]/route.ts`). **Migration:** `20260514160928_add_industry_group`.
- **Slack — project health updates from Status Reports** — Editors can **Post to Slack** from the Status Reports tab to send a summary of the **most recent** saved report (RAG, budget snapshot, next milestone, key-role mentions when Slack user IDs are set) to the project’s Slack channel, with an optional note. Channel resolution: **Settings → Links → Slack Channel ID** on the project, else the linked **Account** channel (see Admin → Accounts). API: `POST /api/projects/[id]/slack/health-update` (`app/api/projects/[id]/slack/health-update/route.ts`); UI: `components/StatusReportsTab.tsx`.
- **Slack — resourcing change requests** — From the Resourcing tab, **Request Resourcing Changes** opens a modal and posts to the **org resourcing** Slack channel (configured in **Admin → Slack**), tagging PM/PGM and optional **notify** users. The request stores a **Float hours snapshot** per person in the sync window; project editors use **Mark fulfilled** to run Float API sync and post **Marked as fulfilled** in the thread, with an optional variance reply when Ready Float does not match Planned or non-Ready Float changed after sync (see **1.1.3** and Technical Reference). APIs: `POST /api/projects/[id]/slack/resourcing-request`, `POST /api/projects/[id]/slack/resourcing-request/fulfill`; data: `ResourcingRequest`, `AppConfig.resourcingChannelId`, `ResourcingNotifyUser` (`prisma/schema.prisma`); UI: `components/ResourcingGrids.tsx`.
- **Slack — missing-actuals nudges (Trigger.dev)** — Three weekly schedules (**Tuesday / Wednesday / Thursday 15:00 UTC**) remind teams about **prior UTC week** gaps matching Resourcing **Actuals Stale** rules: **Planned > 0** and **actual hours null** (explicit **0** is not stale; see **1.1.4**). **Tuesday:** DM each PM who has a **Slack user ID**; for PMs without one, post to the **project** channel if configured. **Wednesday:** project channel only (extra nudge copy). **Thursday:** **account** channel when the project has an account with `slackChannelId`. Requires **`SLACK_BOT_TOKEN`** and **`DATABASE_URL`** on the Trigger worker; optional **`WORKBENCH_BASE_URL`** for links. Sends are logged in **`ActualsNudgeLog`**. Implementation: `trigger/missingActualsNudge.ts`, selection logic `lib/missingActuals.ts`.
- **Admin — Slack configuration** — **Admin → Slack** (`/admin/slack`): set **resourcing channel** ID (`AppConfig`), manage users who receive resourcing-request **@mentions** (`ResourcingNotifyUser`). APIs: `GET/PATCH /api/admin/slack-config`, `GET/PATCH /api/admin/slack-config/notify-users`, `PATCH /api/admin/slack-config/notify-users/[userId]`.
- **Admin — Accounts** — **Admin → Accounts** (`/admin/accounts`): list **Account** rows (synced from Float clients), set optional **`slackChannelId`**, and optional **`industryGroupId`** (industry taxonomy; all projects with that account inherit the group). APIs: `GET /api/admin/accounts`, `PATCH /api/admin/accounts/[id]`.
- **Schema** — `IndustryGroup`, `Account.industryGroupId`, `User.industryGroupId` (migration `20260514160928_add_industry_group`). Also: `User.slackUserId`, `Project.slackChannelId`, `Account.slackChannelId`, `AppConfig`, `ResourcingNotifyUser`, `ResourcingRequest`, `ActualsNudgeLog` (migrations `20260506194215_add_slack_foundation`, `20260507164830_add_actuals_nudge_log`, `20260507180000_add_person_user_link_and_notify`).

### Changed

- **Status reports — block create when actuals are stale** — New reports cannot be saved while the project has **missing actuals** (completed weeks with **planned > 0** and **no actual hours**), matching portfolio **Actuals** semantics (`projectHasMissingActuals` / `computeBudgetRollups`). Client shows the same message before POST. This is **independent** of the Float-based missing-actuals **Slack nudge** criteria (see Technical Reference).
- **App sidebar** — **Jakala** branding in the header (`public/brand/jakala-wordmark.png` / `jakala-wordmark-dark.png` expanded, `j512.png` collapsed): larger wordmark, vertical centering of the header row, wordmark aligned **left** in its strip. **Hi &lt;First name&gt;** (from session name or email local-part) is the **first main-nav row** with a **Hand** icon when expanded; the greeting row is **omitted when collapsed** (footer still exposes the signed-in name to assistive tech). Removed **Open my projects** (bulk open in new tabs). **`app/(app)/layout.tsx`** no longer calls **`getDashboardContext`** for shell chrome—dashboards and the projects list still load **`personId`** / context where needed (`components/AppSidebar.tsx`, `components/AppShell.tsx`).

### Documentation

- **User Guide** — *Getting started* → **Sidebar (signed-in app)** (`docs/USER_GUIDE.md`).
- **Technical Reference** — *App shell*; *Projects list* (`getDashboardContext` wording); *API overview* (`GET /api/projects/my-pm-slugs` no longer described as sidebar wiring) (`docs/TECHNICAL.md`).
- **README** — Documentation index: User Guide / Technical Reference blurbs mention **sidebar** and **app shell** (`README.md`).
- README, User Guide, and Technical Reference updated for **Industry groups** (admin UI, inheritance from accounts, APIs, migration).
- README, User Guide, Technical Reference, and `.env.example` updated for Slack env vars, admin pages, APIs, and Trigger schedules.
- **README** — Production release tag example updated to **v1.1.0**.
- **User Guide** — Release version line updated to **1.1.0**.

## [1.0.8] - 2026-05-06

Patch release: **Resourcing** adds split-week **Weekly Actuals** keyboard navigation and bulk **Expand** / **Collapse** for split weeks; **Status reports** fixes production HTML meeting-notes sanitization (**sanitize-html**, no jsdom); **Project settings** fixes saves after rename (mutating APIs use **project id**, URL refresh on new slug); documentation aligned. **Deploy:** no new migrations; redeploy as usual.

### Added

- **Resourcing — bulk expand/collapse split weeks** — In **Weekly Actuals**, when the visible range includes month-boundary weeks, the header shows a compact **Split weeks** hint next to **Expand** / **Collapse** to open or roll up **all** split cells at once (React state only; `components/ResourcingGrids.tsx`). Buttons disable when already fully expanded or fully collapsed. Per-cell split/rollup and comment controls use **`tabIndex={-1}`** so keyboard Tab moves through hour fields first.

### Fixed

- **Resourcing — split-week Actuals keyboard navigation** — Expanded month-split cells participate in the same navigation as single-week cells: **Arrow Up/Down** moves by person row while staying in the **same month half** (first or second month in the cell); **Tab** walks month inputs then the next week without stopping on split/rollup chrome (`data-resourcing-*` / `data-resourcing-split-frame` on inputs, `focusActualGridInput` in `components/ResourcingGrids.tsx`).
- **Status reports — production crash on HTML meeting notes** — SSR for `StatusReportView` loaded **jsdom** via **isomorphic-dompurify**, which triggered **`ERR_REQUIRE_ESM`** in some production builds (CommonJS `require` of ESM-only **`@exodus/bytes`** inside **html-encoding-sniffer**). Meeting notes sanitization now uses **`sanitize-html`** in `lib/meetingNotesHtml.ts` (no jsdom). Tests: `__tests__/lib/meetingNotesHtml.test.ts`.
- **Project settings — `{"error":"Not found"}` after renaming** — Debounced save and Float actions used **`/api/projects/{slug}`**; **`PATCH`** regenerates the slug when the **name** changes, so the next save used a stale slug. The client now uses **`/api/projects/{projectId}`** for **`PATCH`**, **backfill-float**, and **sync-plan-from-float**, and **`router.replace`**es to **`/projects/{newSlug}?tab=settings`** when the API returns an updated slug (`components/ProjectSettingsTab.tsx`).

### Documentation

- **User Guide** — *Resourcing tab* → *Split weeks*: keyboard behavior (Tab, arrows, month “frames”) and bulk **Expand** / **Collapse** for all split weeks.
- **Technical Reference** — *Resourcing API details*: split-week grid keyboard navigation and bulk expansion (client-only `expandedSplitCells` state).
- **Technical Reference** — *Status report rendering*: meeting notes HTML sanitization (**sanitize-html**, no jsdom) and rationale.
- **Technical Reference** — *API overview*: `GET/PATCH/DELETE /api/projects/[id]` accepts **id or slug**; **Settings** client uses **project id** in mutating URLs and URL refresh on slug change.
- **User Guide** — *Settings tab*: autosave, rename + URL slug update, and meeting notes HTML safety in *Status Reports*.
- **README** — Documentation index: User Guide summary mentions split-week keyboard and bulk expand/collapse.
- **README** — Documentation index: Technical Reference summary mentions project API **id or slug** and **sanitize-html** for meeting notes.
- **README** — Production release tag example updated to **v1.0.8**.
- **User Guide** — Release version line updated to **1.0.8**.

## [1.0.7] - 2026-05-05

Patch release: **Admin → Users** layout restores **Edit** / password reset; **Status Reports** closes the form after save/update (with list refresh) and adds **Refresh timeline** while editing Standard or Milestones reports; **Resourcing** adds collapsible **Weekly Actuals** for easier Planned vs Float comparison; documentation aligned. **Deploy:** no new migrations; redeploy as usual.

### Added

- **Resourcing — collapse Weekly Actuals** — The middle **Weekly Actuals** grid can be collapsed so **Planned** and **Float** sit closer for comparison: icon-only chevron in the section header (`actualsCollapsed` state in `components/ResourcingGrids.tsx`; tighter vertical spacing between cards while collapsed). No API or persistence.
- **Status reports — refresh timeline when editing** — While editing a Standard or Milestones report, **Refresh timeline** (with a confirmation step) replaces only the timeline slice of the report snapshot with the project’s current timeline bars and markers; report date, previous-months window, and other snapshot fields stay unchanged. `POST /api/projects/[id]/status-reports/[reportId]/refresh-timeline`; preview refetches after refresh. Implementation: `lib/statusReportPdfData.ts`, `app/api/projects/[id]/status-reports/[reportId]/refresh-timeline/route.ts`, `components/StatusReportsTab.tsx`, `components/StatusReportPreview.tsx`.

### Fixed

- **Admin → Users — Edit / password reset unreachable** — The user list used a narrow main column (`max-w-2xl`) and a table card with `overflow-hidden`, so long emails and multiple columns could clip the **Actions** column (**Edit**), blocking the edit modal (including **New password**). The page now uses a wider main width (`max-w-6xl`), `overflow-x-auto` on the table card with a sensible table `min-width`, a shrink-wrapped **Actions** column, and truncated name/email/role cells with `title` tooltips for full values. Implementation: `app/admin/users/page.tsx`.
- **Status reports — unclear save / duplicate risk** — After **Save** (new report) or **Update** (edit), the form now closes, the list refreshes (create resets to page 1 of the paginated list), and the page scrolls to the **Status Reports** table so success is obvious and accidental double-submits are less likely. Implementation: `components/StatusReportsTab.tsx`.

### Documentation

- **User Guide** — *Resourcing tab*: **Collapsing Weekly Actuals** (chevron, tighter Planned vs Float layout while collapsed).
- **Technical Reference** — *Resourcing API details*: **Weekly Actuals collapse** behavior and implementation notes (`ResourcingGrids`).
- **README** — User Guide summary mentions collapsible Weekly Actuals; production release tag example updated to **v1.0.7**.
- **User Guide** — *Admin: Roles, People, and Users*: **Users** row expanded; new **Admin → Users** subsection (table, **Edit**, optional password reset, narrow screens); release version line updated to **1.0.7**.
- **Technical Reference** — *Admin pages (UI)*: **Users** page layout and scroll behavior; pointer to `app/admin/users/page.tsx`.
- **User Guide** — *Status Reports tab*: new **Saving a report** subsection (form closes, list refresh, scroll, page 1 on create, preview via row action).
- **Technical Reference** — *Status report rendering*: **Status Reports tab (create/edit UX)** bullet; `StatusReportsTab` post-save behavior.

## [1.0.5] - 2026-04-14

Patch release: project **Settings** saves now invalidate the cached project payload correctly so the project shell (title, dates, etc.) stays in sync without relying on a full client **`router.refresh()`**. **Deploy:** no new migrations; redeploy as usual.

### Fixed

- **Project settings — stale UI after save** — `getCachedProjectBySlugOrId` (`lib/projectCache.ts`) tags the fetch with **`project-detail`**; **`PATCH`**/**`DELETE`** `/api/projects/[id]` revalidate that tag (with existing `portfolio-metrics` / `projects-list`). **Project Settings** no longer calls **`router.refresh()`** after a successful save; tag revalidation is enough. Implementation: `app/api/projects/[id]/route.ts`, `components/ProjectSettingsTab.tsx`.

### Documentation

- **Technical Reference** — API overview: `GET/PATCH/DELETE /api/projects/[id]` notes **`project-detail`** revalidation after mutating requests.
- **README** — Release tag example updated to **v1.0.5**.
- **User Guide** — Release version line updated to **1.0.5**.

## [1.0.4] - 2026-04-14

Minor release: **project create** can populate **assignments** and **Float scheduled hours** from merged Float import history when the new project matches a Float project name; documentation now matches **Admin Float API sync** write behavior (`floatApiSyncWindow` / no blanket pre-delete). **Deploy:** no new migrations; redeploy as usual.

### Added

- **Projects — Float backfill on create** — `POST /api/projects` (`app/api/projects/route.ts`): after creating a project, if the **name** (or optional **`floatProjectName`**, e.g. from the New project Float project dropdown) matches a project in merged **`FloatImportRun`** history, Workbench upserts **`ProjectAssignment`** rows using `resolveRoleIdForNewAssignmentFromFloat` (Float role + job title via `lib/float/roleWorkbenchMatch.ts`), creates missing **`Person`** rows, and batch-upserts **`FloatScheduledHours`** via `getProjectDataFromAllImports` and `floatScheduledHourRowsFromMergedLists`. JSON response includes **`backfillFromImport`** (`matched`, `assignmentsCreated`, `floatHoursCreated`, optional **`floatHoursNote`** when assignments exist but no float hours were in history). Tests: `__tests__/lib/roleWorkbenchMatch.test.ts`.

### Documentation

- **User Guide** — *Creating a new project*: Float backfill on create; *Float sync* → *What sync does*: Admin API sync uses upserts + removed-person cleanup (not bulk pre-delete of all incomplete weeks); aligns with `executeFloatApiSync` + `floatApiSyncWindow`.
- **Technical Reference** — *Float sync behavior* (**Writes** / **Cleanup**), *Manual QA checklist*, **`POST /api/projects`** row in API overview.
- **README** — Float sync summary and new-project backfill pointer.
- **Errata (1.0.1 release notes)** — The **1.0.1** “stale hours” fix described a delete-then-upsert behavior that applies to **non–API-sync** import paths; **Admin → Float API sync** documents the correct model as of this release (see *Documentation* above).

## [1.0.3] - 2026-04-10

Patch release: Float scheduled hours now subtract **time off** using the same person identifiers Float returns on `/v3/timeoffs` as the PTO UI (`people_ids` array, with `people_id` as fallback). **Deploy:** no new migrations; redeploy the app and run **Admin → Float sync** so `FloatScheduledHours` refresh with corrected exclusions.

### Fixed

- **Float sync — PTO excluded from scheduled-hour rollups** — `buildExcludedUtcDatesByFloatPeopleId` (`lib/float/excludedDays.ts`) previously read only `people_id` on each time off row. Float’s API commonly returns **`people_ids`** (array) without a top-level `people_id`, so **no** time off was applied when merging exclusions for `aggregateTasksToWeeklyHours`. PTO and holiday **pills** and the project **PTO** tab still looked correct (they use `floatPeopleIdsFromTimeoffRow` in `lib/float/ptoholidaySyncWriters.ts`). The exclusion builder now resolves people the same way (**`people_ids` first, then `people_id`**), so **Resourcing → Float** weekly hours match non-working days. Tests: `__tests__/lib/float/excludedDays.test.ts`.

### Documentation

- **Technical Reference** — Float sync behavior: document time-off person resolution for `excludedUtcDatesByFloatPeopleId`.
- **User Guide** — Float sync: note that scheduled-hour math aligns with PTO data for `people_ids`-only time off rows.
- **README** — Release tag example updated to **v1.0.3**.

## [1.0.2] - 2026-04-09

Patch release: Float assignment **role** handling (job title preference, manual lock, safer fallbacks), **global backfill** from import history, documentation updates, and database migrations for `ProjectAssignment.syncRoleFromFloat`. **Deploy:** ensure production `DATABASE_URL` is set; Vercel build runs `prisma migrate deploy` before `next build`, which applies `20260409145854_project_assignment_sync_role_from_float` and `20260409220000_ensure_sync_role_from_float_if_missing`.

### Added

- **Admin — restore Float hours for all projects** — `POST /api/admin/backfill-float-all` and **Admin → Float sync** → **Restore hours from import history (all projects)** repopulate `FloatScheduledHours` for every project from merged `FloatImportRun` history (`lib/backfillFloatFromImports.ts`), using the same merge rules as per-project **Backfill**. Revalidates `project-resourcing`. Requires at least one prior Float sync so import runs exist.

### Documentation

- **User Guide** — Float sync: updated **Matching rules** for job-title-first role resolution, preferred fallback for new assignments, and preserving existing roles when Float labels do not map; added **Restore hours from import history (all projects)** and **Assignment roles and Float sync**; Admin entry point described as **sidebar** (not header).
- **Technical Reference** — Documented `POST /api/admin/backfill-float-all`.
- **README** — Float sync section summarizes assignment-role behavior and the all-projects restore action.

### Changed

- **Float sync — assignment role from job title** — When **`syncRoleFromFloat`** is true, Workbench prefers **`Person.floatJobTitle`** (Float `job_title`) mapped to a Workbench `Role` via `resolveJobTitleToWorkbenchId` and **`FLOAT_JOB_TITLE_ALIASES`**, then Float **scheduling** role names from tasks (`lib/floatImportApply.ts`). Extend aliases in `lib/float/roleWorkbenchMatch.ts` as needed for your org’s titles.

### Fixed

- **Float sync — project assignment roles** — Float import no longer assigns the same fallback role (previously the first Workbench role alphabetically, often **Analytics Engineer**) to everyone when Float’s role label did not exactly match a Workbench `Role` name. Unmapped Float roles now **keep** the existing assignment role for that person on the project; **new** rows use a stable preferred fallback (`lib/float/roleWorkbenchMatch.ts`). Float labels are matched with normalization and optional aliases. **`ProjectAssignment.syncRoleFromFloat`** (default true): saving a role in **Settings → Assignments** sets it to false so Float sync does not overwrite manual role choices.

## [1.0.1] - 2026-04-08

Patch release: Float sync correctness and performance, with a database index migration (`prisma/migrations/20260408155337_float_scheduled_hours_project_week_index`). Deploy with `prisma migrate deploy` (included in `npm run build`).

### Added

- **Float sync — people added on tasks get project assignments** — For every Float **(project, person)** pair that appears on a **task** in the sync window, Workbench upserts **`ProjectAssignment`**, even when that pair produces **no** positive weekly hours (for example **0 hours per day**, or weekdays fully excluded by PTO/holidays so **`FloatScheduledHours`** rows are never written). People still appear under **Settings → Assignments** and on the Resourcing grid when the role can be resolved. If Float has **no** mappable role (`role_id` missing, unknown name, or no match in Workbench), sync uses the **first Workbench role by name** as a fallback so the person is not omitted. Implementation: `executeFloatApiSync` / `mergedFloatByProjectPerson` backfill from `tasksForSync`, `fallbackRoleIdForAssignment` and batched `INSERT … ON CONFLICT` in `lib/floatImportApply.ts`. Tests: `__tests__/api/admin/float-sync.test.ts`.

### Changed

- **Float sync — database performance** — Clears future **`FloatScheduledHours`** with **tuple `(projectId, personId) IN (…)`** deletes (`deleteFutureFloatScheduledHoursForPairs` in `lib/floatImportApply.ts`) instead of large `OR` filters or **N** per-pair `deleteMany` calls. Adds index **`FloatScheduledHours_projectId_weekStartDate_idx`**. **`syncPeopleFromFloatList`** loads **`Person`** rows **only** for Float `people_id` / name matches, not the full table. **`PTOHolidayImpact`** cleanup uses **`NOT EXISTS`** against **`unnest(ARRAY[…])`** for large approved-id lists. Returns **`touchedProjectIds`** from `applyFloatImportDatabaseEffects` for downstream use. **`POST /api/admin/float-sync`** revalidates **`revalidateTag("project-resourcing")`** once (with **`GET /api/projects/[id]/resourcing`** also tagged globally) instead of revalidating every project id in a loop.

### Fixed

- **Float import — stale hours when schedules change** — Import paths that **omit** `floatApiSyncWindow` now delete incomplete `FloatScheduledHours` for `(project, person)` pairs that have incomplete-week rows in the merge **before** upserting, so weeks dropped from the merge do not leave stale future values where that delete path runs. Previously, only weeks present in the new aggregate were upserted. **Admin → Float API sync** (`executeFloatApiSync`) uses a different model (`floatApiSyncWindow` set): see **v1.0.4** documentation errata and [docs/USER_GUIDE.md](docs/USER_GUIDE.md) (*Float sync*). Completed (past) weeks are still never deleted or overwritten; people removed entirely from a project in Float are still cleaned up. Implementation: `applyFloatImportDatabaseEffects` in `lib/floatImportApply.ts`.

## [1.0.0] - 2026-04-06

First **stable major** release. The application is versioned with [Semantic Versioning](https://semver.org/spec/v2.0.0.html): **1.0.0** marks production readiness and a commitment that **documented** environment variables, HTTP API shapes, and user-facing behavior will only change in breaking ways with a new **major** version (unless called out as experimental). See [README.md](README.md) and [docs/TECHNICAL.md](docs/TECHNICAL.md) (*Versioning*).

### Added

- **PTO & holidays (Float-backed)** — Float API sync persists day-level **`PTOHolidayImpact`** (`lib/float/ptoholidaySyncWriters.ts`). **Resourcing** Float column shows PTO/holiday indicators; project **PTO** tab (`ProjectPtoTab`), **PTO & Holidays** company page (`/pto-holidays`, `GET /api/company/pto-holidays`), and **Upcoming PTO & holidays** on PM/PGM/CAD dashboards (`PgmPtoWidget`) surface the same data for planning visibility.
- **Trigger.dev (optional)** — `trigger/floatSync.ts` defines scheduled tasks that call `executeFloatApiSync` (same core sync as **Admin → Float sync**). Config in `trigger.config.ts`; see Technical Reference for env and operational notes.

### Changed

- **Float — API sync replaces CSV upload**: Scheduled hours are loaded from the Float API (**Admin → Float sync**, `GET`/`POST` `/api/admin/float-sync`). CSV upload and `papaparse` were removed. Documentation (README, User Guide, Technical Reference) and integration tests were updated; `__tests__/api/admin/float-sync.test.ts` mocks Float HTTP and runs `executeFloatApiSync` against the database, while `float-import-cleanup.test.ts` still validates `applyFloatImportDatabaseEffects` behavior.
- **App shell — sidebar**: Authenticated app routes use **`AppShell`** (`components/AppShell.tsx`) for the shared sidebar + main header layout (refactored from `app/(app)/layout.tsx`). The **top of the sidebar** greets the signed-in user with **Hi &lt;First name&gt;** (derived from session **name**, or from the **email** local-part before `@`), instead of the static title “Project Workbench”. **Sidebar nav icons (Lucide)**: **PGM Dashboard** — `Network`; **CAD Dashboard** — `Users`; **PTO & Holidays** — `CalendarOff` (`components/AppSidebar.tsx`).

### Fixed

- **Split-week actuals — Resourcing vs rolled-up totals** — `hasMissingActualsSplitWeek` (`lib/budgetCalculations.ts`) aligns amber “missing” styling on split **Actual** cells with per-month unlock rules; **`PATCH /api/projects/[id]/actual-hours`** keeps **`ActualHours`** totals aligned with **`ActualHoursMonthSplit`** when split parts are saved. Reduces false “missing” highlights when only one month-half of a split week is due.
- **Split-month Resourcing Actual cells — clear vs zero**: Clearing a month-half field (empty input on blur) **deletes** that **`ActualHoursMonthSplit`** row by sending `hours: null` in the `parts` payload, instead of saving **0** hours—so “no entry” stays distinct from “worked zero hours”. **`PATCH /api/projects/[id]/actual-hours`** recomputes the weekly **`ActualHours`** total from remaining split rows (or clears it when no splits remain). **`ResourcingGrids.tsx`** maps empty blur to `null` and merges local split state accordingly.

## [0.3.0] - 2026-04-01

### Added

- **Documentation — CDA projected hours**: User Guide and Technical Reference describe **Projected surplus at contract end** and **Avg hours per future month (after current plan)** on the CDA Budget sub-tab; formulas and implementation live in `lib/cdaCalculations.ts` (`computeCdaProjections`).
- **Documentation — Projects list**: User Guide and Technical Reference describe `/projects` (filters, sorting, pagination, My Projects and Person linking, portfolio metrics on dashboards). Technical Reference adds a **Projects list page** section with implementation details (`getDashboardContext`, query params, Prisma `select`, pagination behavior for key-role sorts). README links to this in the Technical Reference blurb.
- **CDA — Report hours only**: Documented in the User Guide and Technical Reference. Project setting `cdaReportHoursOnly` hides budget-dollar columns on the CDA Overall row in status copy, CDA status report preview/PDF, and locks the choice in each report snapshot at creation time.
- **PM / PGM / CAD dashboards — Request column**: The projects table includes a **Request** column (sortable) that shows when at least one **visible** project assignment has **Ready** turned on in the Resourcing tab **Planned** grid (stored in `ReadyForFloatUpdate`). Amber dot = open request; muted dot = none. Toggling Ready revalidates portfolio dashboard cache so the indicator updates promptly.
- **PM / PGM / CAD dashboards — 1-wk recovery column**: The projects table on each dashboard includes a **1-wk recovery** column showing revenue recovery % for the **most recent completed week** (the same week as the portfolio **This week** revenue recovery card). The existing **4-wk recovery** column still shows recovery over the rolling previous four completed weeks. Both columns are sortable.
- **Split-week actual hours**: For weeks that span two calendar months (Monday–Sunday across a month boundary), actual hours can be recorded **per calendar month** so CDA monthly actuals and rollups stay correct. The Resourcing **Actual** grid shows two sub-cells (with month labels) for those weeks; hours are stored in `ActualHoursMonthSplit` and must be in quarter-hour increments. Legacy rows can be backfilled with `npm run migrate:split-week-actuals` (see Technical documentation). The CDA tab derives month-to-date actuals from these splits plus single-month weeks.

### Removed

- **Projects — At Risk filter**: The "At Risk" tab on `/projects` and `GET /api/projects/at-risk` were removed. Portfolio risk and recovery signals remain on the PM, PGM, and CAD dashboards.

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
