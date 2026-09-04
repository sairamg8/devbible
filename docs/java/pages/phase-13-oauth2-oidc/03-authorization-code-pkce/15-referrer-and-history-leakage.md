---
title: "The authorization code ends up in browser history, in Referer headers, in access logs and in APM traces by default, and none of those leaks is fixed by anything the authorization server can do — every countermeasure lives in your own callback response"
sidebar_label: "15 · Referrer and history leakage"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 9700 §4.2 (Credential Leakage via Referrer Headers), §4.2.1,
> §4.2.2, §4.2.3, §4.2.4 (Countermeasures), §4.3 (Credential Leakage via Browser History)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 6749 §3.1.2.5 (Endpoint Content), §10.5 (Authorization Codes)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**A code in a URL is a code in a log, and the URL that carries it is the one the browser lands
on. Once the browser is on your callback page, three separate mechanisms start copying that URL
to places you did not intend: the `Referer` header on every outbound request the page makes,
the browser's history store, and every access log and trace on the path in. RFC 9700 gives
these two full sections, and every countermeasure is something you do in your own response.**

## `Referer` leakage — RFC 9700 §4.2

The browser attaches the current page's URL as `Referer` on requests originating from that page.
If your callback response *is* the landing page, and it contains an image, a script, a font, an
analytics beacon or a link to any third-party origin, that origin receives your callback URL —
authorization code included.

RFC 9700 §4.2 on where it leaks from:

> *"Leakage from the OAuth client requires that the client render a page that contains links to
> other pages under the attacker's control."*

and on the consequence, §4.2.3:

> *"An attacker that learns a valid code or access token through a Referer header can perform
> attacks as described in Sections 4.1.1, 4.5 and 4.6."*

§4.5 is code injection. So a `Referer` leak is not a theoretical privacy issue; it is the input
to the account-takeover attack in [11](11-authorization-code-injection.md).

The countermeasure, §4.2.4:

> *"Suppress the Referer header by applying an appropriate Referrer Policy to the document"*

Concretely, on the callback response:

```http
Referrer-Policy: no-referrer
```

`no-referrer` is the right value for the callback specifically. `same-origin` is an acceptable
site-wide default; `strict-origin-when-cross-origin` — the modern browser default — sends the
*origin* cross-origin, which does not leak the query string and is therefore adequate against
this specific attack but weaker than you want on the one page that has a credential in its URL.

In a Spring application:

```java
http.headers(headers -> headers
        .referrerPolicy(referrer -> referrer
                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)));
```

Spring Security has a `ReferrerPolicyHeaderWriter`; the header-writing DSL lives in
`HeadersConfigurer`. Applying it site-wide is the simplest correct answer.

## Browser history — RFC 9700 §4.3

> *"Authorization codes and access tokens can end up in the browser's history of visited URLs,
> enabling attacks."*

History is per-profile and persists. On a shared workstation, a kiosk, a family device, or a
machine that syncs history to a cloud account, the callback URL — with the code — is durably
readable. Codes expire, which limits direct redemption, but the entry also documents which
identity provider a user authenticates to and when, and any nearby URL that *did* keep a
credential (an old implicit-flow fragment, a magic link) is in the same store.

The countermeasure is the same one RFC 6749 already asked for, §3.1.2.5:

> *"The client SHOULD NOT include any third-party scripts (e.g., third-party analytics, social
> plug-ins, ad networks) in the redirection endpoint response. Instead, it SHOULD extract the
> credentials from the URI and redirect the user-agent again to another endpoint without
> exposing the credentials (in the URI or elsewhere). If third-party scripts are included, the
> client MUST ensure that its own scripts (used to extract and remove the credentials from the
> URI) will execute first."*

Redirecting off the callback URL immediately does not remove the history entry for the callback
itself — a 302 does not create a history entry in most browsers, but the entry for the *landing*
page is clean, and the user never sits on a page whose URL contains a code. Combined with
`Referrer-Policy: no-referrer` it removes the practical leak paths.

## Server-side logs, which the RFCs do not cover and your infrastructure does

Not in RFC 9700, and the one you will actually find in an audit. By default, every one of these
captures the full request line:

| Component | What it captures |
|---|---|
| Access logs (Tomcat, nginx, Apache, an ALB) | The full request URI including the query string |
| APM / tracing (`http.url`, `http.target` span attributes) | The same, exported to a third party |
| Error reporting (Sentry and equivalents) | The request URL attached to any exception |
| Spring Boot Actuator `httpexchanges` | Recent request URIs, exposed over HTTP |
| Ingress and service-mesh access logs | The full path |
| Browser `performance.getEntries()` | The navigation URL, readable by any script on the page |

The fix is per-path, not per-parameter: **strip the query string on the callback path.** A
redaction rule that looks for a parameter named `code` will miss `session_state`, `iss`, and
whatever your provider adds next, and will not help at all in the components that only see a URI
string.

Tomcat's `AccessLogValve` pattern is the concrete lever: `%r` logs the full request line
including the query, while a pattern built from `%m %U` logs the method and the path without it.
Whatever your stack, the principle is the same — the callback path is a special case and needs a
rule of its own.

## What the authorization server can and cannot do

Nothing about `Referer` or history. Once the redirect has been issued, the URL is on the user's
machine and the client's response determines what happens to it. The AS's contribution is the
one it already made: short code lifetimes and single use (RFC 6749 §10.5), which bound the
damage rather than preventing the leak.

