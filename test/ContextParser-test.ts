import {ContextParser, FetchDocumentLoader} from "../index";

describe('ContextParser', () => {
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

    it('should parse a valid context URL', () => {
      return expect(parser.parse('http://example.org/simple.jsonld')).resolves.toEqual({
        name: "http://xmlns.com/foaf/0.1/name",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      });
    });

    it('should fail to parse an invalid source', () => {
      return expect(parser.parse('http://example.org/invalid.jsonld')).rejects.toBeTruthy();
    });
  });
});
