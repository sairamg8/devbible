---
title: "Every pattern-matching scheme for redirect URIs that anyone has shipped has been broken by somebody, which is why RFC 9700 replaced a decade of prefix rules and wildcard subdomains with one instruction — simple string comparison, with exactly one exception"
sidebar_label: "12 · Redirect URI exact matching"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 9700 §2.1 (Protecting Redirect-Based Flows), §4.1
> (Insufficient Redirect URI Validation), §4.1.1, §4.1.2, §4.1.3 (Countermeasures)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 6749 §3.1.2 (Redirection Endpoint), §3.1.2.2 (Registration Requirements), §3.1.2.3
> (Dynamic Configuration), §3.1.2.4 (Invalid Endpoint), §10.6 (Authorization Code Redirection
> URI Manipulation) ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt));
> RFC 3986 §6.2.1 (Simple String Comparison)
> ([rfc-editor.org/rfc/rfc3986](https://www.rfc-editor.org/rfc/rfc3986.txt)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**The redirect URI is the address the authorization server will hand a live credential to. Any
looseness in how it decides that address is acceptable is directly convertible into "hand the
credential to the attacker". The history of this parameter is a history of clever matching
schemes — prefix matching, subdomain wildcards, "the path must start with", ignoring the query
— each of which turned out to be exploitable, and RFC 9700's response is to delete the
cleverness entirely.**

## The rule

RFC 9700 §2.1:

> *"When comparing client redirection URIs against pre-registered URIs, authorization servers
> MUST utilize exact string matching except for port numbers in `localhost` redirection URIs of
> native apps."*

and §4.1.3, pointing at the comparison algorithm:

> *"The authorization server MUST ensure that the two URIs are equal; see Section 6.2.1 of
> [RFC3986], Simple String Comparison, for details. The only exception is native apps using a
> `localhost` URI."*

RFC 3986 §6.2.1 is the *least* normalising comparison the URI specification defines: compare the
two strings character by character. No case folding except what was already done by the party
that produced the string, no percent-decoding, no default-port elision, no dot-segment
resolution, no trailing-slash equivalence.

RFC 6749 §3.1.2.3 already said this for fully-registered URIs — *"If the client registration
included the full redirection URI, the authorization server MUST compare the two URIs using
simple string comparison as defined in [RFC3986] Section 6.2.1"* — but it also permitted partial
registration with looser matching. RFC 9700 closes that door.

## What "exact" means, concretely

These are all *different* URIs under simple string comparison, and any of them registered
against any other will fail:

```text
https://app.example.com/login/oauth2/code/idp
https://app.example.com/login/oauth2/code/idp/          trailing slash
https://app.example.com:443/login/oauth2/code/idp       explicit default port
http://app.example.com/login/oauth2/code/idp            scheme
https://App.Example.com/login/oauth2/code/idp           host case
https://app.example.com/login/oauth2/code/IDP           path case
https://app.example.com/login/oauth2/code/idp?x=1       query added
https://app.example.com/login/oauth2/code/%69dp         percent-encoding
```

Host names are case-insensitive per RFC 3986, so a *fully normalising* comparison would treat
rows 1 and 5 as equal — but simple string comparison does not normalise, and a server is
following the BCP by rejecting row 5. Do not rely on either behaviour: register and send the
identical string.

## The attacks that got us here

**§4.1.1 — pattern-matching flaws.** RFC 9700 notes that pattern-based approaches have proven
*"more complex to implement and more error-prone to manage than exact redirection URI
matching"*, and that the flaws *"allow the attacker to obtain an authorization code or access
token"*. Concrete shapes that have all shipped:

| Registered pattern | What the attacker registers or reaches |
|---|---|
| `https://*.example.com/cb` | A subdomain they control — a stale CNAME, a customer subdomain, a CDN takeover |
| `https://example.com/cb*` (prefix) | `https://example.com/cb.attacker.com` on some parsers, or `https://example.com/cb/../open-redirect` |
| Path ignored | Any path on your origin, including an open redirector or a page that reflects the query string |
| Query ignored | Appending parameters that change your callback's behaviour |

**§4.1.2 — open redirectors, including the fragment trick.** The general rule, RFC 9700 §2.1:

> *"Clients and authorization servers MUST NOT expose URLs that forward the user's browser to
> arbitrary URIs obtained from a query parameter (open redirectors)."*

And the specific mechanism §4.1.2 documents:

> *"The attack utilizes the fact that user agents reattach fragments to the destination URL of a
> redirect if the location header does not contain a fragment."*

So an open redirector on a *registered* redirect URI can carry a fragment — where the implicit
grant puts its access token — across to an attacker's site, even though the redirector itself
never saw the fragment. This is the mechanism that makes an open redirector on your own domain
into a token exfiltration primitive.

**RFC 6749 §10.6 — the original.** An attacker who can get the code delivered to a URI they
control redeems it with your public `client_id`. The countermeasure is the §4.1.3 re-check of
`redirect_uri` at the token endpoint.

## The registration rules

RFC 6749 §3.1.2.2:

> *"The authorization server MUST require the following clients to register their redirection
> endpoint: Public clients. Confidential clients utilizing the implicit grant type."*
>
> *"The authorization server SHOULD require all clients to register their redirection endpoint
> prior to utilizing the authorization endpoint."*

And §3.1.2.4, the rule that shapes your debugging:

> *"If an authorization request fails validation due to a missing, invalid, or mismatching
> redirection URI, the authorization server SHOULD inform the resource owner of the error and
> MUST NOT automatically redirect the user-agent to the invalid redirection URI."*

Which is why a redirect-URI mismatch never reaches your application — see
[02b · When a parameter is wrong](02b-when-a-parameter-is-wrong.md).

## What this costs you operationally

Exact matching means **every environment is a separate registration**. There is no
`https://*.dev.example.com/cb` that covers every preview deployment. The options, in order of
preference:

1. **Register each environment's exact URI.** Verbose, boring, correct. Most authorization
   servers allow many registered URIs per client — exact matching is per-entry, not
   per-registration.
2. **A separate client per environment.** Better isolation: production credentials never exist
   in a preview environment.
3. **One fixed callback host per environment, with the per-deployment routing behind it.** The
   authorization server sees one URI; your ingress does the rest. Note the trap: if the "rest"
   involves reading a target URL from a parameter, you have built the open redirector §2.1
   forbids. Use a server-side map keyed by an opaque id, not a URL.
4. **Dynamic Client Registration (RFC 7591)** for genuinely dynamic clients. Rarely worth it for
   preview environments.

What is not an option: asking your identity provider to enable wildcard matching. It is a
request to disable a control the BCP puts a MUST on.

## The Spring Security side

Spring builds the redirect URI from a template. From the reference:

> *"The default redirect URI template is `{baseUrl}/login/oauth2/code/{registrationId}`."*

`baseUrl` is resolved **from the incoming request**. That is convenient in development and a
functional hazard in production, because behind a proxy the request your application sees is not
the request the browser made. Getting the scheme, host and port right is what
`server.forward-headers-strategy` and the `ForwardedHeaderFilter` are for, and getting it wrong
produces a `redirect_uri` that does not match your registration — reported by the authorization
server as an error page you never see. This is covered in detail in
**19 · Where the defaults leave you exposed** *(not written yet)*.

Native-app redirect URIs — private-use schemes, claimed `https`, and the loopback exception —
are [12b · Native apps and loopback](12b-native-apps-and-loopback.md).

## Gotchas

**★ A trailing slash is a different URI.**
Under simple string comparison, `…/cb` and `…/cb/` do not match. Frameworks that normalise
trailing slashes on *routing* do not normalise them on the string you send as `redirect_uri`.

**★ An explicit `:443` on an `https` URI is a different URI.**
Some proxies and some URI builders add the port when reconstructing an absolute URL from
forwarded headers. The result matches nothing.

**★ `http` in development and `https` in production are two registrations, not one.**
Obvious in principle, and the cause of an enormous amount of "it works locally" time. Register
both, or use a local `https` setup.

**★ Wildcard subdomain registrations are a subdomain-takeover away from full compromise.**
A stale DNS record pointing at a decommissioned service, a customer-controlled subdomain, or a
CDN account someone closed — any of these becomes a valid redirect target. RFC 9700 §4.1.1 is
explicit that pattern approaches have proven error-prone.

**★ An open redirector anywhere on a registered origin defeats exact matching.**
The authorization server correctly delivers the code to your registered URI; your own endpoint
then forwards the browser — and per §4.1.2, potentially the fragment — onward. Exact matching
protects the first hop only.

**★ Do not build the redirect URI from user-controllable input.**
A `redirect_uri` assembled from a `Host` header, an `X-Forwarded-Host` you did not validate, or
a query parameter is attacker-influenced. Use a configured absolute base URL in production and
resolve nothing from the request.

**★ Sending a `redirect_uri` that matches registration is not sufficient; it must also match at
the token endpoint.**
RFC 6749 §4.1.3 requires the same value in the token request, *"and their values MUST be
identical"*. Two different code paths building the string is how they diverge.

**★ Registering many URIs on one client is fine; registering a loose pattern is not.**
The BCP's objection is to pattern matching, not to multiplicity. Ten exact URIs are ten exact
comparisons.

**★ Some authorization servers still offer wildcard matching and some tutorials still recommend
it.**
The feature existing does not make it conforming. RFC 9700's `MUST` is on the server; a server
that offers a non-conforming mode is offering you a way to violate the BCP.

## Interview questions

**★ How should an authorization server match a `redirect_uri` against registration?**
By simple string comparison — RFC 9700 §2.1: *"authorization servers MUST utilize exact string
matching except for port numbers in `localhost` redirection URIs of native apps"*, with §4.1.3
pointing at RFC 3986 §6.2.1. No normalisation, no prefix matching, no wildcards, no ignoring the
query. The one exception is the loopback port for native apps, because the client picks an
ephemeral port at runtime and cannot register it in advance.

**★ Why did the specification community abandon pattern matching?**
Because every scheme leaked. RFC 9700 §4.1.1 says pattern approaches proved *"more complex to
implement and more error-prone to manage than exact redirection URI matching"* and that the
resulting flaws *"allow the attacker to obtain an authorization code or access token"*. Concrete
failures: wildcard subdomains combined with subdomain takeover; prefix matching that a crafted
path or an unusual parser sidesteps; and ignoring the path or query, which lets an attacker
reach an open redirector on the same origin. The economics are one-sided — the benefit is
convenience in registration, the cost is a credential delivered to an attacker.

**★ Exact matching means every preview environment needs its own registration. How do you handle
that?**
Register each environment's exact URI — most servers allow many exact entries per client — or
use a separate client per environment, which also stops production credentials existing in a
preview. If neither is practical, terminate on one fixed callback host per environment and route
behind it, but do the routing through a server-side map keyed by an opaque identifier, never by
reading a target URL out of a parameter, because that is exactly the open redirector RFC 9700
§2.1 says clients *"MUST NOT expose"*.

**★ Your registration is exact and correct, and you still have an open-redirect exposure. How?**
Because exact matching only governs the first hop. If the registered callback path, or anything
else on that origin, forwards the browser to a URL taken from a parameter, the attacker gets a
valid delivery to your registered URI followed by a forward to theirs. RFC 9700 §4.1.2 adds a
sharper edge: *"user agents reattach fragments to the destination URL of a redirect if the
location header does not contain a fragment"*, so an open redirector can carry a fragment —
where an implicit-flow access token lives — to a destination it never saw.

**★ Why does the token endpoint re-validate the `redirect_uri`?**
Because the authorization-endpoint check decides *where to deliver* the code, and the
token-endpoint check decides *whether the presenter is the intended recipient*. RFC 6749 §10.6
is the attack it closes: an attacker who obtained a code delivered to a different URI — through a
matching flaw or an open redirector — would otherwise be able to redeem it with your public
`client_id`. §4.1.3 requires the values in the two requests be identical.

---

← [Code injection](11-authorization-code-injection.md) · [Topic index](README.md) · Next → [Native apps and loopback](12b-native-apps-and-loopback.md)
