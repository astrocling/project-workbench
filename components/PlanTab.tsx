"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { LocalTime } from "@/components/LocalTime";
import { PlanChart } from "@/components/plan/PlanChart";
import { PlanMeetingsSection } from "@/components/plan/PlanMeetingsSection";
import { TIMELINE_BAR_COLORS } from "@/components/TimelineTab";
import { expandYmdRange } from "@/lib/plan/businessDays";
import type { PlanItemJson, PlanJson, PlanPhaseJson } from "@/lib/plan/serialize";
import {
  PHASE_SUGGESTIONS,
  PLAN_ITEM_TYPES,
  type PlanItemType,
} from "@/lib/plan/types";

const INPUT_CLASS =
  "mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100";
const BTN_PRIMARY =
  "px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50";
const BTN_SECONDARY =
  "px-3 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-dark-border";
const BTN_DANGER =
  "px-3 py-1.5 rounded-md text-body-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20";

const ITEM_TYPE_LABELS: Record<PlanItemType, string> = {
  task: "Task",
  milestone: "Milestone",
  sign_off: "Sign-off",
  hard_deadline: "Hard deadline",
  waiting_on_client: "Waiting on client",
};

type PlanResponse = {
  plan: PlanJson | null;
  project: { startDate: string; endDate: string | null };
  dateMismatch?: boolean;
};

type ItemFormState = {
  type: PlanItemType;
  label: string;
  startDate: string;
  endDate: string;
};

function planDurationDays(kickoff: string, end: string): number {
  return expandYmdRange(kickoff, end).length;
}

function emptyItemForm(plan: PlanJson): ItemFormState {
  return {
    type: "task",
    label: "",
    startDate: plan.kickoffDate,
    endDate: plan.kickoffDate,
  };
}

