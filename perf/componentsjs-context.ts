// A synthetic, representative "large" JSON-LD @context used to benchmark the
// normalized-context cache without inlining hundreds of lines of vendored data.
//
// It is shaped after the Components.js ^5.0.0 @context (a handful of prefixes plus
// ~90 compact-IRI term definitions, some carrying `@type`/`@container`) — one of the
// contexts observed being re-normalized ~979x during a single Community Solid Server
// boot. Building it programmatically keeps the benchmark workload large (and the
// normalization work representative) while keeping this source file lean.
// tslint:disable
const TERM_COUNT = 90;

const context: {[key: string]: any} = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  oo: "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#",
  type: {"@id": "rdf:type"},
  types: {"@id": "rdf:type"},
};

for (let i = 0; i < TERM_COUNT; i++) {
  const id = `oo:member${i}`;
  switch (i % 4) {
    case 0:
      context[`term${i}`] = {"@id": id, "@type": "@id"};
      break;
    case 1:
      context[`term${i}`] = {"@id": id, "@container": "@list"};
      break;
    case 2:
      context[`term${i}`] = {"@id": id, "@type": "xsd:string"};
      break;
    default:
      context[`term${i}`] = {"@id": id};
  }
}

export const componentsjsContext: any = {"@context": context};
