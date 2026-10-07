import {IParseOptions} from "./ContextParser";
import {JsonLdContext} from "./JsonLdContext";
import {JsonLdContextNormalized} from "./JsonLdContextNormalized";

/**
 * A cache for the normalized version of JSON-LD contexts.
 *
 * Implementations are responsible for deriving a cache key via {@link IContextCache#hash}
 * that uniquely identifies a `(context, options)` pair. Two different contexts, or the same
 * context parsed under different options or parent contexts, must never map to the same key,
 * otherwise the cache would return an incorrect normalized result.
 */
export interface IContextCache {
  /**
   * Derive the cache key for a given context/options pair.
   *
   * The key must capture everything that can influence the normalized result, including
   * the full content of the context, the parent context, and any other relevant options,
   * so that genuinely different inputs are never collapsed onto the same entry.
   * @param context The context that is about to be parsed.
   * @param options The parsing options, or undefined.
   * @return A string key that uniquely identifies the `(context, options)` pair.
   */
  hash(context: JsonLdContext, options: IParseOptions | undefined): string;
  /**
   * Retrieve the cached normalized context for the given key.
   * @param key A key obtained via {@link IContextCache#hash}.
   * @return A promise resolving to the normalized context, or undefined if not cached.
   */
  get(key: string): Promise<JsonLdContextNormalized> | undefined;
  /**
   * Store the normalized context for the given key.
   * @param key A key obtained via {@link IContextCache#hash}.
   * @param normalized A promise resolving to the normalized context.
   */
  set(key: string, normalized: Promise<JsonLdContextNormalized>): void;
}
