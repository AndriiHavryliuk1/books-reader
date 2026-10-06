import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { defer, map, Observable, of } from 'rxjs';
import { TableState } from '../../../shared/models/table.models';
import { FileService } from '../../../shared/services/file.service';
import { pageCount, paginate } from '../../../shared/utils/table.utils';
import { BOOKS_INITIAL_STATE, MAX_IMPORT_BYTES } from '../constants/books-store.constants';
import { Book, BookDraft } from '../models/book.models';
import { BookImportResult, BooksStoreContext } from '../models/books-store.models';
import { parseBooksXml, serializeBooksXml } from '../utils/book-xml.utils';
import { bookKey, filterBooks, sortBooks, upsertBooks } from '../utils/book.utils';
import { dateNow, exportFileName } from '../../../shared/utils/utils';

export const BooksStore = signalStore(
  withState(BOOKS_INITIAL_STATE),
  withComputed(({ books, tableState }) => {
    const matches = computed(() => {
      const { search, sort } = tableState();
      return sortBooks(filterBooks(books(), search), sort);
    });
    return {
      total: computed(() => matches().length),
      page: computed(() => paginate(matches(), tableState())),
    };
  }),
  withMethods((store, fileService = inject(FileService)) => ({
    setTableState(tableState: TableState<Book>): void {
      patchState(store, { tableState });
    },
    add(draft: BookDraft): Observable<Book> {
      return defer(() => {
        assertUnique(store, draft);
        const book: Book = { ...draft, id: crypto.randomUUID(), lastModified: dateNow() };
        setBooks(store, [...store.books(), book]);
        return of(book);
      });
    },
    update(id: string, draft: BookDraft): Observable<Book> {
      return defer(() => {
        assertUnique(store, draft, id);
        const book: Book = { ...draft, id, lastModified: dateNow() };
        setBooks(
          store,
          store.books().map((existing) => (existing.id === id ? book : existing)),
        );
        return of(book);
      });
    },
    remove(id: string): void {
      setBooks(
        store,
        store.books().filter((book) => book.id !== id),
      );
    },
    importXml(file: File): Observable<BookImportResult> {
      return defer(() => {
        if (file.size > MAX_IMPORT_BYTES) {
          throw new Error('The file is too large (max 5 MB)');
        }
        return fileService.readText(file);
      }).pipe(
        map((xml) => {
          const { books, errors } = parseBooksXml(xml);
          const result = upsertBooks(store.books(), books);
          setBooks(store, result.books);
          return { summary: result.summary, errors };
        }),
      );
    },
    exportXml(): Observable<number> {
      return defer(() => {
        const books = sortBooks(store.books());
        return fileService
          .download(serializeBooksXml(books), exportFileName(new Date()), 'application/xml')
          .pipe(map(() => books.length));
      });
    },
  })),
);

function setBooks(store: BooksStoreContext, books: Book[]): void {
  patchState(store, { books });
  const tableState = store.tableState();
  const lastPageIndex = Math.max(pageCount(store.total(), tableState.pageSize) - 1, 0);
  if (tableState.pageIndex > lastPageIndex) {
    patchState(store, { tableState: { ...tableState, pageIndex: lastPageIndex } });
  }
}

function assertUnique(store: BooksStoreContext, draft: BookDraft, exceptId?: string): void {
  const key = bookKey(draft);
  if (store.books().some((book) => book.id !== exceptId && bookKey(book) === key)) {
    throw new Error(`"${draft.name}" by ${draft.author} is already in the library`);
  }
}
