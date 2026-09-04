---
title: "The authorization code flow is the only grant you need to know cold, and the reason it takes twenty chunks is that every parameter in it is a defence against a named attack that killed a simpler design"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against RFC 6749 §3.1 (Authorization Endpoint), §3.1.2 (Redirection
> Endpoint), §4.1–§4.1.4 (Authorization Code Grant), §4.2 (Implicit Grant), §5.2 (Error
> Response), §10.6 (Authorization Code Redirection URI Manipulation), §10.12 (CSRF)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7636 §4,
> §7.1, §7.3, Appendices A–B (PKCE)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 9700 §2.1, §2.1.1, §2.1.2, §4.1, §4.4, §4.5 (Security BCP)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 8252 (OAuth 2.0 for Native Apps)
> ([datatracker.ietf.org/doc/html/rfc8252](https://datatracker.ietf.org/doc/html/rfc8252));
> RFC 3986 §2.3, §6.2.1 ([rfc-editor.org/rfc/rfc3986](https://www.rfc-editor.org/rfc/rfc3986.txt)).
> Target: **JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x**.
> **No sandbox** — these pages carry Java source, config and specification-quoted field
> definitions, never a fabricated HTTP transcript or a real token.

**Every other grant in OAuth2 is either a special case of this one or a mistake the working
group has since apologised for. The authorization code flow is two conversations that never
touch: a front-channel redirect through the user's browser that carries a one-time reference,
and a back-channel server-to-server call that trades that reference for tokens. Nothing
secret ever travels on the channel that is public, and nothing the browser can see is worth
stealing on its own. Learn that split and the flow stops being a diagram to memorise and
becomes a thing you can re-derive from first principles at a whiteboard.**

The reason this topic runs to twenty chunks is that the split alone is not enough. A code in
a redirect is worthless *only if* the party redeeming it can prove it started the exchange —
which is what PKCE does, and PKCE has its own downgrade attack. A callback endpoint is safe
*only if* it can tell a response it asked for from one an attacker pushed at it — which is
what `state` does, and `state` defends a different attack from PKCE, at a different endpoint,
checked by a different party. And all of it collapses if the authorization server will hand
the code to an address the attacker controls, which is why redirect-URI matching is a
character-for-character string comparison with exactly one exception in the whole
specification. Each of those is a chunk, and each names the attack that made it necessary.

**20 chunks, ~4,711 lines.** Read in order — chunk 01 is the map the rest fills in.

## Chunks

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The flow end to end](01-the-flow-end-to-end.md)** | <span className="db-tier t-master">Master</span> | Two channels with different security properties; almost every OAuth2 defect is a confusion about which one a thing belongs to |
| 2 | **[Why a code at all](01b-why-a-code-at-all.md)** | <span className="db-tier t-master">Master</span> | A redirect URL is a public document — the flow's cleverness is that what it publishes is worthless to everyone but the party that started the exchange |
| 3 | **[The authorization request](02-the-authorization-request.md)** | <span className="db-tier t-master">Master</span> | Seven front-channel parameters, each a routing decision, a scoping decision or a binding — and what the AS therefore can and cannot verify |
| 4 | **[When a parameter is wrong](02b-when-a-parameter-is-wrong.md)** | <span className="db-tier t-master">Master</span> | 🔴 The authorization endpoint has **two** error behaviours depending on whether it trusts the redirect URI — error page vs error in a query string |
| 5 | **[The authorization code](03-the-authorization-code.md)** | <span className="db-tier t-master">Master</span> | Short life, single use, client binding, reuse-triggered revocation — four normative properties, each of which some deployment you will meet has dropped |
| 6 | **[The token exchange](04-the-token-exchange.md)** | <span className="db-tier t-master">Master</span> | The only authenticated hop: five independent checks in one request, every failure reported as the same error code |
| 7 | **[Client authentication](04b-client-authentication.md)** | <span className="db-tier t-master">Master</span> | Secret in a header vs secret in a body vs an asymmetric assertion — a choice about who else could ever hold that credential |
| 8 | **[The interception attack](05-the-interception-attack.md)** | <span className="db-tier t-master">Master</span> | 🔴 On mobile a redirect URI is a *claim on a name*, not a network address, and the OS hands your code to whoever else claimed it |
| 9 | **[The `code_verifier`](06-the-code-verifier.md)** | <span className="db-tier t-master">Master</span> | 43–128 characters, unreserved only, 256 bits of entropy, fresh per request — each constraint defeats a specific attack, not a style guide |
| 10 | **[S256 vs plain](07-s256-vs-plain.md)** | <span className="db-tier t-master">Master</span> | 🔴 Not a performance trade-off but the difference between PKCE and no PKCE — and `plain` is the *default* when you omit the method |
| 11 | **[Server-side verification](08-server-side-pkce-verification.md)** | <span className="db-tier t-master">Master</span> | The AS owes three obligations; a server that implements only the first two is why downgrade attacks work |
| 12 | **[The PKCE downgrade attack](09-the-pkce-downgrade-attack.md)** | <span className="db-tier t-master">Master</span> | A parameter a server treats as optional is a parameter an attacker can delete |
| 13 | **[What `state` defends](10-what-state-defends.md)** | <span className="db-tier t-master">Master</span> | A CSRF problem, not a code-theft problem — and the spec puts the MUST on the *protection*, not on the parameter |
| 14 | **[`state` vs PKCE](10b-state-vs-pkce.md)** | <span className="db-tier t-master">Master</span> | Different parties, different endpoints, different stored values — and the one narrow conditional overlap RFC 9700 grants |
| 15 | **[Code injection](11-authorization-code-injection.md)** | <span className="db-tier t-master">Master</span> | Every AS check passes, because the attacker is not impersonating your client — they are *using* it as the instrument of redemption |
| 16 | **[Redirect URI exact matching](12-redirect-uri-exact-matching.md)** | <span className="db-tier t-master">Master</span> | Every pattern-matching scheme anyone shipped has been broken; RFC 9700 replaced them all with simple string comparison |
| 17 | **[Native apps and loopback](12b-native-apps-and-loopback.md)** | <span className="db-tier t-master">Master</span> | Three ways a native app receives a redirect, differing by who the OS will believe — and the single exception to exact matching |
| 18 | **[The mix-up attack](13-the-mix-up-attack.md)** | <span className="db-tier t-master">Master</span> | A valid code sent to a valid token endpoint at the *wrong* AS; neither `state` nor PKCE notices, because the client never checked who answered |
| 19 | **[Replay and idempotency](14-code-replay-and-idempotency.md)** | <span className="db-tier t-master">Master</span> | Single-use makes your callback a non-idempotent public GET, and your infrastructure assumes GETs can be repeated |
| 20 | **[Referrer and history leakage](15-referrer-and-history-leakage.md)** | <span className="db-tier t-master">Master</span> | The code lands in history, `Referer`, access logs and APM traces by default — every countermeasure lives in *your* callback response |

## The six things this topic is really about

**1 · The channel split is the whole design.** Front channel = the browser, and everything on
it is visible in the address bar, in `Referer`, in history, in proxy logs and to other apps on
the device. Back channel = your server to the token endpoint over TLS, authenticated. The
authorization *code* is the only thing that crosses from one to the other, and it is designed
to be useless to whoever reads it off the public channel. Every question of the form "can I
put X in the redirect?" is answered by asking which channel X belongs on.

**2 · PKCE and `state` are not alternatives, and confusing them is the most common review
finding in this topic.** PKCE binds the *code* to the client instance that started the flow;
it is checked by the **authorization server**, at the **token endpoint**, against a challenge
stored beside the code. `state` binds the *authorization response* to a session that asked for
it; it is checked by the **client**, at the **redirect endpoint**, against a value in the
user's session. One stops a stolen code being redeemed; the other stops your callback being
fed a response nobody asked for. RFC 9700 §2.1.1 grants a narrow conditional overlap and
almost nobody reads it to the end — chunk 14 does.

**3 · The dangerous defaults are defaults, not bugs.** `code_challenge_method` defaults to
`plain` when omitted (RFC 7636 §4.3), which is PKCE that defends nothing against an attacker
who can read the authorization request. An AS that accepts a token request with no
`code_verifier` for a code that *had* a challenge silently reverts every client to no PKCE at
all. Both are chunks 10–12, and both are "the code works, and the protection is off".

**4 · Exact string matching is the one place the specification refuses to be flexible.**
RFC 9700 §2.1: authorization servers *"MUST utilize exact string matching except for port
numbers in `localhost` redirection URIs of native apps"*. That single exception exists because
a native app cannot reserve a loopback port in advance (RFC 8252). Everything else — prefix
matching, wildcard subdomains, "starts with our domain" — has a published break.

**5 · Implicit is dead by a *different word* than the password grant, and quoting the wrong
one is itself a defect.** RFC 9700 §2.1.2 says clients **SHOULD NOT** use the implicit grant;
§2.4 says the resource owner password credentials grant **MUST NOT** be used. Both are
covered here as history plus the attack that killed each — see the two chunks still owed
below.

**6 · The leaks that survive a correct flow are yours to close.** Nothing the authorization
server does can keep the code out of the user's browser history, out of a `Referer` header
sent by a third-party script on your callback page, out of your own access logs or out of an
APM trace. Chunk 20 is the countermeasure list, and every item on it is something you write
in your own callback handler.

## Still owed in this topic

Two chunks are named in the prose of chunks 01, 03 and 06 and are not written yet:

- **16 · The implicit grant** *(not written yet)* — the grant RFC 9700 §2.1.2 says clients
  SHOULD NOT use, the token-in-fragment leak that killed it, and what to do with the
  provider that still offers it.
- **17 · The password grant** *(not written yet)* — RFC 9700 §2.4's MUST NOT, the five
  failures from topic 01 that it re-creates, and the migration path off it.

Three further chunks are referenced as future work by the original author and are **not**
part of this topic's close: **18 · Spring Security client config** belongs to topic
**09 · Spring as OAuth2 client** *(not written yet)*, while **19 · Where the defaults leave
you exposed** and **20 · Reading the errors** are candidates for extension.

## Phase gate

You are done with this topic when you can draw both channels from memory, name every
parameter that goes up on the authorization request and say what the AS can verify about
each, state which of `state` and PKCE is checked by whom and against what, and explain why
`code_challenge_method=plain` is worse than useless without looking anything up.

## Where this connects

- [01 · Why OAuth2 exists](../01-why-oauth2-exists/README.md) — the five failures this flow
  is an answer to.
- [02 · The four roles](../02-the-four-roles/README.md) — confidential vs public clients,
  which decides whether PKCE is a MUST or a RECOMMENDED for you.
- [04 · Client credentials](../04-client-credentials/README.md) — the same exchange with the
  user, the redirect and the refresh token removed.
- **05 · The three tokens** — what comes back from the exchange and how long each piece lives.
- **06 · JWT anatomy and validation** — the wire format the `access_token` often, but not
  necessarily, arrives in.

---

Start → [The flow end to end](01-the-flow-end-to-end.md)
