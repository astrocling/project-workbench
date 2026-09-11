# How to use the Plan tab (Project Workbench)

Copy this page into Confluence (paste as Markdown, or use Confluence’s Markdown macro). It is written for **project editors**. Viewers can open Plan but cannot drag or edit.

**Plan is beta.** A project **editor** turns it on per project in **Settings**. The **Timeline** tab is unchanged and still the default source for status reports unless you choose **Project Plan** when you create a report.

---

## Before you start

1. Open the project in Project Workbench.
2. Confirm you can **edit** the project (not view-only).
3. If you do not see a **Plan** tab, open **Settings → Enable Plan tab (beta)**.

Everyone who can open the project can **see** Plan. Only editors get grips, date handles, and toolbar actions.

---

## Open Plan and choose a grid density

1. Open the project and click **Plan**.
2. If there is **no plan yet**, click **Start from blank**. The grid opens in **Edit**.
3. Use **View** to scan names, types, shortened dates, and status icons (hover an icon for **Not started**, **In progress**, or **Complete**). Plans that already have phases open in View. The left grid does not scroll sideways in View or Edit.
4. Switch to **Edit** to see Type, Start, End, Days, **Rpt**, Status, add rows, and row actions. Every edit column stays on screen; the Gantt uses the remaining space.

**Gantt zoom:** **Fit** sizes date columns to the pane when they still fit, but never shrinks a column so the header date is cut off — the chart scrolls sideways instead. **Day**, **Week**, and **Month** use the same readable column widths. There is a small gap before the first date so kickoff items are not clipped, and a red **Today** line (on the start or end edge if today is outside the plan).

---

## Add phases and items

You must be in **Edit**. **View** hides add rows.

1. Click **+ Add phase** at the bottom of the grid.
2. Name the phase. Optionally set a color.
3. Click **+ Add item** under that phase (this row is there even when the phase has no items yet). New items start as tasks on the kickoff date; change type, dates, and status in the row.
4. To add another item after an existing one, use that item’s plus icon, or click **+ Add item** again to append a top-level item in the phase.
5. Nest items with **Indent** / **Outdent**, or by dragging (next section). Nesting is limited to **three** levels.

Collapsed phases hide **+ Add item**. Expand the phase (chevron) first.

**Delete:** Select a phase or item, then **Delete** on the toolbar (or **Delete** / **Backspace** when you are not typing in a field). Deleting a phase removes all of its items. Nested children are removed with their parent.

---

## Reorder phases (drag and drop)

Use the **grip** (six-dot handle) on the **phase** row — not the item grip, and not the phase name.

| What you want | What to do | What you should see |
|---------------|------------|---------------------|
| Move a phase **above** another phase | Drag the phase grip and drop on the **other phase** row | Blue line along the **top** of the target phase |
| Move a phase to the **end** | Drag the phase grip and drop on **Add phase** | The Add phase row highlights |
| Keep items with the phase | Drop the **phase**, not an item | All items stay inside that phase in the new order |

**What does not happen**

- Dropping a **phase** onto an **item** row does not nest the phase and does not move it.
- Dropping a phase onto **itself**, onto the phase already **immediately below** it, or onto **Add phase** when it is already last, is ignored (no save).
- Viewers do not see a grip.

Phase order on Plan is the working schedule order. **Existing status reports do not change** until someone **Refresh schedule**s a Plan-sourced report (see below).

---

## Reorder, nest, and move items (drag and drop)

Use the **grip** on an **item** row.

| What you want | What to do | What you should see |
|---------------|------------|---------------------|
| Nest under another item | Drop **on** the item (not the thin top edge) | Blue ring / highlight on the target item |
| Insert as a **sibling before** an item | Drop on the **top edge** of that item row | Blue line along the **top** of the row |
| Make it a **top-level item in a phase** | Drop on the **phase** row, or that phase’s **Add item** row | Highlight on the phase / add-item row |
| Move to another phase | Drop on the destination **phase** (or nest under an item already in that phase) | Item (and nested children) appear in the new phase |

Nested children **travel with** the item when it changes phase.

Indent/Outdent still work if you prefer the toolbar instead of drag.

---

## Change dates on the Gantt

- **Task** or **assumed meeting** (bar): drag the bar to move it (duration stays the same). Drag the **left or right edge** to resize.
- **Milestone**, **sign-off**, **hard deadline**, or **scheduled meeting** (diamond): drag the diamond to change that **single** date.
- Dates snap to **calendar days** (same as the Start/End cells).
- Child rows **do not** move when you drag a **parent** bar.
- Press **Escape** to cancel a Gantt drag in progress.

You can also type dates in **Full** grid Start/End cells.

---

## Status and status reports (Rpt)

- Set item **Status** to **Not started**, **In progress**, or **Complete** (in **Edit**; **View** shows the same states as icons — hover for the full name). The Plan header shows how many items are complete.
- **Rpt** chooses whether that phase or item appears on **Plan-sourced** status-report schedules.
- Short names for a **specific slide** are set on that report’s **Arrange this report’s schedule** board, not on Plan.
- New key dates and scheduled meetings default to **shown**; tasks, waiting-on-client, and assumed meetings default to **hidden** as markers (they still stretch the phase bar).
- Completed key dates still appear on **new** reports (when **Rpt** is on) but are drawn faded.

### Default for new reports

On Plan, editors can set **New status reports use** to **Project timeline** or **Project Plan**. That only affects **new** Standard and Milestones reports.

### After you change Plan

Editing Plan **does not** rewrite saved reports. To update a report that was created from **Project Plan**:

1. Open **Status Reports**.
2. **Edit** that report.
3. Use **Refresh schedule** (confirm the dialog). Per-report arrange tweaks (row, hide, short names) are kept when the same phase or item still exists.

If Plan has been turned **off** since the report was created, **Refresh schedule** fails until an editor turns Plan back on. The saved slide still shows the old schedule.

---

## Quick checklist

- [ ] An editor enabled **Plan** on this project
- [ ] You are an editor (grips visible)
- [ ] Phases are in the order you want (phase grip → drop on another phase or **Add phase**)
- [ ] Items are nested / ordered (item grip)
- [ ] Gantt dates look right
- [ ] **Rpt** is on for rows that should appear on slides
- [ ] New or refreshed **Standard** / **Milestones** reports use **Project Plan** if that is the intended source

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| No **Plan** tab | **Settings → Enable Plan tab (beta)** |
| Blank grid, no **Add phase** / **Add item** | Switch to **Edit**. A brand-new plan opens in Edit; a plan that already has phases opens in View. |
| No grips | You are view-only, or you are not dragging from the grip |
| Phase will not move | You dropped on an item, on itself, or it is already in that position |
| Item will not nest | Nesting is capped at three levels; you cannot create a cycle (parent under its own child) |
| Status report still shows the old order | **Refresh schedule** on that report; Plan edits are not live on old snapshots |

---

*Product docs: User Guide (`docs/USER_GUIDE.md`), Technical Reference (`docs/TECHNICAL.md`), Changelog (`CHANGELOG.md`).*
