//
// Copyright Inrupt Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
// Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
export default {
  "@context": {
    id: "@id",
    type: "@type",
    "@protected": true,
    proof: {
      "@id": "https://w3id.org/security#proof",
      "@type": "@id",
      "@container": "@graph",
    },
    DataIntegrityProof: {
      "@id": "https://w3id.org/security#DataIntegrityProof",
      "@context": {
        "@protected": true,
        id: "@id",
        type: "@type",
        challenge: "https://w3id.org/security#challenge",
        created: {
          "@id": "http://purl.org/dc/terms/created",
          "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
        },
        domain: "https://w3id.org/security#domain",
        expires: {
          "@id": "https://w3id.org/security#expiration",
          "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
        },
        nonce: "https://w3id.org/security#nonce",
        proofPurpose: {
          "@id": "https://w3id.org/security#proofPurpose",
          "@type": "@vocab",
          "@context": {
            "@protected": true,
            id: "@id",
            type: "@type",
            assertionMethod: {
              "@id": "https://w3id.org/security#assertionMethod",
              "@type": "@id",
              "@container": "@set",
            },
            authentication: {
              "@id": "https://w3id.org/security#authenticationMethod",
              "@type": "@id",
              "@container": "@set",
            },
            capabilityInvocation: {
              "@id": "https://w3id.org/security#capabilityInvocationMethod",
              "@type": "@id",
              "@container": "@set",
            },
            capabilityDelegation: {
              "@id": "https://w3id.org/security#capabilityDelegationMethod",
              "@type": "@id",
              "@container": "@set",
            },
            keyAgreement: {
              "@id": "https://w3id.org/security#keyAgreementMethod",
              "@type": "@id",
              "@container": "@set",
            },
          },
        },
        cryptosuite: "https://w3id.org/security#cryptosuite",
        proofValue: {
          "@id": "https://w3id.org/security#proofValue",
          "@type": "https://w3id.org/security#multibase",
        },
        verificationMethod: {
          "@id": "https://w3id.org/security#verificationMethod",
          "@type": "@id",
        },
      },
    },
  },
};