This is a useful thing to be able to state in a review, because "our IdP is very secure" is a
common non-answer to this finding.

## Gotchas

**★ A single analytics tag on the callback page hands your authorization code to a third
party.**
This is not hypothetical — RFC 6749 §3.1.2.5 names *"third-party analytics, social plug-ins, ad
networks"* specifically, and marketing-inserted tags are typically applied site-wide by a tag
manager without engineering review. The callback path needs an explicit exclusion.

**★ `strict-origin-when-cross-origin` is the browser default and is *nearly* enough, which is
why nobody fixes this.**
It sends only the origin cross-origin, so the code does not leak — today, in current browsers,
for cross-origin requests. Same-origin requests still get the full URL, an older browser or a
non-browser client may not, and a policy you did not set is a policy you cannot rely on. Set
`no-referrer` on the callback.

**★ The code is in your access logs right now unless someone specifically excluded it.**
Every default access log format includes the query string. Check before assuming; it is a
five-minute check and it is the finding an auditor will lead with.

**★ APM tools export URLs to a third party by default.**
`http.url` is a standard span attribute and tracing agents populate it automatically. That means
the code goes off-premises. Most agents support URL scrubbing or path exclusion; configure it.

**★ Actuator's `httpexchanges` endpoint stores recent request URIs in memory and serves them over
HTTP.**
If it is enabled and exposed, it is a live code viewer for the duration of the buffer. This is
covered from the Actuator side in
[../../phase-9-spring-boot/13-actuator/README.md](../../phase-9-spring-boot/13-actuator/README.md).

**★ Rendering the landing page directly from the callback is the default of the simplest
implementation.**
Every framework tutorial does it. RFC 6749 §3.1.2.5 asks for a second redirect, and doing so also
removes the reload-replays-the-code problem from
[14 · Replay and idempotency](14-code-replay-and-idempotency.md). One change, two bugs fixed.

**★ `Referrer-Policy` set only on the callback response does not help pages the user reaches
afterwards — and does not need to.**
Once you have redirected away, the code is no longer in any URL, so the policy on subsequent
pages is a general hygiene question, not an OAuth one.

**★ A code visible in a screen share or a screenshot in a bug report is the same leak by a
different route.**
Same fix: do not leave the user sitting on a URL that contains one.

## Interview questions

**★ Name three ways an authorization code leaks after it has been correctly delivered to your
callback.**
The `Referer` header on any outbound request from the callback page — RFC 9700 §4.2, and §4.2.3
notes such a code enables the attacks in §4.1.1, §4.5 and §4.6. The browser's history store —
§4.3. And your own server-side logging: access logs, APM traces, error reports and Actuator's
`httpexchanges` all capture the full request URI by default. The first two are fixed by
`Referrer-Policy: no-referrer` and an immediate redirect off the callback URL; the third by
stripping the query string on that path.

**★ Whose responsibility is `Referer` leakage, and why can the authorization server not fix it?**
The client's, entirely. The leak happens on the client's own callback page, after the redirect
has completed — the authorization server is no longer in the conversation and has no way to
influence what headers the browser sends from a page it did not serve. RFC 9700 §4.2.4's
countermeasure is to *"suppress the Referer header by applying an appropriate Referrer Policy to
the document"*, which is a header on the client's response.

**★ Why does RFC 6749 say to redirect again after the callback?**
§3.1.2.5: *"it SHOULD extract the credentials from the URI and redirect the user-agent again to
another endpoint without exposing the credentials"*. It takes the code out of the address bar, so
it is not in the URL of the page the user actually sits on and links from — which kills both the
`Referer` path and the useful part of the history entry — and it makes reloading the page
harmless, because there is no longer a code to replay. The same section adds the reason scripts
matter: *"If the HTML response is served directly as the result of the redirection request, any
script included in the HTML document will execute with full access to the redirection URI and the
credentials it contains."*

**★ Your security team reports authorization codes in the log aggregator. The codes are all
expired. Is this a real finding?**
Yes, on three counts. Expiry bounds a specific redemption, not the correlation: the entries
record which user authenticated to which provider at what time, which is data your log platform
was probably not scoped to hold. It proves the pipeline captures live codes right now, and log
shipping delays and clock differences mean some of them arrive while still valid. And whatever
rule failed to strip `code` has almost certainly not stripped `Authorization` headers or token
responses elsewhere in the same pipeline. The fix is a path-scoped rule that drops the query
string on the callback, not a parameter-name denylist.

**★ How would you configure this in a Spring Boot application?**
Set `Referrer-Policy: no-referrer` — via `http.headers(h -> h.referrerPolicy(...))` in the
security configuration, which is straightforward to apply site-wide. Make sure the login success
handler redirects to an application URL rather than rendering the landing page from the callback
request. Strip the query string from the access log for the callback path in whatever container
or ingress is producing it. Configure the tracing agent to scrub or exclude that path. And check
whether Actuator's `httpexchanges` endpoint is enabled and exposed, because it holds recent
request URIs in memory and serves them.

---

← [Replay and idempotency](14-code-replay-and-idempotency.md) · [Topic index](README.md) · Next topic → [04 · Client credentials](../04-client-credentials/README.md)
