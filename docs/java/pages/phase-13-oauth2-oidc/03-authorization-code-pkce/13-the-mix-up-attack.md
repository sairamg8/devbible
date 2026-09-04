---
title: "The mix-up attack is the one where the client sends a perfectly valid code to a perfectly valid token endpoint belonging to the wrong authorization server, and neither state nor PKCE notices, because the client never checked who answered"
sidebar_label: "13 · The mix-up attack"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 9700 §2.1 (Protecting Redirect-Based Flows), §4.4 (Mix-Up
> Attacks), §4.4.1 (Attack Description), §4.4.2 (Countermeasures)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 9207 (OAuth 2.0 Authorization Server Issuer Identification) §2 (Response Parameter
> `iss`), §2.3 (Providing the Issuer Identifier), §2.4 (Validating the Issuer Identifier)
> ([datatracker.ietf.org/doc/html/rfc9207](https://datatracker.ietf.org/doc/html/rfc9207)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Every check in this topic so far has been about *what* came back. Mix-up is about *where it
came from*, and nothing in RFC 6749's authorization response says. The response is a redirect
carrying `code` and `state` — there is no field naming the authorization server that issued
them. If your client talks to more than one authorization server, and the response arrives at a
redirect URI shared between them, the client has to decide which token endpoint to send the code
to on the basis of state it stored, and an attacker who can influence that decision gets your
client to hand a valid code to a server the attacker controls.**

## When this applies

RFC 9700 §4.4.1's prerequisites:

- The client interacts with **more than one authorization server**, at least one of which is
  attacker-controlled or attacker-influenced. "Attacker-controlled" includes an AS the attacker
  legitimately registered — a "sign in with anything" client that accepts arbitrary OIDC
  providers is the pure case.
- The client stores the selected authorization server in the browser session.
- The **same redirection URI** is used for every authorization server.

If your client talks to exactly one authorization server and always will, this attack does not
apply to you. If it supports "sign in with Google or with our corporate IdP", it does. RFC 9700
§2.1 puts the requirement in exactly those terms:

> *"When an OAuth client can interact with more than one authorization server, a defense against
> mix-up attacks ... is REQUIRED."*

## The attack

1. The user chooses the attacker's authorization server (`A-AS`) at your client — or the
   attacker manipulates the choice.
2. Your client stores "this session's AS is `A-AS`" and redirects the browser to `A-AS`'s
   authorization endpoint.
3. **`A-AS` redirects the browser onward to the honest authorization server (`H-AS`)'s
   authorization endpoint**, with your client's `client_id` at `H-AS` and the same shared
   redirect URI.
4. The user — who may well have an existing session at `H-AS` — authenticates and consents
   there. The URL bar says `H-AS`, which is a real, trusted provider, so nothing looks wrong.
5. `H-AS` redirects back to your client's shared redirect URI with a code **issued by `H-AS`**.
6. Your client looks up the session, sees "this session's AS is `A-AS`", and sends the code —
   along with its `client_id` and, if it has one, **its client secret for `A-AS`** — to `A-AS`'s
   token endpoint.
7. The attacker now holds a valid `H-AS` authorization code for the victim, and possibly your
   client's credentials at `A-AS` (which they already had, being `A-AS`) — and can redeem the
   code at `H-AS`.

`state` matched: the client generated it and it came back. PKCE was fine as far as the client
was concerned: the verifier is in the session. **Neither check involves the issuer**, and that is
the point.

## The countermeasure: RFC 9207's `iss`

RFC 9700 §2.1:

> *"To this end, clients SHOULD use the `iss` parameter as a countermeasure according to
> [RFC9207], or use an alternative countermeasure based on an `iss` value in the authorization
> response."*

RFC 9207 adds one parameter to the authorization response. On the server side:

> *"In authorization responses to the client, including error responses, an authorization server
> supporting this specification MUST indicate its identity by including the `iss` parameter in
> the response."*

The value is the authorization server's issuer identifier — an `https` URL with no query or
fragment, identical to the `issuer` in its metadata. And on the client side, §2.4:

Clients supporting the specification **MUST** extract the `iss` parameter from the authorization
response, decode it, and compare it to the issuer identifier of the authorization server the
request was sent to. If they do not match, the client **MUST reject the authorization response
and MUST NOT proceed with the authorization grant**.

Servers advertise support with the metadata field
`authorization_response_iss_parameter_supported: true` (RFC 9207 §2.3), and the `issuer` in
metadata *"MUST be identical to the `iss` parameter's value"*.

In the attack above, step 5's response now carries `iss=https://h-as.example.com`. The client
compares that to `A-AS`'s issuer, they differ, and it aborts before step 6.

## The alternative countermeasure: distinct redirect URIs

RFC 9700 §4.4.2's second option:

> *"Clients MAY instead use distinct redirection URIs to identify authorization endpoints and
> token endpoints"*

and then verify that the response arrived at the URI belonging to the AS it started with. This
requires no support from the authorization server at all, which is its great advantage — you can
deploy it unilaterally.

It is also **exactly what Spring Security's default redirect URI template already gives you**:

```text
{baseUrl}/login/oauth2/code/{registrationId}
```

Each `ClientRegistration` gets its own path segment, so a response for the `google` registration
arrives at `/login/oauth2/code/google` and one for `corporate-idp` arrives at
`/login/oauth2/code/corporate-idp`. The registration is selected by the *path*, not only by
session state. That is a genuine structural mitigation and it is worth knowing you get it for
free — but see the gotchas, because it is not a complete one on its own.

## The OIDC angle

For an OIDC client, the ID token carries an `iss` claim that the client must validate. That
gives a mix-up defence for free *if* the client validates `iss` against the expected issuer for
this flow — which is the OIDC Core requirement — because a code redeemed at the attacker's token
endpoint either fails or returns an ID token whose `iss` is wrong. The catch is that by then the
code has already been sent to the attacker. `iss` in the *authorization response* fails earlier,
before the code leaves the client. ID token validation belongs to **07 · OpenID Connect** *(not
written yet)*.

## Gotchas

**★ Single-provider clients are not exposed, and saying so is part of knowing the attack.**
RFC 9700 §2.1 scopes the requirement to clients that *"can interact with more than one
authorization server"*. Adding a second provider to an application is therefore a security
change, not a feature change, and should trigger this review.

**★ "More than one authorization server" includes multi-tenant setups where tenants bring their
own IdP.**
This is the common enterprise SaaS shape and it is squarely in scope: some of those tenant IdPs
are operated by parties you have no relationship with.

**★ Distinct redirect URIs per provider help but do not cover a client that also selects the
token endpoint from session state.**
If the callback path picks the registration but a later step reads the token endpoint from
something else, you have reintroduced the gap. Derive everything — token endpoint, client
credentials, expected issuer — from the registration the *path* selected.

**★ `iss` must be compared to the issuer you sent the request to, not merely to a list of known
issuers.**
A client that accepts any issuer from its configured set has not defended anything, because the
attacker's server is in that set. RFC 9207 §2.4 requires comparing to *"the issuer identifier of
the authorization server where the authorization request was sent to"*.

**★ The `iss` parameter appears in error responses too.**
RFC 9207 §2: *"including error responses"*. A client that validates `iss` only on success has a
gap on the error path, which is smaller but is the same class of oversight as validating `state`
only on success.

**★ I could not confirm from the Spring Security 7.x reference whether the client validates the
RFC 9207 `iss` authorization-response parameter automatically.**
Treat that as unverified rather than as either a yes or a no. What the reference *does* document
is the per-registration redirect URI template, which is the §4.4.2 alternative. If you need
`iss` validation specifically, verify it against the version you are running rather than
assuming.

**★ A "sign in with any OIDC provider" feature is the pure form of this attack surface.**
Accepting an arbitrary issuer URL from a user means one of your authorization servers is
attacker-chosen by design. Such a feature needs `iss` validation, per-issuer redirect URIs,
per-issuer client registrations, and a hard look at whether it is worth having.

**★ Mix-up is not solved by TLS, by `state`, or by PKCE.**
All three are intact throughout the attack. It is a *routing* failure, and the fix is
identifying the responder.

## Interview questions

**★ What is a mix-up attack and what makes a client vulnerable?**
An attacker gets a client to send an authorization code issued by one authorization server to a
different authorization server's token endpoint, which the attacker controls. It requires the
client to work with more than one authorization server, to keep the selected server in session
state, and to use the same redirect URI for all of them — RFC 9700 §4.4.1's prerequisites. The
attacker's server redirects the browser onward to the honest server, so the user authenticates
somewhere real and the code comes back to the shared redirect URI, at which point the client
consults its session, believes it is talking to the attacker's server, and posts the honest
server's code — plus its credentials for the attacker's server — to the attacker.

**★ Why do `state` and PKCE not stop it?**
Because neither says anything about *which* authorization server responded. `state` proves the
browser that delivered the response started the flow, which is true here — the victim did start
it. PKCE binds the code to the authorization request, and the client still holds the matching
verifier. Both checks pass, and then the client sends the code to the wrong endpoint. The missing
property is issuer identification, which RFC 6749's authorization response simply does not carry.

**★ What is the fix?**
RFC 9207's `iss` parameter in the authorization response. The authorization server includes its
issuer identifier in every authorization response including error responses, and the client
extracts it and compares it to the issuer of the server it sent the request to, rejecting the
response and not proceeding if they differ. RFC 9700 §2.1 says clients *"SHOULD use the `iss`
parameter as a countermeasure according to [RFC9207], or use an alternative countermeasure based
on an `iss` value in the authorization response"*, and §4.4.2 offers a second option: distinct
redirect URIs per authorization server, so the URI the response arrived at identifies the issuer.

**★ Does Spring Security's default configuration mitigate this?**
Partly, structurally, and by side effect. The default redirect URI template
`{baseUrl}/login/oauth2/code/{registrationId}` gives each `ClientRegistration` its own callback
path, which is precisely RFC 9700 §4.4.2's distinct-redirect-URI countermeasure: the response for
one provider cannot arrive on another provider's path. That is a real mitigation and it is worth
knowing you get it by default. What I have not verified is whether Spring Security 7.x also
validates the RFC 9207 `iss` parameter, so I would check that against the version in use rather
than assume either way, and I would make sure nothing in the application re-derives the token
endpoint or client credentials from anything other than the registration the path selected.

**★ Your product adds "sign in with your own identity provider" for enterprise customers. What
changes in your threat model?**
You go from one authorization server to N, at least some of which are operated by parties you
have no relationship with — which activates RFC 9700 §2.1's *"a defense against mix-up attacks
... is REQUIRED"*. Concretely: a distinct redirect URI and a distinct client registration per
tenant issuer; validation of the `iss` authorization-response parameter where the provider
supports it; strict validation of the ID token's `iss` against the issuer expected for that
tenant; and no code path that resolves the token endpoint or client credentials from anything
other than the registration identified by the callback path.

---

← [Native apps and loopback](12b-native-apps-and-loopback.md) · [Topic index](README.md) · Next → [Replay and idempotency](14-code-replay-and-idempotency.md)
