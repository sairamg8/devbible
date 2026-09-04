---
title: "state defends your callback endpoint against being fed an authorization response the user's browser never asked for, which is a CSRF problem and not a code-theft problem, and the specification places the MUST on the protection rather than on the parameter"
sidebar_label: "10 · What state defends"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 6749 §4.1.1 (Authorization Request), §4.1.2 (Authorization
> Response), §4.1.2.1 (Error Response), §10.12 (Cross-Site Request Forgery), §10.14 (Code
> Injection and Input Validation)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); RFC 9700 §2.1
> (Protecting Redirect-Based Flows), §4.7 (Cross-Site Request Forgery)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> `MessageDigest.isEqual` javadoc, JDK 25
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/security/MessageDigest.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**Your callback endpoint is a public, unauthenticated URL that anyone on the internet can
navigate any user's browser to, with any query string they like. Without a check, "the user
arrived at `/login/oauth2/code/example?code=…`" means nothing more than "somebody caused this
browser to make that request". `state` is the check: a value your server generated, stored
against this browser's session, and now requires to come back. It answers exactly one
question — *did the browser that is presenting this response also start this flow?* — and
answering that question is CSRF protection, not code protection.**

## The requirement, and where the MUST actually sits

RFC 6749 §10.12:

> *"Cross-site request forgery (CSRF) is an exploit in which an attacker causes a resource
> owner to make a request to the authorization server by including a malicious link or script
> in a page that the resource owner visits while authenticated to the authorization server. A
> CSRF attack against the client's redirection endpoint (rather than the authorization server)
> may be used to obtain the authorization code and launch further attacks."*
>
> *"The client MUST implement CSRF protection for its redirection endpoint. This is typically
> accomplished by requiring any request to the redirection endpoint to include a value that
> binds the request to the resource owner's user-agent and that cannot be guessed or obtained
> by an attacker. The client SHOULD use the `state` request parameter to deliver this value to
> the authorization server when making an authorization request and verify the value when the
> user-agent is redirected back to the client."*

The MUST is on *implementing CSRF protection*. The SHOULD is on *using `state` to do it*. That
split is why §4.1.1 can list `state` as merely RECOMMENDED without contradiction, and why RFC
9700 §2.1 can later permit two alternatives:

> *"Clients MUST prevent Cross-Site Request Forgery (CSRF) ... clients that have ensured that
> the authorization server supports PKCE MAY rely on the CSRF protection provided by PKCE. In
> OpenID Connect flows, the `nonce` parameter provides CSRF protection. Otherwise, one-time use
> CSRF tokens carried in the `state` parameter ... MUST be used."*

Three permitted mechanisms — PKCE with a verified server, OIDC `nonce`, or `state` — and a MUST
on having one of them.

## The attack `state` stops

Concretely, "session fixation via the callback":

1. The attacker starts an authorization flow at your client *in their own browser* and
   authenticates as **themselves** at the authorization server.
2. They stop at the redirect. They now hold a valid authorization code for the attacker's own
   account, addressed to your client's callback.
3. They construct `https://yourapp.example.com/login/oauth2/code/example?code=<attacker-code>`
   and get a victim to visit it — a link in an email, an `img` tag, an auto-submitting form, a
   redirect from a page they control.
4. Your client, if it does not check `state`, exchanges the code and establishes a session for
   the victim's browser **as the attacker's account**.
5. The victim, believing they are on your site and logged in, does something: uploads a
   document, saves a payment method, enters data. It all lands in the attacker's account, which
   the attacker can then log into and read.

Note what this attack does **not** do: it does not steal the victim's code, and it does not
steal a token. It logs the victim into the attacker's account. That is why the defence is CSRF
protection and not confidentiality. RFC 9700 §4.7 names it directly.

## What a correct `state` looks like

RFC 9700 §2.1's phrase is *"one-time use CSRF tokens carried in the `state` parameter"*. Four
properties:

1. **Unguessable.** Generated from a CSRF-safe source — `SecureRandom`, not a counter, not a
   timestamp, not a hash of the session id.
