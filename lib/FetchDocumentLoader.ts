import 'isomorphic-fetch';
import {IDocumentLoader} from "./IDocumentLoader";
import {IJsonLdContextNormalized} from "./JsonLdContext";

/**
 * Loads documents via the fetch API.
 */
export class FetchDocumentLoader implements IDocumentLoader {

  public async load(url: string): Promise<IJsonLdContextNormalized> {
    const response: Response = await fetch(url);
    if (response.ok) {
      return (await response.json());
    } else {
      throw new Error(`No valid context was found at ${url}: ${response.statusText}`);
    }
  }

}
