"use client";

import { useState } from "react";
import type { PlanJson, PlanMeetingJson } from "@/lib/plan/serialize";
import type { PlanMeetingStatus } from "@/lib/plan/types";

const INPUT_CLASS =
  "mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-surface border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100";
const BTN_PRIMARY =
  "px-3 py-1.5 rounded-md text-body-sm font-medium bg-jblue-500 text-white hover:bg-jblue-600 disabled:opacity-50";
const BTN_SECONDARY =
  "px-3 py-1.5 rounded-md text-body-sm font-medium bg-surface-200 dark:bg-dark-muted text-surface-800 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-dark-border";
const BTN_DANGER =
  "px-3 py-1.5 rounded-md text-body-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20";

type PlanMeetingsSectionProps = {
  projectId: string;
  plan: PlanJson;
  canEdit: boolean;
  onMutated: () => void;
};

type MeetingFormState = {
  label: string;
  status: PlanMeetingStatus;
  windowStart: string;
  windowEnd: string;
  scheduledDate: string;
  scheduledTime: string;
  notes: string;
};

const emptyForm = (plan: PlanJson): MeetingFormState => ({
  label: "",
  status: "assumed",
  windowStart: plan.kickoffDate,
  windowEnd: plan.kickoffDate,
  scheduledDate: "",
  scheduledTime: "",
  notes: "",
});