2. **Bound to the user agent.** Stored server-side against the session, or in an `HttpOnly`
   cookie. A global set of "outstanding states" is not bound to anything.
3. **One-time use.** Removed on first successful callback, so a replayed callback fails.
4. **Compared safely.** Constant-time comparison, because a byte-at-a-time comparison over a
   secret is a (slow, noisy, but real) oracle.

```java
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

boolean stateMatches(String expected, String received) {
    if (expected == null || received == null) {
        return false;
    }
    return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            received.getBytes(StandardCharsets.UTF_8));
}
```

`MessageDigest.isEqual` is the JDK's non-short-circuiting comparison. Its implementation note
in the JDK 25 javadoc: *"All bytes in `digesta` are examined to determine equality, unless
`digestb` is `null` or has a length of zero bytes. If `digestb` is not `null` and does not have
a length of zero bytes, then the calculation time depends only on the length of `digesta`. It
does not depend on the length of `digestb` or the contents of `digesta` and `digestb`."* Note
the argument order matters for that guarantee: pass the *expected* value as `digesta`.

## The value generation

The same recipe as the verifier, and for the same reason:

```java
private static final SecureRandom RANDOM = new SecureRandom();

static String newState() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
}
```

Spring Security generates the `state` for you — `DefaultOAuth2AuthorizationRequestResolver`
builds an `OAuth2AuthorizationRequest` carrying a generated state, and the configured
`AuthorizationRequestRepository` stores the whole request against the session so the callback
can find it. You do not write any of the code above for a Spring client; it is here so you can
recognise a hand-rolled implementation that got it wrong.

## `state` is not a place to put data

The temptation is universal: put the return URL, the tenant, the invitation token, the
originating button, into `state`. Two reasons not to:

- **It has to be unguessable.** Anything derived from application data is, by construction,
  partly guessable. A `state` of `returnTo=/dashboard&tenant=acme` protects nothing.
- **It comes back from the internet.** Whatever you put in it, you read back out of an
  attacker-controllable query parameter. RFC 6749 §10.14: *"The authorization server MUST
  validate the syntax of all the received requests. The client MUST also validate the response
  received from the authorization server."* A return URL read out of `state` and redirected to
  without an allowlist check is an open redirector — the thing RFC 9700 §2.1 says clients
  *"MUST NOT expose"*.

The correct pattern is a random `state` as a **key**, with the application data in server-side
session storage under it. That is what Spring Security's
`OAuth2AuthorizationRequest.additionalParameters` and the session-backed repository give you.

If you genuinely cannot hold server-side state, sign or encrypt the payload *and* include a
random nonce inside it, then still validate the return URL against an allowlist on the way out.

## Gotchas

**★ Comparing `state` with `String.equals` is a timing side channel on a secret.**
It is a weak one over a network, and it costs nothing to avoid. `MessageDigest.isEqual`.

**★ Not consuming the `state` lets the callback be replayed.**
RFC 9700 §2.1 says *"one-time use"*. If the stored value survives the first callback, the
attacker's forged callback works whenever they choose, subject only to the code's lifetime.
Remove it from the session as part of the lookup.

**★ Validating `state` only on the success path leaves the error path open.**
§4.1.2.1 makes `state` REQUIRED in error responses too. An unvalidated error path lets an
attacker clear a legitimate in-flight authorization request, which is at minimum a login denial
of service.

**★ A `state` mismatch is a security event, not a 500.**
The user should see "sign-in failed, please try again". Your monitoring should see a counter
that, when it rises, means either an expired session mid-flow or somebody probing. Do not throw
a stack trace at the user, and do not silently swallow it either.

**★ `state` does not protect the authorization code.**
It is a check performed by your client, on your client's own callback. Someone who has stolen
the code does not need to pass through your callback at all — they go straight to the token
endpoint. Confusing these is the subject of [10b · `state` vs
PKCE](10b-state-vs-pkce.md).

