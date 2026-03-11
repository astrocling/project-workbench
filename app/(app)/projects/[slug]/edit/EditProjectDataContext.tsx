"use client";

import { createContext, useContext, type ReactNode } from "react";

export type EditProjectInitial = {
  id: string;
  name: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  cdaEnabled: boolean;
  actualsLowThresholdPercent: number | null;
  actualsHighThresholdPercent: number | null;
  clientSponsor: string | null;
  clientSponsor2: string | null;
  otherContact: string | null;
  keyStaffName: string | null;
  sowLink: string | null;
  estimateLink: string | null;
  floatLink: string | null;
  metricLink: string | null;
  projectKeyRoles: Array<{ type: string; personId: string; person: { id: string; name: string } }>;
};

type EditProjectDataContextValue = {
  initialProject: EditProjectInitial | null;
  initialEligiblePeople: { id: string; name: string }[] | null;
};

const EditProjectDataContext = createContext<EditProjectDataContextValue>({
  initialProject: null,
  initialEligiblePeople: null,
});

export function EditProjectDataProvider({
  initialProject,
  initialEligiblePeople,
  children,
}: {
  initialProject: EditProjectInitial | null;
  initialEligiblePeople: { id: string; name: string }[] | null;
  children: ReactNode;
}) {
  return (
    <EditProjectDataContext.Provider
      value={{ initialProject, initialEligiblePeople }}
    >
      {children}
    </EditProjectDataContext.Provider>
  );
}

export function useEditProjectData() {
  return useContext(EditProjectDataContext);
}