export function PlanTab({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [kickoffDate, setKickoffDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const [assumptionsText, setAssumptionsText] = useState("");
  const [assumptionsSaving, setAssumptionsSaving] = useState(false);

  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseColor, setNewPhaseColor] = useState<string>(TIMELINE_BAR_COLORS[0].value);
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editPhaseName, setEditPhaseName] = useState("");
  const [editPhaseColor, setEditPhaseColor] = useState<string>(TIMELINE_BAR_COLORS[0].value);

  const [addingItemPhaseId, setAddingItemPhaseId] = useState<string | null>(null);
  const [addItemForm, setAddItemForm] = useState<ItemFormState | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemFormState | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const apiBase = `/api/projects/${projectId}/plan`;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(apiBase)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load plan");
        return r.json() as Promise<PlanResponse>;
      })
      .then((json) => {
        setData(json);
        if (json.plan) {
          setKickoffDate(json.plan.kickoffDate);
          setEndDate(json.plan.endDate);
          setAssumptionsText(json.plan.assumptions.join("\n"));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateBlank() {
    if (!canEdit) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to create plan");
        return;
      }
      load();
    } finally {
      setCreating(false);
    }
  }

  async function saveHeaderDates() {
    if (!canEdit || !data?.plan) return;
    if (kickoffDate === data.plan.kickoffDate && endDate === data.plan.endDate) return;
    setHeaderSaving(true);
    setHeaderError(null);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kickoffDate, endDate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHeaderError(json.error ?? "Failed to update dates");
        setKickoffDate(data.plan.kickoffDate);
        setEndDate(data.plan.endDate);
        return;
      }
      load();
    } finally {
      setHeaderSaving(false);
    }
  }

  async function saveAssumptions() {
    if (!canEdit || !data?.plan) return;
    const assumptions = assumptionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (assumptions.join("\n") === data.plan.assumptions.join("\n")) return;
    setAssumptionsSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions }),
      });
      if (res.ok) load();
    } finally {
      setAssumptionsSaving(false);
    }
  }

  async function handleAddPhase(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !newPhaseName.trim()) return;
    setPhaseSaving(true);
    setPhaseError(null);
    try {
      const res = await fetch(`${apiBase}/phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPhaseName.trim(), color: newPhaseColor }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhaseError(json.error ?? "Failed to add phase");
        return;
      }
      setNewPhaseName("");
      load();
    } finally {
      setPhaseSaving(false);
    }
  }

  async function handleQuickAddPhase(suggestion: (typeof PHASE_SUGGESTIONS)[number]) {
    if (!canEdit) return;
    setPhaseSaving(true);
    setPhaseError(null);
    try {
      const res = await fetch(`${apiBase}/phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: suggestion.name, color: suggestion.color }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhaseError(json.error ?? "Failed to add phase");
        return;
      }
      load();
    } finally {
      setPhaseSaving(false);
    }
  }

  async function handleUpdatePhase(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editingPhaseId) return;
    setPhaseSaving(true);
    setPhaseError(null);
    try {
      const res = await fetch(`${apiBase}/phases/${editingPhaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editPhaseName.trim(), color: editPhaseColor }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhaseError(json.error ?? "Failed to update phase");
        return;
      }
      setEditingPhaseId(null);
      load();
    } finally {
      setPhaseSaving(false);
    }
  }

  async function handleDeletePhase(phaseId: string) {
    if (!canEdit) return;
    if (!window.confirm("Delete this phase and all its items?")) return;
    const res = await fetch(`${apiBase}/phases/${phaseId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function startEditPhase(phase: PlanPhaseJson) {
    setEditingPhaseId(phase.id);
    setEditPhaseName(phase.name);
    setEditPhaseColor(phase.color);
    setPhaseError(null);
  }

  function startAddItem(phase: PlanPhaseJson) {
    if (!data?.plan) return;
    setAddingItemPhaseId(phase.id);
    setAddItemForm(emptyItemForm(data.plan));
    setItemError(null);
  }

  function startEditItem(item: PlanItemJson) {
    setEditingItemId(item.id);
    setEditItemForm({
      type: item.type,
      label: item.label,
      startDate: item.startDate,
      endDate: item.endDate,
    });
    setItemError(null);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !addingItemPhaseId || !addItemForm) return;
    setItemSaving(true);
    setItemError(null);
    try {
      const res = await fetch(`${apiBase}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseId: addingItemPhaseId,
          ...addItemForm,
          label: addItemForm.label.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItemError(json.error ?? "Failed to add item");
        return;
      }
      setAddingItemPhaseId(null);
      setAddItemForm(null);
      load();
    } finally {
      setItemSaving(false);
    }
  }

  async function handleUpdateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editingItemId || !editItemForm) return;
    setItemSaving(true);
    setItemError(null);
    try {
      const res = await fetch(`${apiBase}/items/${editingItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editItemForm,
          label: editItemForm.label.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItemError(json.error ?? "Failed to update item");
        return;
      }
      setEditingItemId(null);
      setEditItemForm(null);
      load();
    } finally {
      setItemSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!canEdit) return;
    if (!window.confirm("Delete this item?")) return;
    const res = await fetch(`${apiBase}/items/${itemId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (loading) {
    return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading plan…</p>;
  }
  if (error && !data) {
    return <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (!data) return null;

  const plan = data.plan;

  if (!plan) {
    return (
      <div className="space-y-6">
        <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
          Project Plan
        </h2>
        <div className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface p-8 text-center space-y-4">
          <p className="text-body-sm text-surface-700 dark:text-surface-300">
            No plan yet. Start from a blank plan using your project dates, or use guided setup when
            available.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="relative group">
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-500 dark:text-surface-500 cursor-not-allowed"
              >
                Guided setup
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded bg-surface-800 dark:bg-surface-700 text-white text-label-sm px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Coming soon
              </span>
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={handleCreateBlank}
                disabled={creating}
                className="px-4 py-2 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Start from blank"}
              </button>
            )}
          </div>
          {error && <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  const durationDays = planDurationDays(plan.kickoffDate, plan.endDate);

  return (
    <div className="space-y-6">
      <h2 className="text-title-lg font-semibold text-surface-800 dark:text-surface-100 border-b border-surface-200 dark:border-dark-border pb-2">
        Project Plan
      </h2>

      {data.dateMismatch && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-body-sm text-surface-800 dark:text-surface-200">
          <AlertTriangle
            className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
            size={18}
            aria-hidden
          />
          <div>
            <p className="font-semibold">Plan dates differ from project dates</p>
            <p className="mt-1">
              Project: {data.project.startDate.slice(0, 10)}
              {data.project.endDate ? ` – ${data.project.endDate.slice(0, 10)}` : " (no end date)"}.
              Plan: {plan.kickoffDate} – {plan.endDate}.
            </p>
          </div>
        </div>
      )}

      {(plan.updatedByName || plan.updatedAt) && (
        <p className="text-body-sm text-surface-600 dark:text-surface-400">
          {plan.updatedByName ? (
            <>
              Last updated by <span className="font-medium">{plan.updatedByName}</span> on{" "}
            </>
          ) : (
            <>Last updated on </>
          )}
          <LocalTime isoDate={plan.updatedAt} />
        </p>
      )}

      <section className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              Kickoff date
            </label>
            {canEdit ? (
              <input
                type="date"
                value={kickoffDate}
                onChange={(e) => setKickoffDate(e.target.value)}
                onBlur={saveHeaderDates}
                disabled={headerSaving}
                className={`${INPUT_CLASS} w-auto`}
              />
            ) : (
              <p className="text-body-sm text-surface-800 dark:text-surface-100 mt-1">
                {plan.kickoffDate}
              </p>
            )}
          </div>
          <div>
            <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              End date
            </label>
            {canEdit ? (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onBlur={saveHeaderDates}
                disabled={headerSaving}
                className={`${INPUT_CLASS} w-auto`}
              />
            ) : (
              <p className="text-body-sm text-surface-800 dark:text-surface-100 mt-1">
                {plan.endDate}
              </p>
            )}
          </div>
          <div>
            <span className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              Duration
            </span>
            <p className="text-body-sm text-surface-800 dark:text-surface-100 mt-1 tabular-nums">
              {durationDays} day{durationDays === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {headerError && (
          <p className="mt-2 text-body-sm text-red-600 dark:text-red-400">{headerError}</p>
        )}
      </section>

      <section>
        <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">
          Phase chart
        </h3>
        <PlanChart plan={plan} />
      </section>

      <section className="space-y-4">
        <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
          Phases &amp; items
        </h3>

        {plan.phases.length === 0 && (
          <p className="text-body-sm text-surface-600 dark:text-surface-400">No phases yet.</p>
        )}

        {plan.phases.map((phase) => (
          <div
            key={phase.id}
            className="rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: phase.color }}
                aria-hidden
              />
              {editingPhaseId === phase.id ? (
                <form onSubmit={handleUpdatePhase} className="flex flex-wrap items-end gap-3 flex-1">
                  <div className="flex-1 min-w-[140px]">
                    <input
                      type="text"
                      value={editPhaseName}
                      onChange={(e) => setEditPhaseName(e.target.value)}
                      required
                      className={INPUT_CLASS}
                    />
                  </div>
                  <ColorPicker value={editPhaseColor} onChange={setEditPhaseColor} />
                  <button type="submit" disabled={phaseSaving} className={BTN_PRIMARY}>
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPhaseId(null)}
                    className={BTN_SECONDARY}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <h4 className="text-body-sm font-semibold text-surface-800 dark:text-surface-100 flex-1">
                    {phase.name}
                  </h4>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditPhase(phase)}
                        className={BTN_SECONDARY}
                      >
                        Edit phase
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePhase(phase.id)}
                        className={BTN_DANGER}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 space-y-3">
              {phase.items.length === 0 && (
                <p className="text-body-sm text-surface-600 dark:text-surface-400">No items yet.</p>
              )}
              <ul className="space-y-2">
                {phase.items.map((item) =>
                  editingItemId === item.id ? null : (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 rounded border border-surface-100 dark:border-dark-border px-3 py-2"
                    >
                      <span className="text-label-sm uppercase text-surface-500 dark:text-surface-400 w-28 shrink-0">
                        {ITEM_TYPE_LABELS[item.type]}
                      </span>
                      <span className="text-body-sm font-medium text-surface-800 dark:text-surface-100 flex-1 min-w-[120px]">
                        {item.label}
                      </span>
                      <span className="text-body-sm text-surface-600 dark:text-surface-400 tabular-nums">
                        {item.startDate === item.endDate
                          ? item.startDate
                          : `${item.startDate} – ${item.endDate}`}
                      </span>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className={BTN_SECONDARY}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className={BTN_DANGER}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  )
                )}
              </ul>

              {editingItemId &&
                editItemForm &&
                phase.items.some((i) => i.id === editingItemId) && (
                  <ItemForm
                    form={editItemForm}
                    setForm={(updater) =>
                      setEditItemForm((prev) => {
                        if (!prev) return prev;
                        return typeof updater === "function" ? updater(prev) : updater;
                      })
                    }
                    onSubmit={handleUpdateItem}
                    onCancel={() => {
                      setEditingItemId(null);
                      setEditItemForm(null);
                    }}
                    saving={itemSaving}
                    error={itemError}
                  />
                )}

              {canEdit && addingItemPhaseId === phase.id && addItemForm ? (
                <ItemForm
                  form={addItemForm}
                  setForm={(updater) =>
                    setAddItemForm((prev) => {
                      if (!prev) return prev;
                      return typeof updater === "function" ? updater(prev) : updater;
                    })
                  }
                  onSubmit={handleAddItem}
                  onCancel={() => {
                    setAddingItemPhaseId(null);
                    setAddItemForm(null);
                  }}
                  saving={itemSaving}
                  error={itemError}
                />
              ) : (
                canEdit &&
                editingItemId === null && (
                  <button type="button" onClick={() => startAddItem(phase)} className={BTN_PRIMARY}>
                    Add item
                  </button>
                )
              )}
            </div>
          </div>
        ))}

        {canEdit && (
          <div className="space-y-3">
            <form onSubmit={handleAddPhase} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
                  New phase name
                </label>
                <input
                  type="text"
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                  placeholder="e.g. Development"
                  className={INPUT_CLASS}
                />
              </div>
              <ColorPicker value={newPhaseColor} onChange={setNewPhaseColor} />
              <button
                type="submit"
                disabled={phaseSaving || !newPhaseName.trim()}
                className={BTN_PRIMARY}
              >
                Add phase
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              <span className="text-body-sm text-surface-600 dark:text-surface-400 self-center">
                Quick add:
              </span>
              {PHASE_SUGGESTIONS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  disabled={phaseSaving}
                  onClick={() => handleQuickAddPhase(s)}
                  className="px-2.5 py-1 rounded-full text-label-sm font-medium border border-surface-300 dark:border-dark-muted text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-dark-muted disabled:opacity-50"
                  style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {phaseError && (
              <p className="text-body-sm text-red-600 dark:text-red-400">{phaseError}</p>
            )}
          </div>
        )}
      </section>

      <PlanMeetingsSection
        projectId={projectId}
        plan={plan}
        canEdit={canEdit}
        onMutated={load}
      />

      <section className="space-y-2">
        <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
          Assumptions
        </h3>
        {canEdit ? (
          <>
            <textarea
              value={assumptionsText}
              onChange={(e) => setAssumptionsText(e.target.value)}
              onBlur={saveAssumptions}
              rows={5}
              placeholder="One assumption per line"
              disabled={assumptionsSaving}
              className={`${INPUT_CLASS} h-auto py-2`}
            />
            {assumptionsSaving && (
              <p className="text-body-sm text-surface-500 dark:text-surface-400">Saving…</p>
            )}
          </>
        ) : plan.assumptions.length > 0 ? (
          <ul className="list-disc list-inside text-body-sm text-surface-700 dark:text-surface-300 space-y-1">
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-surface-600 dark:text-surface-400">No assumptions.</p>
        )}
      </section>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
        Color
      </label>
      <div className="mt-1 flex gap-1">
        {TIMELINE_BAR_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded border-2 ${
              value === c.value
                ? "border-surface-800 dark:border-white"
                : "border-surface-300 dark:border-dark-muted"
            }`}
            style={{ backgroundColor: c.value }}
            title={c.label}
            aria-label={c.label}
          />
        ))}
      </div>
    </div>
  );
}

function ItemForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  form: ItemFormState;
  setForm: (value: ItemFormState | ((prev: ItemFormState) => ItemFormState)) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-surface-50 dark:bg-dark-raised rounded-lg p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as PlanItemType }))
            }
            className={INPUT_CLASS}
          >
            {PLAN_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {ITEM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
            Label
          </label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
            Start date
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
            End date
          </label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            required
            className={INPUT_CLASS}
          />
        </div>
      </div>
      {error && <p className="text-body-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={BTN_PRIMARY}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={BTN_SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}
