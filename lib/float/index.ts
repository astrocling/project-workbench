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
  weeklyHoursCompositeKey,
  weeklyHoursMapToRows,
} from "@/lib/float/taskAggregation";
export type {
  AggregateTasksWindow,
  FloatTaskJson,
  WeeklyHoursRow,
} from "@/lib/float/taskAggregation";
export {
  defaultFloatSyncDateRange,
  executeFloatApiSync,
  syncPeopleFromFloatList,
} from "@/lib/float/syncFloatImport";
export type {
  ExecuteFloatApiSyncParams,
  ExecuteFloatApiSyncResult,
  FloatClientJson,
  FloatPersonJson,
  FloatProjectJson,
  FloatRoleJson,
} from "@/lib/float/syncFloatImport";
