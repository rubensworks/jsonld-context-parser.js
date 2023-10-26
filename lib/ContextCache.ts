import { JsonLdContextNormalized } from "./JsonLdContextNormalized";
import { IJsonLdContext, JsonLdContext } from "./JsonLdContext";
import md5 = require("md5");
import { IParseOptions } from "./ContextParser";
import { IContextCache } from "./IContextCache";

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
  cmap: (c: IJsonLdContext) => number,
): string {
  if (Array.isArray(context)) {
    return md5(
      JSON.stringify(context.map((c) => (typeof c === "string" ? c : cmap(c)))),
    );
  }
  return typeof context === "string" ? md5(context) : cmap(context).toString();
}


export class ContextCache implements IContextCache {

  private cachedParsing: Record<string, Promise<JsonLdContextNormalized>> = {};

  private contextMap: Map<IJsonLdContext, number> = new Map();

  private contextHashMap: Map<string, number> = new Map();

  private mapIndex = 1;

  constructor() {
    // Empty
  }

  public hash(
    context: JsonLdContext,
    options?: IParseOptions
  ): string {
    let hash = hashOptions(options);

    if (options?.parentContext && Object.keys(options.parentContext).length !== 0) {
      hash = md5(hash + this.cmap(options.parentContext));
    }

    return md5(hash + hashContext(context, this.cmap));
  }

  get(context: string): Promise<JsonLdContextNormalized> | undefined {
    return this.cachedParsing[context];
  }

  set(context: string, normalized: Promise<JsonLdContextNormalized>): void {
    this.cachedParsing[context] = normalized;
  }

  private cmap = (context: IJsonLdContext) => {
    if (!this.contextMap.has(context)) {
      const hash = md5(JSON.stringify(context));
      if (!this.contextHashMap.has(hash)) {
        this.contextHashMap.set(hash, (this.mapIndex += 1));
      }
      this.contextMap.set(context, this.contextHashMap.get(hash)!);
    }
    return this.contextMap.get(context)!;
  };
}
