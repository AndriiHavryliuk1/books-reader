import { formatDateTime } from '../../../shared/utils/utils';
import { Book, BookData } from '../models/book.models';
import { bookKey, filterBooks, sortBooks, upsertBooks } from './book.utils';

const JAN = '2026-01-01T00:00:00.000Z';
const JUN = '2026-06-01T00:00:00.000Z';

function makeBook(name: string, author: string, overrides: Partial<Book> = {}): Book {
  return { id: name, name, author, pageCount: 100, lastModified: JAN, ...overrides };
}

const titles = (books: BookData[]) => books.map((book) => book.name);

describe('sortBooks', () => {
  const books = [
    makeBook('The Ugly Duckling', 'Andersen', { pageCount: 32, lastModified: JUN }),
    makeBook('It', 'King', { pageCount: 1138 }),
    makeBook('The Little Mermaid', 'Andersen', { pageCount: 48 }),
    makeBook('Carrie', 'King', { pageCount: 199 }),
  ];

  it('keeps the order when there is no sort', () => {
    expect(titles(sortBooks(books))).toEqual([
      'The Ugly Duckling',
      'It',
      'The Little Mermaid',
      'Carrie',
    ]);
  });

  it('sorts by title', () => {
    expect(titles(sortBooks(books, [{ key: 'name', direction: 'asc' }]))).toEqual([
      'Carrie',
      'It',
      'The Little Mermaid',
      'The Ugly Duckling',
    ]);
  });

  it('sorts by page count, descending', () => {
    expect(titles(sortBooks(books, [{ key: 'pageCount', direction: 'desc' }]))).toEqual([
      'It',
      'Carrie',
      'The Little Mermaid',
      'The Ugly Duckling',
    ]);
  });

  it('sorts by last modified', () => {
    const [first] = sortBooks(books, [{ key: 'lastModified', direction: 'desc' }]);
    expect(first.name).toBe('The Ugly Duckling');
  });

  it('uses the next sort level when books are equal', () => {
    const sort = [
      { key: 'author', direction: 'asc' },
      { key: 'name', direction: 'asc' },
    ] as const;

    expect(titles(sortBooks(books, [...sort]))).toEqual([
      'The Little Mermaid',
      'The Ugly Duckling',
      'Carrie',
      'It',
    ]);
  });

  it('keeps equal books in their original order', () => {
    expect(titles(sortBooks(books, [{ key: 'author', direction: 'desc' }]))).toEqual([
      'It',
      'Carrie',
      'The Ugly Duckling',
      'The Little Mermaid',
    ]);
  });

  it('does not change the original array', () => {
    const original = [...books];
    sortBooks(books, [{ key: 'name', direction: 'asc' }]);
    expect(books).toEqual(original);
  });
});

describe('filterBooks', () => {
  const books = [
    makeBook('The Little Mermaid', 'Hans Christian Andersen', { pageCount: 48 }),
    makeBook('Little Women', 'Louisa May Alcott', { pageCount: 759, lastModified: JUN }),
    makeBook('It', 'Stephen King', { pageCount: 1138 }),
  ];
  const search = (term: string) => titles(filterBooks(books, term));

  it('finds books by part of the title, ignoring case', () => {
    expect(search('LITTLE')).toEqual(['The Little Mermaid', 'Little Women']);
  });

  it('finds books by author', () => {
    expect(search('king')).toEqual(['It']);
  });

  it('finds books by page count', () => {
    expect(search('759')).toEqual(['Little Women']);
  });

  it('finds books by the date shown in the table', () => {
    expect(search(formatDateTime(JUN))).toEqual(['Little Women']);
  });

  it('does not match text spread over two fields', () => {
    expect(search('mermaid hans')).toEqual([]);
  });

  it('returns all books for an empty search', () => {
    expect(search('  ')).toHaveLength(3);
  });
});

describe('bookKey', () => {
  it('ignores case and extra spaces', () => {
    expect(bookKey({ name: '  The   Little Mermaid ', author: 'HANS  Andersen' })).toBe(
      bookKey({ name: 'the little mermaid', author: 'hans andersen' }),
    );
  });

  it('differs for different books', () => {
    expect(bookKey({ name: 'It', author: 'King' })).not.toBe(
      bookKey({ name: 'It', author: 'Kingsley' }),
    );
    // Author and title must not run together.
    expect(bookKey({ name: 'c', author: 'ab' })).not.toBe(bookKey({ name: 'bc', author: 'a' }));
  });
});

describe('upsertBooks', () => {
  const createId = () => 'new-id';

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a book that is not in the library yet', () => {
    const it = makeBook('It', 'King');
    const { books, summary } = upsertBooks(
      [it],
      [{ name: 'Carrie', author: 'King', pageCount: 199, lastModified: JAN }],
      createId,
    );

    expect(books).toEqual([
      it,
      { id: 'new-id', name: 'Carrie', author: 'King', pageCount: 199, lastModified: JAN },
    ]);
    expect(summary).toEqual({ added: 1, updated: 0, skipped: 0 });
  });

  it('updates a book when the imported copy is newer', () => {
    const { books, summary } = upsertBooks(
      [makeBook('It', 'King', { id: '1' })],
      [{ name: ' it ', author: 'KING', pageCount: 1138, lastModified: JUN }],
      createId,
    );

    expect(books).toEqual([
      { id: '1', name: ' it ', author: 'KING', pageCount: 1138, lastModified: JUN },
    ]);
    expect(summary).toEqual({ added: 0, updated: 1, skipped: 0 });
  });

  it('skips a book when the imported copy is not newer', () => {
    const existing = [makeBook('It', 'King', { lastModified: JUN })];
    const { books, summary } = upsertBooks(
      existing,
      [
        { name: 'It', author: 'King', pageCount: 1, lastModified: JAN },
        { name: 'It', author: 'King', pageCount: 2, lastModified: JUN },
        { name: 'It', author: 'King', pageCount: 3 },
      ],
      createId,
    );

    expect(books).toEqual(existing);
    expect(summary).toEqual({ added: 0, updated: 0, skipped: 3 });
  });

  it('dates a new book without lastModified with the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(JUN));

    const { books } = upsertBooks([], [{ name: 'It', author: 'King', pageCount: 1 }], createId);

    expect(books[0].lastModified).toBe(JUN);
  });

  it('keeps the newest copy when a file has the same book twice', () => {
    const { books, summary } = upsertBooks(
      [],
      [
        { name: 'It', author: 'King', pageCount: 1, lastModified: JAN },
        { name: 'It', author: 'King', pageCount: 2, lastModified: JUN },
      ],
      createId,
    );

    expect(books).toHaveLength(1);
    expect(books[0].pageCount).toBe(2);
    expect(summary).toEqual({ added: 1, updated: 1, skipped: 0 });
  });
});
