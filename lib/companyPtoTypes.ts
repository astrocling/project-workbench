import type { PtoHolidayByWeek } from "@/lib/pgmPtoWidgetData";

/** Active people row for the company PTO page (filters + grid). */
export type CompanyPerson = {
  personId: string;
  name: string;
  /** Float job title when set; otherwise an em dash placeholder for the Role filter. */
  role: string;
  floatRegionId: number | null;
  floatRegionName: string | null;
};

export type CompanyPtoApiResponse = {
  people: CompanyPerson[];
  ptoHolidayByWeek: PtoHolidayByWeek;
};
