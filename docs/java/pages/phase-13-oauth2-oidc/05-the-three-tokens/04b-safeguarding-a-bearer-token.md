---
title: "Because a bearer token cannot prove who is presenting it, every control RFC 6750 offers is a control on not losing it — and the six-line recommendation list in §5.3 is the most under-read checklist in OAuth2"
sidebar_label: "04b · Safeguarding a bearer token"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6750 §5.1 (Security Threats), §5.2 (Threat Mitigation),
> §5.3 (Summary of Recommendations)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6750.txt)); RFC 6749 §10.3 (Access
> Tokens) and §1.6 (TLS Version)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700 §4.9 (Access
> Token Leakage at the Resource Server) and §4.10 (Misuse of Stolen Access Tokens)
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9700.txt)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**[04](04-bearer-tokens-and-the-authorization-header.md) established that a bearer token is
usable by anyone who has it. That single property means there is no detection story and no
recovery story — only a prevention story and a blast-radius story. RFC 6750 §5.3 is the
prevention story, six bullet points long, and in fifteen years of production incidents I
have yet to see one caused by something that is not on that list.**

## TLS is not optional and it is not the AS's problem alone

RFC 6749 §10.3:

> *"Access token credentials (as well as any confidential access token attributes) MUST be
> kept confidential in transit and storage, and only shared among the authorization server,
> the resource servers the access token is valid for, and the client to whom the access token
> is issued. Access token credentials MUST only be transmitted using TLS […] with server
> authentication."*

And RFC 6750 §5.3 puts the same obligation on the client, plus one people skip:

> *"Validate TLS certificate chains: The client MUST validate the TLS certificate chain when
> making requests to protected resources. Failing to do so may enable DNS hijacking attacks
> to steal the token and gain unintended access."*

That second one is aimed squarely at mobile and CLI clients where disabling certificate
validation "for the test environment" is a two-line change that survives into production.
With bearer tokens, a client that does not validate the chain is handing full credentials to
whoever answers the DNS query.

## The recommendations, all of them

RFC 6750 §5.3 is a short checklist and every line of it is load-bearing:

- *"Safeguard bearer tokens: Client implementations MUST ensure that bearer tokens are not
  leaked to unintended parties, as they will be able to use them to gain access to protected
  resources. This is the primary security consideration when using bearer tokens and
  underlies all the more specific recommendations that follow."*
- *"Always use TLS (https): Clients MUST always use TLS […] or equivalent transport security
  when making requests with bearer tokens."*
- *"Don't store bearer tokens in cookies: Implementations MUST NOT store bearer tokens within
  cookies that can be sent in the clear […] Implementations that do store bearer tokens in
  cookies MUST take precautions against cross-site request forgery."*
- *"Issue short-lived bearer tokens: Token servers SHOULD issue short-lived (one hour or
  less) bearer tokens […]"* — expanded in
  [07 · Access-token lifetime](07-access-token-lifetime-as-a-design-decision.md).
- *"Issue scoped bearer tokens: Token servers SHOULD issue bearer tokens that contain an
  audience restriction, scoping their use to the intended relying party or set of relying
  parties."*
- *"Don't pass bearer tokens in page URLs"* — **04b** *(not written yet)*.

The cookie one is subtler than it reads. It is not "never use cookies" — it is "not cookies
that can be sent in the clear", i.e. without `Secure`, and if you do use cookies you inherit
the CSRF problem, because cookies are sent automatically and `Authorization` headers are not.
That is the seed of the whole BFF argument, which is **13 · Sessions vs tokens, honestly**
*(not written yet)*.

## Where tokens actually leak

RFC 9700 §4.9 catalogues the leak paths at the resource server, and the two it names are the
ones people do not plan for:

- **§4.9.1, a counterfeit resource server.** *"An attacker may set up their own resource
  server and trick a client into sending access tokens to it that are valid for other
  resource servers […] If the client sends a valid access token to this counterfeit resource
  server, the attacker in turn may use that token to access other services on behalf of the
  resource owner."* The BCP notes this needs the client to be *late-bound* to the RS URL —
  configured at runtime by a user or administrator rather than fixed at build time. Any
  product with a "your API base URL" setting is in scope.
- **§4.9.2, a compromised resource server.** *"Such a compromise may range from partial
  access to the system, e.g., its log files, to full control."* Read-only access to logs is
  enough, because a bearer token in a log is a live credential.

The countermeasures RFC 9700 §4.9.3 gives are the two structural ones, both `SHOULD`:

> *"Sender-constrained access tokens, as described in Section 4.10.1, SHOULD be used to
> prevent the attacker from replaying the access tokens on other resource servers. If an
> attacker has only partial access to the compromised system, like a read-only access to web
> server logs, sender-constrained access tokens may also prevent replay on the compromised
> system."*

