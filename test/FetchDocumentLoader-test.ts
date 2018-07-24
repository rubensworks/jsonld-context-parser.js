import {FetchDocumentLoader} from "../index";

describe('FetchDocumentLoader', () => {
  const loader = new FetchDocumentLoader();

  it('should fetch valid sources', () => {
    return expect(loader.load('http://example.org/simple.jsonld')).resolves.toEqual({
      "@context": {
        name: "http://xmlns.com/foaf/0.1/name",
        xsd: "http://www.w3.org/2001/XMLSchema#",
      },
    });
  });

  it('should fail to fetch invalid sources', () => {
    return expect(loader.load('http://example.org/invalid.jsonld')).rejects.toBeTruthy();
  });
});
