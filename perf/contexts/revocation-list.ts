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
    "@protected": true,
    RevocationList2020Credential: {
      "@id":
        "https://w3id.org/vc-revocation-list-2020#RevocationList2020Credential",
      "@context": {
        "@protected": true,

        id: "@id",
        type: "@type",

        description: "http://schema.org/description",
        name: "http://schema.org/name",
      },
    },
    RevocationList2020: {
      "@id": "https://w3id.org/vc-revocation-list-2020#RevocationList2020",
      "@context": {
        "@protected": true,

        id: "@id",
        type: "@type",

        encodedList: "https://w3id.org/vc-revocation-list-2020#encodedList",
      },
    },

    RevocationList2020Status: {
      "@id":
        "https://w3id.org/vc-revocation-list-2020#RevocationList2020Status",
      "@context": {
        "@protected": true,

        id: "@id",
        type: "@type",

        revocationListCredential: {
          "@id":
            "https://w3id.org/vc-revocation-list-2020#revocationListCredential",
          "@type": "@id",
        },
        revocationListIndex:
          "https://w3id.org/vc-revocation-list-2020#revocationListIndex",
      },
    },
  },
};
