import 'isomorphic-fetch';
import {resolve} from "relative-to-absolute-iri";
import {FetchDocumentLoader} from "./FetchDocumentLoader";
import {IDocumentLoader} from "./IDocumentLoader";
import {IJsonLdContextNormalized, IPrefixValue, JsonLdContext} from "./JsonLdContext";

/**
 * Parses JSON-LD contexts.
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

  /**
   * From a given context entry value, get the string value, or the @id field.
   * @param contextValue A value for a term in a context.
   * @return {string} The id value, or null.
   */
  public static getContextValueId(contextValue: any): string {
    if (typeof contextValue === 'string') {
      return contextValue;
    }
    const id = contextValue['@id'];
    return id ? id : null;
  }

  /**
   * Expand the term or prefix of the given term if it has one,
   * otherwise return the term as-is.
   * @param {string} term A term that is an URL or a prefixed URL.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {boolean} vocab If the term is a predicate or type and should be expanded based on @vocab,
   *                        otherwise it is considered a regular term that is expanded based on @base.
   * @return {string} The expanded term or the term as-is.
   */
  public static expandTerm(term: string, context: IJsonLdContextNormalized, vocab?: boolean): string {
    if (context[term]) {
      const value = this.getContextValueId(context[term]);
      if (value) {
        return value;
      }
    }
    const prefix: string = ContextParser.getPrefix(term, context);
    if (prefix) {
      const value = this.getContextValueId(context[prefix]);
      if (value) {
        return value + term.substr(prefix.length + 1);
      }
    } else if (vocab && context['@vocab'] && term.charAt(0) !== '@' && term.indexOf(':') < 0) {
      // Expand @vocab, unless the term value in the context is null
      if (context[term] !== null) {
        return context['@vocab'] + term;
      }
    } else if (!vocab && context['@base'] && term.charAt(0) !== '@' && term.indexOf(':') < 0) {
      // Expand @base, unless the term value in the context is null
      if (context[term] !== null) {
        return resolve(term, context['@base']);
      }
    }
    return term;
  }

  /**
   * Check if the given context value can be a prefix value.
   * @param value A context value.
   * @return {boolean} If it can be a prefix value.
   */
  public static isPrefixValue(value: any): boolean {
    return value && (typeof value === 'string' || value['@id'] || value['@type']);
  }

  /**
   * Add an @id term for all @reverse terms.
   * @param {IJsonLdContextNormalized} context A context.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public static idifyReverseTerms(context: IJsonLdContextNormalized): IJsonLdContextNormalized {
    for (const key of Object.keys(context)) {
      const value: IPrefixValue = context[key];
      if (value && typeof value === 'object') {
        if (value['@reverse'] && !value['@id']) {
          value['@id'] = value['@reverse'];
        }
      }
    }

    return context;
  }

  /**
   * Expand all prefixed terms in the given context.
   * @param {IJsonLdContextNormalized} context A context.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public static expandPrefixedTerms(context: IJsonLdContextNormalized): IJsonLdContextNormalized {
    for (const key of Object.keys(context)) {
      // No need to alter @vocab and @base entries
      if (key !== '@vocab' && key !== '@base') {
        // Loop because prefixes might be nested
        while (ContextParser.isPrefixValue(context[key])) {
          const value: IPrefixValue = context[key];
          let changed: boolean = false;
          if (typeof value === 'string') {
            context[key] = ContextParser.expandTerm(value, context);
            changed = changed || value !== context[key];
          } else {
            const id = value['@id'];
            const type = value['@type'];
            if (id) {
              context[key]['@id'] = ContextParser.expandTerm(id, context);
              changed = changed || id !== context[key]['@id'];
            }
            if (type) {
              context[key]['@type'] = ContextParser.expandTerm(type, context);
              changed = changed || type !== context[key]['@type'];
            }
          }
          if (!changed) {
            break;
          }
        }
      }
    }

    return context;
  }

  /**
   * Parse a JSON-LD context in any form.
   * @param {JsonLdContext} context A context, URL to a context, or an array of contexts/URLs.
   * @param {string} baseIri An optional base IRI to set.
   * @param {IJsonLdContextNormalized} parentContext The parent context.
   * @param {boolean} external If the parsing context is an external context.
   * @return {Promise<IJsonLdContextNormalized>} A promise resolving to the context.
   */
  public async parse(context: JsonLdContext,
                     baseIri?: string,
                     parentContext?: IJsonLdContextNormalized,
                     external?: boolean): Promise<IJsonLdContextNormalized> {
    if (!context) {
      // Context that are explicitly set to null are empty.
      return {};
    } else if (typeof context === 'string') {
      return this.parse(await this.load(context), baseIri, parentContext, true);
    } else if (Array.isArray(context)) {
      return context.reduce((accContextPromise, contextEntry) => accContextPromise
        .then((accContext) => this.parse(contextEntry, baseIri, accContext, external)), Promise.resolve({}));
    } else {
      // We have an actual context object.
      let newContext: any = {};

      // According to the JSON-LD spec, @base must be ignored from external contexts.
      if (external) {
        delete context['@base'];
      }

      // Override the base IRI if provided.
      if (baseIri) {
        newContext['@base'] = baseIri;
      }

      newContext = { ...newContext, ...parentContext, ...context };
      ContextParser.idifyReverseTerms(newContext);
      ContextParser.expandPrefixedTerms(newContext);
      return newContext;
    }
  }

  public async load(url: string): Promise<IJsonLdContextNormalized> {
    if (this.documentCache[url]) {
      return {... this.documentCache[url]};
    }
    return this.documentCache[url] = (await this.parse(await this.documentLoader.load(url),
      null, null, true))['@context'];
  }

}

export interface IContextFlattenerOptions {
  documentLoader?: IDocumentLoader;
}
