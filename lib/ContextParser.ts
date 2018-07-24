import 'isomorphic-fetch';
import {FetchDocumentLoader} from "./FetchDocumentLoader";
import {IDocumentLoader} from "./IDocumentLoader";
import {IJsonLdContextNormalized, JsonLdContext} from "./JsonLdContext";

/**
 * Flattens JSON-LD contexts
 */
export class ContextParser implements IDocumentLoader {

  private readonly documentLoader: IDocumentLoader;
  private readonly documentCache: {[url: string]: any};

  constructor(options?: IContextFlattenerOptions) {
    options = options || {};
    this.documentLoader = options.documentLoader || new FetchDocumentLoader();
    this.documentCache = {};
  }

  public async parse(context: JsonLdContext,
                     parentContext?: IJsonLdContextNormalized): Promise<IJsonLdContextNormalized> {
    if (typeof context === 'string') {
      return this.parse(await this.load(context), parentContext);
    } else if (Array.isArray(context)) {
      return Object.assign.apply(null, [{}].concat(await Promise.all(context
        .map((contextEntry) => this.parse(contextEntry, parentContext)))));
    } else {
      // We have an actual context object.
      // TODO
      return context;
    }
  }

  public async load(url: string): Promise<IJsonLdContextNormalized> {
    if (this.documentCache[url]) {
      return {... this.documentCache[url]};
    }
    return this.documentCache[url] = await this.parse(await this.documentLoader.load(url));
  }

}

export interface IContextFlattenerOptions {
  documentLoader?: IDocumentLoader;
}
