import { Signal } from '@angular/core';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { TableState } from '../../../shared/models/table.models';
import { Book, BookXmlError, UpsertSummary } from './book.models';
import type { BooksStore } from '../store/books.store';

export interface BooksState {
  tableState: TableState<Book>;
  books: Book[];
}

export interface BookImportResult {
  summary: UpsertSummary;
  errors: BookXmlError[];
}

export type BooksStoreInstance = InstanceType<typeof BooksStore>;

export type BooksStoreContext = WritableStateSource<BooksState> &
  StateSignals<BooksState> & {
    total: Signal<number>;
  };
