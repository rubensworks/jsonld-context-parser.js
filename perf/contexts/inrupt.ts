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

/**
 * The custom Inrupt context for verifiable credentials
 * @see https://schema.inrupt.com/credentials/v1.jsonld
 */
export default {
  "@context": {
    "@version": 1.1,
    "@protected": true,
    ldp: "http://www.w3.org/ns/ldp#",
    acl: "http://www.w3.org/ns/auth/acl#",
    gc: "https://w3id.org/GConsent#",
    vc: "http://www.w3.org/ns/solid/vc#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    issuerService: {
      "@id": "vc:issuerService",
      "@type": "@id",
    },
    statusService: {
      "@id": "vc:statusService",
      "@type": "@id",
    },
    verifierService: {
      "@id": "vc:verifierService",
      "@type": "@id",
    },
    derivationService: {
      "@id": "vc:derivationService",
      "@type": "@id",
    },
    proofService: {
      "@id": "vc:proofService",
      "@type": "@id",
    },
    availabilityService: {
      "@id": "vc:availabilityService",
      "@type": "@id",
    },
    submissionService: {
      "@id": "vc:submissionService",
      "@type": "@id",
    },
    supportedSignatureTypes: {
      "@id": "vc:supportedSignatureTypes",
      "@type": "@id",
    },
    include: {
      "@id": "vc:include",
      "@type": "@id",
    },
    SolidAccessGrant: "vc:SolidAccessGrant",
    SolidAccessRequest: "vc:SolidAccessRequest",
    ExpiredVerifiableCredential: "vc:ExpiredVerifiableCredential",
    inbox: {
      "@id": "ldp:inbox",
      "@type": "@id",
    },
    Read: "acl:Read",
    Write: "acl:Write",
    Append: "acl:Append",
    mode: {
      "@id": "acl:mode",
      "@type": "@vocab",
    },
    Consent: "gc:Consent",
    ConsentStatusExpired: "gc:ConsentStatusExpired",
    ConsentStatusExplicitlyGiven: "gc:ConsentStatusExplicitlyGiven",
    ConsentStatusGivenByDelegation: "gc:ConsentStatusGivenByDelegation",
    ConsentStatusImplicitlyGiven: "gc:ConsentStatusImplicitlyGiven",
    ConsentStatusInvalidated: "gc:ConsentStatusInvalidated",
    ConsentStatusNotGiven: "gc:ConsentStatusNotGiven",
    ConsentStatusRefused: "gc:ConsentStatusRefused",
    ConsentStatusRequested: "gc:ConsentStatusRequested",
    ConsentStatusUnknown: "gc:ConsentStatusUnknown",
    ConsentStatusWithdrawn: "gc:ConsentStatusWithdrawn",
    forPersonalData: {
      "@id": "gc:forPersonalData",
      "@type": "@id",
    },
    forProcessing: {
      "@id": "gc:forProcessing",
      "@type": "@id",
    },
    forPurpose: {
      "@id": "gc:forPurpose",
      "@type": "@id",
    },
    hasConsent: {
      "@id": "gc:hasConsent",
      "@type": "@id",
    },
    hasContext: {
      "@id": "gc:hasContext",
      "@type": "@id",
    },
    hasStatus: {
      "@id": "gc:hasStatus",
      "@type": "@vocab",
    },
    inMedium: {
      "@id": "gc:inMedium",
      "@type": "@id",
    },
    isConsentForDataSubject: {
      "@id": "gc:isConsentForDataSubject",
      "@type": "@id",
    },
    isProvidedTo: {
      "@id": "gc:isProvidedTo",
      "@type": "@id",
    },
    isProvidedToPerson: {
      "@id": "gc:isProvidedToPerson",
      "@type": "@id",
    },
    isProvidedToController: {
      "@id": "gc:isProvidedToController",
      "@type": "@id",
    },
    providedConsent: {
      "@id": "gc:providedConsent",
      "@type": "@id",
    },
    inherit: {
      "@id": "urn:uuid:71ab2f68-a68b-4452-b968-dd23e0570227",
      "@type": "xsd:boolean",
    },
  },
} as const;
