import 'isomorphic-fetch';
import {IDocumentLoader} from "./IDocumentLoader";
import {IJsonLdContext} from "./JsonLdContext";

/**
 * Loads documents via the fetch API.
 */
export class FetchDocumentLoader implements IDocumentLoader {

  public async load(url: string): Promise<IJsonLdContext> {
    const response: Response = await fetch(url, { headers: { accept: 'application/ld+json' } });
    if (response.ok) {
      return (await response.json());
    } else {
      throw new Error(`No valid context was found at ${url}: ${response.statusText}`);
    }
  }

}
