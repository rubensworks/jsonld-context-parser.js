# JSON-LD Context Parser

[![Build Status](https://travis-ci.org/rubensworks/jsonld-context-parser.js.svg?branch=master)](https://travis-ci.org/rubensworks/jsonld-context-parser.js)
[![Coverage Status](https://coveralls.io/repos/github/rubensworks/jsonld-context-parser.js/badge.svg?branch=master)](https://coveralls.io/github/rubensworks/jsonld-context-parser.js?branch=master)
[![npm version](https://badge.fury.io/js/jsonld-context-parser.svg)](https://www.npmjs.com/package/jsonld-context-parser)

A [JSON-LD](https://json-ld.org/) [`@context`](https://json-ld.org/spec/latest/json-ld/#the-context) parser that will normalize these contexts so that they can easily be used in your application.

This parser has the following functionality:
* Fetch contexts by URLs.
* Normalize JSON contexts.
* Merge arrays of contexts.
* Create `@id` entries for all `@reverse` occurences.
* Expand prefixes and `@vocab` in string values, `@id`, `@type` and `@reverse`.

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
const ContextParser = require('jsonld-context-parse');

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
