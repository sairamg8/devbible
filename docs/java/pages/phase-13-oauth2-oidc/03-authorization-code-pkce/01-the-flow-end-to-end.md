---
title: "The authorization code flow is two conversations that never touch — a browser redirect that carries a one-time reference and a server-to-server call that trades it for tokens — and almost every OAuth2 defect is a confusion about which conversation something belongs to"
sidebar_label: "01 · The flow end to end"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1 (Authorization Code Grant), §4.1.1
> (Authorization Request), §4.1.2 (Authorization Response), §4.1.3 (Access Token Request),
> §4.1.4 (Access Token Response)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 7636 §4
> (Protocol) ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 9700 §2.1.1 (Authorization Code Grant)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**There are exactly two channels in this flow and they have different security properties.
The front channel is the user's browser: everything on it is visible in the address bar,
in `Referer` headers, in browser history, in proxy logs, and to any other app on the
device that can claim the same redirect target. The back channel is a direct TLS
connection from your server to the authorization server: nothing on it passes through
anything the user controls. The whole design of the authorization code grant is the
decision to put *a reference* on the front channel and *the tokens* on the back channel.
Once you hold that distinction, every parameter in the flow has an obvious job, and every
attack in this topic is a way of breaking the binding between the two channels.**

## The eight steps, labeled

This is the flow the phase gate asks you to whiteboard. Steps marked **(F)** happen on the
front channel — via HTTP redirects through the user's browser. Steps marked **(B)** happen
on the back channel — a direct HTTPS call from the client's *server* to the authorization
server.

1. **(local)** The user hits a protected page on your app. Your app has no token for them.
2. **(local)** Your app generates a `code_verifier`, derives `code_challenge =
   BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`, generates a `state` value, and stores
   both against the user's browser session.
3. **(F)** Your app returns a redirect to the authorization server's **authorization
   endpoint**, carrying `response_type=code`, `client_id`, `redirect_uri`, `scope`,
   `state`, `code_challenge` and `code_challenge_method=S256`.
4. **(AS)** The authorization server authenticates the resource owner — login page, MFA,
   whatever it does — and obtains consent for the requested scopes. **The client is not
   present for this and never sees the credentials.** That is the point of OAuth2.
5. **(AS)** The authorization server stores the `code_challenge` and
   `code_challenge_method` against the authorization code it is about to issue, and binds
   that code to the `client_id` and the `redirect_uri`.
6. **(F)** The authorization server redirects the browser back to the client's registered
   `redirect_uri` with `code` and `state` in the query string.
7. **(local)** Your app looks up the session, compares the returned `state` to the stored
   one, and aborts if they differ. It retrieves the stored `code_verifier`.
8. **(B)** Your app POSTs to the **token endpoint**: `grant_type=authorization_code`,
   `code`, `redirect_uri`, `client_id`, `code_verifier`, plus client authentication if it
   is a confidential client.
9. **(AS)** The authorization server authenticates the client, checks the code has not
   been used, checks it was issued to this `client_id`, checks the `redirect_uri` matches,
   recomputes the transform over the `code_verifier` and compares it to the stored
   `code_challenge`. Any failure is `invalid_grant`.
10. **(B)** The authorization server returns `access_token`, `token_type`, `expires_in`,
    and — depending on the grant and the scopes — `refresh_token` and `id_token`.

Step 9 is where all the security lives. Everything before it exists to make step 9 able to
say no.

## The RFC's own worked example

