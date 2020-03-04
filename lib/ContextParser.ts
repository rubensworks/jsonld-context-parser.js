import 'isomorphic-fetch';
import {resolve} from "relative-to-absolute-iri";
import {ERROR_CODES, ErrorCoded} from "./ErrorCoded";
import {FetchDocumentLoader} from "./FetchDocumentLoader";
import {IDocumentLoader} from "./IDocumentLoader";
import {IJsonLdContextNormalized, IPrefixValue, JsonLdContext} from "./JsonLdContext";

// tslint:disable-next-line:no-var-requires
const canonicalizeJson = require('canonicalize');

/**
 * Parses JSON-LD contexts.
 */
export class ContextParser implements IDocumentLoader {

  public static readonly DEFAULT_PROCESSING_MODE: number = 1.1;

  // Regex for valid IRIs
  public static readonly IRI_REGEX: RegExp = /^([A-Za-z][A-Za-z0-9+-.]*|_):[^ "<>{}|\\\[\]`#]*(#[^#]*)?$/;
  // Regex for keyword form
  public static readonly KEYWORD_REGEX: RegExp = /^@[a-z]+$/i;
  // Regex to see if an IRI ends with a gen-delim character (see RFC 3986)
  public static readonly ENDS_WITH_GEN_DELIM: RegExp = /[:/?#\[\]@]$/;
  // Regex for language tags
  public static readonly REGEX_LANGUAGE_TAG: RegExp = /^[a-zA-Z]+(-[a-zA-Z0-9]+)*$/;
  // Regex for base directions
  public static readonly REGEX_DIRECTION_TAG: RegExp = /^(ltr)|(rtl)$/;

  // All known valid JSON-LD keywords
  // @see https://www.w3.org/TR/json-ld11/#keywords
  public static readonly VALID_KEYWORDS: {[keyword: string]: boolean} = {
    '@base': true,
    '@container': true,
    '@context': true,
    '@direction': true,
    '@graph': true,
    '@id': true,
    '@import': true,
    '@included': true,
    '@index': true,
    '@json': true,
    '@language': true,
    '@list': true,
    '@nest': true,
    '@none': true,
    '@prefix': true,
    '@propagate': true,
    '@protected': true,
    '@reverse': true,
    '@set': true,
    '@type': true,
    '@value': true,
    '@version': true,
    '@vocab': true,
  };
  // Keys in the contexts that will not be expanded based on the base IRI
  private static readonly EXPAND_KEYS_BLACKLIST: string[] = [
    '@base',
    '@vocab',
    '@language',
    '@version',
    '@direction',
  ];
  // Keys in the contexts that may not be aliased
  private static readonly ALIAS_KEYS_BLACKLIST: string[] = [
    '@container',
    '@graph',
    '@id',
    '@index',
    '@list',
    '@nest',
    '@none',
    '@prefix',
    '@reverse',
    '@set',
    '@type',
    '@value',
    '@version',
  ];
  // All valid @container values
  private static readonly CONTAINERS: string[] = [
    '@list',
    '@set',
    '@index',
    '@language',
    '@graph',
    '@id',
    '@type',
  ];

  private readonly documentLoader: IDocumentLoader;
  private readonly documentCache: {[url: string]: any};
  private readonly validate: boolean;
  private readonly expandContentTypeToBase: boolean;

  constructor(options?: IContextParserOptions) {
    options = options || {};
    this.documentLoader = options.documentLoader || new FetchDocumentLoader();
    this.documentCache = {};
    this.validate = !options.skipValidation;
    this.expandContentTypeToBase = !!options.expandContentTypeToBase;
  }

  /**
   * Check if the given term is a valid compact IRI.
   * Otherwise, it may be an IRI.
   * @param {string} term A term.
   * @return {boolean} If it is a compact IRI.
   */
  public static isCompactIri(term: string) {
    return term.indexOf(':') > 0 && !(term && term[0] === '#');
  }

  /**
   * Get the prefix from the given term.
   * @see https://json-ld.org/spec/latest/json-ld/#compact-iris
   * @param {string} term A term that is an URL or a prefixed URL.
   * @param {IJsonLdContextNormalized} context A context.
   * @return {string} The prefix or null.
   */
  public static getPrefix(term: string, context: IJsonLdContextNormalized): string | null {
    // Do not consider relative IRIs starting with a hash as compact IRIs
    if (term && term[0] === '#') {
      return null;
    }

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
      if (prefix === '_' ) {
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
    if (contextValue === null || typeof contextValue === 'string') {
      return contextValue;
    }
    const id = contextValue['@id'];
    return id ? id : null;
  }

  /**
   * Check if the given simple term definition (string-based value of a context term)
   * should be considered a prefix.
   * @param value A simple term definition value.
   * @param options Options that define the way how expansion must be done.
   */
  public static isSimpleTermDefinitionPrefix(value: string, options: IExpandOptions): boolean {
    return !ContextParser.isPotentialKeyword(value)
      && (value[0] === '_' || options.allowPrefixNonGenDelims || ContextParser.isPrefixIriEndingWithGenDelim(value));
  }

  /**
   * Expand the term or prefix of the given term if it has one,
   * otherwise return the term as-is.
   *
   * This will try to expand the IRI as much as possible.
   *
   * Iff in vocab-mode, then other references to other terms in the context can be used,
   * such as to `myTerm`:
   * ```
   * {
   *   "myTerm": "http://example.org/myLongTerm"
   * }
   * ```
   *
   * @param {string} term A term that is an URL or a prefixed URL.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {boolean} expandVocab If the term is a predicate or type and should be expanded based on @vocab,
   *                              otherwise it is considered a regular term that is expanded based on @base.
   * @param {IExpandOptions} options Options that define the way how expansion must be done.
   * @return {string} The expanded term, the term as-is, or null if it was explicitly disabled in the context.
   * @throws If the term is aliased to an invalid value (not a string, IRI or keyword).
   */
  public static expandTerm(term: string, context: IJsonLdContextNormalized, expandVocab?: boolean,
                           options: IExpandOptions = defaultExpandOptions): string | null {
    ContextParser.assertNormalized(context);

    const contextValue = context[term];

    // Immediately return if the term was disabled in the context
    if (contextValue === null || (contextValue && contextValue['@id'] === null)) {
      return null;
    }

    // Check the @id
    const reversed = contextValue && contextValue['@reverse'];
    let validIriMapping = true;
    if (contextValue && expandVocab) {
      const value = this.getContextValueId(contextValue);
      if (value && value !== term) {
        if (typeof value !== 'string' || (!ContextParser.isValidIri(value) && !ContextParser.isValidKeyword(value))) {
          // Don't mark this mapping as invalid if we have an unknown keyword, but of the correct form.
          if ((reversed && !options.allowReverseRelativeToVocab) || !ContextParser.isPotentialKeyword(value)) {
            validIriMapping = false;
          }
        } else {
          return value;
        }
      }
    }

    // Check if the term is prefixed
    const prefix: string | null = ContextParser.getPrefix(term, context);
    const vocab: string | undefined = context['@vocab'];
    const vocabRelative: boolean = (!!vocab || vocab === '') && vocab.indexOf(':') < 0;
    const base: string | undefined = context['@base'];
    const potentialKeyword = ContextParser.isPotentialKeyword(term);
    if (prefix) {
      const contextPrefixValue = context[prefix];
      const value = this.getContextValueId(contextPrefixValue);

      if (value) {
        if (typeof contextPrefixValue === 'string' || !options.allowPrefixForcing) {
          // If we have a simple term definition,
          // check the last character of the prefix to determine whether or not it is a prefix.
          // Validate that prefix ends with gen-delim character, unless @prefix is true
          if (!ContextParser.isSimpleTermDefinitionPrefix(value, options)) {
            // Treat the term as an absolute IRI
            return term;
          }
        } else {
          // If we have an expanded term definition, default to @prefix: false
          if (value[0] !== '_' && !potentialKeyword && !contextPrefixValue['@prefix'] && !(term in context)) {
            // Treat the term as an absolute IRI
            return term;
          }
        }

        return value + term.substr(prefix.length + 1);
      }
    } else if (expandVocab && ((vocab || vocab === '') || (options.allowVocabRelativeToBase && (base && vocabRelative)))
      && !potentialKeyword && !ContextParser.isCompactIri(term)
      && !(reversed && !options.allowReverseRelativeToVocab)) {
      if (vocabRelative) {
        if (options.allowVocabRelativeToBase) {
          return resolve(<string> vocab, base) + term;
        } else {
          throw new ErrorCoded(`Relative vocab expansion for term '${term}' with vocab '${
            vocab}' is not allowed.`, ERROR_CODES.INVALID_VOCAB_MAPPING);
        }
      } else {
        return vocab + term;
      }
    } else if (!expandVocab && base && !potentialKeyword && !ContextParser.isCompactIri(term)) {
      return resolve(term, base);
    }

    // Return the term as-is, unless we discovered an invalid IRI mapping for this term in the context earlier.
    if (validIriMapping) {
      return term;
    } else {
      throw new ErrorCoded(`Invalid IRI mapping found for context entry '${term}': '${
        JSON.stringify(contextValue)}'`, ERROR_CODES.INVALID_IRI_MAPPING);
    }
  }

  /**
   * Compact the given term using @base, @vocab, an aliased term, or a prefixed term.
   *
   * This will try to compact the IRI as much as possible.
   *
   * @param {string} iri An IRI to compact.
   * @param {IJsonLdContextNormalized} context The context to compact with.
   * @param {boolean} vocab If the term is a predicate or type and should be compacted based on @vocab,
   *                        otherwise it is considered a regular term that is compacted based on @base.
   * @return {string} The compacted term or the IRI as-is.
   */
  public static compactIri(iri: string, context: IJsonLdContextNormalized, vocab?: boolean): string {
    ContextParser.assertNormalized(context);

    // Try @vocab compacting
    if (vocab && context['@vocab'] && iri.startsWith(context['@vocab'])) {
      return iri.substr(context['@vocab'].length);
    }

    // Try @base compacting
    if (!vocab && context['@base'] && iri.startsWith(context['@base'])) {
      return iri.substr(context['@base'].length);
    }

    // Loop over all terms in the context
    // This will try to prefix as short as possible.
    // Once a fully compacted alias is found, return immediately, as we can not go any shorter.
    const shortestPrefixing: { prefix: string, suffix: string } = { prefix: '', suffix: iri };
    for (const key in context) {
      const value = context[key];
      if (value && !ContextParser.isPotentialKeyword(key)) {
        const contextIri = this.getContextValueId(value);
        if (iri.startsWith(contextIri)) {
          const suffix = iri.substr(contextIri.length);
          if (!suffix) {
            if (vocab) {
              // Immediately return on compacted alias
              return key;
            }
          } else if (suffix.length < shortestPrefixing.suffix.length) {
            // Overwrite the shortest prefix
            shortestPrefixing.prefix = key;
            shortestPrefixing.suffix = suffix;
          }
        }
      }
    }

    // Return the shortest prefix
    if (shortestPrefixing.prefix) {
      return shortestPrefixing.prefix + ':' + shortestPrefixing.suffix;
    }

    return iri;
  }

  /**
   * An an assert to check if the given context has been normalized.
   * An error will be thrown otherwise.
   * @param {JsonLdContext} context A context.
   */
  public static assertNormalized(context: JsonLdContext) {
    if (typeof context === 'string' || Array.isArray(context) || context['@context']) {
      throw new Error('The given context is not normalized. Make sure to call ContextParser.parse() first.');
    }
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
   * Check if the given IRI is valid.
   * @param {string} iri A potential IRI.
   * @return {boolean} If the given IRI is valid.
   */
  public static isValidIri(iri: string): boolean {
    return ContextParser.IRI_REGEX.test(iri);
  }

  /**
   * Check if the given keyword is a defined according to the JSON-LD specification.
   * @param {string} keyword A potential keyword.
   * @return {boolean} If the given keyword is valid.
   */
  public static isValidKeyword(keyword: any): boolean {
    return ContextParser.VALID_KEYWORDS[keyword];
  }

  /**
   * Check if the given keyword is of the keyword format "@"1*ALPHA.
   * @param {string} keyword A potential keyword.
   * @return {boolean} If the given keyword is of the keyword format.
   */
  public static isPotentialKeyword(keyword: any): boolean {
    return typeof keyword === 'string' && ContextParser.KEYWORD_REGEX.test(keyword);
  }

  /**
   * Check if the given prefix ends with a gen-delim character.
   * @param {string} prefixIri A prefix IRI.
   * @return {boolean} If the given prefix IRI is valid.
   */
  public static isPrefixIriEndingWithGenDelim(prefixIri: string): boolean {
    return ContextParser.ENDS_WITH_GEN_DELIM.test(prefixIri);
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
          if (typeof value['@reverse'] !== 'string') {
            throw new Error(`Invalid @reverse value: '${value['@reverse']}'`);
          }
          value['@id'] = <string> value['@reverse'];
          value['@reverse'] = <any> true;
        }
      }
    }

    return context;
  }

  /**
   * Expand all prefixed terms in the given context.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {boolean} expandContentTypeToBase If @type inside the context may be expanded
   *                                          via @base if @vocab is set to null.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public static expandPrefixedTerms(context: IJsonLdContextNormalized,
                                    expandContentTypeToBase: boolean): IJsonLdContextNormalized {
    for (const key of Object.keys(context)) {
      // Only expand allowed keys
      if (ContextParser.EXPAND_KEYS_BLACKLIST.indexOf(key) < 0) {
        // Error if we try to alias a keyword to something else.
        const keyValue = context[key];
        if (ContextParser.getContextValueId(keyValue) && ContextParser.isPotentialKeyword(key)
          && ContextParser.ALIAS_KEYS_BLACKLIST.indexOf(key) >= 0) {
          throw new ErrorCoded(`Keywords can not be aliased to something else.
Tried mapping ${key} to ${JSON.stringify(keyValue)}`, ERROR_CODES.INVALID_KEYWORD_ALIAS);
        }

        // Error if this term was marked as prefix as well
        if (keyValue && ContextParser.isPotentialKeyword(ContextParser.getContextValueId(keyValue))
          && keyValue['@prefix'] === true) {
          throw new ErrorCoded(`Tried to use keyword aliases as prefix: '${key}': '${JSON.stringify(keyValue)}'`,
            ERROR_CODES.INVALID_TERM_DEFINITION);
        }

        // Loop because prefixes might be nested
        while (ContextParser.isPrefixValue(context[key])) {
          const value: IPrefixValue = context[key];
          let changed: boolean = false;
          if (typeof value === 'string') {
            context[key] = ContextParser.expandTerm(value, context, true);
            changed = changed || value !== context[key];
          } else {
            const id = value['@id'];
            const type = value['@type'];
            if (id) {
              context[key]['@id'] = ContextParser.expandTerm(id, context, true);
              changed = changed || id !== context[key]['@id'];
            }
            if (type && type !== '@vocab' && (!value['@container'] || !(<any> value['@container'])['@type'])) {
              // First check @vocab, then fallback to @base
              context[key]['@type'] = ContextParser.expandTerm(type, context, true);
              if (expandContentTypeToBase && type === context[key]['@type']) {
                context[key]['@type'] = ContextParser.expandTerm(type, context, false);
              }
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
   * Normalize the @language entries in the given context to lowercase.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {number} processingMode The processing mode to normalize under.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public static normalize(context: IJsonLdContextNormalized, { processingMode, normalizeLanguageTags }: IParseOptions)
    : IJsonLdContextNormalized {
    // Lowercase language keys in 1.0
    if (normalizeLanguageTags || processingMode === 1.0) {
      for (const key of Object.keys(context)) {
        if (key === '@language' && typeof context[key] === 'string') {
          context[key] = (<string> context[key]).toLowerCase();
        } else {
          const value = context[key];
          if (value && typeof value === 'object') {
            if (typeof value['@language'] === 'string') {
              value['@language'] = value['@language'].toLowerCase();
            }
          }
        }
      }
    }
    return context;
  }

  /**
   * Convert all @container strings and array values to hash-based values.
   * @param {IJsonLdContextNormalized} context A context.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public static containersToHash(context: IJsonLdContextNormalized): IJsonLdContextNormalized {
    for (const key of Object.keys(context)) {
      const value = context[key];
      if (value && typeof value === 'object') {
        if (typeof value['@container'] === 'string') {
          value['@container'] = { [value['@container']]: true };
        } else if (Array.isArray(value['@container'])) {
          const newValue: {[key: string]: boolean} = {};
          for (const containerValue of value['@container']) {
            newValue[containerValue] = true;
          }
          value['@container'] = newValue;
        }
      }
    }
    return context;
  }

  /**
   * Check if the given term is protected in the context.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {string} key A context term.
   * @return {boolean} If the given term has an @protected flag.
   */
  public static isTermProtected(context: IJsonLdContextNormalized, key: string): boolean {
    const value = context[key];
    return !(typeof value === 'string') && value && value['@protected'];
  }

  /**
   * Check if the given context has at least one protected term.
   * @param context A context.
   * @return If the context has a protected term.
   */
  public static hasProtectedTerms(context: IJsonLdContextNormalized) {
    for (const key of Object.keys(context)) {
      if (ContextParser.isTermProtected(context, key)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Normalize and apply context-levevl @protected terms onto each term separately.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {number} processingMode The processing mode.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public static applyScopedProtected(context: IJsonLdContextNormalized, { processingMode }: IParseOptions)
    : IJsonLdContextNormalized {
    if (processingMode && processingMode >= 1.1) {
      if (context['@protected']) {
        for (const key of Object.keys(context)) {
          if (!ContextParser.isPotentialKeyword(key) && !ContextParser.isTermProtected(context, key)) {
            const value = context[key];
            if (value && typeof value === 'object') {
              if (!('@protected' in context[key])) {
                // Mark terms with object values as protected if they don't have an @protected: false annotation
                context[key]['@protected'] = true;
              }
            } else {
              // Convert string-based term values to object-based values with @protected: true
              context[key] = {
                '@id': value,
                '@protected': true,
              };
            }
          }
        }
        delete context['@protected'];
      }
    }
    return context;
  }

  /**
   * Check if the given context inheritance does not contain any overrides of protected terms.
   * @param {IJsonLdContextNormalized} contextBefore The context that may contain some protected terms.
   * @param {IJsonLdContextNormalized} contextAfter A new context that is being applied on the first one.
   * @param {IExpandOptions} expandOptions Options that are needed for any expansions during this validation.
   */
  public static validateKeywordRedefinitions(contextBefore: IJsonLdContextNormalized,
                                             contextAfter: IJsonLdContextNormalized,
                                             expandOptions: IExpandOptions) {
    for (const key of Object.keys(contextAfter)) {
      if (ContextParser.isTermProtected(contextBefore, key)) {
        // The entry in the context before will always be in object-mode
        // If the new entry is in string-mode, convert it to object-mode
        // before checking if it is identical.
        if (typeof contextAfter[key] === 'string') {
          const isPrefix = ContextParser.isSimpleTermDefinitionPrefix(contextAfter[key], expandOptions);
          contextAfter[key] = { '@id': contextAfter[key] };

          // If the simple term def was a prefix, explicitly mark the term as a prefix in the expanded term definition,
          // because otherwise we loose this information due to JSON-LD interpreting prefixes differently
          // in simple vs expanded term definitions.
          if (isPrefix) {
            contextAfter[key]['@prefix'] = true;
            contextBefore[key]['@prefix'] = true; // Also on before, to make sure the next step still considers them ==
          }
        }

        // Convert term values to strings for each comparison
        const valueBefore = canonicalizeJson(contextBefore[key]);
        // We modify this deliberately,
        // as we need it for the value comparison (they must be identical modulo '@protected')),
        // and for the fact that this new value will override the first one.
        contextAfter[key]['@protected'] = true;
        const valueAfter = canonicalizeJson(contextAfter[key]);

        // Error if they are not identical
        if (valueBefore !== valueAfter) {
          throw new ErrorCoded(`Attempted to override the protected keyword ${key} from ${
            JSON.stringify(ContextParser.getContextValueId(contextBefore[key]))} to ${
            JSON.stringify(ContextParser.getContextValueId(contextAfter[key]))}`,
            ERROR_CODES.PROTECTED_TERM_REDIFINITION);
        }
      }
    }
  }

  /**
   * Validate the entries of the given context.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {IValidateOptions} options The validation options.
   */
  public static validate(context: IJsonLdContextNormalized, { processingMode }: IParseOptions) {
    for (const key of Object.keys(context)) {
      const value = context[key];
      const valueType = typeof value;
      // First check if the key is a keyword
      if (ContextParser.isPotentialKeyword(key)) {
        switch (key.substr(1)) {
        case 'vocab':
          if (value !== null && valueType !== 'string') {
            throw new Error(`Found an invalid @vocab IRI: ${value}`);
          }
          break;
        case 'base':
          if (value !== null && valueType !== 'string') {
            throw new Error(`Found an invalid @base IRI: ${context[key]}`);
          }
          break;
        case 'language':
          if (value !== null) {
            ContextParser.validateLanguage(value, true);
          }
          break;
        case 'version':
          if (value !== null && valueType !== 'number') {
            throw new Error(`Found an invalid @version number: ${value}`);
          }
          break;
        case 'direction':
          if (value !== null) {
            ContextParser.validateDirection(value, true);
          }
          break;
        case 'propagate':
          if (processingMode === 1.0) {
            throw new ErrorCoded(`Found an illegal @propagate keyword: ${value}`, ERROR_CODES.INVALID_CONTEXT_ENTRY);
          }
          if (value !== null && valueType !== 'boolean') {
            throw new ErrorCoded(`Found an invalid @propagate value: ${value}`, ERROR_CODES.INVALID_PROPAGATE_VALUE);
          }
          break;
        }
        continue;
      }

      // Otherwise, consider the key a term
      if (value !== null) {
        switch (valueType) {
        case 'string':
          // Always valid
          break;
        case 'object':
          if (!ContextParser.isCompactIri(key) && !('@id' in value)
            && (value['@type'] === '@id' ? !context['@base'] : !context['@vocab'])) {
            throw new Error(`Missing @id in context entry: '${key}': '${JSON.stringify(value)}'`);
          }

          for (const objectKey of Object.keys(value)) {
            const objectValue = value[objectKey];
            if (!objectValue) {
              continue;
            }

            switch (objectKey) {
            case '@id':
              if (ContextParser.isValidKeyword(objectValue) && objectValue !== '@type' && objectValue !== '@id') {
                throw new ErrorCoded(`Illegal keyword alias in term value, found: '${key}': '${JSON.stringify(value)}'`,
                  ERROR_CODES.INVALID_IRI_MAPPING);
              }

              break;
            case '@type':
              if (value['@container'] === '@type' && objectValue !== '@id' && objectValue !== '@vocab') {
                throw new ErrorCoded(`@container: @type only allows @type: @id or @vocab, but got: '${
                    key}': '${objectValue}'`,
                  ERROR_CODES.INVALID_TYPE_MAPPING);
              }
              if (objectValue !== '@id' && objectValue !== '@vocab'
                && (processingMode === 1.0 || objectValue !== '@json')
                && (processingMode === 1.0 || objectValue !== '@none')
                && (objectValue[0] === '_' || !ContextParser.isValidIri(objectValue))) {
                throw new ErrorCoded(`A context @type must be an absolute IRI, found: '${key}': '${objectValue}'`,
                  ERROR_CODES.INVALID_TYPE_MAPPING);
              }
              break;
            case '@reverse':
              if (typeof objectValue === 'string' && value['@id'] && value['@id'] !== objectValue) {
                throw new Error(`Found non-matching @id and @reverse term values in '${key}':\
'${objectValue}' and '${value['@id']}'`);
              }
              break;
            case '@container':
              for (const containerValue of Object.keys(objectValue)) {
                if (containerValue === '@list' && value['@reverse']) {
                  throw new Error(`Term value can not be @container: @list and @reverse at the same time on '${
                    key}'`);
                }
                if (ContextParser.CONTAINERS.indexOf(containerValue) < 0) {
                  throw new Error(`Invalid term @container for '${key}' ('${containerValue}'), \
must be one of ${ContextParser.CONTAINERS.join(', ')}`);
                }
              }
              break;
            case '@language':
              if (objectValue !== null) {
                ContextParser.validateLanguage(objectValue, true);
              }
              break;
            case '@direction':
              if (objectValue !== null) {
                ContextParser.validateDirection(objectValue, true);
              }
              break;
            case '@prefix':
              if (objectValue !== null && typeof objectValue !== 'boolean') {
                throw new Error(`Found an invalid term @prefix boolean in: '${key}': '${JSON.stringify(value)}'`);
              }
              break;
            case '@index':
              if (processingMode === 1.0 || !value['@container'] || !value['@container']['@index']) {
                throw new ErrorCoded(`Attempt to add illegal key to value object: '${
                  key}': '${JSON.stringify(value)}'`, ERROR_CODES.INVALID_TERM_DEFINITION);
              }
              break;
            }
          }
          break;
        default:
          throw new Error(`Found an invalid term value: '${key}': '${value}'`);
        }
      }
    }
  }

  /**
   * Validate the given @language value.
   * An error will be thrown if it is invalid.
   * @param value An @language value.
   * @param {boolean} strictRange If the string value should be strictly checked against a regex.
   * @return {boolean} If validation passed.
   *                   Can only be false if strictRange is false and the string value did not pass the regex.
   */
  public static validateLanguage(value: any, strictRange: boolean): boolean {
    if (typeof value !== 'string') {
      throw new Error(`The value of an '@language' must be a string, got '${JSON.stringify(value)}'`);
    }

    if (!ContextParser.REGEX_LANGUAGE_TAG.test(value)) {
      if (strictRange) {
        throw new Error(`The value of an '@language' must be a valid language tag, got '${
          JSON.stringify(value)}'`);
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate the given @direction value.
   * An error will be thrown if it is invalid.
   * @param value An @direction value.
   * @param {boolean} strictRange If the string value should be strictly checked against a regex.
   * @return {boolean} If validation passed.
   *                   Can only be false if strictRange is false and the string value did not pass the regex.
   */
  public static validateDirection(value: any, strictRange: boolean) {
    if (typeof value !== 'string') {
      throw new ErrorCoded(`The value of an '@direction' must be a string, got '${JSON.stringify(value)}'`,
        ERROR_CODES.INVALID_BASE_DIRECTION);
    }

    if (!ContextParser.REGEX_DIRECTION_TAG.test(value)) {
      if (strictRange) {
        throw new ErrorCoded(`The value of an '@direction' must be 'ltr' or 'rtl', got '${
          JSON.stringify(value)}'`, ERROR_CODES.INVALID_BASE_DIRECTION);
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply the @base context entry to the given context under certain circumstances.
   * @param context A context.
   * @param options Parsing options.
   * @param inheritFromParent If the @base value from the parent context can be inherited.
   * @return The given context.
   */
  public static applyBaseEntry(context: IJsonLdContextNormalized, options: IParseOptions,
                               inheritFromParent: boolean): IJsonLdContextNormalized {
    // Give priority to @base in the parent context
    if (inheritFromParent && !('@base' in context) && options.parentContext && '@base' in options.parentContext) {
      context['@base'] = options.parentContext['@base'];
    }

    // Override the base IRI if provided.
    if (options.baseIRI && !options.external) {
      if (!('@base' in context)) {
        // The context base is the document base
        context['@base'] = options.baseIRI;
      } else if (context['@base'] !== null && !ContextParser.isValidIri(<string> context['@base'])) {
        // The context base is relative to the document base
        context['@base'] = resolve(<string> context['@base'],
          options.parentContext && options.parentContext['@base'] || options.baseIRI);
      }
    }
    return context;
  }

  /**
   * Resolve relative context IRIs, or return full IRIs as-is.
   * @param {string} contextIri A context IRI.
   * @param {string} baseIRI A base IRI.
   * @return {string} The normalized context IRI.
   */
  protected static normalizeContextIri(contextIri: string, baseIRI?: string) {
    if (!ContextParser.isValidIri(contextIri)) {
      contextIri = resolve(contextIri, baseIRI);
      if (!ContextParser.isValidIri(contextIri)) {
        throw new Error(`Invalid context IRI: ${contextIri}`);
      }
    }
    return contextIri;
  }

  /**
   * Parse scoped contexts in the given context.
   * @param {IJsonLdContextNormalized} context A context.
   * @param {IParseOptions} options Parsing options.
   * @return {IJsonLdContextNormalized} The mutated input context.
   */
  public async parseInnerContexts(context: IJsonLdContextNormalized, options: IParseOptions)
    : Promise<IJsonLdContextNormalized> {
    for (const key of Object.keys(context)) {
      const value = context[key];
      if (value && typeof value === 'object') {
        if ('@context' in value && value['@context'] !== null) {
          // Simulate a processing based on the parent context to check if there are any (potential errors).
          // Honestly, I find it a bit weird to do this here, as the context may be unused,
          // and the final effective context may differ based on any other embedded/scoped contexts.
          // But hey, it's part of the spec, so we have no choice...
          // https://w3c.github.io/json-ld-api/#h-note-10
          if (this.validate) {
            try {
              const parentContext = {...context};
              parentContext[key] = {...parentContext[key]};
              delete parentContext[key]['@context'];
              await this.parse(value['@context'], {...options, parentContext, ignoreProtection: true});
            } catch (e) {
              throw new ErrorCoded(e.message, ERROR_CODES.INVALID_SCOPED_CONTEXT);
            }
          }

          value['@context'] = await this.parse(value['@context'],
            { ...options, minimalProcessing: true, parentContext: context });
        }
      }
    }
    return context;
  }

  /**
   * Parse a JSON-LD context in any form.
   * @param {JsonLdContext} context A context, URL to a context, or an array of contexts/URLs.
   * @param {IParseOptions} options Optional parsing options.
   * @return {Promise<IJsonLdContextNormalized>} A promise resolving to the context.
   */
  public async parse(context: JsonLdContext,
                     options: IParseOptions = {
                       processingMode: ContextParser.DEFAULT_PROCESSING_MODE,
                     })
    : Promise<IJsonLdContextNormalized> {
    const {
      baseIRI,
      parentContext,
      external,
      processingMode,
      normalizeLanguageTags,
      ignoreProtection,
      minimalProcessing,
    } = options;

    if (context === null || context === undefined) {
      // Don't allow context nullification and there are protected terms
      if (!ignoreProtection && parentContext && ContextParser.hasProtectedTerms(parentContext)) {
        throw new ErrorCoded('Illegal context nullification when terms are protected',
          ERROR_CODES.INVALID_CONTEXT_NULLIFICATION);
      }

      // Context that are explicitly set to null are empty.
      return ContextParser.applyBaseEntry({}, options, false);
    } else if (typeof context === 'string') {
      const contextIri = ContextParser.normalizeContextIri(context, baseIRI);
      const parsedStringContext = await this.parse(await this.load(contextIri),
        { ...options, external: true, baseIRI: contextIri });
      ContextParser.applyBaseEntry(parsedStringContext, options, true);
      return parsedStringContext;
    } else if (Array.isArray(context)) {
      // As a performance consideration, first load all external contexts in parallel.
      const contextIris: string[] = [];
      const contexts = await Promise.all(context.map((subContext, i) => {
        if (typeof subContext === 'string') {
          const contextIri = ContextParser.normalizeContextIri(subContext, baseIRI);
          contextIris[i] = contextIri;
          return this.load(contextIri);
        } else {
          return subContext;
        }
      }));

      // Don't apply inheritance logic on minimal processing
      if (minimalProcessing) {
        return contexts;
      }

      const reducedContexts = await contexts.reduce((accContextPromise, contextEntry, i) => accContextPromise
          .then((accContext) => this.parse(contextEntry, {
            ...options,
            baseIRI: contextIris[i] || options.baseIRI,
            external: !!contextIris[i] || options.external,
            parentContext: accContext,
          })),
        Promise.resolve(parentContext || {}));

      // Override the base IRI if provided.
      ContextParser.applyBaseEntry(reducedContexts, options, true);

      return reducedContexts;
    } else if (typeof context === 'object') {
      if ('@context' in context) {
        return await this.parse(context['@context'], options);
      }

      // Make a deep clone of the given context, to avoid modifying it.
      context = <IJsonLdContextNormalized> JSON.parse(JSON.stringify(context)); // No better way in JS at the moment...

      // We have an actual context object.
      let newContext: any = {};

      // According to the JSON-LD spec, @base must be ignored from external contexts.
      if (external) {
        delete context['@base'];
      }

      // Override the base IRI if provided.
      ContextParser.applyBaseEntry(context, options, true);

      // Hashify container entries
      // Do this before protected term validation as that influences term format
      ContextParser.containersToHash(context);

      // In JSON-LD 1.1, check if we are not redefining any protected keywords
      if (!ignoreProtection && parentContext && processingMode && processingMode >= 1.1) {
        ContextParser.validateKeywordRedefinitions(parentContext, context, defaultExpandOptions);
      }

      // Don't perform any other modifications if only minimal processing is needed.
      if (minimalProcessing) {
        return context;
      }

      // In JSON-LD 1.1, load @import'ed context prior to processing.
      let importContext = {};
      if ('@import' in context) {
        if (processingMode && processingMode >= 1.1) {
          // Only accept string values
          if (typeof context['@import'] !== 'string') {
            throw new ErrorCoded('An @import value must be a string, but got ' + typeof context['@import'],
              ERROR_CODES.INVALID_IMPORT_VALUE);
          }

          // Load context
          importContext = await this.loadImportContext(ContextParser.normalizeContextIri(context['@import'], baseIRI));
          delete context['@import'];
        } else {
          throw new ErrorCoded('Context importing is not supported in JSON-LD 1.0',
            ERROR_CODES.INVALID_CONTEXT_ENTRY);
        }
      }

      // Merge different parts of the final context in order
      newContext = { ...newContext, ...parentContext, ...importContext, ...context };

      // Parse inner contexts with minimal processing
      await this.parseInnerContexts(newContext, options);

      // In JSON-LD 1.1, @vocab can be relative to @vocab in the parent context.
      if ((newContext['@version'] || processingMode) >= 1.1
        && (context['@vocab'] || context['@vocab'] === '')
        && context['@vocab'].indexOf(':') < 0 && parentContext && '@vocab' in parentContext) {
        newContext['@vocab'] = parentContext['@vocab'] + context['@vocab'];
      }

      ContextParser.idifyReverseTerms(newContext);
      ContextParser.expandPrefixedTerms(newContext, this.expandContentTypeToBase);
      ContextParser.normalize(newContext, { processingMode, normalizeLanguageTags });
      ContextParser.applyScopedProtected(newContext, { processingMode });
      if (this.validate) {
        ContextParser.validate(newContext, { processingMode });
      }

      return newContext;
    } else {
      throw new Error(`Tried parsing a context that is not a string, array or object, but got ${context}`);
    }
  }

  public async load(url: string): Promise<IJsonLdContextNormalized> {
    const cached = this.documentCache[url];
    if (cached) {
      return Array.isArray(cached) ? cached.slice() : {... cached};
    }
    return this.documentCache[url] = (await this.documentLoader.load(url))['@context'];
  }

  /**
   * Load an @import'ed context.
   * @param importContextIri The full URI of an @import value.
   */
  public async loadImportContext(importContextIri: string): Promise<IJsonLdContextNormalized> {
    // Load the context
    const importContext = await this.load(importContextIri);

    // Require the context to be a non-array object
    if (typeof importContext !== 'object' || Array.isArray(importContext)) {
      throw new ErrorCoded('An imported context must be a single object: ' + importContextIri,
        ERROR_CODES.INVALID_REMOTE_CONTEXT);
    }

    // Error if the context contains another @import
    if ('@import' in importContext) {
      throw new ErrorCoded('An imported context can not import another context: ' + importContextIri,
        ERROR_CODES.INVALID_CONTEXT_ENTRY);
    }

    return importContext;
  }

}

export interface IContextParserOptions {
  /**
   * An optional loader that should be used for fetching external JSON-LD contexts.
   */
  documentLoader?: IDocumentLoader;
  /**
   * By default, JSON-LD contexts will be validated.
   * This can be disabled by setting this option to true.
   * This will achieve slightly better performance for large contexts,
   * and may be useful if contexts are known to be valid.
   */
  skipValidation?: boolean;
  /**
   * If @type inside the context may be expanded via @base is @vocab is set to null.
   */
  expandContentTypeToBase?: boolean;
}

export interface IParseOptions {
  /**
   * An optional fallback base IRI to set.
   */
  baseIRI?: string;
  /**
   * The parent context.
   */
  parentContext?: IJsonLdContextNormalized;
  /**
   * If the parsing context is an external context.
   */
  external?: boolean;
  /**
   * The default JSON-LD version that the context should be parsed with.
   */
  processingMode?: number;
  /**
   * If language tags should be normalized to lowercase.
   * This is always true for JSON-LD 1.0,
   * but false by default for all following versions.
   */
  normalizeLanguageTags?: boolean;
  /**
   * If checks for validating term protection should be skipped.
   */
  ignoreProtection?: boolean;
  /**
   * If the context should only be parsed and validated,
   * without performing normalizations and other modifications.
   *
   * If true, this *will* dereference external contexts.
   *
   * This option is used internally when handling type-scoped and property-scoped contexts.
   */
  minimalProcessing?: boolean;
}

export interface IExpandOptions {
  /**
   * If compact IRI prefixes can end with any kind of character in simple term definitions,
   * instead of only the default gen-delim characters (:,/,?,#,[,],@).
   */
  allowPrefixNonGenDelims: boolean;
  /**
   * If compact IRI prefixes ending with a non-gen-delim character
   * can be forced as a prefix using @prefix: true.
   */
  allowPrefixForcing: boolean;
  /**
   * If @reverse values are allowed to be relative to the @vocab.
   */
  allowReverseRelativeToVocab: boolean;
  /**
   * If @vocab values are allowed contain IRIs relative to @base.
   */
  allowVocabRelativeToBase: boolean;
}
export const defaultExpandOptions: IExpandOptions = {
  allowPrefixForcing: true,
  allowPrefixNonGenDelims: false,
  allowReverseRelativeToVocab: false,
  allowVocabRelativeToBase: true,
};
