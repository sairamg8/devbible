---
title: "The choice between S256 and plain is not a performance trade-off but the difference between PKCE and no PKCE, and the specification made plain the default value so that omitting the method parameter silently gives you the useless one"
sidebar_label: "07 · S256 vs plain"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7636 §4.2 (Client Creates the Code Challenge), §4.3 (Client
> Sends the Code Challenge with the Authorization Request), §6.2 (PKCE Code Challenge Method
> Registry), §7.2 (Protecting against Eavesdroppers)
> ([datatracker.ietf.org/doc/html/rfc7636](https://datatracker.ietf.org/doc/html/rfc7636));
> RFC 9700 §2.1.1 (Authorization Code Grant)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 4648 §5 (Base 64 Encoding with URL and Filename Safe Alphabet)
> ([rfc-editor.org/rfc/rfc4648](https://www.rfc-editor.org/rfc/rfc4648.txt)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**With `plain`, the code challenge *is* the code verifier, so the secret PKCE depends on is
published in the authorization request URL — the exact place the attacker is already reading.
`plain` therefore provides protection against precisely one adversary: one who can steal the
authorization *response* but not the authorization *request*. That adversary is rare, and the
one PKCE was written for is not it. Worse, RFC 7636 §4.3 makes `plain` the value the server
assumes when `code_challenge_method` is absent, so a client that sends a challenge and forgets
the method has enabled the useless variant while appearing to have enabled PKCE.**

## The two transformations

RFC 7636 §4.2, verbatim:

> *"plain — `code_challenge = code_verifier`"*
>
> *"S256 — `code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`"*

and the rule:

> *"If the client is capable of using `S256`, it MUST use `S256`, as `S256` is Mandatory To
> Implement (MTI) on the server. Clients are permitted to use `plain` only if they cannot
> support `S256` for some technical reason and know via out-of-band configuration that the
> server supports `plain`."*

Two obligations in one paragraph: the client MUST use `S256` if it can, and the server MUST
implement `S256`. So there is no interoperability argument for `plain` on any platform with a
SHA-256 implementation, which is every platform.

RFC 7636 §7.2 is blunter:

> *"`plain` SHOULD NOT be used and exists only for compatibility with deployed
> implementations."*

and, on the downgrade:

> *"Clients MUST NOT downgrade to `plain` after trying the `S256` method."*

## Why `plain` fails against the actual attacker

Line up the two channels against the two methods:

| | Attacker reads the authorization **request** | Attacker reads the authorization **response** |
|---|---|---|
| `plain` | Gets the verifier directly. PKCE bypassed. | Gets the code; still needs the verifier, which was in the request. |
| `S256` | Gets a SHA-256 digest. Useless without preimage. | Gets the code; still needs the verifier. |

The interception attack of RFC 7636 §1 is a *response*-side attack, so `plain` does technically
block it — which is why it exists at all. But RFC 9700 §2.1.1 names the request-side attacker
explicitly and rules `plain` out:

> *"When using PKCE, clients SHOULD use PKCE code challenge methods that do not expose the PKCE
> verifier in the authorization request. Otherwise, attackers that can read the authorization
> request (cf. Attacker (A4) in Section 3) can break the security provided by PKCE. Currently,
> `S256` is the only such method."*

Who is that attacker? Anything that sees the outbound URL: browser history on a shared device,
a `Referer` from a page that linked into the flow, a TLS-terminating corporate proxy, a
malicious browser extension, a screenshot in a bug report, or — on mobile — the same
malicious app that can also see the response.

## The dangerous default

RFC 7636 §4.3 defines the parameter:

> *"code_challenge_method — OPTIONAL, defaults to `plain` if not present in the request. Code
> verifier transformation method is `S256` or `plain`."*

The consequence is a failure that produces no error anywhere:

- Client computes `S256(verifier)` and sends it as `code_challenge`.
- Client forgets `code_challenge_method`.
- Server records method = `plain`, challenge = the digest.
- At the token endpoint the client sends the raw verifier. Server compares `verifier ==
  challenge`. They differ. → `invalid_grant`.

That one at least fails loudly. The silent version is worse:

- Client sends the *verifier* as the challenge (a `plain` implementation) and no method.
- Everything works, forever, in every environment, with PKCE providing nothing against a
  request-reading attacker.

There is no test that distinguishes "PKCE working" from "PKCE nominally present and useless"
other than looking at the outgoing `code_challenge_method`. Assert on it.

## Computing the challenge in Java

```java
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

public final class CodeChallenges {

    private static final Base64.Encoder URL_ENCODER =
            Base64.getUrlEncoder().withoutPadding();

    private CodeChallenges() { }

    /** RFC 7636 section 4.2: BASE64URL-ENCODE(SHA256(ASCII(code_verifier))). */
    public static String s256(String codeVerifier) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return URL_ENCODER.encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required of every conforming JDK; this cannot happen.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
```

Four details that are all in the RFC and all get lost in reimplementation:

- **`ASCII(code_verifier)`** — the RFC says ASCII, not UTF-8. It happens not to matter,
  because the verifier's character set is a subset of ASCII and ASCII and UTF-8 agree there,
  but writing `US_ASCII` documents the intent and would fail loudly if someone widened the
  verifier's alphabet.
- **The digest is hashed over the *encoded string*, not over the original 32 random bytes.**
  Hashing the raw bytes is a natural-looking mistake that produces a challenge the server will
  never match.
- **base64url, no padding**, exactly as for the verifier — RFC 4648 §5's alphabet.
- **`MessageDigest` is not thread-safe.** Get a fresh instance per call, as above. A `static
  final MessageDigest` shared across request threads produces intermittently wrong digests
  under concurrency, which is a spectacular way to make logins fail one time in fifty.

Spring Security does all of this for you. `OAuth2AuthorizationRequestCustomizers.withPkce()`,
per its javadoc, *"adds the `code_challenge` and, usually, `code_challenge_method` parameters
to the OAuth 2.0 Authorization Request"*, and *"The `code_verifier` is stored in
`OAuth2AuthorizationRequest.getAttribute(String)` under the key `code_verifier` for subsequent
use in the OAuth 2.0 Access Token Request."* The hedge in *"usually"* is the `plain` fallback:
`code_challenge_method` is only emitted when `S256` is actually used.

## The method registry

RFC 7636 §6.2 creates an IANA "PKCE Code Challenge Methods" registry with `plain` and `S256`
registered, and a Specification Required registration policy. So other methods are possible in
principle. As of the sources checked here, `S256` remains the only registered method that does
not expose the verifier — which is what RFC 9700 §2.1.1 means by *"Currently, `S256` is the
only such method."*

The client-side discovery mechanism is authorization server metadata: RFC 8414's
`code_challenge_methods_supported`. RFC 9700 §2.1.1 recommends servers publish it, and a
client can read it to decide whether PKCE is supported at all — which is the foundation of the
downgrade defence in [09](09-the-pkce-downgrade-attack.md).

## Gotchas

**★ Omitting `code_challenge_method` gives you `plain`, silently.**
RFC 7636 §4.3 defines that default. Always send `code_challenge_method=S256` explicitly. Never
rely on a server's leniency; a server that defaults to `S256` is non-conforming, and you cannot
tell which kind you are talking to by whether login works.

**★ Hashing the raw random bytes instead of the encoded verifier string is the classic
reimplementation bug.**
`SHA256(randomBytes)` and `SHA256(ASCII(base64url(randomBytes)))` are different digests. Both
produce a plausible-looking 43-character challenge. Only the second matches what the server
computes. The failure is a 100% `invalid_grant` rate, so it is caught in five minutes — unless
someone "fixes" it by switching to `plain`.

**★ A shared `MessageDigest` instance is not thread-safe.**
The javadoc for `MessageDigest` does not promise thread safety, and the internal buffer is
mutable. Under concurrency you get digests computed over interleaved inputs. Symptom:
intermittent `invalid_grant` correlated with load, which everyone first blames on code expiry.

**★ Base64 standard alphabet in the challenge fails the same way it does in the verifier.**
`+` and `/` are not URL-safe, and `=` padding is not in the unreserved set. Use
`Base64.getUrlEncoder().withoutPadding()` for both.

**★ "We use `plain` because our platform has no crypto library" is almost never true.**
SHA-256 is in every JDK, every browser (`crypto.subtle.digest`), every mobile platform SDK and
every mainstream language's standard library. RFC 7636 §4.2 allows `plain` only when the client
*"cannot support `S256` for some technical reason"* and knows out of band that the server
accepts it — a conjunction that essentially never holds today.

**★ Falling back from `S256` to `plain` when a server rejects the request is forbidden.**
RFC 7636 §7.2: *"Clients MUST NOT downgrade to `plain` after trying the `S256` method."* A
retry-with-weaker-settings helper in an HTTP layer is exactly the shape of code that violates
this, and it converts a temporary server error into a permanent security downgrade.

**★ `S256` is case-sensitive and is not `s256` or `SHA256`.**
The registered value is the four characters `S256`. Servers that normalise it are being
generous; servers that do not will reject the request as an unsupported transform, which RFC
7636 §4.4.1 says must be `invalid_request`.

**★ A green end-to-end login test proves nothing about which method you used.**
Both methods produce a working flow. The only assertion that distinguishes them is on the
outgoing authorization request URL. If you have an integration test that captures the redirect
`Location`, assert `code_challenge_method=S256` in it.

## Interview questions

**★ What is the difference between `S256` and `plain`, and when is `plain` acceptable?**
`plain` sets `code_challenge = code_verifier`; `S256` sets `code_challenge =
BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`. With `plain`, the secret is published in the
authorization request URL, so any attacker who can read that request — browser history, a
`Referer`, a TLS-terminating proxy, an extension, a malicious co-installed app — has the
verifier and PKCE provides nothing. RFC 7636 §4.2 says a client capable of `S256` *"MUST use
`S256`"* and §7.2 says *"`plain` SHOULD NOT be used and exists only for compatibility with
deployed implementations."* It is acceptable only when the client genuinely cannot compute
SHA-256 and knows out of band that the server accepts `plain`, which in 2026 means essentially
never.

**★ What happens if you send a `code_challenge` but forget `code_challenge_method`?**
The server treats the method as `plain`, because RFC 7636 §4.3 says the parameter *"defaults to
`plain` if not present in the request"*. If your challenge was an `S256` digest, the token
exchange fails with `invalid_grant` every time, which is at least loud. If your challenge was
the raw verifier, everything works and you have a flow that looks like it has PKCE and does not
defend against a request-reading attacker. That second case is the dangerous one, because no
test in your suite will catch it.

**★ Why is a `plain` challenge still better than no PKCE at all?**
Against a response-only attacker it is: the interception attack of RFC 7636 §1 has the
malicious app receiving the redirect, and if it never saw the outbound request it does not have
the verifier. That is why the method exists. But RFC 9700 §2.1.1 points out that the request is
readable by a distinct and realistic attacker class, and concludes clients *"SHOULD use PKCE
code challenge methods that do not expose the PKCE verifier in the authorization request …
Currently, `S256` is the only such method."* So "better than nothing" is true and is not a
reason to choose it.

**★ Show me the challenge computation and tell me what people get wrong.**
`BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))` — hash the *encoded verifier string*, not the
random bytes it was derived from; use the URL-safe base64 alphabet; strip padding; and get a
fresh `MessageDigest` per call because it is not thread-safe. The raw-bytes mistake fails
every login, so it gets found. The thread-safety mistake fails a small fraction of logins under
load, so it gets blamed on the authorization server for weeks.

**★ Your provider's documentation says they support PKCE. How do you verify what your client
actually sends?**
Capture the authorization request URL your application generates — in Spring Security that is
the `Location` header from `OAuth2AuthorizationRequestRedirectFilter`, which an integration test
can assert on directly — and check for both `code_challenge` and `code_challenge_method=S256`.
Separately, read the authorization server's metadata document for
`code_challenge_methods_supported`, which RFC 9700 §2.1.1 recommends servers publish precisely
so clients can detect PKCE support. The provider's prose documentation is not evidence about
either side.

---

← [The code_verifier](06-the-code-verifier.md) · [Topic index](README.md) · Next → [Server-side verification](08-server-side-pkce-verification.md)
