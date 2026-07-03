import {ContextCache} from "../lib/ContextCache";
import {ContextParser} from "../lib/ContextParser";
import {JsonLdContext} from "../lib/JsonLdContext";
import {componentsjsContext} from "./componentsjs-context";

/**
 * Micro-benchmark for the normalized-context cache.
 *
 * It parses a large, representative context (the Components.js ^5.0.0 @context, ~90 terms —
 * one of the contexts observed being re-normalized ~979x during a single Community Solid
 * Server boot) many times, comparing throughput with and without a shared context cache.
 *
 * Run with `npm run perf` (which builds first) or `node perf/bench.js` after a build.
 */

const ITERATIONS = 1000;
const context: JsonLdContext = componentsjsContext;
const termCount: number = Object.keys(componentsjsContext["@context"]).length;

async function time(label: string, fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await fn();
  }
  const ms = performance.now() - start;
  const opsSec = (ITERATIONS / ms) * 1000;
  // tslint:disable-next-line:no-console
  console.log(`${label.padEnd(48)} ${opsSec.toFixed(0).padStart(9)} ops/sec  ` +
    `(${ms.toFixed(1)} ms total, ${(ms / ITERATIONS).toFixed(4)} ms/op)`);
  return opsSec;
}

async function main(): Promise<void> {
  // Correctness guard: a cached result must be structurally identical to an uncached one.
  const uncachedResult = (await new ContextParser().parse(context)).getContextRaw();
  const checkParser = new ContextParser({ contextCache: new ContextCache() });
  await checkParser.parse(context);
  const cachedResult = (await checkParser.parse(context)).getContextRaw();
  if (JSON.stringify(uncachedResult) !== JSON.stringify(cachedResult)) {
    throw new Error("Cached result differs from the uncached result!");
  }

  // Warm up the JIT.
  for (let i = 0; i < 50; i++) {
    await new ContextParser().parse(context);
  }

  // tslint:disable-next-line:no-console
  console.log(`Parsing the Components.js ^5.0.0 context (${termCount} terms) x ${ITERATIONS}\n`);

  const noCacheParser = new ContextParser();
  const baseline = await time("no cache (re-normalized every parse)", () =>
    noCacheParser.parse(context));

  const cachedParser = new ContextParser({ contextCache: new ContextCache() });
  const cached = await time("shared cache, single parser", () =>
    cachedParser.parse(context));

  const sharedCache = new ContextCache();
  const cachedFreshParsers = await time("shared cache across fresh parsers (CSS-boot shape)", () =>
    new ContextParser({ contextCache: sharedCache }).parse(context));

  // tslint:disable-next-line:no-console
  console.log(`\nSpeed-up (single parser):        ${(cached / baseline).toFixed(1)}x`);
  // tslint:disable-next-line:no-console
  console.log(`Speed-up (fresh parser per call): ${(cachedFreshParsers / baseline).toFixed(1)}x`);
}

main().catch((error) => {
  // tslint:disable-next-line:no-console
  console.error(error);
  process.exit(1);
});
