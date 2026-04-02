export {
  FloatClient,
  floatClientFromEnv,
} from "@/lib/float/client";
export {
  FLOAT_API_DEFAULT_BASE_URL,
  FLOAT_LIST_MAX_PER_PAGE,
  FLOAT_PER_PAGE_PARAM,
  FloatApiError,
} from "@/lib/float/types";
export type {
  FloatClientOptions,
  FloatListPage,
  FloatPaginationMeta,
} from "@/lib/float/types";
export {
  aggregateTasksToWeeklyHours,
  dedupeFloatTasksForAggregation,
  isUtcWeekday,
  weeklyHoursCompositeKey,
  weeklyHoursMapToRows,
} from "@/lib/float/taskAggregation";
export type {
  AggregateTasksToWeeklyHoursOptions,
  AggregateTasksWindow,
  FloatTaskJson,
  WeeklyHoursRow,
} from "@/lib/float/taskAggregation";
export {
  defaultFloatSyncDateRange,
  executeFloatApiSync,
  floatAccessLabelFromAccount,
  syncPeopleFromFloatList,
} from "@/lib/float/syncFloatImport";
export {
  buildFloatRegionNameMap,
  enrichHolidayRowsWithWorkbenchRegionLabel,
  floatRegionLabelFromHolidayRow,
  floatRegionLabelFromPersonRow,
  floatRegionNamesFromHolidayRows,
  floatRegionNamesFromPeopleRows,
  mergeFloatRegionNameMaps,
} from "@/lib/float/regionLabel";
export type {
  ExecuteFloatApiSyncParams,
  ExecuteFloatApiSyncResult,
  FloatClientJson,
  FloatPersonJson,
  FloatProjectJson,
  FloatRoleJson,
} from "@/lib/float/syncFloatImport";
export {
  allUtcYmdsFromHolidayRow,
  buildExcludedUtcDatesByFloatPeopleId,
  expandInclusiveUtcRangeToYmds,
  filterHolidayRowsOverlappingYmdWindow,
  holidayRangeYmdFromRow,
  regionIdFromHolidayRow,
  regionIdFromPersonRow,
} from "@/lib/float/excludedDays";
export type { BuildExcludedDaysParams, FloatTimeOffJson } from "@/lib/float/excludedDays";
