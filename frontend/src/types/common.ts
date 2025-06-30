export interface DateRange {
  start: string;
  end: string;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  sortBy: string;
  sortDir: SortDirection;
}
