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

  /**
   * Get the prefix from the given term.
   * @see https://json-ld.org/spec/latest/json-ld/#compact-iris
   * @param {string} term A term that is an URL or a prefixed URL.
   * @param {IJsonLdContextNormalized} context A context.
   * @return {string} The prefix or null.
   */
  public static getPrefix(term: string, context: IJsonLdContextNormalized): string {
    const separatorPos: number = term.indexOf(':');
    if (separatorPos >= 0) {
      // Suffix can not begin with two slashes
      if (term.length > separatorPos + 1
        && term.charAt(separatorPos + 1) === '/'
        && term.charAt(separatorPos + 2) === '/') {
        return null;
      }

      const prefix: string = term.substr(0, separatorPos);

      // Prefix can not be an underscore (this is a blank node)
      if (prefix === '_') {
        return null;
      }

      // Prefix must match a term in the active context
      if (context[prefix]) {
        return prefix;
      }
    }
    return null;
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
