import {
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  model,
  output,
  TrackByFunction,
  untracked,
} from '@angular/core';
import { debounce, form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  TableColumn,
  TableKey,
  TableRowAction,
  TableRowActionEvent,
  TableSortDirection,
  TableState,
} from '../../models/table.models';
import { toggleSort } from '../../utils/table.utils';
import { TableCellPipe } from './pipes/table-cell.pipe';
import { isDeepEqual } from '../../utils/utils';

const SEARCH_DEBOUNCE_MS = 300;
const ACTIONS_COLUMN = 'tableRowActions';

interface ColumnSort {
  direction: Exclude<TableSortDirection, ''>;
  order: number | null;
}

@Component({
  selector: 'app-table',
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatTableModule,
    MatTooltipModule,
    TableCellPipe,
  ],
  templateUrl: './table.html',
  styleUrl: './table.scss',
})
export class Table<T extends { id?: string | number }> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly state = model.required<TableState<T>>();
  readonly data = input<T[]>([]);
  readonly total = input(0);
  readonly pageSizeOptions = input([10, 20, 50]);
  readonly searchLabel = input('Search');
  readonly rowActions = input<TableRowAction[]>([]);

  readonly rowAction = output<TableRowActionEvent<T>>();

  readonly actionsColumn = ACTIONS_COLUMN;
  readonly displayedColumns = computed(() => this.getDisplayedColumns());
  readonly sortedColumns = computed(() => this.getSortedColumns());
  readonly sortable = computed(() => this.columns().some((column) => column.sortable));
  private readonly searchModel = linkedSignal<string, { search: string }>({
    source: () => this.state().search,
    computation: (search, previous) =>
      previous?.value.search.trim() === search ? previous.value : { search },
  });
  readonly searchForm = form(this.searchModel, (path) => {
    debounce(path.search, SEARCH_DEBOUNCE_MS);
  });
  readonly trackRow: TrackByFunction<T> = (index, row) => row?.id ?? index;

  constructor() {
    effect(() => {
      const search = this.searchModel().search.trim();
      untracked(() => this.applySearch(search));
    });
  }

  onSort(key: TableKey<T>, event: MouseEvent): void {
    const multi = event.ctrlKey || event.metaKey;
    this.update({ sort: toggleSort(this.state().sort, key, multi), pageIndex: 0 });
  }

  onPage({ pageIndex, pageSize }: PageEvent): void {
    this.update({ pageIndex, pageSize });
  }

  clearSearch(): void {
    this.searchModel.set({ search: '' });
  }

  private applySearch(search: string): void {
    if (search !== this.state().search) {
      this.update({ search, pageIndex: 0 });
    }
  }

  private update(changes: Partial<TableState<T>>): void {
    const current = this.state();
    const next = { ...current, ...changes };
    if (!isDeepEqual(current, next)) {
      this.state.set(next);
    }
  }

  private getDisplayedColumns(): string[] {
    return [
      ...this.columns().map((c) => c.key),
      ...(this.rowActions().length ? [ACTIONS_COLUMN] : []),
    ];
  }

  private getSortedColumns(): Partial<Record<string, ColumnSort>> {
    const { sort } = this.state();
    return Object.fromEntries(
      sort.map(({ key, direction }, index) => [
        key,
        {
          direction,
          order: sort.length > 1 ? index + 1 : null,
        },
      ]),
    );
  }
}
