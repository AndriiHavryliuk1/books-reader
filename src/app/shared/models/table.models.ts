export type TableKey<T> = Extract<keyof T, string>;

export interface TableColumn<T> {
  key: TableKey<T>;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => unknown;
}

export type TableSortDirection = 'asc' | 'desc' | '';

export interface TableSort<T> {
  key: TableKey<T>;
  direction: Exclude<TableSortDirection, ''>;
}

export interface TableState<T> {
  pageIndex: number;
  pageSize: number;
  sort: TableSort<T>[];
  search: string;
}

export interface TableRowAction {
  id: string;
  icon: string;
  label: string;
}

export interface TableRowActionEvent<T> {
  id: string;
  row: T;
}
