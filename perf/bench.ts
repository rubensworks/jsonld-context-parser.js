import { type Options, type Event, Suite } from 'benchmark';
import contexts from './contexts';
import { IDocumentLoader, IJsonLdContext, ContextParser } from '..'

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

const suite = new Suite();

// add tests
suite
  .add(
    'Parse a context that has not been cached; and without caching in place',
    deferred(async () => {
      const contextParser = new ContextParser({ documentLoader: new CachedDocumentLoader() });
      await contextParser._parse(Object.keys(contexts)); 
    }),
  ).on('cycle', (event: Event) => {
    console.log(event.target.toString());
  }).run();
