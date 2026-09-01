import {FetchDocumentLoader} from "../index";

describe('FetchDocumentLoader', () => {
  const loader = new FetchDocumentLoader();
  const context = {
    '@context': {
      name: "http://xmlns.com/foaf/0.1/name",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
  };

  it('should fetch a valid source', () => {
    return expect(loader.load('http://example.org/simple.jsonld')).resolves.toEqual({
      '@context': {
        name: "http://xmlns.com/foaf/0.1/name",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });
  });

  it('should fetch a valid source with charset in context type', () => {
    return expect(loader.load('http://example.org/charset.jsonld')).resolves.toEqual({
      '@context': {
        name: "http://xmlns.com/foaf/0.1/name",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });
  });

  it('should prefer JSON-LD over JSON in the accept header', async() => {
    const fetcher = jest.fn(async(_url: string, init: RequestInit) => ({
      headers: new Headers({ 'Content-Type': 'application/ld+json' }),
      json: async() => context,
      ok: true,
    } as Response));

    await new FetchDocumentLoader(fetcher).load('http://example.org/context');

    expect(fetcher).toHaveBeenCalledWith('http://example.org/context', expect.objectContaining({
      headers: expect.any(Headers),
    }));
    const headers: Headers = fetcher.mock.calls[0][1].headers as Headers;
    expect(headers.get('Accept')).toBe('application/ld+json, application/json;q=0.9');
  });

  it.each([
    'application/json',
    'application/activity+json',
  ])('should fetch a valid source with content type %s', (contentType) => {
    const fetcher = async() => ({
      headers: new Headers({ 'Content-Type': contentType }),
      json: async() => context,
      ok: true,
    } as Response);

    return expect(new FetchDocumentLoader(fetcher).load('http://example.org/context')).resolves.toEqual(context);
  });

  it('should fail to fetch a source without content type', () => {
    return expect(loader.load('http://example.org/nocontenttype.jsonld')).rejects
        .toThrow(new Error('Unsupported JSON-LD media type null'));
  });

  it('should fail to fetch an invalid source', () => {
    return expect(loader.load('http://example.org/invalid.jsonld')).rejects
      .toThrow(new Error('FAIL (setupJest.js)'));
  });

  it('should fail to fetch an invalid source with only a status code response', () => {
    return expect(loader.load('http://example.org/invalid-statusCode.jsonld')).rejects
      .toThrow(new Error('Status code: 500'));
  });

  it('should fetch a valid source behind an alternate link', () => {
    return expect(loader.load('http://example.org/simple.html')).resolves.toEqual({
      '@context': {
        name: "http://xmlns.com/foaf/0.1/name",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });
  });

  it('should fail to fetch a source with two alternate links', () => {
    return expect(loader.load('http://example.org/two-alts.html')).rejects
      .toThrow(new Error('Multiple JSON-LD alternate links were found on http://example.org/two-alts.html'));
  });

  it('should fail to fetch a source with unknown rel link', () => {
    return expect(loader.load('http://example.org/unknown-rel.html')).rejects
      .toThrow(new Error('Unsupported JSON-LD media type text/html'));
  });

  it('should fail to fetch a source that responds with an invalid content type', () => {
    return expect(loader.load('http://example.org/other.ttl')).rejects
      .toThrow(new Error('Unsupported JSON-LD media type text/turtle'));
  });
});
