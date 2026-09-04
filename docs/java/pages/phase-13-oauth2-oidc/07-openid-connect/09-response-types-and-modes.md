---
title: "OIDC defines seven response types and you should use one of them, and the reason the other six exist is a browser-era problem — no cross-origin requests from JavaScript — that stopped being a problem before most of the code copying them was written"
sidebar_label: "09 · Response types and modes"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against OpenID Connect Core 1.0 §3.1.2.1 (`response_type` — *"When
> using the Authorization Code Flow, this value is `code`"*) and §2 (the ID Token claim
> table), at
> [openid.net/specs/openid-connect-core-1_0.html](https://openid.net/specs/openid-connect-core-1_0.html);
> OpenID Connect Discovery 1.0 §3 (`response_types_supported`), at
> [openid.net/specs/openid-connect-discovery-1_0.html](https://openid.net/specs/openid-connect-discovery-1_0.html);
> RFC 6749 §4.2 (Implicit Grant), §3.1.2 (Redirection Endpoint)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700
> §2.1.2 — *"Clients SHOULD NOT use the implicit grant (response type `token`) or other
> response types issuing access tokens in the authorization response"*
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.
> **No sandbox** — quoted specification text and illustrative URL constructions; no captured
> requests or responses.

**There is one answer — `response_type=code` — and this page exists so you can say why, and
so you recognise the other six when you meet them in a provider's console, an old integration
or a blog post. The whole family is a response to a constraint that has been gone for a
decade: a browser-resident application could not make a cross-origin call to a token
endpoint, so the protocol was bent to deliver tokens through the redirect itself. CORS made
that unnecessary, PKCE made the code flow safe for public clients, and RFC 9700 §2.1.2 now
says clients SHOULD NOT use the response types that put an access token in the authorization
response. What remains is a large amount of code and documentation that predates all three.**

The second thing this page is for is the distinction people conflate: **`response_type` says
*what* comes back; `response_mode` says *how* it is delivered.** They are separate parameters
with separate failure modes, and the `form_post` mode is a genuinely useful piece of the
protocol that has nothing to do with the hybrid flows it is usually mentioned alongside.

## The seven response types

| `response_type` | Returns in the authorization response | Verdict |
|---|---|---|
| `code` | an authorization code | ✅ **Use this** |
| `id_token` | an ID token, in the fragment | ⚠️ no access token, so §2.1.2's letter does not bite — but a credential in a URL |
| `id_token token` | an ID token **and** an access token | 🔴 SHOULD NOT — §2.1.2 |
| `token` | an access token (plain OAuth2 implicit) | 🔴 SHOULD NOT — §2.1.2, and RFC 6749 §4.2 is the grant it names |
| `code id_token` | a code **and** an ID token (hybrid) | ⚠️ front-channel ID token; extra complexity for no benefit you need |
| `code token` | a code **and** an access token (hybrid) | 🔴 SHOULD NOT — access token in the response |
| `code id_token token` | all three (hybrid) | 🔴 SHOULD NOT |

RFC 9700 §2.1.2's wording is worth reading precisely, because getting it wrong is itself a
review finding:

> *"Clients SHOULD NOT use the implicit grant (response type `token`) or other response types
> issuing access tokens in the authorization response."*

It is a **SHOULD NOT**, not a MUST NOT — and it is aimed at *response types issuing access
tokens*. The password grant is the one carrying a MUST NOT, in §2.4. `id_token`-only response
types are not literally covered by that sentence, which is why they survive in some
specialised flows; they still put a signed identity assertion into a URL fragment, which
lands in browser history and in anything that reads the address bar.

## Why the fragment, and why that was the point

In the implicit family the credential comes back in the URL **fragment** —
`https://app.example.com/callback#id_token=...&access_token=...` — not the query string. That
was deliberate: a fragment is not sent to the server, so the token never appears in the web
server's access log. It is visible to JavaScript on the page, which was the entire delivery
mechanism.

Everything wrong with it follows from the same fact:

- It is in the **address bar**, and therefore in browser history and in anything the user
  pastes.
- It is available to **every script on the page**, including a compromised dependency.
- It cannot be **client-authenticated**, because there is no back-channel call in which a
  confidential client could prove itself.
- The token is delivered **before** the client has done anything to prove the response belongs
  to its flow, which is why `nonce` matters so much more here than in the code flow.

The code flow avoids all four by putting a *useless-on-its-own* value in the redirect and
doing the real exchange over an authenticated back channel — the argument in
[03 · Authorization code + PKCE](../03-authorization-code-pkce/README.md).

## `response_mode` — how the response is delivered

Separate parameter, three values in common use:

| `response_mode` | Delivery | Typical use |
|---|---|---|
| `query` | parameters on the redirect URL | the default for `response_type=code` |
| `fragment` | after `#` | the default for the implicit family |
| `form_post` | an auto-submitting HTML form POSTing to your redirect URI | keeps credentials out of the URL entirely |

**`form_post` is the useful one.** It is the answer to "we must use a hybrid flow for a
provider-specific reason, and we do not want an ID token in the address bar": the response
arrives as POST body parameters, so it is never in the URL, never in history, and never in a
`Referer` header. It costs you a POST endpoint at your redirect URI and, if you use
`SameSite=Lax` cookies, a real problem — a cross-site **POST** does not carry a `Lax` cookie,
where the top-level GET navigation of the ordinary code flow does.

```java
// A redirect URI that accepts form_post must handle POST, and the session cookie
// must actually arrive with it — Lax will not send one on a cross-site POST.
@PostMapping(path = "/login/oauth2/code/corp",
             consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
ResponseEntity<Void> callback(@RequestParam String code, @RequestParam String state) { ... }
```

🔴 **That cookie interaction is the trap.** Teams switch to `form_post` for the security
benefit, the `state` lookup then fails because the session cookie was not sent, and the
"fix" applied under time pressure is `SameSite=None` — which is a larger loss than the gain.
If you need `form_post`, plan the cookie policy with it.

## What to do when a provider only offers something else

Check the discovery document first — `response_types_supported` is a REQUIRED member, so the
provider tells you:

```java
List<String> supported = metadata.getResponseTypes();
if (!supported.contains("code")) {
    // Genuinely rare. Escalate as a provider-selection issue, not an implementation one.
    log.error("issuer {} does not advertise the code response type: {}",
            metadata.getIssuer(), supported);
}
```

A provider that does not support `code` in 2026 is a finding to raise, not a constraint to
code around. If you are stuck with a hybrid response type for a genuine reason — some
enterprise IdP profiles still mandate `code id_token` — then use `response_mode=form_post`,
validate the front-channel ID token with the full §3.1.3.7 procedure *including* `nonce`, and
still perform the code exchange for the tokens you actually use.

## Gotchas

**★ A tutorial's `response_type=token` is copied into a new application.**
Symptom: an access token in the address bar and a security review that stops the release.
Cause: material predating CORS, PKCE and RFC 9700. Fix: `response_type=code` with PKCE. There
is no browser-application scenario in 2026 that requires the implicit grant.

**★ "Implicit is banned" is asserted in a review and the reviewer is wrong about the wording.**
Symptom: a correction that undermines the rest of the review. Cause: RFC 9700 §2.1.2 says
**SHOULD NOT** for implicit; the **MUST NOT** in §2.4 belongs to the resource-owner password
credentials grant. Fix: quote the clause you mean. Both grants are to be avoided; only one is
prohibited in the specification's own words.

**★ A fragment response is expected to reach the server.**
Symptom: a callback handler that sees no parameters at all and a redirect that appears to do
nothing. Cause: fragments are never sent in the HTTP request; only JavaScript on the loaded
page can read one. Fix: either read it client-side (which is the implicit design you are
trying to leave) or switch to `code` with `response_mode=query`.

**★ `response_mode=form_post` is enabled and every login fails on `state`.**
Symptom: "invalid state" on every attempt, only after switching modes. Cause: the callback is
now a cross-site POST, and a `SameSite=Lax` session cookie is not sent on it — so the stored
`state` cannot be found. Fix: decide the cookie strategy alongside the mode. Weakening to
`SameSite=None` to make it work trades a large protection for a smaller one.

**★ The redirect URI handles only GET after moving to `form_post`.**
Symptom: 405 Method Not Allowed at the callback. Cause: the response is now an HTTP POST from
an auto-submitting form. Fix: accept `application/x-www-form-urlencoded` POST at the same
path.

**★ A hybrid flow's front-channel ID token is trusted without validation.**
Symptom: an authentication that can be forged by anyone who can craft a redirect. Cause:
treating the front-channel `id_token` as pre-verified because "it came from the provider".
Fix: §3.1.3.7 applies in full, and rule 5's permission to skip the signature explicitly does
**not** apply here — it is scoped to tokens received by direct communication with the token
endpoint. See [03b · Signature, time and the rest](03b-signature-time-and-the-conditional-checks.md).

**★ `response_type` values are joined with `+` or `,`.**
Symptom: `unsupported_response_type` from the authorization endpoint. Cause: multi-valued
response types are **space-separated** and then URL-encoded — `code%20id_token`. A literal `+`
in a query string is a space in `application/x-www-form-urlencoded` and is a frequent source
of confusion; `,` is simply wrong. Fix: build the URL with a proper encoder rather than by
concatenation.

**★ `response_types_supported` is ignored and the request fails before any user sees a
screen.**
Symptom: an error page at the authorization endpoint on the first attempt of an integration.
Cause: assuming a response type the provider does not offer. Fix: read the REQUIRED discovery
member; it exists precisely to answer this.

**★ A hybrid flow is adopted for "faster perceived login".**
Symptom: extra complexity, a front-channel token to validate, and no measurable benefit.
Cause: the historical rationale — getting an ID token before the back-channel round trip —
applied to an era of much slower networks and no CORS. Fix: use `code`; the exchange is one
request on an already-warm connection.

**★ The implicit flow is kept "because the SPA cannot keep a secret".**
Symptom: an argument that was true and is now irrelevant. Cause: conflating *confidential
client* with *code flow*. Fix: a public client uses the code flow **with PKCE** — RFC 9700
§2.1.1 makes PKCE a MUST for public clients precisely so the code flow works without a secret.

## Interview questions

**★ Why does the implicit flow exist at all, and why is it obsolete?**
It exists because browser-resident applications originally could not make a cross-origin
request to a token endpoint, so the protocol delivered tokens through the redirect itself, in
the URL fragment where a web server would not log them. Three things removed the need: CORS
made the back-channel call possible from JavaScript, PKCE made the code flow safe for a client
that cannot hold a secret, and RFC 9700 §2.1.2 now says clients SHOULD NOT use response types
that issue access tokens in the authorization response. What is left is a credential in the
address bar, readable by every script on the page, with no client authentication.

**★ State the normative position on implicit and on the password grant precisely.**
RFC 9700 §2.1.2: *"Clients SHOULD NOT use the implicit grant (response type `token`) or other
response types issuing access tokens in the authorization response."* RFC 9700 §2.4: the
resource owner password credentials grant *"MUST NOT be used"*. So implicit is a SHOULD NOT
and the password grant is a MUST NOT — different force, and quoting the stronger one over
implicit is an error a careful reviewer will catch.

**★ What is the difference between `response_type` and `response_mode`?**
`response_type` says *what* the authorization endpoint returns — a code, an ID token, an access
token, or a combination. `response_mode` says *how* it is delivered — as query parameters, in
the URL fragment, or as an auto-submitting HTML form POST. They vary independently: you can
have `response_type=code` with `response_mode=form_post`, and that combination is a reasonable
choice for keeping even the code out of the URL.

**★ When would you actually use `form_post`?**
When the response must not appear in the URL at all — because the redirect URI is logged
somewhere you do not control, because you are forced into a hybrid response type that would
otherwise put an ID token in the address bar, or because of a `Referer`-leakage concern on the
callback page. The cost to plan for is the cookie policy: the callback becomes a cross-site
POST, which a `SameSite=Lax` cookie will not accompany, and the wrong reaction to that failure
is to weaken the cookie to `None`.

**★ Your enterprise IdP mandates `code id_token`. What do you do?**
Accept it and tighten around it: set `response_mode=form_post` so the front-channel ID token
is never in the URL, validate that ID token with the complete §3.1.3.7 procedure including the
`nonce` check — noting that rule 5's permission to rely on TLS instead of the signature does
not apply, because the token did not arrive by direct communication with the token endpoint —
and still perform the code exchange for the tokens you actually use. Then record why the
non-default response type was chosen, because the next person will ask.

**★ A fragment-delivered token never reaches your server. Is that a bug or a feature?**
A feature, and it is the reason the fragment was chosen. Fragments are stripped by the browser
before the request is sent, so the credential never appears in a web server's access log. The
trade is that it is instead in the address bar, in browser history, and readable by every
script on the page — which is a worse exposure surface for anything except a pure
JavaScript-resident client, and that is the client type PKCE removed the need for.

**★ How do you find out which response types a provider supports?**
`response_types_supported` in its discovery document — a REQUIRED member of the OpenID Provider
Metadata, so every conforming provider publishes it. If `code` is not in that list, the finding
belongs in a provider-selection conversation rather than in your client code.

---

← [`sub` is not an email](08-sub-is-not-an-email.md) · [Topic index](README.md) · Next → **Logout** *(not written yet)*
