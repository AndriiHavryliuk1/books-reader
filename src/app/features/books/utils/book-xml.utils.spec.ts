import { Book, BookData } from '../models/book.models';
import { parseBooksXml, serializeBooksXml } from './book-xml.utils';

const BOOKS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<library>
  <book>
    <name>The Little Mermaid</name>
    <author>Hans Christian Andersen</author>
    <pageCount>48</pageCount>
    <lastModified>2026-01-02T03:04:05.000Z</lastModified>
  </book>
  <book>
    <name>It</name>
    <author>Stephen King</author>
    <pageCount>1138</pageCount>
    <lastModified>2026-02-03T04:05:06.000Z</lastModified>
  </book>
</library>
`;

const BOOKS: BookData[] = [
  {
    name: 'The Little Mermaid',
    author: 'Hans Christian Andersen',
    pageCount: 48,
    lastModified: '2026-01-02T03:04:05.000Z',
  },
  { name: 'It', author: 'Stephen King', pageCount: 1138, lastModified: '2026-02-03T04:05:06.000Z' },
];

const IT = { name: 'It', author: 'Stephen King', pageCount: '1138' };

function bookXml(fields: Record<string, string>): string {
  const children = Object.entries(fields).map(([tag, value]) => `<${tag}>${value}</${tag}>`);
  return `<book>${children.join('')}</book>`;
}

function libraryXml(...books: string[]): string {
  return `<library>${books.join('')}</library>`;
}

function firstError(fields: Record<string, string>): string {
  return parseBooksXml(libraryXml(bookXml(fields))).errors[0]?.message;
}

describe('parseBooksXml', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads books from the library format', () => {
    expect(parseBooksXml(BOOKS_XML)).toEqual({ books: BOOKS, errors: [] });
  });

  it('returns nothing for an empty library', () => {
    expect(parseBooksXml('<library/>')).toEqual({ books: [], errors: [] });
  });

  it('trims values and ignores comments and unknown tags', () => {
    const xml = `
      <library>
        <!-- a comment -->
        <book>
          <id>ignored</id>
          <name>
            It
          </name>
          <author> Stephen King </author>
          <pageCount> 1138 </pageCount>
        </book>
        <magazine><name>Ignored</name></magazine>
      </library>`;

    expect(parseBooksXml(xml).books).toEqual([
      { name: 'It', author: 'Stephen King', pageCount: 1138 },
    ]);
  });

  it('decodes entities and CDATA', () => {
    const xml = libraryXml(
      bookXml({ name: 'Tom &amp; Jerry', author: '<![CDATA[A & B <C>]]>', pageCount: '1' }),
    );

    const [book] = parseBooksXml(xml).books;
    expect(book.name).toBe('Tom & Jerry');
    expect(book.author).toBe('A & B <C>');
  });

  it('converts lastModified to UTC', () => {
    const xml = libraryXml(bookXml({ ...IT, lastModified: '2026-05-01T10:00:00+02:00' }));

    expect(parseBooksXml(xml).books[0].lastModified).toBe('2026-05-01T08:00:00.000Z');
  });

  it('leaves lastModified out when it is empty', () => {
    const xml = libraryXml(bookXml({ ...IT, lastModified: ' ' }));

    expect(parseBooksXml(xml).books[0]).not.toHaveProperty('lastModified');
  });

  it('skips invalid books and reports their position', () => {
    const xml = libraryXml(
      bookXml({ author: 'Stephen King', pageCount: '1' }),
      bookXml(IT),
      bookXml({ name: 'It', author: ' ', pageCount: '1' }),
    );

    const { books, errors } = parseBooksXml(xml);

    expect(books).toHaveLength(1);
    expect(errors).toEqual([
      { position: 1, message: '<name> is missing or empty' },
      { position: 3, message: '<author> is missing or empty' },
    ]);
  });

  it('rejects a missing page count', () => {
    expect(firstError({ name: 'It', author: 'Stephen King' })).toBe(
      '<pageCount> is missing or empty',
    );
  });

  it.each(['1', '007', '100000'])('accepts page count %s', (pageCount) => {
    expect(firstError({ ...IT, pageCount })).toBeUndefined();
  });

  it.each(['0', '-5', '12.5', '1e3', 'many', '100001'])('rejects page count %s', (pageCount) => {
    expect(firstError({ ...IT, pageCount })).toBe(
      `<pageCount> must be a whole number from 1 to 100000, got "${pageCount}"`,
    );
  });

  it('rejects a title longer than 200 characters', () => {
    expect(firstError({ ...IT, name: 'x'.repeat(201) })).toBe(
      '<name> must be at most 200 characters',
    );
    expect(firstError({ ...IT, name: 'x'.repeat(200) })).toBeUndefined();
  });

  it.each(['soon', '2026-13-01', '2026-05-01 10:00'])('rejects date %s', (lastModified) => {
    expect(firstError({ ...IT, lastModified })).toBe(
      `<lastModified> must be an ISO 8601 date, got "${lastModified}"`,
    );
  });

  it('rejects a date in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00.000Z'));

    expect(firstError({ ...IT, lastModified: '2027-01-01' })).toBe(
      '<lastModified> must not be in the future, got "2027-01-01"',
    );
  });

  it.each(['', 'not xml', '<library><book></library>'])('throws on broken XML: %j', (xml) => {
    expect(() => parseBooksXml(xml)).toThrow('The file is not valid XML');
  });

  it('throws when the root element is not <library>', () => {
    expect(() => parseBooksXml('<books><book/></books>')).toThrow(
      'Expected a <library> root element, found <books>',
    );
  });
});

describe('serializeBooksXml', () => {
  it('writes the library format without ids', () => {
    const books: Book[] = BOOKS.map((book, index) => ({ ...book, id: `${index}` }));
    expect(serializeBooksXml(books)).toBe(BOOKS_XML);
  });

  it('writes an empty library', () => {
    expect(serializeBooksXml([])).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<library/>\n');
  });

  it('escapes special characters', () => {
    const xml = serializeBooksXml([{ ...BOOKS[0], name: 'Tom & Jerry <3>' }]);
    expect(xml).toContain('<name>Tom &amp; Jerry &lt;3&gt;</name>');
  });

  it('produces XML that parses back to the same books', () => {
    expect(parseBooksXml(serializeBooksXml(BOOKS)).books).toEqual(BOOKS);
  });
});
