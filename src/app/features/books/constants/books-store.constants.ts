import { SAMPLE_BOOKS } from '../data/sample-books';
import { BooksState } from '../models/books-store.models';
import { upsertBooks } from '../utils/book.utils';
import { DEFAULT_PAGE_SIZE } from '../../../shared/constants/table.constants';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const BOOKS_INITIAL_STATE: BooksState = {
  tableState: {
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    search: '',
    sort: [{ key: 'lastModified', direction: 'desc' }],
  },
  books: upsertBooks([], SAMPLE_BOOKS).books,
};
