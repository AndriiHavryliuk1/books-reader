import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { firstValueFrom, of } from 'rxjs';
import { FileService } from '../../../shared/services/file.service';
import { MAX_IMPORT_BYTES } from '../constants/books-store.constants';
import { SAMPLE_BOOKS } from '../data/sample-books';
import { Book } from '../models/book.models';
import { BooksStoreInstance } from '../models/books-store.models';
import { BooksStore } from './books.store';

const BOOKS: Book[] = Array.from({ length: 12 }, (_, i) => ({
  id: `${i + 1}`,
  name: `Book ${String(i + 1).padStart(2, '0')}`,
  author: 'Author',
  pageCount: 10,
  lastModified: '2026-01-01T00:00:00.000Z',
}));

describe('BooksStore', () => {
  let store: BooksStoreInstance;
  let fileService: { readText: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> };

  const pageTitles = () => store.page().map((book) => book.name);
  const xmlFile = () => new File([''], 'books.xml', { type: 'application/xml' });

  beforeEach(() => {
    fileService = { readText: vi.fn(), download: vi.fn() };
    TestBed.configureTestingModule({
      providers: [BooksStore, { provide: FileService, useValue: fileService }],
    });
    store = TestBed.inject(BooksStore);
    patchState(unprotected(store), {
      books: BOOKS,
      tableState: { ...store.tableState(), sort: [{ key: 'name', direction: 'asc' }] },
    });
  });

  it('starts with the sample books, newest first', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [BooksStore] });
    const fresh = TestBed.inject(BooksStore);

    expect(fresh.total()).toBe(SAMPLE_BOOKS.length);
    expect(fresh.tableState().sort).toEqual([{ key: 'lastModified', direction: 'desc' }]);
  });

  it('shows the first page', () => {
    expect(store.total()).toBe(12);
    expect(pageTitles()).toHaveLength(10);
    expect(pageTitles()[0]).toBe('Book 01');
  });

  it('filters by the search text', () => {
    store.setTableState({ ...store.tableState(), search: 'book 1' });

    expect(store.total()).toBe(3);
    expect(pageTitles()).toEqual(['Book 10', 'Book 11', 'Book 12']);
  });

  it('sorts by the table sort', () => {
    store.setTableState({ ...store.tableState(), sort: [{ key: 'name', direction: 'desc' }] });

    expect(pageTitles()[0]).toBe('Book 12');
  });

  it('shows the requested page', () => {
    store.setTableState({ ...store.tableState(), pageIndex: 1 });

    expect(pageTitles()).toEqual(['Book 11', 'Book 12']);
  });

  it('adds a book', async () => {
    const added = await firstValueFrom(
      store.add({ name: 'Book 00', author: 'Author', pageCount: 5 }),
    );

    expect(store.total()).toBe(13);
    expect(store.page()[0]).toEqual(added);
  });

  it('does not add anything until subscribed', () => {
    store.add({ name: 'Book 00', author: 'Author', pageCount: 5 });

    expect(store.total()).toBe(12);
  });

  it('updates a book', async () => {
    const updated = await firstValueFrom(
      store.update('1', { name: 'Book 99', author: 'Author', pageCount: 5 }),
    );

    expect(updated).toMatchObject({ id: '1', name: 'Book 99', pageCount: 5 });
    expect(store.books().find((book) => book.id === '1')?.name).toBe('Book 99');
  });

  it('removes a book', () => {
    store.remove('1');

    expect(store.total()).toBe(11);
    expect(pageTitles()[0]).toBe('Book 02');
  });

  it('rejects a book that is already in the library', async () => {
    await expect(
      firstValueFrom(store.add({ name: ' book  01', author: 'AUTHOR', pageCount: 1 })),
    ).rejects.toThrow('already in the library');
  });

  it('lets a book keep its own title when it is edited', async () => {
    const updated = await firstValueFrom(
      store.update('1', { name: 'Book 01', author: 'Author', pageCount: 99 }),
    );

    expect(updated.pageCount).toBe(99);
  });

  it('goes back a page when the last page becomes empty', () => {
    store.setTableState({ ...store.tableState(), pageIndex: 1 });

    store.remove('11');
    store.remove('12');

    expect(store.tableState().pageIndex).toBe(0);
  });

  it('imports books from an XML file', async () => {
    fileService.readText.mockReturnValue(
      of(`
        <library>
          <book>
            <name>Book 01</name><author>Author</author><pageCount>99</pageCount>
            <lastModified>2026-06-01T00:00:00Z</lastModified>
          </book>
          <book><name>New</name><author>Author</author><pageCount>7</pageCount></book>
          <book><name>Broken</name><author>Author</author><pageCount>x</pageCount></book>
        </library>`),
    );

    const result = await firstValueFrom(store.importXml(xmlFile()));

    expect(result.summary).toEqual({ added: 1, updated: 1, skipped: 0 });
    expect(result.errors).toEqual([
      { position: 3, message: '<pageCount> must be a whole number from 1 to 100000, got "x"' },
    ]);
    expect(store.total()).toBe(13);
    expect(store.page()[0]).toMatchObject({ name: 'Book 01', pageCount: 99 });
  });

  it('rejects a file that is not valid XML', async () => {
    fileService.readText.mockReturnValue(of('<nope'));

    await expect(firstValueFrom(store.importXml(xmlFile()))).rejects.toThrow(
      'The file is not valid XML',
    );
    expect(store.books()).toBe(BOOKS);
  });

  it('rejects files over 5 MB', async () => {
    const hugeFile = { size: MAX_IMPORT_BYTES + 1 } as File;

    await expect(firstValueFrom(store.importXml(hugeFile))).rejects.toThrow(
      'The file is too large (max 5 MB)',
    );
    expect(fileService.readText).not.toHaveBeenCalled();
  });

  it('exports all books, not only the current page', async () => {
    fileService.download.mockReturnValue(of(undefined));
    store.setTableState({ ...store.tableState(), search: 'Book 1' });

    const count = await firstValueFrom(store.exportXml());

    expect(count).toBe(12);
    const [content, fileName, type] = fileService.download.mock.calls[0];
    expect(content.match(/<book>/g)).toHaveLength(12);
    expect(fileName).toMatch(/^books-\d{4}-\d{2}-\d{2}\.xml$/);
    expect(type).toBe('application/xml');
  });
});
