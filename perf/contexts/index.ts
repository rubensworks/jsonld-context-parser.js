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
import VC from "./vc";
import Inrupt from "./inrupt";
import vc from "./inrupt-vc";
import integrity from "./data-integrity";
import ed25519 from "./ed25519-2020";
import revocation from "./revocation-list";
import statusList from "./status-list";
import odrl from "./odrl";

export default {
  "https://www.w3.org/2018/credentials/v1": VC,
  "https://schema.inrupt.com/credentials/v1.jsonld": Inrupt,
  "https://vc.inrupt.com/credentials/v1": vc,
  "https://w3id.org/security/data-integrity/v1": integrity,
  "https://w3id.org/vc-revocation-list-2020/v1": revocation,
  "https://w3id.org/vc/status-list/2021/v1": statusList,
  "https://w3id.org/security/suites/ed25519-2020/v1": ed25519,
} as const;