**★ Storing `state` in a client-side cookie that is not `HttpOnly` defeats the point.**
A script that can read the cookie can construct a matching callback. `HttpOnly`, `Secure`, and
`SameSite=Lax` at minimum — `Lax` still permits the top-level GET navigation the callback is,
which is why `SameSite=Strict` on a session cookie breaks OAuth callbacks. That interaction is
covered from the Spring side in
[../../phase-9-spring-boot/11-spring-security/13-csrf-decisions.md](../../phase-9-spring-boot/11-spring-security/13-csrf-decisions.md).

**★ Session expiry mid-flow produces a `state` failure that looks like an attack.**
The user opens the login page, goes to lunch, comes back and authenticates. Your session — and
with it the stored `state` and `code_verifier` — is gone. Spring Security reports this as
`authorization_request_not_found` rather than a mismatch, which is a useful distinction to
preserve in your own implementations.

**★ Multiple tabs are the other benign cause.**
A user with two login tabs generates two authorization requests. A repository that stores only
one pending request per session loses the first. Spring Security's default
`HttpSessionOAuth2AuthorizationRequestRepository` keeps a single request per session, which is
a deliberate simplicity trade-off and a real source of "it worked when I tried again".

## Interview questions

**★ What does `state` protect against?**
Cross-site request forgery against the client's redirection endpoint. Concretely: an attacker
obtains an authorization code for *their own* account, then causes a victim's browser to visit
the client's callback with it. Without a `state` check, the client exchanges the code and logs
the victim into the attacker's account, where anything the victim then does is visible to the
attacker. RFC 6749 §10.12 states the requirement — *"The client MUST implement CSRF protection
for its redirection endpoint"* — and RFC 9700 §4.7 catalogues the attack.

**★ `state` is only RECOMMENDED in §4.1.1. Does that mean it is optional?**
The parameter is optional; the protection is not. §10.12 puts a MUST on implementing CSRF
protection for the redirection endpoint and only a SHOULD on using `state` as the vehicle. RFC
9700 §2.1 then names three acceptable vehicles: PKCE, if the client has *ensured* the
authorization server supports it; the OIDC `nonce`; or *"one-time use CSRF tokens carried in
the `state` parameter"*, which it says MUST be used otherwise. So you may omit `state` only if
you have deliberately chosen one of the other two and verified the precondition.

**★ Someone proposes deriving `state` from a hash of the session id, so nothing needs storing.
What is wrong?**
It is deterministic, so it is only as unguessable as the session id, and if the session id ever
leaks — a `Referer`, a log, a URL-rewritten session — the state is derivable. It is also not
one-time use, which RFC 9700 §2.1 requires: the same session produces the same state forever, so
a captured callback can be replayed for the life of the session. And it carries no per-request
identity, so with two tabs open you cannot tell which flow a response belongs to.

**★ How would you compare the returned `state` to the stored one?**
With a constant-time comparison — `MessageDigest.isEqual` in Java — and after removing the
stored value so the check can only succeed once. Then, whatever the result, treat a mismatch as
a failed login for the user and a counted security event for operations, distinguishing it from
"no pending authorization request found", which is the far more common benign case of an
expired session or a stale bookmark.

**★ Is it safe to put the post-login redirect target in `state`?**
Not as-is. `state` must be unguessable to do its CSRF job, and application data is guessable; and
whatever you put in it comes back to you from an attacker-controllable query parameter, so
redirecting to a URL read out of it without an allowlist check builds the open redirector RFC
9700 §2.1 says clients *"MUST NOT expose"*. The safe pattern is a random `state` used as a key
into server-side session storage that holds the return URL, which is what Spring Security's
session-backed `AuthorizationRequestRepository` does. If you must be stateless, sign the payload,
include a random nonce in it, and still validate the URL against an allowlist.

---

← [The PKCE downgrade attack](09-the-pkce-downgrade-attack.md) · [Topic index](README.md) · Next → [state vs PKCE](10b-state-vs-pkce.md)
