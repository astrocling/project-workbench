# Project Workbench — User Guide

This guide explains how to use Project Workbench for project budget and resourcing. It reflects **release 1.2.8** as a baseline and newer behavior documented in [CHANGELOG.md](../CHANGELOG.md) (including Slack integrations and **Industry groups** taxonomy when your deployment includes them). The same content is available in the app at **User Guide** (`/user-guide`). Additional FFW Agency materials are in the [Confluence User Guide folder](https://ffwagency.atlassian.net/wiki/spaces/PW/folder/6305710084/User+Guide). The content is written in standard Markdown so you can copy it into Confluence (paste as Markdown or use Confluence’s Markdown macro).

---

## Getting started

### Logging in

1. Open the app URL (e.g. `https://your-app.vercel.app` or `http://localhost:3000`).
2. Enter your **email** and **password**.
3. After signing in, you are taken to the app—by default the **PM Dashboard** (or the page you were trying to open, such as the Projects list).

If you see "Invalid email or password", an administrator may need to run the initial database seed or add your user account (see Technical documentation).

### Sidebar (signed-in app)

After you sign in, a **left sidebar** is always visible on main app pages (dashboards, Projects list, project detail, PTO & Holidays, Account, etc.):

- **Header** — **Jakala** logo (full wordmark when the sidebar is expanded, compact **`j512`** mark when collapsed) and a control to **collapse** or **expand** the sidebar. The same compact mark appears in the **browser tab** (favicon).
- **Navigation** — When the sidebar is **expanded**, the first row under the logo is **Hi &lt;your first name&gt;** (from your profile name, or from your email before `@` when no first name is available), then links such as **PM Dashboard**, **PGM Dashboard**, **CAD Dashboard**, **PTO & Holidays**, and **Projects**. When **collapsed**, that greeting row is hidden so the narrow rail stays icon-focused; your full display name still appears in the footer when expanded, and screen readers are informed when the sidebar is collapsed. Clicking a sidebar link or a project **tab** (Overview, Budget, and so on) opens that view **scrolled to the top**. Browser **Back** / **Forward** can restore the previous scroll position.
- **Footer** — Theme (light/dark), **User Guide**, **Account** (profile and password), **Admin** (if you are an admin), and **Sign out**.

Open individual projects from the **Projects** list or your role dashboard tables as usual.

### First-time setup (administrators)

The first admin user is created when the database is seeded. Use the credentials configured in the environment (e.g. `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`). Do not use default credentials in production.

---

## Projects list

The main Projects page (`/projects`) lists projects you can access. Use the filter tabs to narrow the list.

| Filter | Description |
|--------|-------------|
| **My Projects** | Projects where you are assigned a **key role** (PM, PGM, or CAD). Workbench matches your login to a **Person** record (typically by email, or by name if your user profile’s first and last name match a person). If no person is linked, this filter shows no rows. |
| **Active Projects** | All projects with status Active. |
| **Closed Projects** | All projects with status Closed. |
| **All Projects** | Every project. |

**Sorting and URL:** Click a column header (Name, Client, Status, PMs, PGM, CAD) to sort; the URL updates with `sort` and `dir` (`asc` / `desc`). Each click toggles direction.

**Pagination:** Long lists are split into pages (default **100** projects per page). The page shows a range (e.g. “Showing 1–100 of 250”) and **Previous** / **Next** when needed. Optional query parameters: `page` (1-based) and `pageSize` (up to 200).

**Portfolio risk and recovery:** Buffer, recovery, and related portfolio views are on the **PM**, **PGM**, and **CAD** dashboards—not on the Projects list.

From the table you can:

- Click a **project name** to open the project detail page.
- Use the **Actions** column (icons) when you have edit or delete permission:
  - **Edit** (pencil) — Opens the project edit page (Settings and key details).
  - **Backfill** (refresh) — Repopulates this project’s Float scheduled hours from the **latest** Float sync snapshot. Use this when a project is missing Float hours (e.g. create timed out before this fix, or the name did not match). A confirmation dialog appears first; it explains that existing float hours for the project may be overwritten and that this isn’t a common action—if you aren’t doing it on purpose, it’s best to cancel. Admins can restore **all** projects from **full** stored sync history at **Admin → Float sync** (*Restore hours from import history (all projects)*).
  - **Delete** (trash, Admins only) — Permanently removes the project and all its data. A confirmation modal appears: you must type the project name exactly to confirm before the delete is performed. This cannot be undone.

---

## Project detail

Each project has a detail page with several tabs. The header shows the **as-of date** (end of the previous week), which is used for all “to date” calculations and which weeks are considered completed.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Summary, key roles (PM, PGM, CAD), project notes, SOW, Estimate, Float, and Metric links, and a snapshot of **dollar** budget burn, **dollar** buffer, **Budget Burndown**, and resource efficiency. Editors can **Post week to Slack** from the right side of the **Float last updated** / **Actuals through** header (Slack mark on the button) when a **project Slack channel** is set in **Settings → Links**—see [Overview — Post week to Slack](#overview--post-week-to-slack). Shows the latest status report RAG and a **Status Report History** strip when reports exist; **View all →** (and **Create your first report →** when none exist) opens the **Status Reports** tab (`?tab=status-reports`). Click a report pill to open that report’s HTML view. When teammates have Float **time off** or a **regional holiday** in the rolling two-week window, small absence pills summarize who is out (see [PTO tab](#pto-tab)). |
| **Resourcing** | Planned hours, actual hours, and Float scheduled hours by person and week. Use this to compare plan vs actual vs Float and spot gaps. You can **collapse Weekly Actuals** (chevron on that section) to bring Planned and Float closer on screen. When Slack is configured, use **Request Resourcing Changes** to notify the org resourcing channel (see [Resourcing tab](#resourcing-tab)). A **shared Holiday / PTO / week-date header** stays at the top of the grids as you scroll; hover **HOL** / **PTO** pills for names, days, and weekday letters (see [Resourcing tab](#resourcing-tab)). |
| **PTO** | PTO and regional holidays for **project members** visible on the Resourcing grid across the project date range. Filter by week range and person; see who is on PTO or a holiday and whether a PTO day is full or partial. Data comes from Float sync (`PTOHolidayImpact`). See [PTO tab](#pto-tab). |
| **CDA** | (When enabled in Settings) Monthly planned and actuals for CDA reporting. Month-to-date actuals for each month incorporate **split-week** hours when a week crosses a month boundary (see Resourcing below). Optional **Report hours only** hides budget dollars on the Overall row in status copy and CDA reports—see [CDA tab](#cda-tab). |
| **Budget** | Contract lines, **Overview** (spend, hours, average rates), dollar burn, **Expected remaining**, **Budget Burndown**, and **Resource Efficiency**. See [Budget tab](#budget-tab). |
| **Timeline** | High-level timeline with month columns and up to four rows of bars and markers. Each bar has a label, start/end dates, row (1–4), and an optional color (Blue, Green, Amber, Teal, Slate, or Violet). On **status report** slides the timeline uses the same week-proportional layout but is **more compact** than the Timeline tab: only rows that contain bars or markers are shown, bar labels truncate when space is tight, and markers use the same Lucide-style icons as the Timeline tab. The same timeline (with colors) appears in status report previews and PDFs. Each saved report stores its **own** copy of the timeline when the report is created from **Project timeline**; if you change bars or markers later, use **Refresh timeline** while **editing** that report (Standard or Milestones) on the Status Reports tab to update that copy—see [Status Reports tab](#status-reports-tab). |
| **Plan** | (When enabled by an **Admin** in **Settings**) Beta schedule builder: a grid plus Gantt with phases and nested items. Editors drag **Gantt bars** (or milestone diamonds) to change dates, drag **bar edges** to resize ranges, drag a **phase grip** to reorder phases, and use an **item grip** to reorder, nest, or move items into another phase. Everyone who can open the project sees the tab. Editors set the **default schedule source** for new status reports (**Project timeline** or **Project Plan**). The **Timeline** tab remains available; Plan does not replace it. |
| **Status Reports** | Summary table of estimated budget, $ spent, $ remaining, budgeted/actual/remaining hours, with copy-to-clipboard and a % budget used (high est.) circle chart. Create, edit, view, and export status reports. Choose a **variation**: **Standard** (timeline + budget), **Milestones**, **CDA**, or **Modular** (sprint schedule, story points, velocity KPIs)—see [Status Reports tab](#status-reports-tab). When **Plan** is enabled, **Standard** and **Milestones** reports can choose **Project timeline** or **Project Plan** (with **phases only** or **phases + key dates**) at create time—see [Schedule source (Plan enabled)](#schedule-source-plan-enabled). **Standard** reports include an optional **Show project budget on report** toggle (default on) to hide the budget table and burn chart on the exported slide. **New** reports cannot be saved while **actuals are stale** (completed weeks with planned hours but missing actuals)—update the Resourcing tab first; the block clears immediately once actuals are filled in. When Slack is configured, **Post to Slack** (Slack icon) sends the latest saved report summary to the linked account's Slack channel. Standard and Milestones reports can **refresh the stored timeline** from the Timeline tab or **refresh the stored schedule** from the Plan tab after the source changes. **Standard**, **Milestones**, and **CDA** reports can **Refresh budget** after Budget tab or Resourcing actuals change (on **CDA** that also refreshes locked monthly/overall hours)—see [Refresh budget](#refresh-budget-standard-milestones-and-cda-editors-only). **Update** alone does not change hours on the slide. **CDA** reports can **refresh stored milestone dates** after the CDA tab changes—see [Refresh milestones (CDA)](#refresh-milestones-cda-editors-only). |
| **Settings** | Edit project name, client, dates, status, single rate, notes, SOW/Estimate/Float/Metric links, optional **Slack channel ID** (for missing-actuals Tue/Wed nudges and **Post week to Slack**), resourcing thresholds, key roles, optional **CDA** tab, and (Admins only) **Enable Plan tab (beta)**. Within Settings, sub-sections include **Details** (includes read-only **Industry group** inherited from the linked Float **client account** when `accountId` is set — see Admin → Accounts), **Links**, **Key roles**, **Resourcing** (thresholds), **Rates** (per-role rate card or single bill rate), and **Assignments** (people assigned, their roles, bill-rate overrides, and “hidden from grid” for the Resourcing tab). |

Only users with edit permission can change data; the **Settings** tab may be read-only for some viewers.

### Overview — Post week to Slack

On **Overview**, editors see **Post week to Slack** (with a Slack icon) on the **right** of the same header row as **Float last updated** and **Actuals through week of**. It is not grouped with Open SOW / Estimate / Float / Metric.

The button posts a **weekly look-ahead** to the **project** Slack channel (**Settings → Links → Slack channel ID**)—not the account channel used by status-report **Post to Slack**.

| The message includes | Details |
|----------------------|---------|
| **Team this week** | Anyone with **Planned** or **Float** hours **> 0** on the current Monday–Sunday **UTC** week (same week as Resourcing). Hidden-from-grid people still appear if they have hours. Names use Slack **@mentions** when the person is linked to a Workbench user with a **Slack user ID**. **(Not in Plan)** means they have Float hours this week but no Planned hours (Workbench planned grid vs Float—not the Plan tab). |
| **This week** | Plan items (meetings, deadlines, milestones, tasks, and so on) and Timeline markers/bars whose **start date or end date** falls in that week. A long bar that only covers the week does **not** appear unless it starts or ends that week. Meeting times are included when set. |

Empty sections still post (for example _No one has hours this week._). The Slack message links back to this project’s **Overview** tab.

If no project channel is set, the button is disabled (tooltip: set a channel in **Settings → Links**). Viewers do not see the control. If Slack is not configured on the server, posting shows an error.

### Plan tab (editors)

When an Admin has enabled **Plan**, the tab is a Smartsheet-style grid (left) and Gantt (right):

- **Compact and Full** — The grid opens in **View** (Compact): nested names, a type icon, shortened dates (`M/DD`), and a **status icon** (empty circle / dotted circle / check; hover for **Not started**, **In progress**, or **Complete**). Switch to **Edit** (Full) to see Type, Start, End, Days, **Rpt**, Status, and row actions. Compact is for scanning; change names, types, dates, and status in Edit. **Neither View nor Edit scrolls the left table sideways**; the Gantt uses the remaining width.
- **Gantt zoom** — **Fit** sizes date columns to the pane when they still fit, but never shrinks a column so the header date is cut off — the chart scrolls sideways instead. **Day**, **Week**, and **Month** use the same readable column widths. Kickoff-day items sit in from the left edge so they are not clipped. A red **Today** line marks the current date (it sits on the start or end edge if today is outside the plan).
- **Dates on the Gantt** — Drag a task or assumed-meeting bar to move it (duration stays the same). Drag the left or right edge to resize. Drag a milestone, sign-off, hard-deadline, or scheduled-meeting diamond to change that single date. Dates snap to calendar days (the same as the Start/End cells). Child rows do not move when you drag a parent bar. **Escape** cancels a drag in progress.
- **Reorder phases** — Drag the **grip** on a **phase** row (not an item). Drop on **another phase** to insert **before** that phase (a blue line appears on the top of the target row). Drop on **Add phase** at the bottom of the grid to move the phase to the **end**. Items stay inside the phase when it moves. Dropping a phase onto an item row does nothing. No-ops (already last and dropping on Add phase, or already immediately above the target) are ignored.
- **Reorder and nest items** — Drag the grip on an **item** row. Drop **on another item** to nest under it (up to three levels). Drop on the **top edge** of a row to insert as a sibling before it. Drop on a **phase** row (or that phase’s **Add item** row) to make it a top-level item in that phase. Nested children travel with the item when it changes phase. Indent/Outdent still work.
- **Delete** — Select a phase or item, then **Delete** on the toolbar (or **Delete** / **Backspace** when you are not typing in a field). Deleting a phase removes all of its items. Nested children are removed with their parent.
- **Status reports columns** — **Rpt** chooses whether that phase or item appears on Plan-sourced status-report schedules. Short names for a specific slide are set on that report’s **Arrange this report’s schedule** board, not here. New key dates and scheduled meetings default to shown; tasks, waiting-on-client, and assumed meetings default to hidden as markers (they still stretch the phase bar).
- **Status** — Mark items **Not started**, **In progress**, or **Complete**. **View** uses icons for those states (hover for the full label). The Plan header shows how many items are complete. Completed key dates still appear on new reports (when **Rpt** is on) but are drawn faded.
- Viewers without edit permission see the grid and Gantt without grips or bar handles.

A copy-paste Confluence how-to for editors is in [Plan tab how-to](PLAN_TAB_HOWTO.md).

### Settings tab (editors)

Open **Settings** from the project detail page. Edits in **Details**, **Links**, **Key roles**, and other sections **save automatically** a short time after you stop changing fields (you may see a brief saved indicator).

- **Industry group (read-only)** — When Float sync has linked the project to a **client account**, **Details** shows that account’s **industry group** (or explains that none is set). To change it, an admin assigns the group on **Admin → Accounts** for that client; **all projects** sharing that account then show the same group. Until an account link exists, the panel explains that the project will inherit a group once sync links it.
- **Links** — SOW, Estimate, Float, Metric URLs, and optional **Slack channel ID** (`C…`) for the **project** channel. That channel is used for **Tuesday/Wednesday** missing-actuals nudges and **Post week to Slack** on Overview. It is **not** used for status-report **Post to Slack** (that uses the **account** channel under **Admin → Accounts**).
- **Renaming the project**: When you change the **project name**, Workbench may **update the page URL** to match the new slug (your tab stays on **Settings**). You do not need a full refresh for further edits or link saves to apply.
- **Assignments** — Add people to the project, set **role** and optional **bill-rate override**, and toggle **Hidden from grid** (see [Resourcing tab](#resourcing-tab)). When you **Add** someone without choosing a role, Workbench uses their **job title** from **Admin → People** (mapped to a Workbench role, same as Float sync)—not the first role in the list (often Analytics Engineer). You can still **Edit** the role afterward. **Remove** asks for confirmation: removing someone **permanently deletes all of their planned hours** on this project (actual hours are not deleted by this action). If they are no longer actively resourced but **past planned hours should stay** for budgeting, actuals, or column totals, use **Hidden from grid** instead of **Remove**. Float sync clears orphaned float and planned rows when there is no assignment left; removing here clears planned hours immediately.

---

## Resourcing tab

The Resourcing tab shows three grids (Planned, Actual, Float) by person and by week.

- **Weeks shown**: By default, the grid includes the **full project range** (project start → project end). You do not need to click “load more” controls to see additional weeks.
- **Sticky Holiday / PTO / dates**: One **Holiday** row (**HOL** pills), **PTO** row (**PTO** pills), and week-date row (Ready / Person / Role / Total + week labels) sits above all three grids. As you **scroll the grid pane down**, that header **stays at the top** while Planned, Actuals, and Float slide underneath. Each grid still has its own title row and buttons (Request Changes, Actuals chevron, Sync plan from Float).
- **Week columns stay aligned**: Horizontal week motion is **one scroller** for the header and all three tables. If Planning is on the week of Sep 7, Actuals and Float (and the Holiday/PTO row) are on that same week. Use trackpad, the pane scrollbar, **Shift + mouse wheel**, or **Scroll left / Scroll right** when weeks overflow. **Load earlier / later weeks** still sits above the pane.
- **Last week visibility**: When you scroll all the way to the right, the final week column remains fully visible (including its right border).
- **Current week**: The column for the **Monday–Sunday week (UTC) that contains today** has a **subtle background tint** across the week headers, all three grids (Planned, Actual, Float), and the variance/total rows—so you can quickly see which week is in progress. (Amber variance or red mismatch highlights still take priority when they apply.)
- **Collapsing Weekly Actuals**: In the **Weekly Actuals** grid title row, the small **chevron** on the right collapses or expands that grid (**Hide weekly actuals** / **Show weekly actuals**—also in the hover tooltip and for assistive technologies). When collapsed, only the title row remains and the vertical gap between **Planned** and **Float** tightens so you can compare those two grids with less scrolling. Expand again when you need to view or edit actual hours.
- **Planned grid — Ready**: Each person row has a **Ready** toggle (for Float sync). People **hidden from grid** (Settings → Assignments) are excluded from rows and from **Ready** / resourcing-request flows. When at least one visible person has **Ready** on, the **PM**, **PGM**, and **CAD** dashboard Projects tables show an **open request** in the **Request** column (see [Dashboards and Account](#dashboards-and-account)).
- **Hidden from grid — column totals**: Assignments can be marked **hidden from grid** under **Settings → Assignments**. Those people **do not appear as rows** in Planned, Actual, or Float, but their hours **still count** in each week’s **column totals** at the bottom of the grids (and in variance highlighting that compares totals). Use this when someone should stay on the project for reporting totals but should not clutter the working grid.
- **Request Resourcing Changes** (when Slack is enabled): Opens a short form to send a Slack message to your organization’s **resourcing** channel (set by an admin). The message tags the project’s **PM** and **PGM** (and optional notify list) and captures who had **Ready** on so resourcing can align Float. The **project name** in the message links to this project’s **Resourcing** tab in Workbench. If a **Float link** is set under **Settings → Links**, the message also includes **View in Float →**; if not, it shows _Float not linked_ (add the link in Settings when you have one). When an **open** request exists, use **Mark fulfilled** on the Planned grid header to run the fulfillment flow: Workbench syncs from Float, posts **Marked as fulfilled** in the Slack thread, and posts a **variance** message **only when** something did not match expectations (see below). You cannot send a new request until the open one is fulfilled. If you see **Slack is not configured**, an administrator must set **`SLACK_BOT_TOKEN`** and the resourcing channel in **Admin → Slack**.
- **Mark fulfilled — when Slack posts variance:** After resourcing updates Float, variance is reported only if (1) a **Ready** person’s Float hours still do not match **Planned** in Workbench (including “no Float changes detected” when Float never moved, or “partial week updates” when Float changed but not to match Planned), or (2) someone **not** on the Ready list had **Float** hours change after sync (week-level summary in the thread). It is **normal** for non-Ready people to have Float and Planned out of sync; that alone does **not** trigger variance. Editing **Planned** for a non-Ready person without a corresponding Float change does **not** trigger variance.
- **PTO and holidays**: When **Admin → Float sync** has run, the **shared header** shows a **Holiday** row (**HOL** pills) and a **PTO** row (**PTO** pills) for every week, and planned-hour cells can show PTO/holiday borders. Hover a pill or a marked cell for details. The hover card **sizes to the text** (long names are not clipped) and opens **below** the trigger in a floating card so it stays readable while the header is stuck.
  - **PTO** lines look like `Alexandru Cracea: 3 day(s) PTO (M, T, W)` or `Matthew Cannon: partial PTO (4h this week) (T)`.
  - **Holiday** lines look like `Labor Day (F)`.
  - Weekday letters are UTC working days: **M** Monday, **T** Tuesday, **W** Wednesday, **R** Thursday, **F** Friday. Thursday uses **R** so it is not the same letter as Tuesday.

### Split weeks (month boundary)

Workbench weeks run **Monday–Sunday**. When a week crosses from one calendar month into the next, the **Actual** grid shows **two inputs** in that week’s cell—one for each month (small month labels indicate which is which). Enter hours in **quarter-hour increments** (e.g. 8, 8.25); the two values should add up to the total worked that week.

- **Why**: Monthly CDA reporting and dashboards need hours attributed to the correct calendar month even when a single week spans two months.
- **Planned / Float**: Those grids still show one value per week (unchanged). Only **Actual** uses the split when the week spans two months.
- **When you can edit**: Uses **UTC** calendar dates. The **first** month in the split becomes editable once that calendar month has ended (for example, after 31 December you can enter December’s share of a December–January week, even while that week is still in progress). The **second** month follows the same rule as other Actual cells: you can enter it after the week is **completed** (not the current week). Expand the cell (split icon) to see both inputs.
- **Keyboard (Weekly Actuals)**: In the **Planned** grid, **Tab** moves across week columns and **Arrow Up/Down** move to the same week on the previous or next person row. In **Actual** month-split cells (expanded), **Tab** moves from the first month’s field to the second, then to the next week’s first field; **Arrow Up/Down** move to the same week column on the row above or below while **staying in the same month half** (top = first month, bottom = second). For a week with only one input, arrows land on that single field. Split-by-month, roll-up, and cell-comment controls are not in the **Tab** order so entry stays fast.
- **Expand or collapse every split week**: When the grid includes at least one month-boundary week, the **Weekly Actuals** header shows **Split weeks** next to **Expand** and **Collapse** — use these to open every split cell at once or roll them all back to the compact total (same as clicking each cell’s control). The buttons dim when there is nothing more to expand or collapse.
- **Clearing a month-half**: If you **clear** one of the inputs (leave it empty and move focus away), that month’s entry is **removed**—it is not saved as **0** hours. Use **0** only when you intentionally mean zero hours for that month. The week’s rolled-up total updates from whatever month parts remain.
- **Collapsing**: When both month parts are filled, you may see a single total for the week with an option to expand and edit the two parts again (depending on layout state).

### Actuals Stale (amber Actual cells)

Completed weeks (not the current week) where someone had **Planned hours > 0** but **Actual** is still blank show an **amber** background on that cell in the **Actual** grid. The project header may also show an **Actuals Stale** pill when any completed week is in this state.

- **Blank vs zero**: An empty Actual cell means **missing** actuals. Saving **0** hours means you intentionally entered zero for that week (or month-half in a split week)—that is **not** stale and the cell is not amber.
- **Planned, not Float**: Stale highlighting uses **Planned** hours as the allocation signal, not the **Float** column. Float can differ from Planned without triggering stale Actual styling.
- **Split weeks**: For weeks that span two calendar months, amber follows the same per-month rules described above (a due month-half with no saved entry is stale; a saved **0** for that month-half is not).

These rules also drive **automated missing-actuals Slack nudges** (below) for the **prior UTC week** only.

### Automated missing-actuals Slack nudges

When Trigger.dev is configured, Workbench sends weekly Slack reminders about **gaps in the prior UTC week** (Monday–Sunday immediately before the current week). A person is listed only when they **appear on the Resourcing tab** (not **hidden from grid**) and that week is **stale on the Actual grid** under the rules above (**Planned > 0**, Actual **blank**, split-week month-halves respected). **Float scheduled hours alone do not trigger a nudge.** People removed from **Settings → Assignments** (or Float placeholders removed from the project) are not listed, even if old planned-hour rows still exist in the database until the next Float sync or cleanup.

| Day (UTC) | Where the message goes |
|-----------|-------------------------|
| **Tuesday 15:00** | **Direct message** each **PM** who has a **Slack user ID** on their Workbench user (Admin → Users or **Account → Profile**). PMs without a Slack user ID: one post in the **project** Slack channel if **Settings → Links** has a **Slack channel ID**. |
| **Wednesday 15:00** | **Project** Slack channel only (**Settings → Links**). Includes extra reminder copy. Skipped if no project channel is set. |
| **Thursday 15:00** | **Account** Slack channel (**Admin → Accounts**) when the project is linked to an account with a channel. Skipped otherwise. |

Each message links to the project **Resourcing** tab and lists people still missing actuals for that week. Requires **`SLACK_BOT_TOKEN`** on the Trigger worker and channel/user IDs configured as above. See [Technical Reference](TECHNICAL.md#missing-actuals-slack-nudges-triggerdev) for implementation details.

---

## PTO tab

The **PTO** tab lists **PTO** (Float time off) and **regional holidays** for people assigned to the project who are **visible on the Resourcing grid** (not hidden under Settings → Assignments). You can narrow the **week range** and filter by **person**. Entries reflect data stored after **Float sync**; regional holidays apply when the person’s **Float region** matches the holiday region (same rules as scheduled hours—see [Float sync](#float-sync-admin-only)).

---

## Company PTO & Holidays

The sidebar link **PTO & Holidays** opens **`/pto-holidays`**, a company-wide view of PTO and holidays across **active people**. Use the **month** control and optional **person** / **region** filters to see who is out and how many people are on PTO in a given month. This page uses the same Float-backed data as the project **PTO** tab, aggregated for planning and visibility (not a substitute for HR systems of record).

---

## Budget tab

The **Budget** tab holds contract lines (SOW, CO, Other) with **low/high hours and dollars**, plus three summary cards, a **Budget Burndown** chart, and a **Resource Efficiency** section:

| Card | What it shows |
|------|----------------|
| **Overview** | Spent and hours through completed weeks vs the **high** totals, and **average rates**. |
| **% Budget Burn** | Dollar burn donut (actual dollars to date ÷ high dollar budget). |
| **Expected remaining** | Projected burn (person rates), leftover dollars, leftover hours at the project blended rate, and **Buffer ($)**. |

Projected **dollar** burn uses each person’s resolved bill rate (override → single project rate → role rate) times hours (`actual` when present, otherwise `planned`). **Buffer** and **projected remaining hours** follow leftover **dollars**, not leftover hours vs the hours cap. Mixed role rates on the rate card are why those two leftovers used to disagree.

| Metric | Meaning |
|--------|---------|
| **Spent / Hours** | Actual dollars and hours through completed weeks vs the **high** dollar and hours totals. |
| **Budget burn ($)** | Actual dollars to date ÷ high dollar budget. Same unit as Overview **Overall budget burn ($)** and dashboard **Budget burn ($)**. |
| **Projected burn** | Hours and dollars through the full plan (actuals where filled, otherwise planned), still at person rates. |
| **Projected remaining $** | High dollar budget minus projected burn dollars. |
| **Projected remaining hours** | Remaining dollars ÷ the **project blended rate** (not leftover vs the hours cap). With mixed rates this can be more or fewer hours than hours-cap leftover. |
| **Buffer ($)** | Remaining dollars ÷ high dollar budget. Under 7% is low (orange); negative is over budget (red). Same definition on the project Overview tab and PM/PGM/CAD dashboards. |
| **Average rates** | **Total Project** is the hours-weighted mix of completed-week actuals plus remaining planned weeks—the rate used to convert leftover dollars to hours. **To date** is actuals only; **Remaining plan** is current + future planned hours. Those two can differ when the remaining mix is senior- or junior-heavy. If there are no hours to blend, the converter falls back to past, then remaining plan, then implied contract rate (high $ ÷ high hours). **Remaining plan** shows **—** when there is no current or future planned mix. |

### Budget Burndown

Below the three cards, **Budget Burndown** shows **when** spend happened and whether remaining plan still lands under the contract high. The same chart (shorter) sits on the project **Overview** tab under the burn / efficiency donuts. It is **not** on PM/PGM/CAD dashboards.

Use **Week** or **Month** (default **Week**). Month groups weeks by the **Monday week-start** calendar month (a week that starts in January counts entirely in January). The choice is not saved; each visit starts on Week.

| Series | What it is |
|--------|------------|
| **Actual + Plan** (solid line) | Running total of spend: **actual $** on completed weeks that have actuals, **planned $** on missing-actuals weeks and on current/future weeks. At the last week this matches **Projected burn** on Expected remaining. Compare this line to **Contract high** to see whether you are heading over budget. |
| **Plan** (dashed line) | Running total of **planned $** only—if every week had hit the resourcing grid. |
| **Period burn** (bars) | Dollars **in that week or month** only. Completed weeks with actuals use actual $; later weeks use planned $. Missing actuals (planned hours, no actuals) use planned $, not $0—the bar is muted and the tooltip says **Missing actuals**. Bars share the same dollar scale as the lines and **Contract high**, so a typical week’s bar is much shorter than the cumulative lines. |
| **Contract high** | Horizontal line at the sum of Budget **high $** lines. Label is on the **left**. This is the **current** contract total, not a historical cap by week. Omitted if high $ is 0. |

Hover a week or month for period actual $ and hours, period planned, variance (actual − planned when actuals exist), both running totals, and remaining vs contract high. In **Month** view, a month that straddles as-of is **mixed**: completed weeks contribute actuals and later weeks in that month contribute plan.

**Float scheduled hours are not in this chart**—same as the Budget cards (plan + actuals only). Stale actuals make **Actual + Plan** follow plan for those weeks; fill Resourcing actuals to see true spend.

Below the chart, **Resource Efficiency** (plan vs actual dollars at person rates) shows **To date**, **This week** (most recent completed week), and **Previous 4 weeks**, plus a **Resource efficiency by month** chart. The same metric appears on the project **Overview** tab (**Resource efficiency to date** and **4-week resource efficiency**) and on PM/PGM/CAD dashboards. See [Resource Efficiency](#resource-efficiency).

**CDA** remaining hours, projected surplus, and hours-only reports still use the **hours cap** (high hours). This tab’s remaining hours follow leftover **dollars**—they will not always match the CDA surplus figure. See [Budget burn, buffer, and blended rates](#budget-burn-buffer-and-blended-rates).

---

## CDA tab

The **CDA** tab appears when **Enable CDA tab** is turned on in **Settings** for the project. It is used for monthly planned vs actual hours, milestones, and material you paste into status reports.

### Projected hours (Budget sub-tab)

On the **Budget** sub-tab, the card next to the monthly table shows two **forward-looking** figures (they use the same **budget high hours** as the Overall row when the Budget tab has hours; otherwise the sum of CDA planned hours). They differ from the **Overall** table’s **Remaining** hours, which is “as of today” using all month-to-date actuals including the current month. They also differ from the project **Budget** tab’s **projected remaining hours**, which convert leftover **dollars** at a blended rate instead of leftover vs the hours cap.

| Label | Meaning |
|--------|---------|
| **Projected surplus at contract end** | Compares the contract hours budget to a **projected total burn** through the last CDA month: **past months** use recorded MTD actuals; the **current month** uses **planned** hours (so mid-month partial actuals do not skew the forecast); **future months** use each month’s **planned** hours. A positive value means you are projected to finish under budget; a negative value means a projected deficit. |
| **Avg hours per future month (after current plan)** | Takes hours left after **prior months’ actuals** (`budget − burned so far`), subtracts the **current month’s planned** hours as “reserved,” then divides by the number of **strictly future** contract months. If you are already in the last month of the contract, this shows “—” (nothing to spread across future months). |

### Report hours only

On the CDA tab, under **Copy for status report**, there is a toggle **Report hours only** (editors only).

| Setting | What the Overall table and copy include |
|--------|----------------------------------------|
| **Off** (default) | **Budget ($)** columns (planned, actual to date, remaining) **and** **Hours** columns (budgeted, actual, remaining)—full financial and hours view. |
| **On** | **Hours only** for the Overall row: the three **Budget ($)** columns are hidden. Use this when the client-facing report should emphasize contract hours and not show dollar amounts. |

**Where this applies**

- **Copy for status report** on the CDA tab (the HTML table and the text you copy to the clipboard).
- **Status Reports** tab — when you preview or export a **CDA** variation report, the same Overall layout is used (preview and PDF match).
- **Saved reports**: When a status report is **created**, the current value is stored in that report’s snapshot. Older reports keep the Overall layout they were saved with; new reports use the project’s current setting at save time.

The monthly CDA tables (month-by-month planned and actuals) are unchanged; only the **Overall** summary row’s budget-dollar cells are affected by this toggle.

### Overall Hours Planned on CDA status reports

On a **CDA** variation status report (preview and PDF), the Overall **Hours Planned** value uses the **Budget** tab’s **high hours** total—not the sum of the monthly CDA planned column. Remaining hours and the hours-complete burn chart use that same baseline. If the project has no budgeted high hours yet, the report falls back to the sum of CDA monthly planned hours.

### Milestones sub-tab

Switch to **Milestones** on the CDA tab to manage sprint-style phases shown on **CDA** status report slides.

| Column | Meaning |
|--------|---------|
| **Phase** | Label (e.g. May Sprint). |
| **DEV START/END** | Development window (optional dates). |
| **UAT START/END** | User acceptance window (optional dates). |
| **Deploy** | Target deploy date (optional). Deploy on **Thursday** or **Friday** is highlighted as a reminder. |
| **Complete** | Mark done when the sprint is finished (completed milestones are deprioritized on the slide). |
| **On status** | Whether this row will appear on the exported slide (first **six incomplete** milestones, same rule as the PDF). |

Editors can **Add** milestones with the form above the table, toggle **Complete**, or **Delete** rows.

**Status report snapshot:** When you **save a new CDA status report**, Workbench stores a copy of **all milestone dates at that moment** in the report snapshot. Later edits on this tab (new dates, deleted/recreated milestones) do **not** change older reports until you use **Refresh milestones on report** on the Status Reports tab while editing that report—see [Refresh milestones (CDA)](#refresh-milestones-cda-editors-only). **New** reports always pick up the current milestone list when saved.

---

## Status Reports tab

The Status Reports tab is where you create and maintain status reports and export them as PDFs.

- **Stale actuals block new reports**: You cannot **save a new** status report if the project still has **missing actuals** for any **completed** week where someone had **planned hours** but **Actual is still blank** (same rules as amber cells on the Resourcing tab—explicit **0** hours do not count as missing). Update the **Resourcing** tab first; then create the report. As soon as you fill in the missing actuals in Resourcing, the block clears **immediately**—switch to Status Reports and the warning is gone and **New report** is enabled right away (no need to wait or refresh the page).
- **Preview and PDF match**: The in-app preview and the exported PDF use the same layout and styling. **Download PDF** captures what you see in the preview (not a separate server layout).
- **Two-page PDF when there are meeting notes**: The 16:9 status slide is page 1. If the report has **meeting notes**, they appear on **page 2** at the same width as the slide, with the **Meeting Notes** heading, divider, body (including links), and footer—matching the preview block below the slide.
- **Bigger, presentation-friendly default size**: The preview is auto-scaled larger (while still fitting your screen), and the downloaded PDF is generated at a larger default page size so you can present at 100% zoom without squinting.
- **Typography**: Status report fonts were updated for readability; the preview and exported PDF use the same typography.

### Report variations

When you create or edit a report, choose a **variation** from the dropdown:

| Variation | Bottom section on the slide |
|-----------|------------------------------|
| **Standard (Timeline/Project Budget)** | Timeline (when the project has bars) plus optional **HIGH/LOW** budget table and burn donut—see [Show budget on report](#standard-variation--show-budget-on-report) below. |
| **Milestones (Fixed Fee No Budget)** | Milestone table placeholder and burn donut (future phase). |
| **CDA (Monthly/Project CDA Budgets)** | CDA Overall and monthly tables (when CDA is enabled). |
| **Modular (Story Points / Velocity)** | Sprint schedule, story-point metrics, and donut KPIs—see [Modular variation](#modular-variation-story-points--velocity) below. |

**Copy from previous report** still pre-fills narrative and RAG from the most recent report before the selected date, regardless of variation.

### Schedule source (Plan enabled)

When an Admin has enabled **Plan** for the project (**Settings → Enable Plan tab (beta)**), **Standard** and **Milestones** reports show **Schedule source** when you create a new report:

| Field | Purpose |
|-------|---------|
| **Schedule source** | **Project timeline** (bars and markers from the **Timeline** tab) or **Project Plan** (compact phase bars and key-date markers from the **Plan** tab). Defaults to the value set on the **Plan** tab (**New status reports use**). |
| **Plan density** | Shown when source is **Project Plan**: **Phases only** or **Phases + key dates** (default). Fine-grained show/hide lives on the **Plan** tab (**Rpt**), then freeze into the report snapshot at create time. Short names for that slide are edited on **Arrange this report’s schedule**. |

**CDA** and **Modular** variations do not show these fields. Projects with Plan **off** always use **Project timeline** (legacy behavior).

On **edit**, schedule source and plan density are **locked** (read-only), same as report date and **Previous months on schedule**. Editing the Plan tab does **not** change saved reports. Use **Refresh timeline** or **Refresh schedule** (below) to replace the stored bars/markers after changing the Timeline or Plan tab. For Plan-source reports you can also **Arrange this report’s schedule**: a mini Gantt of the snapshot where you **drag** phase bars and key dates between rows (or into Hidden). Dates do not change. Click an item to rename it for this slide. If Plan is later disabled on the project, reports that used **Project Plan** still show their locked schedule source and density when you edit them, and the saved schedule keeps showing on the slide — but **Refresh schedule** fails with *“Plan is not enabled for this project.”* until an Admin turns Plan back on in **Settings**.

### Modular variation (Story Points / Velocity)

Use **Modular** for agile or multi-system delivery updates where the bottom of the slide should show sprint timing, story-point rollups, and velocity-style KPIs instead of the Standard budget block.

When you select **Modular (Story Points / Velocity)**, the form adds three editable sections. Each is stored on the saved report and can be updated with **Update** while editing:

1. **Sprint Schedule** — A table of phases with **Date range** (free text, e.g. `4/28 – 5/15`) and **Label** (e.g. `Development / Internal QA`). Use **Add row** / **Remove** to manage rows. Empty schedule rows are omitted from the exported slide.
2. **Story Points** — Define up to **four systems** (column headers, e.g. `OneSource`, `1CTX`). For each system, enter counts for **Planned**, **Completed**, **In Progress**, and **Carry Over**. Add or remove systems with **Add system** / **×**. The slide shows a **Key Metrics** table when at least one system is defined.
3. **Donut KPIs** — Two default KPIs (**Utilization Rate** and **Average Velocity**). Each has an editable **label** and a **manual percentage** (0–100) shown as a compact donut on the slide.

Modular reports share the same top-of-slide content as other variations: biographical block, RAG table, and completed / upcoming / risks columns. They **do not** include the Standard **HIGH/LOW** budget table or burn chart. If the project has timeline bars, the timeline strip may still appear above the modular panels (same rule as non-CDA reports).

New Modular reports start with empty schedule rows and story-point systems; donut KPIs default to **0%** until you enter values.

### Standard variation — show budget on report

When you create or edit a report with variation **Standard (Timeline/Project Budget)**, the form includes **Show project budget on report** (toggle, default **on**).

| Toggle | On the exported slide (preview and PDF) |
|--------|----------------------------------------|
| **On** (default) | Bottom section shows the **HIGH/LOW** budget table ($ and hours) and the **% budget used** burn donut, same as before. |
| **Off** | That bottom budget block is **hidden**. Timeline, RAG, activities, and other sections are unchanged. |

The **Status Report Summary** table on the tab (reference while editing) is **not** affected—you can still copy budget figures from there even when the slide omits them.

- **New reports** always start with the toggle **on**, even when Workbench copies narrative and RAG from a previous report.
- **Saved reports**: The choice is stored in that report’s **snapshot** when you save. You can change it with **Update** while editing. Older reports without this field still show budget (same as toggle on).

### Post to Slack (when configured)

If your team has connected Slack, a **Post to Slack** control (Slack icon + label) appears near the status reports list. It opens a short dialog: optional note (up to 500 characters), then **Post to Slack** (same icon). Workbench sends a **health update** summarizing the **most recent saved** report (RAG, budget figures, next milestone, etc.) to the **linked account's Slack channel** (Admin → Accounts).

This is a different action from Overview **Post week to Slack**, which posts a current-week team and dates digest to the **project** channel.

**Channel selection:** The project must be linked to a Float **account** (via Float sync), and that account must have a **Slack Channel ID** set under **Admin → Accounts**. The project-level **Slack Channel ID** in **Settings → Links** is **not** used for status posts—it is for automated **missing-actuals** nudges (Tuesday fallback and Wednesday) and **Post week to Slack** on Overview. If the account or channel is missing, you’ll get an error explaining what to configure.

**Mentions:** When PM/PGM (and linked **User** records) have **Slack user IDs** stored in **Admin → Users**, they can be @-mentioned in the posted message.

**Workbench link:** The message includes **View full report →**, which opens this project’s **Status Reports** tab in Workbench (`/projects/{slug}?tab=status-reports`). The server builds that URL from **`WORKBENCH_BASE_URL`** (same pattern as resourcing-request links to **`?tab=resourcing`**).

This action does not replace saving a report in Workbench; it only mirrors the latest saved snapshot to Slack.

### Saving a report

When you click **Save** (new report) or **Update** (while editing), Workbench saves the report, **closes the form**, refreshes the list, and **scrolls** the page so the **Status Reports** heading and table are in view. That makes it obvious the save succeeded and reduces the chance of clicking save again and creating a duplicate. For a **new** report, the list jumps to **page 1** (reports are ordered with the newest dates first, so your new row is usually there). Use **Preview** (eye icon) on a row when you want to open the report after saving.

### Snapshot (what stays fixed on a saved report)

When you **save a new** status report, Workbench stores a **snapshot** with the reporting period, budget (or CDA) figures, and—for Standard and Milestones variations—the **timeline** (bars and markers) as they were **at that moment**. For **CDA** variation, the snapshot also includes **milestone** dates from the CDA tab at save time. Preview, the HTML view, and PDF export all read from that snapshot so later changes to resourcing, budget, the **Timeline** tab, or **CDA milestones** do not change older reports unless you refresh (below).

**Modular** reports store sprint/story-point/donut content separately in the report’s **panels** field (not in the budget/timeline snapshot). The snapshot for Modular holds only the reporting **period** and **today** date. Panel data is editable on **Update** and is what preview and PDF use for the bottom section.

- **What you can still edit** on an existing report: narrative fields (completed / upcoming / risks / meeting notes), RAG values and explanations, **variation** where the form allows it, **Show project budget on report** for **Standard** reports (see above), **Arrange this report’s schedule** for Plan-source reports (mini Gantt: drag between rows or Hidden; click to rename), and sprint schedule / story points / donut KPI **panels** for **Modular** reports.
- **Meeting notes with formatting**: If you paste content that includes **HTML** from another tool, the preview, HTML view, and **Download PDF** keep **allowed** formatting (paragraphs, lists, links, basic styles) and drop unsafe markup automatically. Plain-text notes support line breaks and clickable URLs (paste `https://…` or use `[label](url)`). If client-side PDF generation fails, the preview offers **Download PDF (server)** as a fallback; that path may not preserve HTML formatting in meeting notes.
- **What stays locked** unless you use **Refresh timeline**, **Refresh schedule**, **Refresh budget**, or **Refresh milestones on report** (below): **report date**, **reporting period**, **schedule source** and **plan density** (when Plan is enabled or the report used Plan), **Previous months on schedule** (the 1–4 month window chosen at create time), budget/CDA monthly snapshot, **CDA milestone dates** (on CDA reports), and—by default—the **timeline** bars and markers (from Timeline or Plan, depending on source). Plan-tab edits never rewrite a saved report until you refresh.

### Refresh budget (Standard, Milestones, and CDA; editors only)

If you added or changed **Budget** tab lines, or corrected **Resourcing** actuals, **after** a report was saved, the report still shows the **old** locked budget and hours (including **$0** if the report was created before any budget lines existed) until you refresh it:

1. Open **Edit report** for that row (pencil).
2. Click **Refresh budget** (on **Standard** reports it sits under **Show project budget on report**; on **CDA** and **Milestones** it is under the variation selector).
3. Confirm to replace the budget stored on this report with current Budget tab totals and spend-to-date. On **CDA** reports this also updates **monthly hours**, **overall hours actuals**, and overall budget dollars on the slide. Timeline, milestones, and other snapshot data are **not** affected.

**Update** alone does not change hours on the slide — use **Refresh budget** after fixing actuals.

### Refresh timeline or schedule (Standard and Milestones, editors only)

If you updated the project **Timeline** tab **after** a report was saved with **Project timeline**, the report still shows the **old** timeline until you refresh it. If you updated the **Plan** tab after a report was saved with **Project Plan**, use **Refresh schedule** instead.

1. Open **Edit report** for that row (pencil).
2. Under **Previous months on schedule** (read-only on edit), click **Refresh timeline** (Timeline source) or **Refresh schedule** (Plan source).
3. Read the confirmation dialog: it explains that the **schedule stored on this report** will be **replaced** with your project’s **current** Timeline bars/markers or **current** Plan phases/key dates (including current **Rpt** settings). Per-report arrange tweaks (row, hide, short names) are kept when the same phase or item still exists. Your **report date** and **how many previous months** are shown do **not** change; other snapshot data (for example budget) is **not** affected.
4. Confirm to apply, or cancel to keep the existing stored schedule.

If the project has **no** schedule the app can render (for example **no end date**, or Plan with no dated phases when source is Plan), the action may fail with an error message—set the project end date and add content on the **Timeline** or **Plan** tab first. **Refresh schedule** also fails if **Plan** has been disabled on the project since the report was created.

Very old reports **without** a stored snapshot cannot use this action; create a new report if you need a current snapshot.

If the **preview** modal is open for that same report when you refresh, the preview **reloads** so you see the updated timeline without closing it.

### Refresh milestones (CDA, editors only)

If you updated **CDA → Milestones** **after** a CDA report was saved, the report slide still shows the **old** milestone dates until you refresh them:

1. Open **Edit report** for that CDA row (pencil).
2. In the **Status Report Summary** section, under **Milestones**, click **Refresh milestones on report**.
3. Read the confirmation dialog: it replaces **only** the milestone dates stored on this report with the **current** milestones from the CDA tab. CDA monthly budget rows and other snapshot data are **not** affected; **report date** and narrative/RAG fields are unchanged.
4. Confirm to apply, then **View** (or reopen preview) to verify the slide matches the CDA tab.

Each saved report must be refreshed individually if several were created before milestone updates. **New** CDA reports always snapshot current milestones at save time.

If the **preview** modal is open when you refresh, it **reloads** automatically.

### Timeline on status report slides

When a Standard or Milestones report includes a timeline (project has bars in the snapshot window), the slide shows a **compact** strip above the budget section (or above modular panels when applicable):

- **Month columns** align to weeks in the reporting window (same logic as the Timeline tab).
- **Rows**: Up to four logical rows exist in data, but the slide **only shows rows that have at least one bar or marker** — blank rows are omitted to save vertical space.
- **Bars**: Width reflects the bar’s dates on the axis. Short bars stay narrow; labels **truncate with an ellipsis** (…) when they do not fit, instead of spilling outside the bar. Bar colors match the Timeline tab palette.
- **Markers**: Shapes (Pin, Rocket, Thumbs Up, etc.) render as **icons** on the slide, matching the Timeline tab and PDF export.
- **Report date**: When the report date falls within the timeline range, a red vertical line and **Report date** label appear at that date.

Preview, **Download PDF**, and the server PDF fallback all use the same timeline rendering.

---

## Creating a new project

1. From the Projects list, click **New project** (or go to `/projects/new`).
2. Fill in:
   - **Slug** — Short URL-friendly identifier (e.g. `acme-2025`).
   - **Name** — Full project name.
   - **Client** — Client or account name.
   - **Start date** and **End date** (required).
   - **Status** — Active or Closed.
   - Optional: single bill rate, notes, SOW link, estimate link, Float link, Metric link, and resourcing thresholds.
3. Submit to create the project. You can then add assignments, key roles, budget lines, and rates from the project detail page.

**Float data on create:** If **Admin → Float sync** has run at least once, creating a project whose **name** matches a Float project in the **latest** import snapshot (`FloatImportRun`) automatically **creates `ProjectAssignment` rows** (using Float role names and each person’s Float **job title** when roles are resolved) and **writes `FloatScheduledHours`** from that snapshot—Workbench creates **`Person`** rows for any names that do not exist yet. The API response can include **`backfillFromImport`** with counts (and sometimes a note if assignments were created but no float hours were found; run **Float sync** again and use **Backfill** on the project if needed). Use the same **project name** as Float, or on **New project** choose a **Float project** from the dropdown when available so **`floatProjectName`** is sent.

If you use **Float sync** first, project names in Workbench should match Float (or you can create projects and run a **backfill** after sync to apply stored Float data).

---

## Float sync (Admin only)

Admins pull scheduled hours from the **Float API** (no file upload). The app reads Float people, projects, clients, roles, tasks, **time off**, **public holidays**, and **team holidays** for the same date window and updates Workbench to match. Scheduled hours use **UTC weekdays** in that window, minus **per-person** non-working days: Float **time off** (always), plus **public** and **team** holidays **only when** the person’s **Float region** matches the holiday’s region (see Admin People **Region** below). People **without** a Float region still get **time-off** exclusions but **not** regional holiday exclusions—set regions in Float if holiday weeks should line up. Time off is matched to people the same way for **scheduled-hour totals** and for **PTO** features (Float may attach time off to **`people_ids`** rather than a single **`people_id`** field).

### Where to go

**Admin → Float sync** (`/admin/float-sync`; older bookmarks to Float Import redirect here).

### Configuration

- **`FLOAT_API_TOKEN`** — Required on the server for sync to run. Get a token from Float (Account → Integrations / API).
- **`FLOAT_API_USER_AGENT_EMAIL`** (optional) — Contact email included in the API `User-Agent` string, as Float recommends.

If the token is missing, the sync action shows an error (API returns **503**).

### Matching rules

- **Projects** — Matched by Float project id once stored on the project (`floatExternalId`), or by project **name** (normalized). Use the same names in Workbench as in Float, or run sync after creating a project so the link is stored.
- **Duplicate Workbench project names** — If you accidentally have **two Workbench projects** with the **same name** (one linked to Float via **`floatExternalId`**, one older copy without a link), Float sync now writes **assignments** and **Float scheduled hours** to **both** so either project’s Resourcing tab shows the **Float** grid. Prefer **one** canonical project per Float project long term: archive or delete the extra copy after confirming data, so you do not maintain duplicate rows. The **Float** grid only shows hours for people who have a **project assignment** on **that** project.
- **People** — Pulled from Float; Workbench creates or updates `Person` rows (including Float id, **job title** from Float, and **Float region** id + display name when Float or holiday payloads provide them).
- **Accounts (clients)** — Float **clients** become Workbench **accounts** (**Admin → Accounts**). Sync matches by Float client id when already linked; if Float deletes and re-creates a client under the **same name** (new id), Workbench **rebinds** the existing account so Slack channel, industry group, and project links stay intact. New clients create accounts when the name is free; renamed clients update the account name when safe. If two live Float clients share one name (or a name cannot be claimed without colliding with another linked account), that client is **skipped** with a warning and the rest of sync still runs—check server logs for `[float-sync]` messages.
- **Roles** — Workbench matches Float scheduling roles and **job titles** to **Admin → Roles** names (with normalization). Unknown Float role labels appear on the sync page under **Last sync** so you can add or alias roles and run sync again. **Assignment role** resolution (when Float is allowed to set the role—see below): prefers the person’s **job title** in **Admin → People** (from Float `job_title`) when it maps to a Workbench role; otherwise uses the role name from Float tasks. If a label still does not map: **existing** assignment rows **keep** their current Workbench role; **new** rows use a stable preferred fallback (typically **Solutions Consultant**, not merely “first alphabetically”) so people are not skipped. You can always set or correct a role under **Settings → Assignments**; saving there tells Workbench **not** to overwrite that assignment’s role on future Float syncs until you turn that behavior back on (see *Assignment roles and Float sync* below).

### Holidays and sync failures

- **Admin → Holidays** (`/admin/holidays`) lists raw **public** and **team** holiday rows from Float (same default date window as sync). Use **Reload** to refetch; nothing is stored in Workbench for this page in v1.
- If Float **time off** or **holiday** API calls fail during sync, the sync **errors** (so totals are not silently wrong). Fix token/network issues and run sync again.
- **Account name conflicts** do **not** abort the whole sync (unlike older builds that failed with a unique constraint on `Account.name`). Unlinkable clients are skipped; fix duplicate client names in Float or adjust accounts under **Admin → Accounts**, then sync again if needed.

### What sync does

- **Accounts:** Links Float clients to Workbench accounts (create, rebind, or rename as above) so projects can inherit industry group and account Slack channels.
- **Assignments:** Updates **project assignments** for everyone on a Float **task** in the window—including people who end up with **no** weekly Float hours (for example **zero hours per day** on the task, or the week’s working days all excluded by PTO/holidays). Those people still get an assignment so they show on the project; the **Float** column may be empty for weeks with no scheduled time.
- **Multiple time blocks:** If the same person has more than one Float allocation on a project (separate workstreams, or 1h Monday and 1h Friday), weekly **Float** hours are the **sum** of those blocks—not just one of them.
- **Float scheduled hours (Admin API sync):** Writes **Float scheduled hours** for the **Float** grid by **upserting** incomplete weeks (current and future through the sync window) that appear in the merged Float snapshot. **Admin → Float sync** does **not** bulk-delete all future `FloatScheduledHours` for every in-sync pair before writing—doing so would wipe weeks that exist in Workbench from **backfill** or prior runs but are **outside** the current API task window. Instead, weeks present in this run are written with **`INSERT … ON CONFLICT`**, and **future** rows are cleared only for **(project, person)** pairs that **no longer appear** on the project in Float (see below). **Completed** past weeks are **not** overwritten. If you rely on a full refresh of every future week from Float alone, run **Admin → Float sync** on a window that includes those weeks, or use **Backfill** / **Restore hours from import history** when you need to realign from stored snapshots.
- **Removed in Float:** If someone no longer appears on a project in Float for the synced snapshot, their **future** Float scheduled hours for that project are cleared in Workbench. A later sync also removes **orphaned** float **and planned** rows (any week) when there is **no assignment** left for that person on the project—so stale past-week hours do not inflate totals or trigger incorrect missing-actuals nudges. The **assignment** row itself is left until you change it under **Settings → Assignments** (use **Hidden from grid** to keep historical planned hours while hiding the row, or **Remove** to delete the assignment and all planned hours on the project).

### What sync does **not** change

- **Planned** hours — Float sync never writes to the **Planned** grid (`PlannedHours`). Use **Settings → Sync plan from Float** on the project to copy stored Float scheduled hours into Planned for every week that has Float data (past, current, future), or edit Planned in the Resourcing grid for **current and future** weeks only (past Planned is read-only in the grid).
- **Actual** hours — not touched by Float sync.

### When Planned and Float still disagree

- **You didn’t copy Float → Planned:** The **Float** column updates from Admin Float sync; **Planned** does not, until you sync the plan (Settings) or edit Planned / use **Sync plan from Float** on the Resourcing tab (future/current weeks).
- **Past week in Float product ≠ Workbench Float column:** Admin Float sync **does not overwrite past** `FloatScheduledHours` rows. Workbench can keep an older snapshot; Planned (after **Sync plan from Float**) will match that snapshot, not necessarily today’s historical view in Float. Per-project **Backfill** reapplies the **latest** import snapshot (including completed weeks in that snapshot). **Restore hours from import history (all projects)** merges the full stored history.

### Limits

- **Rate limiting:** In production, if Redis is configured, sync is rate-limited (e.g. 20 requests per 15 minutes per user).

### Restore hours from import history (all projects)

On **Admin → Float sync**, **Restore hours from import history (all projects)** repopulates **Float scheduled hours** for **every** project from **all** stored Float sync snapshots (`FloatImportRun`). Per-project **Backfill** (Projects list or project settings) uses only the **latest** snapshot so it finishes quickly. Use the admin restore after a problematic sync or when many projects need historical float rows restored at once—only works if **Float sync** has run before so import history exists. Confirm the dialog before the operation runs.

### Assignment roles and Float sync

- By default, Float sync **updates** each project assignment’s **role** when it can resolve Float’s job title or scheduling role to a Workbench role.
- **Adding a person** in **Settings → Assignments** (without picking a role) uses the same mapping: their **job title** from **Admin → People**, then a Float scheduling-role hint if the title does not map, then a stable fallback (**Solutions Consultant**)—not the first role in the catalog (often Analytics Engineer).
- If you **change a person’s role** in **Settings → Assignments** and save, Workbench **stops** applying Float’s role for that person on that project on future syncs, so your choice sticks (see Technical Reference: `ProjectAssignment.syncRoleFromFloat`). To let Float drive the role again for that row, **remove the assignment and add the person again** (new assignments default to following Float and again use their job title), or have a developer set `syncRoleFromFloat` back to true in the database.
- Keep **Admin → People** **job titles** accurate so assignment roles align with how your org titles map to Workbench roles. Titles usually come from Float sync; you can also set them when **adding** someone manually (see *Admin → People* below).

---

## Admin: Roles, Industry groups, People, Users, Slack, and Accounts (Admin only)

Available from the **Admin** entry in the **sidebar** (admins only).

| Page | Purpose |
|------|---------|
| **Roles** | Create and manage roles (e.g. Project Manager, FE Developer). Role names must match the ones used on assignments and in Float. |
| **Industry groups** | Create and maintain **industry group** labels (taxonomy). Archive or restore groups (**archive** hides them from **new** account/user picks; existing links can stay until changed). Shows how many accounts and users reference each group. |
| **People** | Manage people in Workbench: view Float-backed fields (email, job title, tags, region, department, Float active, access), filter and sort the table, toggle **Workbench** active (**Remove** / **Add back**), and **add** people not yet in Float. **Job title** (Float `job_title`, stored as **`floatJobTitle`**) drives how Workbench maps a person to a role on project assignments; it is usually filled by Float sync but is **required** when you add someone manually. The **Region** column shows each person’s **Float region** by name when the last sync could resolve one (from people and/or holiday API data); otherwise **Region (id)** if only the numeric id is known, or **—** if unset—used for regional public/team holiday handling in Float scheduled hours. Linking a **User** to a **Person** (by email / account setup) helps Slack **@mentions** for PM/PGM and for people listed on **Post week to Slack** when their Workbench user has a **Slack user ID**. |
| **Holidays** | Read-only view of Float **public** and **team** holidays (API JSON) for troubleshooting schedules and regions. |
| **Users** | Manage app logins (email and password) and permissions. Set **User** or **Admin**, optional **position role**, optional **Slack user ID** (`U…`) so Slack messages can @mention the right person (status health updates, weekly look-ahead team list) and so **Tuesday** missing-actuals DMs can reach PMs. Optional **industry group** per user (independent from client accounts). Users can also set their own **Slack user ID** on **Account → Profile**. Use **Edit** on a row to open the edit dialog (see below)—including **New password** to reset someone’s password without changing their email. |
| **Slack** | Set the **resourcing** Slack channel ID where **Request Resourcing Changes** messages are posted. Choose which users are on the **notify** list for extra @mentions on those requests. The page reminds you that the bot token is configured via **`SLACK_BOT_TOKEN`** in the server environment. Project and account channels are set elsewhere: **Settings → Links** (weekly look-ahead and Tue/Wed nudges) and **Admin → Accounts** (status **Post to Slack** and Thursday nudges). |
| **Accounts** | List **accounts** (clients) synced from Float. Sync links by Float client id and rebinds when a client is deleted and re-created under the same name (Slack channel, industry group, and project links stay on that account). Set an optional **Slack channel ID** per account for **account-level** notifications (e.g. **Post to Slack** status health updates and Thursday missing-actuals summary—not Overview weekly look-ahead). Set an optional **industry group** per account—all **projects linked to that account** (via Float sync **`accountId`**) inherit that group on **Project → Settings → Details**. |

### Admin → Industry groups

Open **Admin → Industry groups** (`/admin/industry-groups`). Add groups with **New group name** + **Add**. The table lists each group’s **status** (active vs archived), how many **accounts** and **users** reference it, and actions:

- **Edit** — Change the **name** or mark **Archived**. Archived groups are not offered for **new** assignments on Accounts or Users, but existing links stay until an admin clears or replaces them.
- **Archive** / **Restore** — Quick toggle without opening the modal.

Define groups before assigning them on **Accounts** or **Users**.

### Admin → People

Open **Admin → People** (`/admin/people`). The table lists everyone in Workbench with columns for name, email, **Job title**, tags, region, department, Float scheduling active, access label, and **Workbench** active (whether the person is included in Workbench workflows). Default filter **Active = Yes** shows only people with Workbench active turned on.

- **Filters** — Narrow by job title, region id, department, and Workbench active. **Clear filters** resets to defaults.
- **Add person** — Opens a dialog to enter **Name** and select **Job title** (from the Workbench role catalog plus titles already on people). Both are required. The person is added to Workbench with **Workbench active = Yes**. If someone with the same name already exists (case-insensitive), their **job title** is updated. Float sync can enrich other fields later if the name matches Float.
- **Remove** / **Add back** — Toggles Workbench **active** without deleting the person or their Float data.

### Admin → Users

Open **Admin → Users** (`/admin/users`). At the top you can **create** a user (email, password, names, permissions, optional position role). Below, a **table** lists existing users (including an **Industry group** column when set).

- **Edit** — In the **Actions** column on the right, click **Edit** to change names, permissions, position role, optional **industry group** (separate from any client-account group), optional **Slack user ID**, and optionally set a **new password** (leave blank to keep the current password). **Save** applies changes; **Cancel** closes the dialog.
- **Narrow layouts** — If your browser window is small, the user table can scroll **horizontally** inside its card so **Edit** stays available. Long emails or names may show truncated with an ellipsis; hover the cell (or use your browser’s tooltip behavior) to see the full value when a native `title` tooltip is shown.

---

## Dashboards and Account

- **PM Dashboard** (`/pm-dashboard`): Projects where you are Project Manager.
- **PGM Dashboard** (`/pgm-dashboard`): Projects where you are Program Manager.
- **CAD Dashboard** (`/cad-dashboard`): Projects where you are Client Account Director.

Each dashboard includes **portfolio summary cards** (e.g. portfolio value, active project counts) and, when resource efficiency data exists, **portfolio resource efficiency** cards for **To date**, **This week** (most recent completed week), and **Previous 4 weeks**.

Below the portfolio cards, an **Upcoming PTO & holidays** section lists the **current and next ISO weeks** (Monday start) and, for each of your scoped projects, who is on **PTO** or a **holiday** among visible assignees. Use it as a quick visibility aid alongside the project tables.

The **Projects** table lists every active project in scope for that role. Columns:

| Column | Meaning |
|--------|---------|
| **Project** | Name (link), plus a **CDA** badge when the project has the CDA tab enabled. |
| **Client** | Client name. |
| **Budget burn ($)** | Dollar burn % vs the high dollar budget (color indicates health vs thresholds). |
| **Buffer ($)** | Dollar buffer %: leftover dollars after projected burn vs the high dollar budget; negative values may show “(Over)”. |
| **1-wk efficiency** | Resource efficiency % for the **most recent completed week** only—the same week labeled on the portfolio **This week** efficiency card. |
| **4-wk efficiency** | Resource efficiency % across the **rolling previous four completed weeks** (sum of actual vs forecast dollars for those weeks). |
| **Request** | Whether an **open request** is active: **Ready** is on in the project Resourcing **Planned** grid for at least one person who is **not** hidden from the grid (amber dot = open, muted = none). Sort to group projects with open requests. |
| **Actuals** | Whether weekly actuals look up to date, one week behind, or more than one week behind (traffic-light), based on **rolled-up weekly totals** vs planned for completed weeks. For **split-month** weeks, totals come from the sum of the two month parts once saved. The **Resourcing** Actual grid uses stricter per-month rules for **cell** highlighting on those weeks (amber = blank Actual where Planned > 0; saved **0** is not stale). Automated **missing-actuals Slack nudges** use the same Resourcing stale rules for the **prior UTC week** only. |
| **Status** | Overall RAG from the latest status report when the report is recent; a blue indicator if a report exists but is older than two weeks; gray if there is no report. |

Click any column header to **sort** (toggle ascending/descending). You can filter the table by **client** using the client dropdown when your portfolio spans multiple clients.

Use the sidebar to open these dashboards. The **Account** page (sidebar) has two sections:

- **Profile** — Set your optional **Slack User ID** (for @mentions and Tuesday missing-actuals DMs when configured) and link your login to your **Float person** record. The person dropdown lists people not already linked to another user, plus your current link. Saving updates **`Person.userId`** so **My Projects**, PM/PGM key-role matching, and Slack mentions resolve reliably without waiting for an admin.
- **Password** — Change your password (current password required).

---

## Key concepts

### Weeks and “as-of” date

- **Weeks** run Monday–Sunday. All hours (planned, actual, Float) are stored by the **Monday** of that week.
- The **as-of date** is the end of the previous week (Sunday). The app uses it to decide which weeks count as “completed” for to-date totals and which data you can edit. You cannot change the as-of date; it is set by the system.

### Planned vs actual vs Float

| Type | Meaning |
|------|---------|
| **Planned** | Internal estimate of hours (entered in Workbench). |
| **Actual** | Hours from timesheets or actuals (entered in Workbench). |
| **Float** | Scheduled hours imported from Float via **Float sync** (API). |

The Resourcing tab shows all three so you can compare plan, actual, and Float schedule.

### Budget burn, buffer, and blended rates

Workbench **health** (Budget tab, project Overview, PM/PGM/CAD tables) is dollar-based when role rates differ:

- **Budget burn ($)** — actual dollars to date ÷ high dollar budget.
- **Buffer ($)** — leftover dollars after projected burn ÷ high dollar budget (green ≥ 7%, orange under 7%, red if negative).
- **Projected remaining hours** (Budget tab only) — leftover dollars ÷ the **project blended rate** (hours-weighted person rates: actuals on completed weeks plus planned on current/future weeks).
- **Budget Burndown** — week/month chart of period $ and running **Actual + Plan** vs **Plan** and **Contract high**. See [Budget Burndown](#budget-burndown).

Projected **dollar** burn still multiplies each person’s hours by that person’s rate. The blended rate is only for converting leftover dollars into hours and for display on the Budget **Overview** card (**Total Project**, **To date**, **Remaining plan**).

**CDA** (and hours-only status copy) still uses the **hours cap**. A CDA **projected surplus** of leftover high hours can be smaller than Budget remaining hours when cheaper mix has burned more hours than dollars.

### Resource Efficiency

**Resource Efficiency** is actual billed dollars vs forecast (planned hours × rate) for completed weeks. It was previously labeled **Revenue recovery**. The calculation is unchanged.

| Surface | What you see |
|--------|----------------|
| **Budget** tab | Heading **Resource Efficiency**; cards **To date**, **This week**, **Previous 4 weeks**; chart **Resource efficiency by month**. Donut captions use **Efficiency**. |
| **Overview** tab | Pies **Resource efficiency to date** and **4-week resource efficiency**. |
| **PM / PGM / CAD** dashboards | **Portfolio resource efficiency** cards (**To date**, **This week**, **Previous 4 weeks**). Projects table **1-wk efficiency** and **4-wk efficiency**. |

A value over 100% means actuals exceeded the plan for that window. Color follows the same health bands as before (green ≥ 85%, amber 80–85%, red below 80%, orange above 100%).

### Key roles (PM, PGM, CAD)

Each project can have people in **key roles**:

- **PM** — Project Manager  
- **PGM** — Program Manager  
- **CAD** — Client Account Director  

Your **My Projects** list (on `/projects`) uses the **Person** link described in *Projects list* (email or name match to your user account). It shows projects where that person has a PM, PGM, or CAD key role. It does **not** filter by the optional **position role** field on your user account alone—that field is used elsewhere (e.g. which dashboard you land on).

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Invalid email or password** | Ensure the database has been seeded and your user exists. Ask an admin to run the seed or add your account in Admin → Users. |
| **Budget remaining hours do not match CDA surplus** | That is expected. Budget remaining hours are leftover **dollars** ÷ blended rate. CDA surplus is leftover vs the **hours cap**. See [Budget burn, buffer, and blended rates](#budget-burn-buffer-and-blended-rates). |
| **Remaining plan rate shows —** | There is no current or future **planned** mix to average. **Total Project** still uses actuals (and planned fallbacks on past weeks). |
| **Project names must match** (Float) | Create projects in Workbench with names that match Float, or run sync so `floatExternalId` is set. Add missing roles in Admin → Roles and sync again if needed. |
| **New project has no Float people or hours** | Fixed in **v1.2.6**: create reads only the **latest** Float sync snapshot. Hard-refresh **Resourcing** (not Overview—Overview shows planned/actual hours, which stay 0 until you enter them or **Sync plan from Float**). If it is still empty, run **Admin → Float sync** then **Backfill** on the project. |
| **Float hours look low vs Float** | Fixed in **v1.2.7**: if someone has **multiple allocations** on the same project (workstreams, or split days in a week), older syncs kept only the largest block per day. After this fix, run **Admin → Float sync** and hard-refresh **Resourcing**. |
| **Float Actuals empty after sync** | Confirm **Admin → Float sync** completed without error (Trigger.dev alone does not refresh the Resourcing page cache—run Admin sync or wait ~60s and hard-refresh). Check for **duplicate projects with the same name**; as of **v1.2.3**, sync mirrors hours to the linked project and unlinked copies. Run **`npx tsx scripts/debug-backfill-match.ts <projectSlug>`** against production `DATABASE_URL` to see duplicate names, sync target ids, and row counts. **Backfill** alone does not create assignments; sync (or manual assignments) is required for the **Float** grid to show people. |
| **Sync plan from Float fails (500 or “Sync failed”)** | As of **v1.2.4**, long Float import history no longer crashes the server. If it still fails, read the alert message. Ensure **Admin → Float sync** or **Backfill** has populated **Float** hours and the people appear in **Settings → Assignments** (not hidden from grid). |
| **New assignment shows Analytics Engineer (or the first role)** | Fixed in **v1.2.7**: adding someone in **Settings → Assignments** uses their **job title** from **Admin → People**. If the title is blank or does not match a Workbench role, set/correct it there, then **Remove** and **Add** them again (or **Edit** the role on the assignment). Existing rows are not rewritten. |
| **Refresh budget missing on a CDA (or Milestones) report** | Fixed in **v1.2.8**: open **Edit report** — the button is under the variation selector. It used to appear only on **Standard** reports (next to **Show project budget on report**). |
| **Refresh schedule says “Plan is not enabled for this project.”** | The report was created from **Project Plan**, but Plan has since been turned off in **Settings**. The saved schedule still shows on the slide; ask an Admin to re-enable **Enable Plan tab (beta)** before refreshing. |
| **Cannot drag phases or items on Plan** | You need **edit** permission, and Plan must be enabled. Viewers see the grid and Gantt without grips. Drag from the **grip**, not the name. Use a **phase** grip to reorder phases; an **item** grip to nest or move items. If the drop highlight disappears, you are over a no-op target (same position). |
| **Reordered Plan rows but the status report looks the same** | Saved reports keep their snapshot until you **Refresh schedule** (Plan source) while editing that report. Phase order on the Plan tab does not rewrite existing slides by itself. |
| **Edit form shows correct hours but the slide stays old after Update** | **Update** does not refresh locked budget/hours. Use **Refresh budget** while editing. On **CDA**, that also refreshes monthly and overall hours actuals (not only dollars). |
| **Float API not configured** | Set `FLOAT_API_TOKEN` in the server environment. |
| **Float sync fails with unique constraint on account name** | Fixed in current builds: sync rebinds accounts when Float re-creates a client under the same name. Redeploy if you still see this. If two **live** Float clients share one name, that client is skipped—rename one in Float and sync again. Check server logs for `[float-sync]` warnings. |
| **Slack is not configured** / health post errors | Admin must set **`SLACK_BOT_TOKEN`** on the server, invite the bot to channels, and configure **Admin → Slack** (resourcing channel), **Settings → Links** (project channel for missing-actuals nudges and **Post week to Slack**), and/or **Admin → Accounts** (account channel for status posts and Thursday nudges) as needed. |
| **Post week to Slack is disabled / grayed out** | Set **Slack channel ID** on **Settings → Links** (project channel `C…`). Invite the bot to that channel. Editors only; viewers do not see the button. |
| **Weekly Slack post is missing people or dates** | People need **Planned** or **Float** hours **this** UTC week. Dates come from the **Plan** tab and **Timeline** tab only if the item **starts or ends** this week (not merely spans it). **(Not in Plan)** means Float hours without Planned hours. |
| **Too many sync requests** | Wait and try again later; sync is rate-limited when Redis is configured. |
| **PTO/holiday hover is cut off or sits under the row above** | Current builds size the hover card to the text and open it in a **floating card below** the pill (not inside the table cell). Hard-refresh the **Resourcing** tab. Weekday letters are **M T W R F** (**R** = Thursday). |
| **Resourcing week columns don’t line up across Planned / Actuals / Float** | All three grids and the Holiday/PTO header share one scroller. Hard-refresh. Scroll weeks with **Shift + mouse wheel** or the **Scroll left / right** buttons, not a separate scrollbar on each table. |
| **New page opens already scrolled down** | Clicking a **sidebar** link or a project **tab** should start at the top of that page. If an older tab is still open, hard-refresh. **Back** / **Forward** can restore the previous scroll on purpose. Nested panes (for example the Resourcing week grid) keep their own scroll and are not reset. |
| **Page looks broken** (overlapping layout, wrong styles, sidebar over content) | Try a **hard refresh** (e.g. Mac: `Cmd+Shift+R`). If it persists, a **browser extension** may be injecting styles or scripts — see *Browser extensions* below. |
| **Wrong tab icon** (e.g. old Vercel triangle after an update) | Browsers cache favicons heavily. Hard refresh, clear site data, or open the app in an **Incognito/Private** window. |
| **Cannot assign industry group on account/user** | The group may be **archived**. Restore it under **Admin → Industry groups** or choose an active group. Existing links may still show “(archived)” until cleared. Projects inherit from **Admin → Accounts** only after Float sync links **`accountId`**. |

### Browser extensions

Some Chrome extensions can inject CSS or JavaScript into every page and break Project Workbench’s layout and styling. If the site looks correct in an **Incognito/Private** window but broken in a normal tab, the cause is likely an extension.

- **What to do:** Disable extensions one by one (or use Incognito for Workbench) until the layout is normal. Then either leave that extension disabled or restrict it so it doesn’t run on the Workbench site: right‑click the extension icon → **Manage extension** → set site access to *On specific sites* and remove your Workbench URL, or *On click*.
- **Known problematic extension:** The [Google Maps API Key Checker](https://chromewebstore.google.com/detail/google-maps-api-key-check/gjpanmpojpplcipiaigglekleicmgmel) extension has been observed to break the UI; disabling it or excluding the Workbench domain fixes the issue.

---

*For setup, deployment, and technical details, see the Technical documentation and the main README.*
