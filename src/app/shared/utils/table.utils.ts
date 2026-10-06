import { TableKey, TableSort, TableSortDirection, TableState } from '../models/table.models';

const NEXT_DIRECTION: Record<TableSortDirection, TableSortDirection> = {
  '': 'asc',
  asc: 'desc',
  desc: '',
};

export function pageCount(total: number, pageSize: number): number {
  return pageSize > 0 ? Math.ceil(total / pageSize) : 0;
}

export function toggleSort<T>(
  sort: TableSort<T>[],
  key: TableKey<T>,
  multi: boolean,
): TableSort<T>[] {
  const current = sort.find((level) => level.key === key);
  const direction = NEXT_DIRECTION[current?.direction ?? ''];

  if (!direction) {
    return multi ? sort.filter((level) => level.key !== key) : [];
  }
  const next: TableSort<T> = { key, direction };
  if (!multi) {
    return [next];
  }
  return current ? sort.map((level) => (level.key === key ? next : level)) : [...sort, next];
}

export function paginate<T>(
  items: T[],
  { pageIndex, pageSize }: Pick<TableState<T>, 'pageIndex' | 'pageSize'>,
): T[] {
  const start = pageIndex * pageSize;
  return items.slice(start, start + pageSize);
}