> *"Audience restriction as described in Section 4.10.2 SHOULD be used to prevent replay of
> captured access tokens on other resource servers."*

Plus one that is aimed at your own code:

> *"The resource server MUST treat access tokens like other sensitive secrets and not store
> or transfer them in plaintext."*

That `MUST` catches a surprising amount of real code: caching the raw token as a map key,
putting it in a distributed cache to memoise introspection results, attaching it to a trace
span, or persisting it in a request-audit table. Hash it if you need an identifier
(introspection caching is **14b** *(not written yet)*); do not store
the token.

## Audience restriction is the one control you can deploy today

Of the two structural countermeasures, sender-constraining requires client changes
(see [06 · What a bearer token cannot do](06-what-a-bearer-token-cannot-do.md)). Audience
restriction requires only AS configuration and a validator on the resource server. RFC 9700
§4.10.2:

> *"Audience restriction essentially restricts access tokens to a particular resource server.
> The authorization server associates the access token with the particular resource server,
> and the resource server is then supposed to verify the intended audience. If the access
> token fails the intended audience validation, the resource server refuses to serve the
> respective request."*

And the detail that makes it a *phishing* defence rather than just hygiene:

> *"The audience can be expressed using logical names or physical addresses (like URLs). To
> prevent phishing, it is necessary to use the actual URL the client will send requests to.
> In the phishing case, this URL will point to the counterfeit resource server. If the
> attacker tries to use the access token at the legitimate resource server (which has a
> different URL), the resource server will detect the mismatch (wrong audience) and refuse to
> serve the request."*

The cost is stated too, and it is the reason teams resist it: *"since every access token is
bound to a specific resource server, the client also needs to obtain a single resource
server-specific access token when accessing several resource servers."* One token per API,
not one token for everything. The "one token for everything" shape is precisely the internal
god-token anti-pattern owned by **12 · Token relay across microservices** *(not written
yet)*.

RFC 9700 §2.3 states the general principle it sits under:

> *"The privileges associated with an access token SHOULD be restricted to the minimum
> required for the particular application or use case."*

and

> *"In particular, access tokens SHOULD be audience-restricted to a specific resource server
> or, if that is not feasible, to a small set of resource servers."*

Configuring the resource-server side of that check — a custom `OAuth2TokenValidator` for
`aud` — is **08 · Spring Security as resource server** *(not written yet)*.

## A redaction rule you can actually enforce

The "do not log the token" rule fails because it depends on every developer remembering. Make
it structural: redact at the framework boundary, and assert it in a test.

```java
// A filter-level allowlist beats a per-log-statement rule, because it survives
// the next person adding a request dump.
private static final Set<String> REDACTED_HEADERS =
        Set.of("authorization", "proxy-authorization", "cookie", "dpop");

static Map<String, String> loggableHeaders(HttpServletRequest request) {
    return Collections.list(request.getHeaderNames()).stream()
            .collect(Collectors.toMap(
                    Function.identity(),
                    name -> REDACTED_HEADERS.contains(name.toLowerCase(Locale.ROOT))
                            ? "<redacted>"
                            : request.getHeader(name)));
}
```

Note `dpop` in the set: a DPoP proof is a signed JWT bound to a specific request, so it is
less dangerous than a bearer token, but it still identifies the key and belongs out of logs.

The same discipline applies to exception messages. A token that appears in
`OAuth2AuthenticationException`'s description ends up in a stack trace, and stack traces end
up in error trackers run by third parties.

## Gotchas

**★ A bearer token in a log line is a live credential until it expires.**
Not "a security concern" — a working credential that anyone with log access can replay
against your API. This is why access-token lifetime is a real control and not a formality,
and it is why request-logging middleware must redact `Authorization` before anything else.

**★ `Authorization` is not forwarded across redirects by well-behaved HTTP clients, and is by
some others.**
If your API 301s or 307s to another host, a client that forwards the header has just sent
your token to that host. Check your HTTP client's redirect policy. Java's `HttpClient` drops
`Authorization` on cross-origin redirects; not every library does.

**★ "We're internal, so plain HTTP is fine" is wrong specifically because the token is a
bearer token.**
The token grants the same access to whoever reads it off the wire, and inside a cluster the
set of things that can read the wire is larger than people assume — sidecars, mesh proxies,
packet captures, misconfigured span exporters. RFC 6749 §10.3 makes TLS a `MUST` with no
"internal network" exception.

**★ Disabling TLS verification in a client is worse than it looks with bearer tokens.**
RFC 6750 §5.3 calls out DNS hijacking specifically. Without chain validation the client will
happily hand a full-privilege credential to an impostor, and — unlike a password — the
impostor can use it immediately without any further interaction with the user.

