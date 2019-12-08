import {ContextParser, defaultExpandOptions, ERROR_CODES, ErrorCoded, FetchDocumentLoader} from "../index";

describe('ContextParser', () => {
  describe('#isCompactIri', () => {
    it('to be true for a simple compact IRI', async () => {
      expect(ContextParser.isCompactIri('a:b')).toBeTruthy();
    });

    it('to be false for a term', async () => {
      expect(ContextParser.isCompactIri('a')).toBeFalsy();
    });

    it('to be false for a hash that looks like a compact IRI', async () => {
      expect(ContextParser.isCompactIri('#a:b')).toBeFalsy();
    });
  });

  describe('#isTermProtected', () => {
    it('to be false when a term is not present', async () => {
      expect(ContextParser.isTermProtected({}, 'a')).toBeFalsy();
    });

    it('to be false on a string-based term', async () => {
      expect(ContextParser.isTermProtected({ a: 'b' }, 'a')).toBeFalsy();
    });

    it('to be false on an object-based term', async () => {
      expect(ContextParser.isTermProtected({ a: { '@id': 'b' } }, 'a')).toBeFalsy();
    });

    it('to be false on an object-based term with @protected: false', async () => {
      expect(ContextParser.isTermProtected({ a: { '@id': 'b', '@protected': false } }, 'a')).toBeFalsy();
    });

    it('to be true on an object-based term with @protected: true', async () => {
      expect(ContextParser.isTermProtected({ a: { '@id': 'b', '@protected': true } }, 'a')).toBeTruthy();
    });
  });

  describe('#getPrefix', () => {
    it('to return a null when no colon exists', async () => {
      expect(ContextParser.getPrefix('abc', { '//': 'abc' })).toBe(null);
    });

    it('to return a null for just a colon', async () => {
      expect(ContextParser.getPrefix(':', { '//': 'abc' })).toBe(null);
    });

    it('to return a null for double slashed suffixes', async () => {
      expect(ContextParser.getPrefix('http://abc', { '//': 'abc' })).toBe(null);
    });

    it('to return a null for blank nodes', async () => {
      expect(ContextParser.getPrefix('_:abc', { _: 'abc' })).toBe(null);
    });

    it('to return a null for a non-existing term', async () => {
      expect(ContextParser.getPrefix('abc:def', { def: 'abc' })).toBe(null);
    });

    it('to return a null for a non-existing term', async () => {
      expect(ContextParser.getPrefix('abc:def', { abc: 'ABC' })).toBe('abc');
    });

    it('to return a null for terms starting with a hash', async () => {
      expect(ContextParser.getPrefix('#abc:def', { abc: 'ABC' })).toBe(null);
    });
  });

  describe('#expandTerm', () => {
    describe('in vocab-mode', () => {
      it('should throw on a non-normalized context', async () => {
        expect(() => ContextParser.expandTerm('abc:123', <any> 'string', true))
          .toThrow(new Error('The given context is not normalized. Make sure to call ContextParser.parse() first.'));
      });

      it('to return when no prefix applies', async () => {
        expect(ContextParser.expandTerm('abc:123', {def: 'DEF/'}, true)).toBe('abc:123');
      });

      it('to return when no prefix applies without @id', async () => {
        expect(ContextParser.expandTerm('def:123', {def: {}}, true)).toBe('def:123');
      });

      it('to return when no term applies without @id', async () => {
        expect(ContextParser.expandTerm('def', {def: {}}, true)).toBe('def');
      });

      it('to return when a prefix applies', async () => {
        expect(ContextParser.expandTerm('def:123', {def: 'DEF/'}, true)).toBe('DEF/123');
      });

      it('to return when a prefix applies with @id', async () => {
        expect(ContextParser.expandTerm('def:123', {def: { '@id': 'DEF/' }}, true)).toBe('DEF/123');
      });

      it('to return when a direct value applies', async () => {
        expect(ContextParser.expandTerm('abc', {abc: 'http://DEF'}, true)).toBe('http://DEF');
      });

      it('to return when @vocab exists but not applies', async () => {
        expect(ContextParser.expandTerm('def:123', {'@vocab': 'bbb/'}, true)).toBe('def:123');
      });

      it('to return when @vocab exists and applies', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'http://bbb/'}, true))
          .toBe('http://bbb/def');
      });

      it('to return when @vocab exists and applies, but the context key references itself', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'http://bbb/', 'def': 'def'}, true)).
        toBe('http://bbb/def');
      });

      it('to return when @vocab exists and applies, but is disabled', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'bbb/', 'def': null}, true)).toBe(null);
      });

      it('to return when @vocab exists and applies, but is disabled via @id', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'bbb/', 'def': { '@id': null }}, true)).toBe(null);
      });

      it('to return when @base exists but not applies', async () => {
        expect(ContextParser.expandTerm('def:123', {'@base': 'bbb/'}, true)).toBe('def:123');
      });

      it('to return when @base exists and applies', async () => {
        expect(ContextParser.expandTerm('def', {'@base': 'bbb/'}, true)).toBe('def');
      });

      it('to return when @base exists and applies, but is disabled', async () => {
        expect(ContextParser.expandTerm('def', {'@base': 'bbb/', 'def': null}, true)).toBe(null);
      });

      it('to return when @base exists and applies, but is disabled via @id', async () => {
        expect(ContextParser.expandTerm('def', {'@base': 'bbb/', 'def': { '@id': null }}, true)).toBe(null);
      });

      it('to return when a term and prefix applies', async () => {
        expect(ContextParser.expandTerm('bla', {
          bla: 'http://DEF/123',
          def: 'http://DEF/',
        }, true)).toBe('http://DEF/123');
      });

      it('to throw for not allowed relative @vocab', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: false,
        };
        expect(() => ContextParser.expandTerm('bla', {
          '@vocab': 'relative/',
        }, true, opts)).toThrow(new Error(
          'Relative vocab expansion for term \'bla\' with vocab \'relative/\' is not allowed.'));
      });

      it('to throw for unsupported relative empty @vocab', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: false,
        };
        expect(() => ContextParser.expandTerm('bla', {
          '@vocab': '',
        }, true, opts)).toThrow(new Error(
          'Relative vocab expansion for term \'bla\' with vocab \'\' is not allowed.'));
      });

      it('to return when @vocab is empty string and @base does not exist', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': ''}, true)).toBe('def');
      });

      it('to return when @vocab is empty string and @base exists', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': '', '@base': 'http://ex.org/'}, true))
          .toBe('http://ex.org/def');
      });

      it('to return when @vocab is empty string and @base exists if allowVocabRelativeToBase is true', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: true,
        };
        expect(ContextParser.expandTerm('def', {'@vocab': '', '@base': 'http://ex.org/'}, true,
          opts)).toBe('http://ex.org/def');
      });

      it('to throw when @vocab is empty string and @base exists if allowVocabRelativeToBase is false', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: false,
        };
        expect(() => ContextParser.expandTerm('def', {'@vocab': '', '@base': 'http://ex.org/'}, true,
          opts)).toThrow(new Error(
            'Relative vocab expansion for term \'def\' with vocab \'\' is not allowed.'));
      });

      it('to return when @vocab is "#" and @base exists if allowVocabRelativeToBase is true', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: true,
        };
        expect(ContextParser.expandTerm('def', {'@vocab': '#', '@base': 'http://ex.org/'}, true,
          opts)).toBe('http://ex.org/#def');
      });

      it('to throw when @vocab is "#" string and @base exists if allowVocabRelativeToBase is false', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: false,
        };
        expect(() => ContextParser.expandTerm('def', {'@vocab': '#', '@base': 'http://ex.org/'}, true,
          opts)).toThrow(new Error(
            'Relative vocab expansion for term \'def\' with vocab \'#\' is not allowed.'));
      });

      it('to return when @vocab is "../#" and @base exists if allowVocabRelativeToBase is true', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: true,
        };
        expect(ContextParser.expandTerm('def', {'@vocab': '../#', '@base': 'http://ex.org/abc/'}, true,
          opts)).toBe('http://ex.org/#def');
      });

      it('to throw when @vocab is "../#" string and @base exists if allowVocabRelativeToBase is false', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: false,
        };
        expect(() => ContextParser.expandTerm('def', {'@vocab': '../#', '@base': 'http://ex.org/abc/'}, true,
          opts)).toThrow(new Error(
            'Relative vocab expansion for term \'def\' with vocab \'../#\' is not allowed.'));
      });

      it('to return when @vocab is absolute and @base exists if allowVocabRelativeToBase is true', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: true,
        };
        expect(ContextParser.expandTerm('def', {'@vocab': 'http://abc.org/', '@base': 'http://ex.org/abc/'}, true,
          opts)).toBe('http://abc.org/def');
      });

      it('to return when @vocab is absolute string and @base exists if allowVocabRelativeToBase is false', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowVocabRelativeToBase: false,
        };
        expect(ContextParser.expandTerm('def', {'@vocab': 'http://abc.org/', '@base': 'http://ex.org/abc/'}, true,
          opts)).toBe('http://abc.org/def');
      });

      it('to return null when allowNonGenDelimsIfPrefix is true with non-gen-delim without @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: true,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: 'http://ex.org/compact-' }, true,
          opts)).toBe(null);
      });

      it('to return when allowNonGenDelimsIfPrefix is true with non-gen-delim with @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: true,
        };
        expect(ContextParser.expandTerm('abc:def',
          { abc: { '@id': 'http://ex.org/compact-', '@prefix': true } }, true, opts))
          .toBe('http://ex.org/compact-def');
      });

      it('to return null when allowNonGenDelimsIfPrefix is false with non-gen-delim without @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: false,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': 'http://ex.org/compact-' } }, true,
          opts)).toBe(null);
      });

      it('to return null when allowNonGenDelimsIfPrefix is false with non-gen-delim with @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: false,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': 'http://ex.org/compact-', '@prefix': true } },
          true, opts)).toBe(null);
      });

      it('to return when allowNonGenDelimsIfPrefix is true with gen-delim without @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: true,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': 'http://ex.org/' } }, true,
          opts)).toBe('http://ex.org/def');
      });

      it('to return when allowNonGenDelimsIfPrefix is true with gen-delim with @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: true,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': 'http://ex.org/', '@prefix': true } }, true,
          opts)).toBe('http://ex.org/def');
      });

      it('to return when allowNonGenDelimsIfPrefix is true for a blank node', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: true,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': '_:b' } }, true,
          opts)).toBe('_:bdef');
      });

      it('to return when allowNonGenDelimsIfPrefix is false with gen-delim without @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: false,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': 'http://ex.org/' } }, true,
          opts)).toBe('http://ex.org/def');
      });

      it('to return when allowNonGenDelimsIfPrefix is false with gen-delim with @prefix', async () => {
        const opts = {
          ...defaultExpandOptions,
          allowNonGenDelimsIfPrefix: false,
        };
        expect(ContextParser.expandTerm('abc:def', { abc: { '@id': 'http://ex.org/', '@prefix': true } }, true,
          opts)).toBe('http://ex.org/def');
      });

      it('to throw when context alias value is not a string', async () => {
        expect(() => ContextParser.expandTerm('k', { k: { '@id': 3 } }, true))
          .toThrow(new Error('Invalid IRI mapping found for context entry \'k\': \'{"@id":3}\''));
      });

      it('to throw when context alias value is not an IRI', async () => {
        expect(() => ContextParser.expandTerm('k', { k: { '@id': 'not an IRI' } }, true))
          .toThrow(new Error('Invalid IRI mapping found for context entry \'k\': \'{"@id":"not an IRI"}\''));
      });

      it('to ignore invalid aliases and fallback to vocab', async () => {
        expect(ContextParser.expandTerm('ignoreMe', {
          "@vocab": "http://example.org/",
          "ignoreMe": "@ignoreMe",
        }, true)).toBe('http://example.org/ignoreMe');
      });

      it('to ignore invalid keyword-like alias without vocab', async () => {
        expect(ContextParser.expandTerm('ignoreMe', { ignoreMe: "@ignoreMe" }, true))
          .toBe('ignoreMe');
      });

      it('to error on invalid keyword-like alias with @reverse', async () => {
        expect(() => ContextParser.expandTerm('ignoreMe', { ignoreMe: { "@id": "@ignoreMe", "@reverse": true } }, true))
          .toThrow(new ErrorCoded('Invalid IRI mapping found for context entry \'ignoreMe\': ' +
            '\'{"@id":"@ignoreMe","@reverse":true}\'', ERROR_CODES.INVALID_IRI_MAPPING));
      });

      it('to ignore invalid keyword-like alias with @reverse when allowReverseRelativeToVocab is true', async () => {
        expect(ContextParser.expandTerm('ignoreMe', { ignoreMe: { "@id": "@ignoreMe", "@reverse": true } }, true,
          { ...defaultExpandOptions, allowReverseRelativeToVocab: true }))
          .toBe('ignoreMe');
      });

      it('to error on invalid keyword-like alias with @reverse and @vocab', async () => {
        expect(() => ContextParser.expandTerm('ignoreMe', {
          "@vocab": "http://example.org/",
          "ignoreMe": { "@id": "@ignoreMe", "@reverse": true },
        }, true))
          .toThrow(new ErrorCoded('Invalid IRI mapping found for context entry \'ignoreMe\': ' +
            '\'{"@id":"@ignoreMe","@reverse":true}\'', ERROR_CODES.INVALID_IRI_MAPPING));
      });

      it('to return on invalid keyword-like alias with @reverse and @vocab when allowReverseRelativeToVocab is true',
        async () => {
          expect(ContextParser.expandTerm('ignoreMe', {
            "@vocab": "http://example.org/",
            "ignoreMe": { "@id": "@ignoreMe", "@reverse": true },
          }, true,
            { ...defaultExpandOptions, allowReverseRelativeToVocab: true }))
            .toBe('http://example.org/ignoreMe');
        });
    });

    describe('in base-mode', () => {
      it('to return when no prefix applies', async () => {
        expect(ContextParser.expandTerm('abc:123', {def: 'DEF/'}, false)).toBe('abc:123');
      });

      it('to return when no prefix applies with @id', async () => {
        expect(ContextParser.expandTerm('def:123', {def: {}}, false)).toBe('def:123');
      });

      it('to return when no term applies with @id', async () => {
        expect(ContextParser.expandTerm('def', {def: {}}, false)).toBe('def');
      });

      it('to return when a prefix applies', async () => {
        expect(ContextParser.expandTerm('def:123', {def: 'DEF/'}, false)).toBe('DEF/123');
      });

      it('to return when a prefix applies with @id', async () => {
        expect(ContextParser.expandTerm('def:123', {def: { '@id': 'DEF/'} }, false)).toBe('DEF/123');
      });

      it('to return when a direct value applies, but ignore it in base-mode', async () => {
        expect(ContextParser.expandTerm('abc', {abc: 'DEF'}, false)).toBe('abc');
      });

      it('to return when @vocab exists but not applies', async () => {
        expect(ContextParser.expandTerm('def:123', {'@vocab': 'bbb/'}, false)).toBe('def:123');
      });

      it('to return when @vocab exists and applies', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'bbb/'}, false)).toBe('def');
      });

      it('to return when @vocab exists and applies, but is disabled', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'bbb/', 'def': null}, false)).toBe(null);
      });

      it('to return when @vocab exists and applies, but is disabled via @id', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': 'bbb/', 'def': { '@id': null }}, false)).toBe(null);
      });

      it('to return when @base exists but not applies', async () => {
        expect(ContextParser.expandTerm('def:123', {'@base': 'bbb/'}, false)).toBe('def:123');
      });

      it('to return when @base exists and applies', async () => {
        expect(ContextParser.expandTerm('def', {'@base': 'http://bbb/'}, false))
          .toBe('http://bbb/def');
      });

      it('to return when @base exists and applies, but is disabled', async () => {
        expect(ContextParser.expandTerm('def', {'@base': 'bbb/', 'def': null}, false)).toBe(null);
      });

      it('to return when @base exists and applies, but is disabled via @id', async () => {
        expect(ContextParser.expandTerm('def', {'@base': 'bbb/', 'def': { '@id': null }}, false)).toBe(null);
      });

      it('to return when @base exists and applies, and a relative hash with a semicolon', async () => {
        expect(ContextParser.expandTerm('#abc:def', {'@base': 'http://ex.org/'}, false))
          .toBe('http://ex.org/#abc:def');
      });

      it('to return when @vocab is empty string and @base does not exist', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': ''}, false)).toBe('def');
      });

      it('to return when @vocab is empty string and @base exists', async () => {
        expect(ContextParser.expandTerm('def', {'@vocab': '', '@base': 'http://ex.org/'}, false))
          .toBe('http://ex.org/def');
      });

      it('to return when a term and prefix applies', async () => {
        expect(ContextParser.expandTerm('bla', {
          bla: 'DEF/123',
          def: 'DEF/',
        }, false)).toBe('bla');
      });

      it('to return when a prefix and prefix applies', async () => {
        expect(ContextParser.expandTerm('a:123', {
          a: 'DEF/A/',
          def: 'DEF/',
        }, false)).toBe('DEF/A/123');
      });

      it('to return identity when context alias value is not a string', async () => {
        expect(ContextParser.expandTerm('k', { k: { '@id': 3 } }, false)).toBe('k');
      });

      it('to return identity when context alias value is not an IRI', async () => {
        expect(ContextParser.expandTerm('k', { k: { '@id': 'not an IRI' } }, false)).toBe('k');
      });
    });
  });

  describe('#compactIri', () => {
    describe('in vocab-mode', () => {
      it('should throw on a non-normalized context', async () => {
        expect(() => ContextParser.compactIri('http://ex.org/abc', <any> 'string', true))
          .toThrow(new Error('The given context is not normalized. Make sure to call ContextParser.parse() first.'));
      });

      it('when no prefix applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {}, true)).toBe('http://ex.org/abc');
      });

      it('when @vocab applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          '@vocab': 'http://ex.org/',
        }, true)).toBe('abc');
      });

      it('when @base applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          '@base': 'http://ex.org/',
        }, true)).toBe('http://ex.org/abc');
      });

      it('when a term alias applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          myterm: 'http://ex.org/abc',
        }, true)).toBe('myterm');
      });

      it('when a term prefix applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          ex: 'http://ex.org/',
        }, true)).toBe('ex:abc');
      });

      it('when a term prefix and term alias applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          ex: 'http://ex.org/',
          thing: 'http://ex.org/abc',
        }, true)).toBe('thing');
      });

      it('when multiple prefixes apply', async () => {
        expect(ContextParser.compactIri('http://ex.org/a/b/c/suffix', {
          a: 'http://ex.org/a/',
          b: 'http://ex.org/a/b/',
          c: 'http://ex.org/a/b/c/',
        }, true)).toBe('c:suffix');
      });

      it('when multiple prefixes apply in different order', async () => {
        expect(ContextParser.compactIri('http://ex.org/a/b/c/suffix', {
          0: 'http://ex.org/a/b/c/',
          1: 'http://ex.org/a/b/',
          2: 'http://ex.org/a/',
        }, true)).toBe('0:suffix');
      });
    });

    describe('in base-mode', () => {
      it('when no prefix applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {}, false)).toBe('http://ex.org/abc');
      });

      it('when @vocab applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          '@vocab': 'http://ex.org/',
        }, false)).toBe('http://ex.org/abc');
      });

      it('when @base applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          '@base': 'http://ex.org/',
        }, false)).toBe('abc');
      });

      it('when a term alias applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          myterm: 'http://ex.org/abc',
        }, false)).toBe('http://ex.org/abc');
      });

      it('when a term prefix applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          ex: 'http://ex.org/',
        }, false)).toBe('ex:abc');
      });

      it('when a term prefix and term alias applies', async () => {
        expect(ContextParser.compactIri('http://ex.org/abc', {
          ex: 'http://ex.org/',
          thing: 'http://ex.org/abc',
        }, false)).toBe('ex:abc');
      });
    });
  });

  describe('#assertNormalized', () => {
    it('should throw on a string', async () => {
      expect(() => ContextParser.assertNormalized('string'))
        .toThrow(new Error('The given context is not normalized. Make sure to call ContextParser.parse() first.'));
    });

    it('should throw on an array', async () => {
      expect(() => ContextParser.assertNormalized([]))
        .toThrow(new Error('The given context is not normalized. Make sure to call ContextParser.parse() first.'));
    });

    it('should throw on a non-normalized context', async () => {
      expect(() => ContextParser.assertNormalized({ "@context": {} }))
        .toThrow(new Error('The given context is not normalized. Make sure to call ContextParser.parse() first.'));
    });

    it('should not throw on a normalized context', async () => {
      expect(() => ContextParser.assertNormalized({})).not.toThrow();
    });
  });

  describe('#isPrefixValue', () => {
    it('should be false for null', async () => {
      expect(ContextParser.isPrefixValue(null)).toBeFalsy();
    });

    it('should be true for strings', async () => {
      expect(ContextParser.isPrefixValue('abc')).toBeTruthy();
    });

    it('should be true for objects with @id', async () => {
      expect(ContextParser.isPrefixValue({ '@id': 'bla' })).toBeTruthy();
    });

    it('should be true for objects with @type', async () => {
      expect(ContextParser.isPrefixValue({ '@type': 'bla' })).toBeTruthy();
    });

    it('should be false for objects without @id and @type', async () => {
      expect(ContextParser.isPrefixValue({ '@notid': 'bla' })).toBeFalsy();
    });
  });

  describe('#isValidIri', () => {
    it('should be false for null', async () => {
      expect(ContextParser.isValidIri(null)).toBeFalsy();
    });

    it('should be false for an empty string', async () => {
      expect(ContextParser.isValidIri('')).toBeFalsy();
    });

    it('should be false for an abc', async () => {
      expect(ContextParser.isValidIri('abc')).toBeFalsy();
    });

    it('should be true for an abc:def', async () => {
      expect(ContextParser.isValidIri('abc:def')).toBeTruthy();
    });

    it('should be true for an http://google.com', async () => {
      expect(ContextParser.isValidIri('http://google.com')).toBeTruthy();
    });

    it('should be false for an http://google.com<', async () => {
      expect(ContextParser.isValidIri('http://google.com<')).toBeFalsy();
    });

    it('should be false for an http://google .com', async () => {
      expect(ContextParser.isValidIri('http://google .com')).toBeFalsy();
    });
  });

  describe('#isValidKeyword', () => {
    it('should be true for valid keywords', async () => {
      expect(ContextParser.isValidKeyword('@id')).toBeTruthy();
      expect(ContextParser.isValidKeyword('@container')).toBeTruthy();
      expect(ContextParser.isValidKeyword('@nest')).toBeTruthy();
    });

    it('should be false for invalid keywords', async () => {
      expect(ContextParser.isValidKeyword(null)).toBeFalsy();
      expect(ContextParser.isValidKeyword(3)).toBeFalsy();
      expect(ContextParser.isValidKeyword('@')).toBeFalsy();
      expect(ContextParser.isValidKeyword('@!')).toBeFalsy();
      expect(ContextParser.isValidKeyword('@3')).toBeFalsy();
      expect(ContextParser.isValidKeyword('@ignore')).toBeFalsy();
      expect(ContextParser.isValidKeyword('@ignoreMe')).toBeFalsy();
    });
  });

  describe('#isPotentialKeyword', () => {
    it('should be true for potential keywords', async () => {
      expect(ContextParser.isPotentialKeyword('@id')).toBeTruthy();
      expect(ContextParser.isPotentialKeyword('@container')).toBeTruthy();
      expect(ContextParser.isPotentialKeyword('@nest')).toBeTruthy();
      expect(ContextParser.isPotentialKeyword('@ignore')).toBeTruthy();
      expect(ContextParser.isPotentialKeyword('@ignoreMe')).toBeTruthy();
    });

    it('should be false for invalid keywords', async () => {
      expect(ContextParser.isPotentialKeyword(null)).toBeFalsy();
      expect(ContextParser.isPotentialKeyword(3)).toBeFalsy();
      expect(ContextParser.isPotentialKeyword('@')).toBeFalsy();
      expect(ContextParser.isPotentialKeyword('@!')).toBeFalsy();
      expect(ContextParser.isPotentialKeyword('@3')).toBeFalsy();
    });
  });

  describe('#expandPrefixedTerms with expandContentTypeToBase true', () => {
    it('should not modify an empty context', async () => {
      expect(ContextParser.expandPrefixedTerms({}, true)).toEqual({});
    });

    it('should not modify a context without prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        abc: 'def',
      }, true)).toEqual({
        abc: 'def',
      });
    });

    it('should expand a context with string prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: 'ex:Example',
        ex: 'http://example.org/',
      }, true)).toEqual({
        Example: 'http://example.org/Example',
        ex: 'http://example.org/',
      });
    });

    it('should expand a context with nested string prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: 'exabc:Example',
        ex: 'http://example.org/',
        exabc: 'ex:abc/',
      }, true)).toEqual({
        Example: 'http://example.org/abc/Example',
        ex: 'http://example.org/',
        exabc: 'http://example.org/abc/',
      });
    });

    it('should expand a context with object @id prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'ex:Example' },
        ex: 'http://example.org/',
      }, true)).toEqual({
        Example: { '@id': 'http://example.org/Example' },
        ex: 'http://example.org/',
      });
    });

    it('should expand a context with nested object @id prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'exabc:Example' },
        ex: 'http://example.org/',
        exabc: 'ex:abc/',
      }, true)).toEqual({
        Example: { '@id': 'http://example.org/abc/Example' },
        ex: 'http://example.org/',
        exabc: 'http://example.org/abc/',
      });
    });

    it('should expand a context with object @type prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@type': 'ex:Example' },
        ex: 'http://example.org/',
      }, true)).toEqual({
        Example: { '@type': 'http://example.org/Example' },
        ex: 'http://example.org/',
      });
    });

    it('should expand a context with nested object @type prefixes', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@type': 'exabc:Example' },
        ex: 'http://example.org/',
        exabc: 'ex:abc/',
      }, true)).toEqual({
        Example: { '@type': 'http://example.org/abc/Example' },
        ex: 'http://example.org/',
        exabc: 'http://example.org/abc/',
      });
    });

    it('should expand a context with object prefixes with @id and @type', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'ex:Example', '@type': 'ex:ExampleType' },
        ex: 'http://example.org/',
      }, true)).toEqual({
        Example: { '@id': 'http://example.org/Example', '@type': 'http://example.org/ExampleType' },
        ex: 'http://example.org/',
      });
    });

    it('should not expand object prefixes that are not @id or @type', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@id': 'ex:Example', '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      }, true)).toEqual({
        Example: { '@id': 'http://example.org/Example', '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      });
    });

    it('should not expand object prefixes without @id and @type', async () => {
      expect(ContextParser.expandPrefixedTerms({
        Example: { '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      }, true)).toEqual({
        Example: { '@bla': 'ex:Example' },
        ex: 'http://example.org/',
      });
    });

    it('should expand a context with object prefixes without @id and with @type', async () => {
      expect(ContextParser.expandPrefixedTerms({
        ex: 'http://ex.org/',
        p: { '@id': 'http://ex.org/pred1', '@type': 'ex:mytype' },
      }, true)).toEqual({
        ex: 'http://ex.org/',
        p: { '@id': 'http://ex.org/pred1', '@type': 'http://ex.org/mytype' },
      });
    });

    it('should expand a context with object prefixes with @id and without @type', async () => {
      expect(ContextParser.expandPrefixedTerms({
        ex: 'http://ex.org/',
        p: { '@id': 'ex:pred1', '@type': 'http://ex.org/mytype' },
      }, true)).toEqual({
        ex: 'http://ex.org/',
        p: { '@id': 'http://ex.org/pred1', '@type': 'http://ex.org/mytype' },
      });
    });

    it('should not expand @language', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        '@language': 'en',
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'pred1', '@language': 'nl' },
      }, true)).toEqual({
        '@base': 'http://base.org/',
        '@language': 'en',
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'http://vocab.org/pred1', '@language': 'nl' },
      });
    });

    it('should not expand @direction', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        '@direction': 'ltr',
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'pred1', '@direction': 'rtl' },
      }, true)).toEqual({
        '@base': 'http://base.org/',
        '@direction': 'ltr',
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'http://vocab.org/pred1', '@direction': 'rtl' },
      });
    });

    it('should expand terms based on the vocab IRI', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        '@vocab': 'http://vocab.org/',
        'p': 'p',
      }, true)).toEqual({
        '@base': 'http://base.org/',
        '@vocab': 'http://vocab.org/',
        'p': 'http://vocab.org/p',
      });
    });

    it('should expand nested terms based on the vocab IRI', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'p', '@type': 'type' },
      }, true)).toEqual({
        '@base': 'http://base.org/',
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'http://vocab.org/p', '@type': 'http://vocab.org/type' },
      });
    });

    it('should let @type fallback to base when when vocab is disabled', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        '@vocab': null,
        'p': { '@id': 'p', '@type': 'type' },
      }, true)).toEqual({
        '@base': 'http://base.org/',
        '@vocab': null,
        'p': { '@id': 'p', '@type': 'http://base.org/type' },
      });
    });

    it('should let @type fallback to base when when vocab is not present', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        'p': { '@id': 'p', '@type': 'type' },
      }, true)).toEqual({
        '@base': 'http://base.org/',
        'p': { '@id': 'p', '@type': 'http://base.org/type' },
      });
    });

    it('should not expand @type: @vocab', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'p', '@type': '@vocab' },
      }, true)).toEqual({
        '@vocab': 'http://vocab.org/',
        'p': { '@id': 'http://vocab.org/p', '@type': '@vocab' },
      });
    });

    it('should error on aliasing of keywords', async () => {
      expect(() => ContextParser.expandPrefixedTerms({
        '@id': 'http//ex.org/id',
      }, true)).toThrow(new Error(`Keywords can not be aliased to something else.
Tried mapping @id to "http//ex.org/id"`));
    });

    it('should expand aliases', async () => {
      expect(ContextParser.expandPrefixedTerms({
        id: '@id',
        url: 'id',
      }, true)).toEqual({
        id: '@id',
        url: '@id',
      });
    });

    it('should not expand unknown keywords', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@vocab': 'http://example.org/',
        'ignoreMe': '@ignoreMe',
      }, true)).toEqual({
        '@vocab': 'http://example.org/',
        'ignoreMe': '@ignoreMe',
      });
    });
  });

  describe('#normalize', () => {
    it('should lowercase @language in 1.0', async () => {
      expect(ContextParser.normalize({
        '@language': 'EN',
        'p': { '@id': 'pred1', '@language': 'NL' },
      }, { processingMode: 1.0 })).toEqual({
        '@language': 'en',
        'p': { '@id': 'pred1', '@language': 'nl' },
      });
    });

    it('should lowercase @language if normalizeLanguageTags is true', async () => {
      expect(ContextParser.normalize({
        '@language': 'EN',
        'p': { '@id': 'pred1', '@language': 'NL' },
      }, { normalizeLanguageTags: true })).toEqual({
        '@language': 'en',
        'p': { '@id': 'pred1', '@language': 'nl' },
      });
    });

    it('should not lowercase @language in 1.1', async () => {
      expect(ContextParser.normalize({
        '@language': 'EN',
        'p': { '@id': 'pred1', '@language': 'NL' },
      }, { processingMode: 1.1 })).toEqual({
        '@language': 'EN',
        'p': { '@id': 'pred1', '@language': 'NL' },
      });
    });

    it('should not fail on null @language', async () => {
      expect(ContextParser.normalize({
        '@language': null,
        'p': { '@id': 'pred1', '@language': null },
      }, { processingMode: 1.0 })).toEqual({
        '@language': null,
        'p': { '@id': 'pred1', '@language': null },
      });
    });

    it('should not fail on invalid @language', async () => {
      expect(ContextParser.normalize({
        '@language': <any> {},
        'p': { '@id': 'pred1', '@language': {} },
      }, { processingMode: 1.0 })).toEqual({
        '@language': {},
        'p': { '@id': 'pred1', '@language': {} },
      });
    });
  });

  describe('#expandPrefixedTerms with expandContentTypeToBase false', () => {
    it('should not let @type fallback to base when when vocab is disabled', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        '@vocab': null,
        'p': { '@id': 'p', '@type': 'type' },
      }, false)).toEqual({
        '@base': 'http://base.org/',
        '@vocab': null,
        'p': { '@id': 'p', '@type': 'type' },
      });
    });

    it('should not let @type fallback to base when when vocab is not present', async () => {
      expect(ContextParser.expandPrefixedTerms({
        '@base': 'http://base.org/',
        'p': { '@id': 'p', '@type': 'type' },
      }, false)).toEqual({
        '@base': 'http://base.org/',
        'p': { '@id': 'p', '@type': 'type' },
      });
    });
  });

  describe('#idifyReverseTerms', () => {
    it('should not modify an empty context', async () => {
      expect(ContextParser.idifyReverseTerms({})).toEqual({});
    });

    it('should add an @id for a @reverse', async () => {
      expect(ContextParser.idifyReverseTerms({
        Example: { '@reverse': 'ex:Example' },
        ex: 'http://example.org/',
      })).toEqual({
        Example: { '@reverse': true, '@id': 'ex:Example' },
        ex: 'http://example.org/',
      });
    });

    it('should not add an @id for a @reverse that already has an @id', async () => {
      expect(ContextParser.idifyReverseTerms({
        Example: { '@reverse': 'ex:Example', '@id': 'ex:AnotherExample' },
        ex: 'http://example.org/',
      })).toEqual({
        Example: { '@reverse': 'ex:Example', '@id': 'ex:AnotherExample' },
        ex: 'http://example.org/',
      });
    });

    it('should error on an invalid @reverse @reverse', async () => {
      expect(() => ContextParser.idifyReverseTerms({
        Example: { '@reverse': 10 },
        ex: 'http://example.org/',
      })).toThrow(new Error('Invalid @reverse value: \'10\''));
    });
  });

  describe('#validate', () => {
    const parseDefaults = { processingMode: 1.1 };

    it('should error on an invalid @vocab', async () => {
      expect(() => ContextParser.validate(<any> { '@vocab': true }, parseDefaults))
        .toThrow(new Error('Found an invalid @vocab IRI: true'));
    });

    it('should error on an invalid @base', async () => {
      expect(() => ContextParser.validate(<any> { '@base': true }, parseDefaults))
        .toThrow(new Error('Found an invalid @base IRI: true'));
    });

    it('should error on an invalid @language', async () => {
      expect(() => ContextParser.validate(<any> { '@language': true }, parseDefaults))
        .toThrow(new Error('The value of an \'@language\' must be a string, got \'true\''));
    });

    it('should error on an invalid @direction', async () => {
      expect(() => ContextParser.validate(<any> { '@direction': true }, parseDefaults))
        .toThrow(new Error('The value of an \'@direction\' must be a string, got \'true\''));
    });

    it('should error on an invalid @version', async () => {
      expect(() => ContextParser.validate(<any> { '@version': true }, parseDefaults))
        .toThrow(new Error('Found an invalid @version number: true'));
    });

    it('should not error on a null @language', async () => {
      expect(() => ContextParser.validate(<any> { '@language': null }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on a null @direction', async () => {
      expect(() => ContextParser.validate(<any> { '@direction': null }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on a null @version', async () => {
      expect(() => ContextParser.validate(<any> { '@version': null }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on a number @version', async () => {
      expect(() => ContextParser.validate(<any> { '@version': 1.1 }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on an invalid @unknown', async () => {
      expect(() => ContextParser.validate(<any> { '@unknown': 'true' }, parseDefaults))
        .not.toThrow();
    });

    it('should error on term without @id and @type : @id', async () => {
      expect(() => ContextParser.validate(<any> { term: {} }, parseDefaults))
        .toThrow(new Error('Missing @id in context entry: \'term\': \'{}\''));
    });

    it('should error on term without @id, but with @type : @id', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@type': '@id' } }, parseDefaults))
        .toThrow(new Error('Missing @id in context entry: \'term\': \'{"@type":"@id"}\''));
    });

    it('should not error on term without @id, but with @type : @id and @base', async () => {
      expect(() => ContextParser.validate(<any> { 'term': { '@type': '@id' }, '@base': 'abc' }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on term without @id and @type : @id and @base', async () => {
      expect(() => ContextParser.validate(<any> { 'term': {}, '@base': 'abc' }, parseDefaults))
        .toThrow(new Error('Missing @id in context entry: \'term\': \'{}\''));
    });

    it('should error on term without @id, but with @type : @id and @vocab', async () => {
      expect(() => ContextParser.validate(<any> { 'term': { '@type': '@id' }, '@vocab': 'abc' }, parseDefaults))
        .toThrow(new Error('Missing @id in context entry: \'term\': \'{"@type":"@id"}\''));
    });

    it('should not error on term without @id and @type : @id and @vocab', async () => {
      expect(() => ContextParser.validate(<any> { 'term': {}, '@vocab': 'abc' }, parseDefaults))
        .not.toThrow();
    });

    it('should error on term with @id: @container', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@container' } }, parseDefaults))
        .toThrow(new Error('Illegal keyword alias in term value, found: \'term\': \'{"@id":"@container"}\''));
    });

    it('should not error on term with @id: @type', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@type' } }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on term with @id: @id', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id' } }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on term with @type: @id', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id', '@type': '@id' } }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on term with @type: @vocab', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id', '@type': '@vocab' } }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on term with @type: @json', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id', '@type': '@json' } }, parseDefaults))
        .not.toThrow();
    });

    it('should error on term with @type: @json in 1.0', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id', '@type': '@json' } }, { processingMode: 1.0 }))
        .toThrow(new ErrorCoded(`A context @type must be an absolute IRI, found: 'term': '@json'`,
          ERROR_CODES.INVALID_TYPE_MAPPING));
    });

    it('should error on term with @type: _:bnode', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id', '@type': '_:bnode' } }, parseDefaults))
        .toThrow(new Error('A context @type must be an absolute IRI, found: \'term\': \'_:bnode\''));
    });

    it('should error on term with @type: invalid-iri', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': '@id', '@type': 'invalid-iri' } }, parseDefaults))
        .toThrow(new Error('A context @type must be an absolute IRI, found: \'term\': \'invalid-iri\''));
    });

    it('should not error on term with @reverse: true', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@reverse': true } }, parseDefaults))
        .not.toThrow();
    });

    it('should error on term with different @reverse and @id', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@reverse': 'abc' } },
        parseDefaults))
        .toThrow(
          new Error('Found non-matching @id and @reverse term values in \'term\':\'abc\' and \'http://ex.org/\''));
    });

    it('should not error on a term with @container: @list', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@container': '@list' } },
        parseDefaults))
        .not.toThrow();
    });

    it('should not error on a term with @container: @set', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@container': '@set' } },
        parseDefaults))
        .not.toThrow();
    });

    it('should not error on a term with @container: @index', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@container': '@index' } },
        parseDefaults))
        .not.toThrow();
    });

    it('should not error on a term with @container: @language', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@container': '@language' } },
        parseDefaults))
        .not.toThrow();
    });

    it('should error on a term with @container: @unknown', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@container': '@unknown' } },
        parseDefaults))
        .toThrow(new Error('Invalid term @container for \'term\' (\'@unknown\'), ' +
          'must be one of @list, @set, @index, @language'));
    });

    it('should error on a term with @container: @list and @reverse', async () => {
      expect(() => ContextParser.validate(<any>
        { term: { '@id': 'http://ex.org/', '@container': '@list', '@reverse': true } }, parseDefaults))
        .toThrow(new Error('Term value can not be @container: @list and @reverse at the same time on \'term\''));
    });

    it('should not error on a term with @language: en', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@language': 'en' } },
        parseDefaults))
        .not.toThrow();
    });

    it('should not error on a term with @direction: rtl', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@direction': 'rtl' } },
        parseDefaults))
        .not.toThrow();
    });

    it('should error on a term with @language: 10', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@language': 10 } }, parseDefaults))
        .toThrow(new Error('The value of an \'@language\' must be a string, got \'10\''));
    });

    it('should error on a term with @language: en us', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@language': 'en us' } },
        parseDefaults))
        .toThrow(new Error('The value of an \'@language\' must be a valid language tag, got \'"en us"\''));
    });

    it('should error on a term with @direction: abc', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@direction': 'abc' } },
        parseDefaults))
        .toThrow(new Error('The value of an \'@direction\' must be \'ltr\' or \'rtl\', got \'"abc"\''));
    });

    it('should error on a term with @prefix: true', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@prefix': true } }, parseDefaults))
        .not.toThrow();
    });

    it('should error on a term with @prefix: 10', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': 'http://ex.org/', '@prefix': 10 } }, parseDefaults))
        .toThrow(new Error('Found an invalid term @prefix boolean in: \'term\': ' +
          '\'{"@id":"http://ex.org/","@prefix":10}\''));
    });

    it('should not error on a term set to null', async () => {
      expect(() => ContextParser.validate(<any> { term: null }, parseDefaults))
        .not.toThrow();
    });

    it('should not error on a term @id set to null', async () => {
      expect(() => ContextParser.validate(<any> { term: { '@id': null } }, parseDefaults))
        .not.toThrow();
    });

    it('should error on a term set to a number', async () => {
      expect(() => ContextParser.validate(<any> { term: 10 }, parseDefaults))
        .toThrow(new Error('Found an invalid term value: \'term\': \'10\''));
    });
  });

  describe('#validateLanguage', () => {
    describe('with strictRange', () => {
      it('should pass on valid languages', () => {
        expect(ContextParser.validateLanguage('en-us', true)).toBeTruthy();
        expect(ContextParser.validateLanguage('EN-us', true)).toBeTruthy();
        expect(ContextParser.validateLanguage('nl-be', true)).toBeTruthy();
      });

      it('should error on invalid language datatypes', () => {
        expect(() => ContextParser.validateLanguage(3, true)).toThrow();
        expect(() => ContextParser.validateLanguage({}, true)).toThrow();
      });

      it('should error on invalid language strings', () => {
        expect(() => ContextParser.validateLanguage('!', true)).toThrow();
        expect(() => ContextParser.validateLanguage('', true)).toThrow();
        expect(() => ContextParser.validateLanguage('en_us', true)).toThrow();
      });
    });

    describe('without strictRange', () => {
      it('should pass on valid languages', () => {
        expect(ContextParser.validateLanguage('en-us', false)).toBeTruthy();
        expect(ContextParser.validateLanguage('EN-us', false)).toBeTruthy();
        expect(ContextParser.validateLanguage('nl-be', false)).toBeTruthy();
      });

      it('should error on invalid language datatypes', () => {
        expect(() => ContextParser.validateLanguage(3, false)).toThrow();
        expect(() => ContextParser.validateLanguage({}, false)).toThrow();
      });

      it('should return false on invalid language strings', () => {
        expect(ContextParser.validateLanguage('!', false)).toBeFalsy();
        expect(ContextParser.validateLanguage('', false)).toBeFalsy();
        expect(ContextParser.validateLanguage('en_us', false)).toBeFalsy();
      });
    });
  });

  describe('#validateDirection', () => {
    describe('with strictRange', () => {
      it('should pass on valid directions', () => {
        expect(ContextParser.validateDirection('rtl', true)).toBeTruthy();
        expect(ContextParser.validateDirection('ltr', true)).toBeTruthy();
      });

      it('should error on invalid direction datatypes', () => {
        expect(() => ContextParser.validateDirection(3, true)).toThrow();
        expect(() => ContextParser.validateDirection({}, true)).toThrow();
      });

      it('should error on invalid direction strings', () => {
        expect(() => ContextParser.validateDirection('!', true)).toThrow();
        expect(() => ContextParser.validateDirection('', true)).toThrow();
        expect(() => ContextParser.validateDirection('en_us', true)).toThrow();
      });
    });

    describe('without strictRange', () => {
      it('should pass on valid directions', () => {
        expect(ContextParser.validateDirection('rtl', false)).toBeTruthy();
        expect(ContextParser.validateDirection('ltr', false)).toBeTruthy();
      });

      it('should error on invalid direction datatypes', () => {
        expect(() => ContextParser.validateDirection(3, false)).toThrow();
        expect(() => ContextParser.validateDirection({}, false)).toThrow();
      });

      it('should return false on invalid direction strings', () => {
        expect(ContextParser.validateDirection('!', false)).toBeFalsy();
        expect(ContextParser.validateDirection('', false)).toBeFalsy();
        expect(ContextParser.validateDirection('en_us', false)).toBeFalsy();
      });
    });
  });

  describe('when instantiated without options', () => {
    let parser;

    beforeEach(() => {
      parser = new ContextParser();
    });

    it('should have a default document loader', async () => {
      expect(parser.documentLoader).toBeInstanceOf(FetchDocumentLoader);
    });
  });

  describe('when instantiated with empty options', () => {
    let parser;

    beforeEach(() => {
      parser = new ContextParser({});
    });

    it('should have a default document loader', async () => {
      expect(parser.documentLoader).toBeInstanceOf(FetchDocumentLoader);
    });
  });

  describe('when instantiated with skipValidation = true', () => {
    let parser;

    beforeEach(() => {
      parser = new ContextParser({ skipValidation: true });
    });

    it('should parse with an invalid context entry', () => {
      return expect(parser.parse({ '@base': true })).resolves.toEqual({ '@base': true });
    });
  });

  describe('when instantiated with options and a document loader', () => {
    let documentLoader;
    let parser;

    beforeEach(() => {
      documentLoader = new FetchDocumentLoader();
      parser = new ContextParser({ documentLoader });
    });

    it('should have the given document loader', async () => {
      expect(parser.documentLoader).toBe(documentLoader);
    });

    describe('for parsing objects', () => {
      it('should error when parsing a context with an invalid context entry', () => {
        return expect(parser.parse({ '@base': true })).rejects
          .toEqual(new Error('Found an invalid @base IRI: true'));
      });

      it('should parse an object with direct context values', () => {
        return expect(parser.parse({ name: "http://xmlns.com/foaf/0.1/name" })).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
        });
      });

      it('should parse an object with indirect context values', () => {
        return expect(parser.parse({ "@context": { name: "http://xmlns.com/foaf/0.1/name" } })).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
        });
      });

      it('should parse without modifying the original context', async () => {
        const contextIn = { "@context": { rev: { "@reverse": "http://example.com/" } } };
        await expect(parser.parse(contextIn)).resolves.toEqual({
          rev: {
            "@id": "http://example.com/",
            "@reverse": true,
          },
        });
        expect(contextIn).toEqual({ "@context": { rev: { "@reverse": "http://example.com/" } } });
      });

      it('should parse and normalize language tags in 1.0', async () => {
        const contextIn = {
          '@language': 'EN',
          'p': { '@id': 'pred1', '@language': 'NL' },
        };
        await expect(parser.parse(contextIn, { processingMode: 1.0 })).resolves.toEqual({
          '@language': 'en',
          'p': { '@id': 'pred1', '@language': 'nl' },
        });
      });

      it('should parse and not normalize language tags in 1.1', async () => {
        const contextIn = {
          '@language': 'EN',
          'p': { '@id': 'pred1', '@language': 'NL' },
        };
        await expect(parser.parse(contextIn, { processingMode: 1.1 })).resolves.toEqual({
          '@language': 'EN',
          'p': { '@id': 'pred1', '@language': 'NL' },
        });
      });

      it('should parse and use a relative @base IRI, when a document base IRI is given', () => {
        return expect(parser.parse({
          '@context': {
            '@base': '/sub',
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          },
        }, { baseIRI: 'http://doc.org/' }))
          .resolves.toEqual({
            '@base': 'http://doc.org/sub',
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          });
      });

      it('should parse and not modify an absolute @base IRI, when a document base IRI is also given', () => {
        return expect(parser.parse({
          '@context': {
            '@base': 'http://a/bb/ccc/./d;p?q',
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          },
        }, { baseIRI: 'http://doc.org/' }))
          .resolves.toEqual({
            '@base': 'http://a/bb/ccc/./d;p?q',
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          });
      });

      it('should parse and not modify a null @base, when a document base IRI is also given', () => {
        return expect(parser.parse({
          '@context': {
            '@base': null,
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          },
        }, { baseIRI: 'http://doc.org/' }))
          .resolves.toEqual({
            '@base': null,
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          });
      });

      it('should parse with a base IRI and not override the inner @base', () => {
        return expect(parser.parse({ '@base': 'http://myotherexample.org/' }, 'http://myexample.org/'))
          .resolves.toEqual({
            '@base': 'http://myotherexample.org/',
          });
      });

      it('should parse contexts with unknown keywords', () => {
        return expect(parser.parse({
          '@vocab': 'http://example.org/',
          'ignoreMe': '@ignoreMe',
        })).resolves.toEqual({
          '@vocab': 'http://example.org/',
          'ignoreMe': '@ignoreMe',
        });
      });
    });

    describe('for parsing URLs', () => {
      it('should parse a valid context URL', () => {
        return expect(parser.parse('http://example.org/simple.jsonld')).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse a valid relative context URL', () => {
        return expect(parser.parse('simple.jsonld', { baseIRI: 'http://example.org/mydoc.html' })).resolves.toEqual({
          '@base': 'http://example.org/mydoc.html',
          'name': "http://xmlns.com/foaf/0.1/name",
          'xsd': "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should fail to parse a relative context URL without baseIRI', () => {
        return expect(parser.parse('simple.jsonld')).rejects
          .toThrow(new Error('Invalid context IRI: simple.jsonld'));
      });

      it('should parse and ignore the @base IRI', () => {
        return expect(parser.parse('http://example.org/base.jsonld')).resolves.toEqual({
          nickname: 'http://xmlns.com/foaf/0.1/nick',
        });
      });

      it('should parse and ignore the @base IRI, but not when a custom base IRI is given', () => {
        return expect(parser.parse('http://example.org/base.jsonld', { baseIRI: 'abc' })).resolves.toEqual({
          '@base': 'abc',
          'nickname': 'http://xmlns.com/foaf/0.1/nick',
        });
      });

      it('should parse and ignore the @base IRI, but not from the parent context', () => {
        return expect(parser.parse('http://example.org/base.jsonld', { parentContext: { '@base': 'abc' } }))
          .resolves.toEqual({
            '@base': 'abc',
            'nickname': 'http://xmlns.com/foaf/0.1/nick',
          });
      });

      it('should cache documents', async () => {
        const spy = jest.spyOn(parser.documentLoader, 'load');

        await parser.parse('http://example.org/simple.jsonld');

        expect(parser.documentCache['http://example.org/simple.jsonld']).toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });

        await expect(parser.parse('http://example.org/simple.jsonld')).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should fail to parse an invalid source', () => {
        return expect(parser.parse('http://example.org/invalid.jsonld')).rejects.toBeTruthy();
      });
    });

    describe('for parsing null', () => {
      it('should parse to an empty context', () => {
        return expect(parser.parse(null)).resolves.toEqual({});
      });

      it('should parse to an empty context, even when a parent context is given', () => {
        return expect(parser.parse(null, { parentContext: { a: 'b' } })).resolves.toEqual({});
      });

      it('should parse to an empty context, but set @base if needed', () => {
        return expect(parser.parse(null, { baseIRI: 'http://base.org/' })).resolves
          .toEqual({ '@base': 'http://base.org/' });
      });
    });

    describe('for parsing arrays', () => {
      it('should parse an empty array to the parent context', () => {
        const parentContext = { a: 'b' };
        return expect(parser.parse([], { parentContext })).resolves.toBe(parentContext);
      });

      it('should parse an array with one string', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
        ])).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with two strings', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
          'http://example.org/simple2.jsonld',
        ])).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          nickname: "http://xmlns.com/foaf/0.1/nick",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with an object and a string', () => {
        return expect(parser.parse([
          {
            npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
          },
          'http://example.org/simple2.jsonld',
        ])).resolves.toEqual({
          nickname: "http://xmlns.com/foaf/0.1/nick",
          npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
        });
      });

      it('should parse an array with an object and a string resolving to an array when cached', () => {
        parser.documentCache['http://example.org/simplearray.jsonld'] = [{
          nickname: 'http://xmlns.com/foaf/0.1/nick',
        }];
        return expect(parser.parse([
          {
            npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
          },
          'http://example.org/simplearray.jsonld',
        ])).resolves.toEqual({
          nickname: "http://xmlns.com/foaf/0.1/nick",
          npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
        });
      });

      it('should parse and expand prefixes', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
          {
            myint: { "@id": "xsd:integer" },
          },
        ])).resolves.toEqual({
          myint: { "@id": "http://www.w3.org/2001/XMLSchema#integer" },
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });
    });

    describe('for base and vocab', () => {
      it('should parse with a base IRI', () => {
        return expect(parser.parse('http://example.org/simple.jsonld', { baseIRI: 'http://myexample.org/' }))
          .resolves.toEqual({
            '@base': 'http://myexample.org/',
            'name': "http://xmlns.com/foaf/0.1/name",
            'xsd': "http://www.w3.org/2001/XMLSchema#",
          });
      });

      it('should parse with a base IRI and not override the inner @base', () => {
        return expect(parser.parse({ '@base': 'http://myotherexample.org/' }, { baseIRI: 'http://myexample.org/' }))
          .resolves.toEqual({
            '@base': 'http://myotherexample.org/',
          });
      });

      it('should parse relative @vocab with parent context @vocab in active 1.1', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': 'vocab/' }, { parentContext, processingMode: 1.1 }))
          .resolves.toEqual({
            '@vocab': 'http://example.org/vocab/',
          });
      });

      it('should parse relative (empty) @vocab with parent context @vocab in active 1.1', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': '' }, { parentContext, processingMode: 1.1 }))
          .resolves.toEqual({
            '@vocab': 'http://example.org/',
          });
      });

      it('should not see null @vocab as relative @vocab', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': null }, { parentContext, processingMode: 1.1 }))
          .resolves.toEqual({
            '@vocab': null,
          });
      });

      it('should parse relative @vocab without parent context @vocab in active 1.1', () => {
        return expect(parser.parse({ '@vocab': 'vocab/' }, { parentContext: {}, processingMode: 1.1 }))
          .resolves.toEqual({
            '@vocab': 'vocab/',
          });
      });

      it('should not parse relative @vocab with parent context @vocab in 1.0', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': 'vocab/', '@version': 1.0 }, { parentContext }))
          .resolves.toEqual({
            '@version': 1.0,
            '@vocab': 'vocab/',
          });
      });

      it('should not parse relative (empty) @vocab with parent context @vocab in 1.0', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': '', '@version': 1.0 }, { parentContext }))
          .resolves.toEqual({
            '@version': 1.0,
            '@vocab': '',
          });
      });

      it('should not parse relative @vocab without parent context @vocab in 1.0', () => {
        return expect(parser.parse({ '@vocab': 'vocab/', '@version': 1.0 }, { parentContext: {} }))
          .resolves.toEqual({
            '@version': 1.0,
            '@vocab': 'vocab/',
          });
      });

      it('should parse relative @vocab with parent context @vocab in 1.1', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': 'vocab/', '@version': 1.1 }, { parentContext }))
          .resolves.toEqual({
            '@version': 1.1,
            '@vocab': 'http://example.org/vocab/',
          });
      });

      it('should parse relative (empty) @vocab with parent context @vocab in 1.1', () => {
        const parentContext = { '@vocab': 'http://example.org/' };
        return expect(parser.parse({ '@vocab': '', '@version': 1.1 }, { parentContext }))
          .resolves.toEqual({
            '@version': 1.1,
            '@vocab': 'http://example.org/',
          });
      });

      it('should parse relative @vocab without parent context @vocab in 1.1', () => {
        return expect(parser.parse({ '@vocab': 'vocab/', '@version': 1.1 }, { parentContext: {} }))
          .resolves.toEqual({
            '@version': 1.1,
            '@vocab': 'vocab/',
          });
      });
    });

    describe('for protected terms', () => {
      it('should parse a single protected term', () => {
        return expect(parser.parse({
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        }, { processingMode: 1.1 })).resolves.toEqual({
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse a single keyword alias', () => {
        return expect(parser.parse({
          id: {
            '@id': '@id',
            '@protected': true,
          },
        }, { processingMode: 1.1 })).resolves.toEqual({
          id: {
            '@id': '@id',
            '@protected': true,
          },
        });
      });

      it('should parse context-level @protected', () => {
        return expect(parser.parse({
          '@protected': true,
          'knows': 'http://xmlns.com/foaf/0.1/knows',
          'name': 'http://xmlns.com/foaf/0.1/name',
        }, { processingMode: 1.1 })).resolves.toEqual({
          knows: {
            '@id': 'http://xmlns.com/foaf/0.1/knows',
            '@protected': true,
          },
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse context-level @protected with local overrides', () => {
        return expect(parser.parse({
          '@protected': true,
          'knows': {
            '@id': 'http://xmlns.com/foaf/0.1/knows',
            '@protected': false,
          },
          'name': {
            '@id': 'http://xmlns.com/foaf/0.1/name',
          },
        }, { processingMode: 1.1 })).resolves.toEqual({
          knows: {
            '@id': 'http://xmlns.com/foaf/0.1/knows',
            '@protected': false,
          },
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse context-level @protected with a keyword alias', () => {
        return expect(parser.parse({
          '@protected': true,
          'id': '@id',
        }, { processingMode: 1.1 })).resolves.toEqual({
          id: {
            '@id': '@id',
            '@protected': true,
          },
        });
      });

      it('should error on a protected term with override', () => {
        return expect(parser.parse([
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
              '@protected': true,
            },
          },
          {
            name: 'http://schema.org/name',
          },
        ], { processingMode: 1.1 })).rejects.toThrow(new ErrorCoded(
          'Attempted to override the protected keyword name from ' +
          '"http://xmlns.com/foaf/0.1/name" to "http://schema.org/name"',
          ERROR_CODES.PROTECTED_TERM_REDIFINITION));
      });

      it('should error on a protected keyword alias with override', () => {
        return expect(parser.parse([
          {
            id: {
              '@id': '@id',
              '@protected': true,
            },
          },
          {
            id: 'http://schema.org/id',
          },
        ], { processingMode: 1.1 })).rejects.toThrow(new ErrorCoded(
          'Attempted to override the protected keyword id from "@id" to "http://schema.org/id"',
          ERROR_CODES.PROTECTED_TERM_REDIFINITION));
      });

      it('should parse a protected term with semantically identical (string-based) override', () => {
        return expect(parser.parse([
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
              '@protected': true,
            },
          },
          {
            name: 'http://xmlns.com/foaf/0.1/name',
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse a protected term with identical (object-based) override (mod @protected)', () => {
        return expect(parser.parse([
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
              '@protected': true,
            },
          },
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
            },
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse a protected term with identical (object-based) override', () => {
        return expect(parser.parse([
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
              '@protected': true,
            },
          },
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
              '@protected': true,
            },
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse a protected keyword alias with identical (object-based) override (mod @protected)', () => {
        return expect(parser.parse([
          {
            id: {
              '@id': '@id',
              '@protected': true,
            },
          },
          {
            id: {
              '@id': '@id',
            },
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          id: {
            '@id': '@id',
            '@protected': true,
          },
        });
      });

      it('should parse a protected keyword alias with identical (object-based) override', () => {
        return expect(parser.parse([
          {
            id: {
              '@id': '@id',
              '@protected': true,
            },
          },
          {
            id: {
              '@id': '@id',
              '@protected': true,
            },
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          id: {
            '@id': '@id',
            '@protected': true,
          },
        });
      });

      it('should parse a term that becomes protected later on', () => {
        return expect(parser.parse([
          {
            name: 'http://xmlns.com/foaf/0.1/name',
          },
          {
            name: {
              '@id': 'http://xmlns.com/foaf/0.1/name',
              '@protected': true,
            },
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          name: {
            '@id': 'http://xmlns.com/foaf/0.1/name',
            '@protected': true,
          },
        });
      });

      it('should parse a global protected keyword alias with identical (object-based) override (mod @protected)',
        () => {
          return expect(parser.parse([
            {
              '@protected': true,
              'id': '@id',
            },
            {
              id: '@id',
            },
          ], { processingMode: 1.1 })).resolves.toEqual({
            id: {
              '@id': '@id',
              '@protected': true,
            },
          });
        });

      it('should parse a global protected keyword alias with identical (object-based) override', () => {
        return expect(parser.parse([
          {
            '@protected': true,
            'id': '@id',
          },
          {
            '@protected': true,
            'id': '@id',
          },
        ], { processingMode: 1.1 })).resolves.toEqual({
          id: {
            '@id': '@id',
            '@protected': true,
          },
        });
      });
    });

    it('should parse a complex context', () => {
      // tslint:disable:object-literal-sort-keys
      // tslint:disable:max-line-length
      return expect(parser.parse('http://example.org/complex.jsonld')).resolves.toEqual({
        "@vocab": "unknown://",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "oo": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#",
        "Module": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#Module",
        },
        "Class": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#Class",
        },
        "AbstractClass": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#AbstractClass",
        },
        "Instance": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#ComponentInstance",
        },
        "components": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#component",
        },
        "parameters": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#parameter",
        },
        "constructorArguments": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#constructorArguments",
          "@container": "@list",
        },
        "unique": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#uniqueValue",
        },
        "required": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#required",
        },
        "default": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#defaultValue",
        },
        "defaultScoped": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#defaultScoped",
        },
        "defaultScope": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#defaultScope",
          "@type": "@id",
        },
        "defaultScopedValue": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#defaultScopedValue",
        },
        "arguments": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#arguments",
          "@container": "@list",
        },
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "comment": {
          "@id": "http://www.w3.org/2000/01/rdf-schema#comment",
          "@type": "@id",
        },
        "extends": {
          "@id": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          "@type": "@id",
        },
        "range": {
          "@id": "http://www.w3.org/2000/01/rdf-schema#range",
          "@type": "@id",
        },
        "owl": "http://www.w3.org/2002/07/owl#",
        "import": {
          "@id": "http://www.w3.org/2002/07/owl#imports",
        },
        "InheritanceValue": {
          "@id": "http://www.w3.org/2002/07/owl#Restriction",
        },
        "inheritValues": {
          "@id": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          "@type": "@id",
        },
        "onParameter": {
          "@id": "http://www.w3.org/2002/07/owl#onProperty",
          "@type": "@id",
        },
        "from": {
          "@id": "http://www.w3.org/2002/07/owl#allValuesFrom",
          "@type": "@id",
        },
        "doap": "http://usefulinc.com/ns/doap#",
        "requireName": {
          "@id": "http://usefulinc.com/ns/doap#name",
        },
        "requireElement": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#componentPath",
        },
        "om": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#",
        "ObjectMapping": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#ObjectMapping",
        },
        "ArrayMapping": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#ArrayMapping",
        },
        "fields": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#field",
          "@type": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#ObjectMapEntry",
        },
        "elements": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#elements",
          "@type": "@id",
          "@container": "@list",
        },
        "collectEntries": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#collectsEntriesFrom",
          "@type": "@id",
        },
        "keyRaw": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#fieldName",
        },
        "key": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#fieldName",
          "@type": "@id",
        },
        "value": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#fieldValue",
          "@type": "@id",
        },
        "valueRaw": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#fieldValue",
        },
        "valueRawReference": {
          "@id": "https://linkedsoftwaredependencies.org/vocabularies/object-mapping#fieldValueRaw",
          "@type": "@id",
        },
        "npmd": "https://linkedsoftwaredependencies.org/bundles/npm/",
        "cais": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/",
        "ActorInitSparql": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/Actor/Init/Sparql",
        "mediatorQueryOperation": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/mediatorQueryOperation",
        "mediatorSparqlParse": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/mediatorSparqlParse",
        "mediatorSparqlSerialize": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/mediatorSparqlSerialize",
        "mediatorSparqlSerializeMediaTypeCombiner": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/mediatorSparqlSerializeMediaTypeCombiner",
        "mediatorContextPreprocess": "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-init-sparql/mediatorContextPreprocess",
      });
      // tslint:enable:object-literal-sort-keys
      // tslint:enable:max-line-length
    });

    describe('for parsing null', () => {
      it('should parse to an empty context', () => {
        return expect(parser.parse(null)).resolves.toEqual({});
      });

      it('should parse to an empty context, even when a parent context is given', () => {
        return expect(parser.parse(null, { parentContext: { a: 'b' } })).resolves.toEqual({});
      });

      it('should parse to an empty context, but set @base if needed', () => {
        return expect(parser.parse(null, { baseIRI: 'http://base.org/' })).resolves
          .toEqual({ '@base': 'http://base.org/' });
      });
    });

    describe('for parsing arrays', () => {
      it('should parse an empty array to the parent context', () => {
        const parentContext = { a: 'b' };
        return expect(parser.parse([], { parentContext })).resolves.toBe(parentContext);
      });

      it('should parse an array with one string', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
        ])).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with two strings', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
          'http://example.org/simple2.jsonld',
        ])).resolves.toEqual({
          name: "http://xmlns.com/foaf/0.1/name",
          nickname: "http://xmlns.com/foaf/0.1/nick",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with relative string URLs', () => {
        return expect(parser.parse([
          'simple.jsonld',
          'simple2.jsonld',
        ], { baseIRI: 'http://example.org/mybase.html' })).resolves.toEqual({
          '@base': 'http://example.org/mybase.html',
          'name': "http://xmlns.com/foaf/0.1/name",
          'nickname': "http://xmlns.com/foaf/0.1/nick",
          'xsd': "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should parse an array with an object and a string', () => {
        return expect(parser.parse([
          {
            npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
          },
          'http://example.org/simple2.jsonld',
        ])).resolves.toEqual({
          nickname: "http://xmlns.com/foaf/0.1/nick",
          npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
        });
      });

      it('should parse an array with an object and a string resolving to an array when cached', () => {
        parser.documentCache['http://example.org/simplearray.jsonld'] = [{
          nickname: 'http://xmlns.com/foaf/0.1/nick',
        }];
        return expect(parser.parse([
          {
            npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
          },
          'http://example.org/simplearray.jsonld',
        ])).resolves.toEqual({
          nickname: "http://xmlns.com/foaf/0.1/nick",
          npmd: "https://linkedsoftwaredependencies.org/bundles/npm/",
        });
      });

      it('should parse and expand prefixes', () => {
        return expect(parser.parse([
          'http://example.org/simple.jsonld',
          {
            myint: { "@id": "xsd:integer" },
          },
        ])).resolves.toEqual({
          myint: { "@id": "http://www.w3.org/2001/XMLSchema#integer" },
          name: "http://xmlns.com/foaf/0.1/name",
          xsd: "http://www.w3.org/2001/XMLSchema#",
        });
      });

      it('should handle @base relative to each other', () => {
        return expect(parser.parse([
          {
            '@base': 'one/',
          },
          {
            '@base': 'two/',
          },
        ], { baseIRI: 'http://doc.org/' })).resolves.toEqual({
          '@base': 'http://doc.org/one/two/',
        });
      });
    });

    describe('for parsing invalid values', () => {
      it('should error when parsing true', () => {
        return expect(parser.parse(true)).rejects
          .toEqual(new Error('Tried parsing a context that is not a string, array or object, but got true'));
      });

      it('should error when parsing false', () => {
        return expect(parser.parse(false)).rejects
          .toEqual(new Error('Tried parsing a context that is not a string, array or object, but got false'));
      });

      it('should error when parsing a number', () => {
        return expect(parser.parse(1)).rejects
          .toEqual(new Error('Tried parsing a context that is not a string, array or object, but got 1'));
      });
    });
  });
});
