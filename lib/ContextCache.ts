import {LRUCache} from "lru-cache";
import {IParseOptions} from "./ContextParser";
import {IContextCache} from "./IContextCache";
import {JsonLdContext} from "./JsonLdContext";
import {JsonLdContextNormalized} from "./JsonLdContextNormalized";

/**
 * A bounded (LRU) implementation of {@link IContextCache}.
 *
 * The cache is keyed on the *content* of the context (rather than its object identity),
 * together with its parent context and all remaining parsing options. This ensures that:
 * - the same context parsed repeatedly resolves to a single normalized result;
 * - a context that is mutated between calls produces a different key (so a stale result
 *   is never returned);
 * - genuinely different contexts, or the same context under a different parent context or
 *   different options, are never collapsed onto the same entry.
 *
 * As the cache is bounded via an LRU policy, long-running processes that encounter an
 * unbounded number of distinct contexts will not leak memory.
 */
export class ContextCache implements IContextCache {
  private readonly cache: LRUCache<string, Promise<JsonLdContextNormalized>>;

  constructor(options?: LRUCache.Options<string, Promise<JsonLdContextNormalized>, unknown>) {
    this.cache = new LRUCache(options ?? { max: 512 });
  }

  public hash(context: JsonLdContext, options?: IParseOptions): string {
    // Serialize the options with sorted top-level keys (so that key ordering in the options
    // object is irrelevant) while omitting the parent context and any undefined values.
    // The parent context is serialized separately, as it can be a large object whose content
    // must still be part of the key.
    const opts = options ?? {};
    const normalizedOptions: {[key: string]: unknown} = {};
    for (const key of Object.keys(opts).sort()) {
      if (key === "parentContext") {
        continue;
      }
      const value = opts[key as keyof IParseOptions];
      if (value !== undefined) {
        normalizedOptions[key] = value;
      }
    }

    // An empty parent context is behaviourally identical to no parent context, so both map
    // to `null` (a non-empty parent context is included verbatim, as its content affects the
    // normalized result).
    const parentContext = opts.parentContext && Object.keys(opts.parentContext).length > 0
      ? opts.parentContext : null;

    // Wrapping the three components in an array keeps their boundaries unambiguous, so that
    // structurally distinct inputs can never serialize to the same string.
    return JSON.stringify([normalizedOptions, context, parentContext]);
  }

  public get(key: string): Promise<JsonLdContextNormalized> | undefined {
    return this.cache.get(key);
  }

  public set(key: string, normalized: Promise<JsonLdContextNormalized>): void {
    this.cache.set(key, normalized);
  }
}