export function PlanMeetingsSection({
  projectId,
  plan,
  canEdit,
  onMutated,
}: PlanMeetingsSectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<MeetingFormState>(() => emptyForm(plan));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MeetingFormState>(() => emptyForm(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `/api/projects/${projectId}/plan/meetings`;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        label: addForm.label.trim(),
        status: addForm.status,
        windowStart: addForm.windowStart,
        windowEnd: addForm.windowEnd,
        notes: addForm.notes.trim() || null,
      };
      if (addForm.status === "scheduled") {
        body.scheduledDate = addForm.scheduledDate;
        body.scheduledTime = addForm.scheduledTime.trim() || null;
      }
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to add meeting");
        return;
      }
      setShowAdd(false);
      setAddForm(emptyForm(plan));
      onMutated();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        label: editForm.label.trim(),
        status: editForm.status,
        windowStart: editForm.windowStart,
        windowEnd: editForm.windowEnd,
        notes: editForm.notes.trim() || null,
      };
      if (editForm.status === "scheduled") {
        body.scheduledDate = editForm.scheduledDate;
        body.scheduledTime = editForm.scheduledTime.trim() || null;
      } else {
        body.scheduledDate = null;
        body.scheduledTime = null;
      }
      const res = await fetch(`${apiBase}/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to update meeting");
        return;
      }
      setEditingId(null);
      onMutated();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(meetingId: string) {
    if (!canEdit) return;
    if (!window.confirm("Delete this meeting?")) return;
    const res = await fetch(`${apiBase}/${meetingId}`, { method: "DELETE" });
    if (res.ok) onMutated();
  }

  async function handleToggleStatus(meeting: PlanMeetingJson) {
    if (!canEdit) return;
    const nextStatus: PlanMeetingStatus =
      meeting.status === "assumed" ? "scheduled" : "assumed";
    const body: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "scheduled") {
      body.scheduledDate = meeting.scheduledDate ?? meeting.windowStart;
    } else {
      body.scheduledDate = null;
      body.scheduledTime = null;
    }
    const res = await fetch(`${apiBase}/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onMutated();
  }

  async function handlePromote(meeting: PlanMeetingJson) {
    if (!canEdit || meeting.status !== "assumed") return;
    const scheduledDate =
      window.prompt(
        "Scheduled date (YYYY-MM-DD):",
        meeting.scheduledDate ?? meeting.windowStart
      ) ?? "";
    if (!scheduledDate.trim()) return;
    const res = await fetch(`${apiBase}/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "scheduled",
        scheduledDate: scheduledDate.trim(),
      }),
    });
    if (res.ok) onMutated();
  }

  function startEdit(meeting: PlanMeetingJson) {
    setEditingId(meeting.id);
    setEditForm({
      label: meeting.label,
      status: meeting.status,
      windowStart: meeting.windowStart,
      windowEnd: meeting.windowEnd,
      scheduledDate: meeting.scheduledDate ?? "",
      scheduledTime: meeting.scheduledTime ?? "",
      notes: meeting.notes ?? "",
    });
    setError(null);
  }

  return (
    <section className="space-y-4">
      <h3 className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
        Meetings
      </h3>

      {plan.meetings.length === 0 && !showAdd && (
        <p className="text-body-sm text-surface-600 dark:text-surface-400">
          No meetings yet.
        </p>
      )}

      {plan.meetings.length > 0 && (
        <ul className="space-y-2">
          {plan.meetings.map((meeting) =>
            editingId === meeting.id ? null : (
              <li
                key={meeting.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-200 dark:border-dark-border bg-surface-50 dark:bg-dark-raised px-4 py-3"
              >
                <div className="flex-1 min-w-[200px]">
                  <p className="text-body-sm font-medium text-surface-800 dark:text-surface-100">
                    {meeting.label}
                  </p>
                  <p className="text-body-sm text-surface-600 dark:text-surface-400 mt-0.5">
                    {meeting.status === "scheduled" && meeting.scheduledDate
                      ? `Scheduled ${meeting.scheduledDate}${
                          meeting.scheduledTime ? ` at ${meeting.scheduledTime}` : ""
                        }`
                      : `Assumed window ${meeting.windowStart} – ${meeting.windowEnd}`}
                  </p>
                  {meeting.notes && (
                    <p className="text-body-sm text-surface-500 dark:text-surface-500 mt-1">
                      {meeting.notes}
                    </p>
                  )}
                </div>
                <span
                  className={`text-label-sm font-semibold uppercase px-2 py-0.5 rounded ${
                    meeting.status === "scheduled"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
                  }`}
                >
                  {meeting.status}
                </span>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(meeting)}
                      className={BTN_SECONDARY}
                    >
                      Mark {meeting.status === "assumed" ? "scheduled" : "assumed"}
                    </button>
                    {meeting.status === "assumed" && (
                      <button
                        type="button"
                        onClick={() => handlePromote(meeting)}
                        className={BTN_PRIMARY}
                      >
                        Schedule
                      </button>
                    )}
                    <button type="button" onClick={() => startEdit(meeting)} className={BTN_SECONDARY}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(meeting.id)}
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
      )}

      {editingId && (
        <MeetingForm
          title="Edit meeting"
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          onCancel={() => setEditingId(null)}
          saving={saving}
          error={error}
        />
      )}

      {canEdit && (
        <>
          {showAdd ? (
            <MeetingForm
              title="Add meeting"
              form={addForm}
              setForm={setAddForm}
              onSubmit={handleAdd}
              onCancel={() => {
                setShowAdd(false);
                setError(null);
              }}
              saving={saving}
              error={error}
            />
          ) : (
            <button type="button" onClick={() => setShowAdd(true)} className={BTN_PRIMARY}>
              Add meeting
            </button>
          )}
        </>
      )}
    </section>
  );
}

function MeetingForm({
  title,
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  error,
}: {
  title: string;
  form: MeetingFormState;
  setForm: React.Dispatch<React.SetStateAction<MeetingFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-surface-50 dark:bg-dark-raised rounded-lg p-4 space-y-3 max-w-lg"
    >
      <p className="text-body-sm font-semibold text-surface-800 dark:text-surface-100">{title}</p>
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
          Status
        </label>
        <select
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({ ...f, status: e.target.value as PlanMeetingStatus }))
          }
          className={INPUT_CLASS}
        >
          <option value="assumed">Assumed</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
            Window start
          </label>
          <input
            type="date"
            value={form.windowStart}
            onChange={(e) => setForm((f) => ({ ...f, windowStart: e.target.value }))}
            required
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
            Window end
          </label>
          <input
            type="date"
            value={form.windowEnd}
            onChange={(e) => setForm((f) => ({ ...f, windowEnd: e.target.value }))}
            required
            className={INPUT_CLASS}
          />
        </div>
      </div>
      {form.status === "scheduled" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              Scheduled date
            </label>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
              Time (optional)
            </label>
            <input
              type="text"
              value={form.scheduledTime}
              onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
              placeholder="e.g. 2:00 PM"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
      <div>
        <label className="block text-body-sm font-medium text-surface-700 dark:text-surface-300">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className={`${INPUT_CLASS} h-auto py-2`}
        />
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
