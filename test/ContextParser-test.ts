import {ContextParser, FetchDocumentLoader} from "../index";

describe('ContextParser', () => {
  describe('#getPrefix', () => {
    it('to return a null when no colon exists', async () => {
      expect(ContextParser.getPrefix('abc', { '//': 'abc' })).toBe(null);
    });

    it('to return a null for just a colon', async () => {
      expect(ContextParser.getPrefix(':', { '//': 'abc' })).toBe(null);
    });

    it('to return a null for double slashed suffixes', async () => {
      expect(ContextParser.getPrefix('http://abc', { '//': 'abc' })).toBe(null);
    });

    it('to return a null for blank nodes', async () => {
      expect(ContextParser.getPrefix('_:abc', { _: 'abc' })).toBe(null);
    });

    it('to return a null for a non-existing term', async () => {
      expect(ContextParser.getPrefix('abc:def', { def: 'abc' })).toBe(null);
    });

    it('to return a null for a non-existing term', async () => {
      expect(ContextParser.getPrefix('abc:def', { abc: 'ABC' })).toBe('abc');
    });
  });

  describe('#expandPrefixedTerm', () => {
    it('to return when no prefix applies', async () => {
      expect(ContextParser.expandPrefixedTerm('abc:123', { def: 'DEF/' })).toBe('abc:123');
    });

    it('to return when a prefix applies', async () => {
      expect(ContextParser.expandPrefixedTerm('def:123', { def: 'DEF/' })).toBe('DEF/123');
    });
  });

  describe('#isPrefixValue', () => {
    it('should be false for null', async () => {
      expect(ContextParser.isPrefixValue(null)).toBeFalsy();
    });

    it('should be true for strings', async () => {
      expect(ContextParser.isPrefixValue('abc')).toBeTruthy();
    });

    it('should be true for objects with @id', async () => {
      expect(ContextParser.isPrefixValue({ '@id': 'bla' })).toBeTruthy();
    });

    it('should be false for objects without @id', async () => {
      expect(ContextParser.isPrefixValue({ '@notid': 'bla' })).toBeFalsy();
    });
  });

  describe('#expandPrefixedTerms', () => {
    it('should not modify an empty context', async () => {
      expect(ContextParser.expandPrefixedTerms({})).toEqual({});
    });

    it('should not modify a context without prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        abc: 'def',
      })).toEqual({
        abc: 'def',
      });
    });

    it('should expand a context with string prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: 'ex:Example',
        ex: 'http://example.org/',
      })).toEqual({
        Example: 'http://example.org/Example',
        ex: 'http://example.org/',
      });
    });

    it('should expand a context with nested string prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: 'exabc:Example',
        ex: 'http://example.org/',
        exabc: 'ex:abc/',
      })).toEqual({
        Example: 'http://example.org/abc/Example',
        ex: 'http://example.org/',
        exabc: 'http://example.org/abc/',
      });
    });

    it('should expand a context with object prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'ex:Example' },
        ex: 'http://example.org/',
      })).toEqual({
        Example: { '@id': 'http://example.org/Example' },
        ex: 'http://example.org/',
      });
    });

    it('should expand a context with nested string prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'exabc:Example' },
        ex: 'http://example.org/',
        exabc: 'ex:abc/',
      })).toEqual({
        Example: { '@id': 'http://example.org/abc/Example' },
        ex: 'http://example.org/',
        exabc: 'http://example.org/abc/',
      });
    });

    it('should not expand object prefixes that are not @id', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'ex:Example', '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      })).toEqual({
        Example: { '@id': 'http://example.org/Example', '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      });
    });

    it('should not expand object prefixes without @id', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      })).toEqual({
        Example: { '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      });
    });
  });

  describe('when instantiated without options', () => {
    let parser;

    beforeEach(() => {
      parser = new ContextParser();
    });

    it('should have a default document loader', async () => {
      expect(parser.documentLoader).toBeInstanceOf(FetchDocumentLoader);
    });
  });

  describe('when instantiated with empty options', () => {
    let parser;

    beforeEach(() => {
      parser = new ContextParser({});
    });

    it('should have a default document loader', async () => {
      expect(parser.documentLoader).toBeInstanceOf(FetchDocumentLoader);
    });
  });

  describe('when instantiated with options and a document loader', () => {
    let documentLoader;
    let parser;

    beforeEach(() => {
      documentLoader = new FetchDocumentLoader();
      parser = new ContextParser({ documentLoader });
    });

    it('should have the given document loader', async () => {
      expect(parser.documentLoader).toBe(documentLoader);
    });

    describe('for parsing URLs', () => {
      it('should parse a valid context URL', () => {
        return expect(parser.parse('http://example.org/simple.jsonld')).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should cache documents', async () => {
        const spy = jest.spyOn(parser.documentLoader, 'load');

        await parser.parse('http://example.org/simple.jsonld');

        expect(parser.documentCache['http://example.org/simple.jsonld']).toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });

        await expect(parser.parse('http://example.org/simple.jsonld')).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should fail to parse an invalid source', () => {
        return expect(parser.parse('http://example.org/invalid.jsonld')).rejects.toBeTruthy();
      });
    });

    describe('for parsing arrays', () => {
      it('should parse an empty array', () => {
        return expect(parser.parse([])).resolves.toEqual({});
      });

      it('should parse an array with one string', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
        ])).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with two strings', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
          'http://example.org/simple2.jsonld',
        ])).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          nickname: "http://xmlns.com/foaf/0.1/nick",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with an object and a string', () => {
        return expect(parser.parse([
          {
            npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
          },
          'http://example.org/simple2.jsonld',
        ])).resolves.toEqual({
          nickname: "http://xmlns.com/foaf/0.1/nick",
          npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
        });
      });

      it('should parse and expand prefixes', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
          {
            myint: { "@id": "xsd:integer" },
          },
        ])).resolves.toEqual({
          myint: { "@id": "http://www.w3.org/2001/XMLSchema#integer" },
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });
    });
  });
});
