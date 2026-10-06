export interface Book {
  id: string;
  name: string;
  author: string;
  pageCount: number;
  lastModified: string;
}

export type BookData = Omit<Book, 'id'>;

export type ImportedBook = Omit<BookData, 'lastModified'> & { lastModified?: string };

export type BookDraft = Pick<Book, 'name' | 'author' | 'pageCount'>;

export interface BookXmlError {
  position: number;
  message: string;
}

export interface UpsertSummary {
  added: number;
  updated: number;
  skipped: number;
}

export interface UpsertResult {
  books: Book[];
  summary: UpsertSummary;
}
