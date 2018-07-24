import {FetchDocumentLoader} from "../index";

describe('FetchDocumentLoader', () => {
  const loader = new FetchDocumentLoader();

  it('should fetch a valid source', () => {
    return expect(loader.load('http://example.org/simple.jsonld')).resolves.toEqual({
      name: "http://xmlns.com/foaf/0.1/name",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    });
  });

  it('should fail to fetch an invalid source', () => {
    return expect(loader.load('http://example.org/invalid.jsonld')).rejects.toBeTruthy();
  });
});
