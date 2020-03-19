# JSON-LD Context Parser

[![Build Status](https://travis-ci.org/rubensworks/jsonld-context-parser.js.svg?branch=master)](https://travis-ci.org/rubensworks/jsonld-context-parser.js)
[![Coverage Status](https://coveralls.io/repos/github/rubensworks/jsonld-context-parser.js/badge.svg?branch=master)](https://coveralls.io/github/rubensworks/jsonld-context-parser.js?branch=master)
[![npm version](https://badge.fury.io/js/jsonld-context-parser.svg)](https://www.npmjs.com/package/jsonld-context-parser)

A [JSON-LD](https://json-ld.org/) [`@context`](https://json-ld.org/spec/latest/json-ld/#the-context) parser that will normalize these contexts so that they can easily be used in your application.

This parser has the following functionality:
* Fetch contexts by URLs.
* Normalize JSON contexts.
* Merge arrays of contexts.
* Create a default `@base` entry if a base IRI is provided.
* Create `@id` entries for all `@reverse` occurences.
* Convert `@container` string and array values to a hash-based value.
* Expand prefixes and `@vocab` in string values, `@id`, `@type` and `@reverse`.
* Context validation according to the [JSON-LD](https://json-ld.org/) specification while parsing (_can be disabled_).
* Term expansion with the `context.expandTerm`.
* IRI compacting with the `context.compactIri`.

Example input (with base IRI set to `http://example.org/base`):
```jsonld
[
  {
    "@vocab": "http://vocab.org/",
    "npmd": "https://linkedsoftwaredependencies.org/bundles/npm/",
    "p": { "@id": "pred1", "@language": "nl" }
  },
  "http://example.org/simple.jsonld",
]
```

With `http://example.org/simple.jsonld` containing:
```jsonld
{
  "xsd": "http://www.w3.org/2001/XMLSchema#",
  "name": "http://xmlns.com/foaf/0.1/name"
}
```

Example output:
```jsonld
{
  "@base": "http://example.org/base",
  "@vocab": "http://vocab.org/",

  "npmd": "https://linkedsoftwaredependencies.org/bundles/npm/",
  "p": { "@id": "http://vocab.org/pred1", "@language": "nl" },

  "xsd": "http://www.w3.org/2001/XMLSchema#",
  "name": "http://xmlns.com/foaf/0.1/name"
},
```

## Install

This package can be installed via [npm](https://www.npmjs.com/package/jsonld-context-parser).

```bash
$ npm install jsonld-context-parser
```

This package also works out-of-the-box in browsers via tools such as [webpack](https://webpack.js.org/) and [browserify](http://browserify.org/).

## Usage

### API

#### Create a new parser

```javascript
const ContextParser = require('jsonld-context-parser').ContextParser;

const myParser = new ContextParser();
```

Optionally, you can pass an options object with a custom [document loader](https://github.com/rubensworks/jsonld-context-parser.js/blob/master/lib/IDocumentLoader.ts):

```javascript
const myParser = new ContextParser({ documentLoader: myDocumentLoader });
```

#### Parse a context.

Either parse a context by URL:

```javascript
const myContext = await myParser.parse('http://json-ld.org/contexts/person.jsonld');
```

by an non-normalized context:
```javascript
const myContext = await myParser.parse({ ... });
```

or by an array of mixed contexts or URLs:
```javascript
const myContext = await myParser.parse([
  'http://json-ld.org/contexts/person.jsonld',
  { ... },
  'https://linkedsoftwaredependencies.org/contexts/components.jsonld'
]);
```

Optionally, the following parsing options can be passed:

* `baseIRI`: An initial default base IRI. _(Default: `''`)_
* `parentContext`: An optional context to inherit from. _(Default: `null`)_
* `external`: If the given context is being loaded from an external URL. _(Default: `false`)_
* `processingMode`: The JSON-LD version that the context should be parsed with. _(Default: `1.1`)_
* `normalizeLanguageTags`: Whether or not language tags should be normalized to lowercase. _(Default: `false` for JSON-LD 1.1 (and higher), `true` for JSON-LD 1.0)_

```javascript
const myContext = await myParser.parse({ ... }, {
  baseIRI: 'http://example.org/',
  parentContext: {},
  external: true,
  processingMode: 1.0,
  normalizeLanguageTags: true,
});
```

#### Expand a term

Based on a context, terms can be expanded in vocab or base-mode.

##### Base expansion

Base expansion is done based on the `@base` context entry.
This should typically be used for expanding terms in the subject or object position.

```
// Expands `person` based on the @base IRI. Will throw an error if the final IRI is invalid.
myContext.expandTerm('person');

// Expands if `foaf` is present in the context
myContext.expandTerm('foaf:name');

// Returns the URI as-is
myContext.expandTerm('http://xmlns.com/foaf/0.1/name');
```

##### Vocab expansion

Vocab expansion is done based on the `@vocab` context entry.
This should typically be used for expanding terms in the predicate position.

```
// Expands `name` based on the @vocab IRI.
myContext.expandTerm('name', true);

// Expands if `foaf` is present in the context
myContext.expandTerm('foaf:name', true);

// Returns the URI as-is
myContext.expandTerm('http://xmlns.com/foaf/0.1/name', true);
```

#### Compact an IRI

Based on a context, IRIs can be compacted in vocab or base-mode.

##### Base compacting

Base compacting is done based on the `@base` context entry.
This should typically be used for compacting terms in the subject or object position.

```
// Compacts to `something` if @base is `http://base.org/`.
myContext.compactIri('http://base.org/something');

// Compacts to `prefix:name` if `"prefix": "http://prefix.org/"` is in the context
myContext.compactIri('http://prefix.org/name');

// Returns the URI as-is if it is not present in the context in any way
myContext.compactIri('http://xmlns.com/foaf/0.1/name');
```

##### Vocab compacting

Vocab compacting is done based on the `@vocab` context entry.
This should typically be used for compacting terms in the predicate position.

```
// Compacts to `something` if @vocab is `http://vocab.org/`.
myContext.compactIri('http://vocab.org/something', true);

// Compacts to `prefix:name` if `"prefix": "http://prefix.org/"` is in the context
myContext.compactIri('http://prefix.org/name', true);

// Compacts to `term` if `"term": "http://term.org/"` is in the context
myContext.compactIri('http://term.org/', true);

// Returns the URI as-is if it is not present in the context in any way
myContext.compactIri('http://xmlns.com/foaf/0.1/name', true);
```

### Command-line

A command-line tool is provided to quickly normalize any context by URL, file or string.

Usage:
```
$ jsonld-context-parse url http://json-ld.org/contexts/person.jsonld
$ jsonld-context-parse file path/to/context.jsonld
$ jsonld-context-parse arg '{ "xsd": "http://www.w3.org/2001/XMLSchema#" }'
```

## License
This software is written by [Ruben Taelman](http://rubensworks.net/).

This code is released under the [MIT license](http://opensource.org/licenses/MIT).
