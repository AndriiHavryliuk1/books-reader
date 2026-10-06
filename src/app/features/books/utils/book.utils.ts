import { TableKey, TableSort } from '../../../shared/models/table.models';
import { Book, BookData, ImportedBook, UpsertResult, UpsertSummary } from '../models/book.models';
import { formatDateTime } from '../../../shared/utils/utils';

type BookComparator = (a: BookData, b: BookData) => number;

const COMPARATORS: Partial<Record<TableKey<Book>, BookComparator>> = {
  author: (a, b) => a.author.localeCompare(b.author, 'en-US'),
  name: (a, b) => a.name.localeCompare(b.name, 'en-US'),
  pageCount: (a, b) => a.pageCount - b.pageCount,
  lastModified: (a, b) => Date.parse(a.lastModified) - Date.parse(b.lastModified),
};

export function sortBooks<T extends BookData>(books: T[], sort: TableSort<Book>[] = []): T[] {
  return [...books].sort((a, b) => {
    for (const { key, direction } of sort) {
      const result = COMPARATORS[key]?.(a, b) ?? 0;
      if (result) {
        return direction === 'desc' ? -result : result;
      }
    }
    return 0;
  });
}

function searchableText({ name, author, pageCount, lastModified }: BookData): string {
  return [name, author, pageCount, formatDateTime(lastModified)].join('\n').toLowerCase();
}

export function filterBooks<T extends BookData>(books: T[], search: string): T[] {
  const term = search.trim().toLowerCase();
  return term ? books.filter((book) => searchableText(book).includes(term)) : [...books];
}

export function bookKey({ author, name }: Pick<BookData, 'author' | 'name'>): string {
  return `${normalize(author)}-${normalize(name)}`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function upsertBooks(
  existing: Book[],
  imported: ImportedBook[],
  createId: () => string = () => crypto.randomUUID(),
): UpsertResult {
  const now = new Date().toISOString();
  const books = [...existing];
  const indexByKey = new Map(books.map((book, index) => [bookKey(book), index]));
  const summary: UpsertSummary = { added: 0, updated: 0, skipped: 0 };

  for (const importedBook of imported) {
    const key = bookKey(importedBook);
    const index = indexByKey.get(key);

    if (index === undefined) {
      const book = {
        ...importedBook,
        id: createId(),
        lastModified: importedBook.lastModified ?? now,
      };
      indexByKey.set(key, books.push(book) - 1);
      summary.added++;
    } else if (
      importedBook.lastModified &&
      Date.parse(importedBook.lastModified) > Date.parse(books[index].lastModified)
    ) {
      books[index] = {
        ...importedBook,
        id: books[index].id,
        lastModified: importedBook.lastModified,
      };
      summary.updated++;
    } else {
      summary.skipped++;
    }
  }

  return { books, summary };
}
