import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { MAX_BOOK_TEXT_LENGTH, MAX_PAGE_COUNT } from '../constants/book.constants';
import { BookData, BookXmlError, ImportedBook } from '../models/book.models';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

// 2026-05-01, 2026-05-01T10:00, 2026-05-01T10:00:00.000Z, 2026-05-01T10:00:00+02:00, ...
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const parser = new XMLParser({
  ignoreAttributes: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (_, path) => path === 'library.book',
});

const builder = new XMLBuilder({ format: true, indentBy: '  ', suppressEmptyNode: true });

type ParsedBook = Partial<Record<keyof BookData, unknown>>;

export interface BooksXmlResult {
  books: ImportedBook[];
  errors: BookXmlError[];
}

export function parseBooksXml(xml: string): BooksXmlResult {
  if (XMLValidator.validate(xml) !== true) {
    throw new Error('The file is not valid XML');
  }

  const document = parser.parse(xml);
  const rootNames = Object.keys(document);
  // The validator allows several root elements; ones with the same name are parsed into an array.
  if (rootNames.length !== 1 || Array.isArray(document[rootNames[0]])) {
    throw new Error('The file is not valid XML');
  }
  if (rootNames[0] !== 'library') {
    throw new Error(`Expected a <library> root element, found <${rootNames[0]}>`);
  }

  const books: ImportedBook[] = [];
  const errors: BookXmlError[] = [];
  const entries: (ParsedBook | '')[] = document.library.book ?? [];

  entries.forEach((entry, index) => {
    try {
      books.push(toBook(entry || {}));
    } catch (error) {
      errors.push({ position: index + 1, message: (error as Error).message });
    }
  });

  return { books, errors };
}

export function serializeBooksXml(books: BookData[]): string {
  const book = books.map(({ name, author, pageCount, lastModified }) => ({
    name,
    author,
    pageCount,
    lastModified,
  }));

  return `${XML_DECLARATION}\n${builder.build({ library: { book } })}`;
}

function toBook(entry: ParsedBook): ImportedBook {
  const name = readText(entry.name);
  const author = readText(entry.author);
  const pageCount = readText(entry.pageCount);
  const lastModified = readText(entry.lastModified);

  checkText('name', name);
  checkText('author', author);

  if (!pageCount) {
    throw new Error('<pageCount> is missing or empty');
  }
  if (!/^\d+$/.test(pageCount) || Number(pageCount) < 1 || Number(pageCount) > MAX_PAGE_COUNT) {
    throw new Error(
      `<pageCount> must be a whole number from 1 to ${MAX_PAGE_COUNT}, got "${pageCount}"`,
    );
  }

  const book: ImportedBook = { name, author, pageCount: Number(pageCount) };
  if (lastModified) {
    const date = new Date(lastModified);
    if (!ISO_DATE.test(lastModified) || Number.isNaN(date.getTime())) {
      throw new Error(`<lastModified> must be an ISO 8601 date, got "${lastModified}"`);
    }
    if (date.getTime() > Date.now()) {
      throw new Error(`<lastModified> must not be in the future, got "${lastModified}"`);
    }
    book.lastModified = date.toISOString();
  }
  return book;
}

function checkText(name: string, value: string): void {
  if (!value) {
    throw new Error(`<${name}> is missing or empty`);
  }
  if (value.length > MAX_BOOK_TEXT_LENGTH) {
    throw new Error(`<${name}> must be at most ${MAX_BOOK_TEXT_LENGTH} characters`);
  }
}

// Elements that contain other elements are parsed into objects; treat them as empty.
function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