RFC 6749 §4.1.1 gives this authorization request verbatim (line breaks are the RFC's, "for
display purposes only"). The values `s6BhdRkqt3` and `xyz` are the RFC's own examples and
are reproduced here because the RFC uses them, not because they were observed anywhere:

```http
GET /authorize?response_type=code&client_id=s6BhdRkqt3&state=xyz
    &redirect_uri=https%3A%2F%2Fclient%2Eexample%2Ecom%2Fcb HTTP/1.1
Host: server.example.com
```

And §4.1.2's response:

```http
HTTP/1.1 302 Found
Location: https://client.example.com/cb?code=SplxlOBeZQQYbYS6WxSbIA
          &state=xyz
```

And §4.1.3's token request — with one change: the RFC's `Authorization: Basic` header
carries a base64-encoded example credential, and this site does not print credential-shaped
strings even fake ones, so it is replaced with a placeholder:

```http
POST /token HTTP/1.1
Host: server.example.com
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA
&redirect_uri=https%3A%2F%2Fclient%2Eexample%2Ecom%2Fcb
```

Note what is *not* in the RFC's example: `code_challenge` and `code_verifier`. RFC 6749 was
published in 2012 and PKCE arrived in 2015 as RFC 7636. Every example in RFC 6749 predates
it. This is the single biggest reason online material is wrong — it is copied from a
document that is correct and incomplete.

## What each channel can and cannot carry

| | Front channel (browser redirects) | Back channel (server→AS, TLS) |
|---|---|---|
| Visible in the address bar | yes | no |
| Visible in browser history | yes | no |
| Leaks via `Referer` | yes | no |
| Visible to other apps that claim the redirect target | yes | no |
| Survives a screenshot / screen-share | yes | no |
| Client authenticated | no — anyone can craft the URL | yes, for confidential clients |
| Carries in this flow | `code`, `state`, `code_challenge` | `code_verifier`, tokens, client credentials |

The implicit grant put the *access token* in the left column. That is the whole story of
why it died, and it gets its own chunk in
**16 · The implicit grant** *(not written yet)*.

## The three things that make step 9 safe

Each is a separate binding, each defends a separate attack, and each is missing in some
real deployment right now:

- **The code is bound to the `client_id`.** Someone else's client cannot redeem it. RFC
  6749 §4.1.2: *"The authorization code is bound to the client identifier and redirection
  URI."*
- **The code is bound to a `code_challenge`.** Whoever redeems it must present the
  matching `code_verifier`, which never left the client's server. That is PKCE, and it is
  why intercepting the code on the front channel is not enough — [05 · The interception
  attack](05-the-interception-attack.md).
- **The callback is bound to the browser session that started it.** Comparing `state`
  proves the response arrived at the browser that made the request. That is CSRF
  protection, and it is *not* the same thing as PKCE — [10b · `state` vs
  PKCE](10b-state-vs-pkce.md).

Removing any one of the three leaves a flow that works perfectly in a demo.

## Where this sits in the phase

The vocabulary — resource owner, client, authorization server, resource server,
confidential vs public — belongs to [02 · The four roles](../02-the-four-roles/README.md). This topic
assumes it. What the returned tokens *are*, how long they live and how a refresh token
rotates belongs to [05 · The three tokens](../05-the-three-tokens/README.md). The JWT wire format and
its validation algorithm belong to [06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md).
The `nonce` parameter and the ID token belong to **07 · OpenID Connect** *(not written
yet)* — this topic names `nonce` only where RFC 9700 names it as a code-injection
countermeasure.

## Gotchas

**★ "The redirect goes to the authorization server" and "the redirect comes back" are two
different HTTP 302s, and people conflate them.**
Step 3 is your server telling the browser to go to the AS. Step 6 is the AS telling the
browser to go to your `redirect_uri`. The `redirect_uri` parameter in step 3 is *not* the
URL being redirected to in step 3 — it is the URL the AS will use in step 6. Reading it as
"where to send the user now" is the source of endless confusion when the two hosts differ.

**★ The client never sees the user's password, and that is not a side effect — it is the
requirement.**
If your integration involves collecting a username and password in your own form and
posting them anywhere, you are not doing this flow. See
**17 · The password grant** *(not written yet)* for the grant that did that and the
`MUST NOT` that ended it.

**★ The back-channel call is made by your server, not by the browser.**
An "authorization code flow" implemented entirely in JavaScript still needs the token
request to happen somewhere. If it happens in the browser, the client is a public client,
there is no client secret to speak of, and PKCE is doing all the work. That is a legitimate
configuration — it is just a different threat model, and pretending it is a confidential
client because the code sits in a repo with a `client-secret` property in it is not.

**★ RFC 6749's examples do not contain PKCE and are still, in 2026, the most-copied
examples on the internet.**
Any tutorial whose authorization request has exactly the five parameters from §4.1.1 is
reproducing a 2012 document. Add `code_challenge` and `code_challenge_method`.

**★ TLS is assumed everywhere and stated almost nowhere.**
RFC 6749 §3.1.2.1 only says the redirection endpoint *"SHOULD require the use of TLS"*.
That SHOULD is a 2012 artifact. RFC 9700 treats plaintext front-channel URLs as broken;
if a code can be read off the wire, PKCE's `code_challenge` is read off the wire with it
and — for `plain` — so is the verifier.

## Interview questions

**★ Walk me through the authorization code flow with PKCE. Label every hop.**
The answer is the ten-step list above, and the thing an interviewer is listening for is
whether you say which hops go through the browser. A candidate who says "then the app calls
the token endpoint" without noting that this is a server-to-server call, unlike everything
before it, has not internalised the design. The second thing they listen for is whether the
`code_verifier` is generated *before* the authorization request — it must be, because the
challenge derived from it is a parameter of that request.

**★ Why does the flow bother with a code at all? Why not have the authorization server
return the access token in the redirect?**
Because the redirect goes through the user's browser, and everything in a redirect URL is
exposed to browser history, the `Referer` header, any proxy that terminates TLS, and
anything else on the device that can receive that URL. An access token is a bearer
credential usable for its whole lifetime; a code is a one-time reference that is useless
without either client authentication or a `code_verifier`. Returning the token directly is
exactly the implicit grant, and RFC 9700 §2.1.2 now says clients `SHOULD NOT` use it.
[01b · Why a code at all](01b-why-a-code-at-all.md) is the long version.

**★ Which parts of this flow does the client authenticate on, and which does it not?**
None of the front channel. The authorization request is a URL a browser fetches; anybody
can construct one with your `client_id` in it, because `client_id` is public by
definition. Client authentication happens exactly once, at the token endpoint, on the back
channel, and RFC 6749 §4.1.3 says the AS *"MUST require client authentication for
confidential clients"* there. That asymmetry is why the code must be bound to the client:
the front channel cannot prove who is asking.

**★ What is stored on the client between step 3 and step 7, and where?**
The `state` value and the `code_verifier`, keyed to the user's browser session. In Spring
Security that is the whole `OAuth2AuthorizationRequest`, held by an
`AuthorizationRequestRepository` whose default implementation is session-backed. This is
server-side state in an "OAuth is stateless" flow, and it is the source of a specific class
of production failure covered in
**19 · Where the defaults leave you exposed** *(not written yet)*.

**★ If you had to remove one of `state`, PKCE and client authentication from a confidential
web client, which would you remove and what would you lose?**
`state` — but only if you have verified that the authorization server enforces PKCE, because
RFC 9700 §2.1 says clients *"that have ensured that the authorization server supports PKCE
MAY rely on the CSRF protection provided by PKCE"*. You would lose the ability to carry
per-request application state (like the originally requested URL) in the parameter, which
you then have to carry elsewhere. Removing client authentication turns a confidential
client into a public one and gives up the binding that stops another client redeeming your
codes; removing PKCE reopens code injection. The interesting part of this question is that
one of the three is conditionally redundant and two are not.

---

← [Topic index](README.md) · Next → [Why a code at all](01b-why-a-code-at-all.md)
