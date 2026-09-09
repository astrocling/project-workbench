export type PhaseOrderRow = {
  id: string;
  order: number;
};

export type PhaseDropTarget =
  | { kind: "before"; phaseId: string }
  | { kind: "append" };

export type PhaseDropPlacement = {
  phaseId: string;
  insertBeforePhaseId: string | null;
};

function sortPhases(phases: PhaseOrderRow[]): PhaseOrderRow[] {
  return phases.slice().sort((a, b) => a.order - b.order);
}

export function validateInsertBeforePhase(
  phases: PhaseOrderRow[],
  movedId: string,
  insertBeforePhaseId: string | null
): string | null {
  if (insertBeforePhaseId === null) return null;
  if (insertBeforePhaseId === movedId) return "Cannot insert a phase before itself";
  const before = phases.find((phase) => phase.id === insertBeforePhaseId);
  if (!before) return "Insert-before phase not found";
  return null;
}

export function reindexPhaseOrders(
  phases: PhaseOrderRow[],
  movedId: string,
  insertBeforePhaseId: string | null
): { id: string; order: number }[] {
  const siblings = phases
    .filter((phase) => phase.id !== movedId)
    .slice()
    .sort((a, b) => a.order - b.order);

  const insertAt =
    insertBeforePhaseId == null
      ? siblings.length
      : siblings.findIndex((phase) => phase.id === insertBeforePhaseId);
  const at = insertAt < 0 ? siblings.length : insertAt;
  const ordered = [
    ...siblings.slice(0, at).map((phase) => phase.id),
    movedId,
    ...siblings.slice(at).map((phase) => phase.id),
  ];
  return ordered.map((id, order) => ({ id, order }));
}

export function resolvePhaseDrop(
  phases: PhaseOrderRow[],
  draggedPhaseId: string,
  target: PhaseDropTarget
): PhaseDropPlacement | null {
  const dragged = phases.find((phase) => phase.id === draggedPhaseId);
  if (!dragged) return null;

  const sorted = sortPhases(phases);
  const draggedIndex = sorted.findIndex((phase) => phase.id === draggedPhaseId);

  if (target.kind === "append") {
    if (draggedIndex === sorted.length - 1) return null;
    return { phaseId: draggedPhaseId, insertBeforePhaseId: null };
  }

  if (target.phaseId === draggedPhaseId) return null;
  const before = phases.find((phase) => phase.id === target.phaseId);
  if (!before) return null;

  const beforeIndex = sorted.findIndex((phase) => phase.id === target.phaseId);
  if (draggedIndex >= 0 && draggedIndex + 1 === beforeIndex) return null;

  return { phaseId: draggedPhaseId, insertBeforePhaseId: target.phaseId };
}