**★ The `MUST NOT store or transfer in plaintext` rule catches your introspection cache.**
RFC 9700 §4.9.3 binds the resource server. The obvious implementation of an introspection
cache — a `Map` keyed by the raw token value, or worse a Redis entry — stores a live
credential in a data store with a different threat model. Key the cache by a SHA-256 of the
token instead; you lose nothing and the cache stops being a credential store.

**★ Audience restriction only defends you if you actually validate `aud`.**
Issuing audience-restricted tokens is the AS's half. A resource server that validates
signature, issuer and expiry but not audience gets none of the benefit, and will happily
accept a token minted for a different API of the same issuer. Spring's
`JwtValidators.createDefaultWithIssuer` does not validate audience for you — that is a
validator you add.

**★ "We'll add sender-constraining later" quietly means "never".**
It requires coordinated changes at the AS, the client and every resource server, plus key
management on the client. Audience restriction is the control you can ship this quarter, and
RFC 9700 §4.9.3 lists both as `SHOULD` precisely because it expects deployments to pick what
they can operate.

**★ An error tracker is an exfiltration path for tokens.**
Exception messages and request context uploaded to a third-party error service will contain
`Authorization` headers unless you configured the scrubber. Check it; the default scrubbers
in most SDKs cover passwords and card numbers and not always bearer tokens.

## Interview questions

**★ Your API is behind a gateway that terminates TLS. Is the bearer requirement satisfied?**
Only if the hop between the gateway and the API is also protected. RFC 6749 §10.3's `MUST`
applies to the credential in transit, not to "the internet-facing leg". A token traversing
plaintext HTTP inside a cluster is readable by anything on that path, and it is a full
credential. Either run mTLS or in-mesh TLS on the internal hop, or terminate authorization
at the gateway and do not forward the token at all — which is the design question owned by
**12 · Token relay across microservices** *(not written yet)*.

**★ A team wants to put the access token in a cookie so the browser sends it automatically.
What does RFC 6750 say and what is the real problem?**
§5.3 says *"Implementations MUST NOT store bearer tokens within cookies that can be sent in
the clear […] Implementations that do store bearer tokens in cookies MUST take precautions
against cross-site request forgery."* So it is not banned, it is conditioned: `Secure` is
mandatory, and you have just acquired a CSRF problem you did not have with an
`Authorization` header, because cookies are attached by the browser automatically on
cross-site requests and headers are not. Once you are handling `SameSite`, CSRF tokens and
cookie flags, you are building a session — which may well be the right answer, and is the
argument in **13 · Sessions vs tokens, honestly** *(not written yet)*.

**★ RFC 9700 gives two structural countermeasures for stolen access tokens. What are they,
and which would you deploy first?**
Sender-constraining (§4.10.1 — bind the token to a key the client holds, via mTLS per RFC
8705 or DPoP per RFC 9449) and audience restriction (§4.10.2 — bind the token to one resource
server, which then verifies `aud`). Audience restriction first, in almost every case: it
needs configuration at the AS and one validator at each resource server, with no change to
clients, and it defends the two scenarios §4.9 names — a counterfeit resource server and a
compromised one — by making a captured token useless anywhere else. Sender-constraining is
strictly stronger, because it also defends replay *at the same* resource server, but it
requires coordinated client, AS and RS changes and client-side key storage. The cost of
audience restriction is that a client talking to three APIs needs three tokens.

**★ Your resource server caches introspection results keyed by the token string, in Redis.
What is wrong?**
You have copied a live bearer credential into a datastore that almost certainly has a
different access-control and backup policy than your application, and RFC 9700 §4.9.3 is
explicit: *"The resource server MUST treat access tokens like other sensitive secrets and not
store or transfer them in plaintext."* Anyone with Redis access — an operator, a backup, a
misconfigured `KEYS *` — now has working credentials for every active session. The fix costs
one line: key the cache by a SHA-256 hash of the token value. The cache behaves identically
and no longer holds credentials. Separately, cap the entry's TTL by the token's `exp`, which
RFC 7662 §4 requires: *"If the response contains the `exp` parameter (expiration), the
response MUST NOT be cached beyond the time indicated therein."*

**★ Why does RFC 9700 call out "read-only access to web server logs" as sufficient for a
resource-server compromise?**
Because a bearer token in a log line is not a trace of a credential — it *is* the credential,
usable until it expires by anyone who reads it. §4.9.2 makes the point that a compromise
*"may range from partial access to the system, e.g., its log files, to full control"*, and
the log-file case is the common one: log shipping, log aggregation vendors, support engineers
with read access, an exposed debug endpoint. It is also the case sender-constrained tokens
help with even after compromise, since a logged token without the corresponding key is
useless.

{/* FOOTER */}
