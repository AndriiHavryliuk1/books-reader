import { Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  catchError,
  concatMap,
  exhaustMap,
  filter,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  Subject,
  tap,
} from 'rxjs';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ConfirmDialogData } from '../../../../shared/models/confirm-dialog.models';
import {
  TableColumn,
  TableRowAction,
  TableRowActionEvent,
} from '../../../../shared/models/table.models';
import { Table } from '../../../../shared/components/table/table';
import { Book } from '../../models/book.models';
import { BookImportResult } from '../../models/books-store.models';
import { BooksStore } from '../../store/books.store';
import { EditBookDialog, EditBookDialogData } from '../edit-book-dialog/edit-book-dialog';
import { errorMessage, formatDateTime } from '../../../../shared/utils/utils';

interface Notification {
  message: string;
  duration?: number;
}

@Component({
  selector: 'app-books-page',
  imports: [MatButtonModule, MatIconModule, Table],
  providers: [BooksStore],
  templateUrl: './books-page.html',
  styleUrl: './books-page.scss',
})
export class BooksPage {
  readonly store = inject(BooksStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly importRequests = new Subject<File>();
  private readonly exportRequests = new Subject<void>();
  private readonly deleteRequests = new Subject<Book>();
  private readonly addRequests = new Subject<void>();
  private readonly updateRequests = new Subject<Book>();

  private readonly notification = toSignal<Notification>(
    merge(
      this.importRequests.pipe(
        concatMap((file) =>
          this.store.importXml(file).pipe(
            map((result) => ({ message: this.importMessage(result), duration: 8000 })),
            catchError((error) =>
              of({ message: `Import failed: ${errorMessage(error)}`, duration: 8000 }),
            ),
          ),
        ),
      ),
      this.exportRequests.pipe(
        exhaustMap(() => this.store.exportXml()),
        map((count) => ({ message: `Exported ${count} ${count === 1 ? 'book' : 'books'}` })),
      ),
      this.deleteRequests.pipe(
        mergeMap((book) =>
          this.confirmDelete(book).pipe(
            filter(Boolean),
            tap(() => this.store.remove(book.id)),
            map(() => ({ message: `"${book.name}" deleted` })),
          ),
        ),
      ),
      this.addRequests.pipe(
        exhaustMap(() =>
          this.openEditBookDialog().pipe(
            filter(Boolean),
            map((saved) => ({ message: `"${saved.name}" added` })),
          ),
        ),
      ),
      this.updateRequests.pipe(
        exhaustMap((book) =>
          this.openEditBookDialog(book).pipe(
            filter(Boolean),
            map((saved) => ({ message: `"${saved.name}" updated` })),
          ),
        ),
      ),
    ),
  );

  constructor() {
    effect(() => {
      const notification = this.notification();
      if (notification) {
        this.snackBar.open(notification.message, 'Dismiss', {
          duration: notification.duration ?? 4000,
        });
      }
    });
  }

  readonly columns: TableColumn<Book>[] = [
    { key: 'name', header: 'Title', sortable: true },
    { key: 'author', header: 'Author', sortable: true },
    { key: 'pageCount', header: 'Pages', sortable: true },
    {
      key: 'lastModified',
      header: 'Last modified',
      sortable: true,
      cell: (book) => formatDateTime(book.lastModified),
    },
  ];

  readonly rowActions: TableRowAction[] = [
    { id: 'edit', icon: 'edit', label: 'Edit' },
    { id: 'delete', icon: 'delete', label: 'Delete' },
  ];

  onRowAction({ id, row }: TableRowActionEvent<Book>): void {
    switch (id) {
      case 'edit':
        this.updateRequests.next(row);
        break;
      case 'delete':
        this.remove(row);
        break;
      default:
        break;
    }
  }

  addBook(): void {
    this.addRequests.next();
  }

  onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.importRequests.next(file);
    }
  }

  exportXml(): void {
    this.exportRequests.next();
  }

  private openEditBookDialog(book?: Book): Observable<Book | undefined> {
    return this.dialog
      .open<EditBookDialog, EditBookDialogData, Book>(EditBookDialog, {
        data: {
          book,
          save: (draft) => (book ? this.store.update(book.id, draft) : this.store.add(draft)),
        },
        autoFocus: 'first-tabbable',
      })
      .afterClosed();
  }

  private remove(book: Book): void {
    this.deleteRequests.next(book);
  }

  private confirmDelete(book: Book): Observable<boolean | undefined> {
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: 'Delete book?',
          message: `"${book.name}" by ${book.author} will be removed from the library`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed();
  }

  private importMessage({ summary, errors }: BookImportResult): string {
    const parts = [`${summary.added} added`, `${summary.updated} updated`];
    if (summary.skipped) {
      parts.push(`${summary.skipped} skipped (already up to date)`);
    }
    const sentences = [`Import complete: ${parts.join(', ')}`];
    if (errors.length) {
      const [first] = errors;
      sentences.push(
        `${errors.length} invalid ${errors.length === 1 ? 'entry' : 'entries'} ignored (book #${first.position}: ${first.message})`,
      );
    }
    return sentences.join('. ');
  }
}
