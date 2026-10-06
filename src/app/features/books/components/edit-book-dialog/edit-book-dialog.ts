import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, max, maxLength, min, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { catchError, exhaustMap, map, Observable, of, startWith, Subject, tap } from 'rxjs';
import { MAX_BOOK_TEXT_LENGTH, MAX_PAGE_COUNT } from '../../constants/book.constants';
import { Book, BookDraft } from '../../models/book.models';
import { errorMessage } from '../../../../shared/utils/utils';

export interface EditBookDialogData {
  book?: Book;
  save: (draft: BookDraft) => Observable<Book>;
}

interface SaveState {
  saving: boolean;
  error: string | null;
}

interface BookFormModel {
  name: string;
  author: string;
  pageCount: number | null;
}

@Component({
  selector: 'app-edit-book-dialog',
  imports: [FormField, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './edit-book-dialog.html',
  styleUrl: './edit-book-dialog.scss',
})
export class EditBookDialog {
  private readonly data = inject<EditBookDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EditBookDialog, Book>);

  private readonly model = signal<BookFormModel>({
    name: this.data.book?.name ?? '',
    author: this.data.book?.author ?? '',
    pageCount: this.data.book?.pageCount ?? null,
  });

  readonly bookForm = form(this.model, (path) => {
    required(path.name, { message: 'Title is required' });
    maxLength(path.name, MAX_BOOK_TEXT_LENGTH, {
      message: `Maximum ${MAX_BOOK_TEXT_LENGTH} characters`,
    });
    required(path.author, { message: 'Author is required' });
    maxLength(path.author, MAX_BOOK_TEXT_LENGTH, {
      message: `Maximum ${MAX_BOOK_TEXT_LENGTH} characters`,
    });
    required(path.pageCount, { message: 'Number of pages is required' });
    min(path.pageCount, 1, { message: 'Must be at least 1' });
    max(path.pageCount, MAX_PAGE_COUNT, { message: `Must be less then ${MAX_PAGE_COUNT}` });
    validate(path.pageCount, ({ value }) => {
      const pageCount = value();
      return pageCount !== null && !Number.isInteger(pageCount)
        ? { kind: 'integer', message: 'Must be an integer' }
        : null;
    });
    validate(path.name, ({ value }) =>
      value() && !value().trim() ? { kind: 'blank', message: 'Title is required' } : null,
    );
    validate(path.author, ({ value }) =>
      value() && !value().trim() ? { kind: 'blank', message: 'Author is required' } : null,
    );
  });

  readonly isEdit = signal(!!this.data.book);
  private readonly saveRequests = new Subject<BookDraft>();

  private readonly saveState = toSignal(
    this.saveRequests.pipe(
      tap(() => (this.dialogRef.disableClose = true)),
      exhaustMap((draft) =>
        this.data.save(draft).pipe(
          tap((saved) => this.dialogRef.close(saved)),
          map((): SaveState => ({ saving: false, error: null })),
          catchError((error) => of({ saving: false, error: errorMessage(error) })),
          startWith({ saving: true, error: null }),
        ),
      ),
      tap(() => (this.dialogRef.disableClose = false)),
    ),
    { initialValue: { saving: false, error: null } },
  );

  readonly saving = computed(() => this.saveState().saving);
  readonly saveError = computed(() => this.saveState().error);

  public onSubmit(event: Event): void {
    event.preventDefault();
    this.bookForm().markAsTouched();
    if (this.bookForm().invalid()) {
      return;
    }
    const { name, author, pageCount } = this.model();
    this.saveRequests.next({ name: name.trim(), author: author.trim(), pageCount: pageCount! });
  }
}
