import { JsonLdContextNormalized } from "./JsonLdContextNormalized";
import { JsonLdContext } from "./JsonLdContext";
import { IParseOptions } from "./ContextParser";

/**
 * Caches the normalized version of a JSON-LD context.
 */
export interface IContextCache {
  /**
   * Returns a cached version of the normalized version of a JSON-LD context.
   * @param {string} context A hashed JSON-LD Context.
   * @return {Promise<JsonLdContextNormalized> | undefined} A promise resolving to a normalized JSON-LD context.
   */
  get(context: string): Promise<JsonLdContextNormalized> | undefined;
  /**
   * Returns a cached version of the normalized version of a JSON-LD context.
   * @param {string} context A hashed JSON-LD Context.
   * @return {Promise<JsonLdContextNormalized>} A promise resolving to a normalized JSON-LD context.
   */
  set(context: string, normalized: Promise<JsonLdContextNormalized>): void;
  /**
   * 
   */
  hash(context: JsonLdContext, options: IParseOptions | undefined): string;
}
