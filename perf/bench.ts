import { type Options, type Event, Suite } from 'benchmark';
import contexts from './contexts';
import { IDocumentLoader, IJsonLdContext, ContextParser, ContextCache } from '..'

class CachedDocumentLoader implements IDocumentLoader {
  load(url: string): Promise<IJsonLdContext> {
    if (!contexts[url as keyof typeof contexts])
      return Promise.reject(new Error(`No context for ${url}`));

    return Promise.resolve(contexts[url as keyof typeof contexts]);
  }
}

function deferred(fn: () => Promise<any>): Options {
  return {
    defer: true,
    fn: (deferred: { resolve: () => void }) => fn().then(() => deferred.resolve())
  }
}

async function main() {

  const suite = new Suite();

  const contextCache = new ContextCache();
  const context = Object.keys(contexts);
  const contextParser = new ContextParser({ documentLoader: new CachedDocumentLoader(), contextCache: new ContextCache() });
  await contextParser.parse(context);

  // add tests
  suite
    .add(
      'Parse a context that has not been cached; and without caching in place',
      deferred(async () => {
        const contextParser = new ContextParser({ documentLoader: new CachedDocumentLoader() });
        await contextParser.parse(context);
      }),
    ).add(
      'Parse a context that has not been cached; and with caching in place',
      deferred(async () => {
        const contextParser = new ContextParser({ documentLoader: new CachedDocumentLoader(), contextCache: new ContextCache() });
        await contextParser.parse(context);
      }),
    ).add(
      'Parse a context that has been cached',
      deferred(async () => {
        const contextParser = new ContextParser({ documentLoader: new CachedDocumentLoader(), contextCache });
        await contextParser.parse(context);
      }),
    ).on('cycle', (event: Event) => {
      console.log(event.target.toString());
    }).run();
}

main();
