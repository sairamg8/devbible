---
title: "The authorization server's half of PKCE is three obligations — store the challenge with the code, demand the verifier at redemption, and refuse to accept a verifier for a code that never had a challenge — and a server that implements only the first two is the reason downgrade attacks work"
sidebar_label: "08 · Server-side verification"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7636 §4.4 (Server Associates the Code Challenge with the
> Authorization Code), §4.4.1 (Error Response), §4.5 (Client Sends the Authorization Code and
> the Code Verifier to the Token Endpoint), §4.6 (Server Verifies code_verifier before
> Returning the Tokens), §5 (Compatibility)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 9700 §2.1.1, §4.8.2 (PKCE Downgrade — Countermeasures)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 8414 §2 (Authorization Server Metadata)
> ([datatracker.ietf.org/doc/html/rfc8414](https://datatracker.ietf.org/doc/html/rfc8414)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**A client can implement PKCE perfectly against a server that ignores it and get exactly zero
security, and nothing in the flow will tell you. That asymmetry is why understanding the
server's obligations matters even when you are only writing clients: it tells you what to
check about the authorization server before you rely on PKCE, and it tells you which of the
two parties a given failure belongs to.**

## The three obligations, quoted

**At the authorization endpoint** — RFC 7636 §4.4:

> *"The server MUST associate the `code_challenge` and `code_challenge_method` values with the
> authorization code so it can be verified later."*

Note *both* values. A server that stores the challenge but not the method cannot know which
transform to apply and will guess — usually `plain`, per §4.3's default, which turns every
`S256` client into a broken one, or `S256`, which silently upgrades and then rejects real
`plain` clients.

**At the token endpoint** — RFC 7636 §4.6:

> *"The server verifies the `code_verifier` by calculating the code challenge from the received
> `code_verifier` and comparing it with the previously associated `code_challenge`, after first
> transforming it according to the `code_challenge_method` method specified by the client."*
>
> *"If the `code_challenge_method` from Section 4.3 was `S256`, the received `code_verifier` is
> hashed by SHA-256, base64url-encoded, and then compared to the `code_challenge`, i.e.:
> `BASE64URL-ENCODE(SHA256(ASCII(code_verifier))) == code_challenge`"*
>
> *"If the `code_challenge_method` from Section 4.3 was `plain`, they are compared directly,
> i.e.: `code_verifier == code_challenge`"*
>
> *"If the values are equal, the token endpoint MUST continue processing as normal (as defined
> by OAuth 2.0). If the values are not equal, an error response indicating `invalid_grant` MUST
> be returned."*

**Rejecting a verifier for a challenge-less code** — RFC 9700 §4.8.2:

> *"Authorization servers MUST ensure that if there was no `code_challenge` in the authorization
> request, a request to the token endpoint containing a `code_verifier` is rejected."*

That third one is not in RFC 7636 at all. It was added by the BCP because RFC 7636 §5's
backward-compatibility allowance —

> *"Server implementations of this specification MAY accept OAuth 2.0 clients that do not
> implement this extension. If the `code_verifier` is not received from the client in the
> Authorization Request, servers supporting backwards compatibility revert to the OAuth 2.0
> protocol without PKCE."*

— creates exactly the hole the downgrade attack exploits. See
[09 · The PKCE downgrade attack](09-the-pkce-downgrade-attack.md).

## The complete decision table

Four states, and every real server must handle all four:

| `code_challenge` at authz | `code_verifier` at token | Correct server behaviour |
|---|---|---|
| present | present, matches | Issue tokens. |
| present | present, does not match | `invalid_grant` (RFC 7636 §4.6). |
| present | absent | `invalid_grant` — RFC 9700 §2.1.1: *"the authorization server MUST enforce the correct usage of `code_verifier` at the token endpoint"*. |
| absent | present | Reject — RFC 9700 §4.8.2. |
| absent | absent | Legacy non-PKCE flow. Permitted by RFC 7636 §5; forbidden for public clients by RFC 9700 §2.1.1. |

Notice that three of the five rows fail, and that RFC 7636 alone only mandates two of those
three. This is the gap the BCP closes.

## The one authorization-endpoint error

RFC 7636 §4.4.1:

> *"If the server requires Proof Key for Code Exchange (PKCE) by OAuth public clients and the
> client does not send the `code_challenge` in the request, the authorization endpoint MUST
> return the authorization error response with the `error` value set to `invalid_request`."*

with a recommended description of *"code challenge required"*, and the same `invalid_request`
with *"transform algorithm not supported"* for an unrecognised `code_challenge_method`.

So there are exactly two places PKCE can fail, and they look completely different:

- **Authorization endpoint**, `invalid_request`, delivered as a redirect to your
  `redirect_uri`: the challenge was missing or the method was unsupported. You never got a
  code.
- **Token endpoint**, `invalid_grant`, delivered as an HTTP 400 JSON body: the verifier did not
  match, was missing, or was present when it should not have been. You had a code and it is now
  spent.

## What a client should check about the server

You cannot audit someone else's authorization server, but you can check three things from
outside:

**1 · Does its metadata advertise PKCE?** RFC 9700 §2.1.1:

> *"Authorization servers MUST provide a way to detect their support for PKCE. It is
> RECOMMENDED for authorization servers to publish the element
> `code_challenge_methods_supported` in their Authorization Server Metadata [RFC8414]
> containing the supported PKCE challenge methods (which can be used by the client to detect
> PKCE support)."*

Fetch `/.well-known/oauth-authorization-server` or `/.well-known/openid-configuration` and look
for `code_challenge_methods_supported` containing `S256`. Its *absence* is the signal that you
cannot rely on PKCE's CSRF property and must therefore use `state` — see
[10b · `state` vs PKCE](10b-state-vs-pkce.md).

**2 · Does it actually enforce the verifier?** The negative test is the informative one: start a
flow with a `code_challenge`, then attempt the token exchange *without* a `code_verifier`. A
conforming server returns `invalid_grant`. A server that issues tokens has PKCE as decoration.
This is a test to run against your own non-production authorization server, or against a
provider's sandbox tenant with their agreement — not against a production system you do not own.

**3 · Does it reject a mismatched verifier?** Same shape, with a deliberately wrong verifier.
Same expected answer.

Both tests belong in whatever integration suite covers your identity provider upgrade path,
because "our IdP changed a default" is a real event.

## Where Spring sits on both sides

As a **client**, Spring Security generates the verifier, sends the challenge and replays the
verifier at the token endpoint; the conditions under which it does so are
**18 · Spring Security client config** *(not written yet)*.

As an **authorization server**, that is Spring Authorization Server, a separate project, and it
belongs to **11 · Running vs buying the AS** *(not written yet)*. The relevant fact here is that
whether you run Keycloak, Spring Authorization Server or a SaaS provider, the three obligations
above are the checklist, and provider defaults differ.

## Gotchas

**★ A server can store the challenge, verify it correctly, and still be exploitable — if it
accepts a `code_verifier` for a code issued without a challenge.**
This is RFC 9700 §4.8.2's requirement, absent from RFC 7636. Servers written against RFC 7636
alone commonly miss it, because from the server's point of view a stray `code_verifier` on a
non-PKCE code looks like a harmless extra parameter.

**★ The comparison must be constant-time, or it is a timing oracle on the challenge.**
The stored `code_challenge` is not a secret in the `S256` case, so this matters less than it
sounds — but in the `plain` case the stored value *is* the verifier, and a byte-at-a-time
`String.equals` leaks it. Use `MessageDigest.isEqual` for the comparison. It is one more reason
`plain` is a bad idea on both sides of the wire.

**★ Storing the challenge without the method breaks one class of client entirely.**
RFC 7636 §4.4 says store both. A server that assumes `S256` breaks conforming `plain` clients;
one that assumes `plain` breaks every `S256` client. Both failures look like a client bug from
the outside because the error is `invalid_grant`.

**★ `invalid_grant` at the token endpoint has five causes and PKCE is only one of them.**
Expired code, used code, wrong client, `redirect_uri` mismatch, PKCE mismatch — all
`invalid_grant` by RFC 6749 §5.2 and RFC 7636 §4.6. Do not conclude "PKCE is broken" from the
error code alone. **20 · Reading the errors** *(not written yet)* is the differential
diagnosis.

**★ RFC 7636 §5's backward compatibility is a server-side allowance, not a client-side
excuse.**
It permits a *server* to keep serving old clients. It does not permit a new client to skip
PKCE, and RFC 9700 §2.1.1 forecloses that for public clients with a MUST.

**★ Metadata is a claim, not a proof.**
`code_challenge_methods_supported: ["S256"]` in a discovery document means the server says it
supports `S256`. It does not prove the server *enforces* the verifier. If you are going to rely
on PKCE for CSRF protection instead of `state`, the negative test above is the evidence, not
the metadata.

**★ A server that returns a distinct error for "verifier mismatch" versus "code expired" is
leaking information.**
RFC 7636 §4.6 says the mismatch response is `invalid_grant` — the same code as every other
grant failure — for exactly this reason. If your own authorization server helpfully
distinguishes them in `error_description`, you have built an oracle that tells an attacker
whether a stolen code is still live.

## Interview questions

**★ What must an authorization server do to implement PKCE correctly?**
Three things. Store both the `code_challenge` and the `code_challenge_method` against the
issued code (RFC 7636 §4.4). At the token endpoint, recompute the challenge from the presented
`code_verifier` using the stored method and compare, returning `invalid_grant` on mismatch or
absence (§4.6, and RFC 9700 §2.1.1's *"the authorization server MUST enforce the correct usage
of `code_verifier` at the token endpoint"*). And reject a token request that carries a
`code_verifier` for a code that was issued without a `code_challenge` (RFC 9700 §4.8.2). The
third is the one that is missing from RFC 7636 and missing from many implementations.

**★ How do you know, as a client developer, that the authorization server is actually enforcing
PKCE?**
Read its metadata for `code_challenge_methods_supported` — RFC 9700 §2.1.1 recommends servers
publish it and says servers *"MUST provide a way to detect their support for PKCE"* — and then
test the negative case in a non-production environment: start a flow with a challenge and
redeem the code without a verifier. A conforming server returns `invalid_grant`; one that hands
you tokens is not enforcing anything. The distinction matters concretely because RFC 9700 §2.1
lets you drop `state` only if you have *ensured* the server supports PKCE, and "the docs say so"
is not ensuring.

**★ Why does RFC 7636 §5 allow servers to accept clients that do not implement PKCE, and what
did that cost?**
Because PKCE was published three years after RFC 6749 into an ecosystem of deployed clients, and
a hard cut would have been unadoptable. The cost is the downgrade attack: if a server silently
falls back to non-PKCE behaviour when the challenge is absent, an attacker who can modify the
authorization request simply strips the challenge and the server issues an unbound code. RFC
9700 §4.8.2 patches it by requiring the server to reject a `code_verifier` when no
`code_challenge` was present, and §2.1.1 requires servers to *"mitigate PKCE downgrade
attacks"* outright.

**★ Why is every PKCE failure at the token endpoint reported as `invalid_grant` rather than
something specific?**
Because a specific error is an oracle. If the server distinguished "your verifier is wrong"
from "that code has expired" from "that code was already used", an attacker holding a stolen
code could learn whether it is still live and whether the legitimate client has redeemed it,
and could probe verifier guesses distinguishably from other failures. RFC 7636 §4.6 mandates
`invalid_grant` specifically, which is the same code RFC 6749 §5.2 already uses for every other
grant problem. The cost is that debugging is harder, which is why the differential diagnosis is
a page of its own.

**★ Should the server's comparison of challenge and verifier be constant-time?**
Yes, and use `MessageDigest.isEqual` rather than `String.equals` or `Arrays.equals` on the
decoded bytes. For `S256` the stored challenge is a public digest, so the leak is small; for
`plain` the stored challenge *is* the verifier, and a timing side channel on a byte-at-a-time
comparison would let an attacker recover it. It costs nothing to do correctly and it removes a
whole argument about whether the leak matters.

{/* FOOTER */}
