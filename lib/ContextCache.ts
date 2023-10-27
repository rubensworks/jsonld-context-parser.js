import { JsonLdContextNormalized } from "./JsonLdContextNormalized";
import { JsonLdContext } from "./JsonLdContext";
import md5 = require("md5");
import { IParseOptions } from "./ContextParser";
import { IContextCache } from "./IContextCache";
import { LRUCache } from "lru-cache";

function hashOptions(options: IParseOptions | undefined) {
  const opts = { ...options, parentContext: undefined };
  for (const key of Object.keys(opts)) {
    if (typeof opts[key as keyof typeof opts] === "undefined") {
      delete opts[key as keyof typeof opts];
    }
  }

  return md5(JSON.stringify(opts, Object.keys(opts).sort()));
}

function hashContext(
  context: JsonLdContext,
): string {
  if (Array.isArray(context)) {
    return md5(
      JSON.stringify(context),
    );
  }
  return typeof context === "string" ? md5(context) : md5(JSON.stringify(context));
}

export class ContextCache implements IContextCache {
  private cachedParsing: LRUCache<string, Promise<JsonLdContextNormalized>>;

  constructor(options?: LRUCache.Options<string, Promise<JsonLdContextNormalized>, unknown>) {
    this.cachedParsing = new LRUCache(options ?? { max: 512 })
  }

  public hash(
    context: JsonLdContext,
    options?: IParseOptions
  ): string {
    let hash = hashOptions(options);

    if (options?.parentContext && Object.keys(options.parentContext).length !== 0) {
      hash = md5(hash + hashContext(options.parentContext));
    }

    return md5(hash + hashContext(context,));
  }

  get(context: string): Promise<JsonLdContextNormalized> | undefined {
    return this.cachedParsing.get(context);
  }

  set(context: string, normalized: Promise<JsonLdContextNormalized>): void {
    this.cachedParsing.set(context, normalized);
  }
}
