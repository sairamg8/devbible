---
title: "The compact serialization is three base64url segments joined by dots, and knowing that the signature is computed over the encoded bytes — not over the JSON — explains most of what a verifier is allowed to do"
sidebar_label: "02 · Compact serialization"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 7515 §2 (Terminology), §3.1 (JWS Compact
> Serialization Overview), §5.1–§5.2 (Message Signature or MAC Computation /
> Validation), §7.1 (JWS Compact Serialization); RFC 7519 §3.1 (Example JWT),
> §6.1 (Example Unsecured JWT), §7.2 (Validating a JWT).
> ([rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc7519](https://www.rfc-editor.org/rfc/rfc7519.txt))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Every JWT you will handle is a JWS in compact serialization: exactly two dot characters,
three base64url segments, no whitespace, no line breaks. The format is dull, and that is
the point — its dullness is what lets a verifier do the one thing that actually matters,
which is to compute a signature over the *literal bytes it received* rather than over
whatever its JSON parser decided those bytes meant. Every re-serialization bug, every
"the signature works locally but not through the gateway" ticket, and the entire
`alg: none` family trace back to this one structural fact.**

## The format, verbatim

RFC 7515 §7.1 defines it as:

> *"In the JWS Compact Serialization, a JWS is represented as the concatenation:
> `BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload) || '.' ||
> BASE64URL(JWS Signature)`"*

So, structurally:

```text
<base64url(header JSON)>.<base64url(payload JSON)>.<base64url-signature>
```

Three segments, two dots, and the whole thing is URL-safe by construction — no `+`, no `/`,
no `=`, so it survives a query string, a cookie value, a header, and a filename without
percent-encoding. That is why the encoding is base64url rather than base64.

RFC 7519 §3.1 publishes a complete example token; because the RFC publishes it, it is safe
to reproduce here (line breaks are the RFC's, added for display — a real token has none):

```text
eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9
.
eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFt
cGxlLmNvbS9pc19yb290Ijp0cnVlfQ
.
dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Its header decodes to `{"typ":"JWT","alg":"HS256"}` and its payload to a claims set with
`iss`, `exp` and a private claim. This is **RFC 7519's own example, signed with the RFC's
own example key** — it is a specification artefact, not a credential. Everywhere else in
this topic, a signature is written as `<base64url-signature>` and never as plausible base64.

## What the three segments are

| Segment | RFC 7515 name | Contains |
|---|---|---|
| 1 | JWS Protected Header | The JOSE header JSON — `alg`, and optionally `typ`, `kid`, `cty`, `crit`, `jku`, `x5t`… |
| 2 | JWS Payload | For a JWT, the JWT Claims Set JSON — `iss`, `sub`, `aud`, `exp`, `scope`, your private claims |
| 3 | JWS Signature | The raw signature or MAC octets, base64url-encoded |

"Protected" in *JWS Protected Header* means exactly what it sounds like: RFC 7515 §2 —

> *"JSON object that contains the Header Parameters that are integrity protected by the JWS
> Signature digital signature or MAC operation."*

The compact serialization has **only** a protected header. The JSON serialization (which
JWTs do not use) additionally allows an *unprotected* header whose parameters are not
covered by the signature. If you ever find yourself reasoning about unprotected headers in
a JWT context, you have wandered into the wrong serialization.

## The signing input is the encoded bytes, and this is load-bearing

RFC 7515 §2 again, verbatim:

> *"JWS Signing Input: The input to the digital signature or MAC computation. Its value is
> `ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))`."*

Read that as an instruction to a verifier: **take the first two segments and the dot between
them exactly as they arrived, as ASCII, and verify against that**. Do not parse the JSON and
re-encode it. Do not normalise whitespace. Do not sort keys. Do not re-base64 anything.

The consequences are concrete:

- **JSON is not canonical, and JOSE does not require it to be.** `{"a":1,"b":2}` and
  `{ "b": 2, "a": 1 }` are the same object and different bytes and therefore different
  signatures. Because the signature is over bytes, this never matters — as long as nobody
  round-trips the token through a JSON library.
- **Any middlebox that "normalises" a token breaks it.** A gateway that decodes a JWT to
  inspect claims and then re-encodes it will produce a token that no longer verifies. The
  correct behaviour for an inspecting proxy is to pass the original string through
  untouched.
- **Trailing whitespace, a stray newline, or a `\r` from a config file is fatal.** A token
  read from a file with `Files.readString` and passed with its trailing newline intact will
  fail to parse or fail to verify, and the error message will say "Malformed token", not
  "you have a newline".
- **`Bearer ` prefix stripping is your job, not the decoder's.** `JwtDecoder.decode` wants
  the compact serialization, not the full `Authorization` header value. Spring's
  `BearerTokenAuthenticationFilter` strips it before the decoder sees it; hand-rolled code
  frequently does not.

## Verification, as the specification orders it

RFC 7515 §5.2 gives the validation steps. Compressed to what a JWT verifier does:

1. Split on `.` and check you got three parts.
2. Base64url-decode segment 1; confirm the octets are valid UTF-8 and parse as JSON;
   **reject duplicate header parameter names**.
3. Confirm you understand every header parameter you are required to understand, including
   everything listed in `crit`.
4. Base64url-decode segments 2 and 3.
5. Validate the signature over the JWS Signing Input using the algorithm from `alg` —
   restricted to the algorithms *you* permit, never simply "whatever `alg` says".
6. If validation fails, reject the whole JWS.

RFC 7519 §7.2 layers the JWT-specific steps on top: verify the token contains at least one
`.`, decode and parse the header, determine whether it is a JWS or a JWE, validate
accordingly, then check `cty` for nesting, then decode and parse the claims. And it ends
with the only instruction that matters at the end of a validation routine:

> *"If any of the listed steps fail, then the JWT MUST be rejected for processing."*

Note the ordering: **the signature is checked before the claims are trusted.** A verifier
that reads `iss` out of the payload to decide which key to use is doing something delicate,
not something forbidden — see **08b · kid lookup** *(not written yet)* — but a verifier that
*acts* on a claim before the signature verifies has no security at all.

## Splitting it correctly in Java

Three traps live in a one-line `split`:

```java
// WRONG on an alg:none token — String.split discards trailing empty strings
String[] parts = token.split("\\.");          // {"header", "payload"} — length 2!

// Correct: keep empty trailing fields
String[] parts = token.split("\\.", -1);      // {"header", "payload", ""}

if (parts.length != 3) {
    throw new BadJwtException("Not a JWS compact serialization");
}
```

The `alg: none` case is not hypothetical: RFC 7519 §6.1 publishes an unsecured JWT whose
third segment is the empty string, so the token *ends* with a dot. Code that uses
`split("\\.")` sees two segments, concludes "malformed", and may fall into an error path
that is less careful than the success path. Code that uses `split("\\.", -1)` sees three,
one of which is empty, and can reject it explicitly — which is what you want.

The second trap is that `String.split` takes a **regex**, and `.` is the regex "any
character". `token.split(".")` returns an empty array. It compiles, it runs, it returns
nothing, and the bug reads as "the token was empty".

The third: **do not hand-roll this at all in application code.** Use the decoder. The only
legitimate reason to split a JWT by hand is to log the `kid` from an unverifiable token
during an incident, and even then you write the helper once, name it `unsafePeek`, and put
it in a test-scoped class.

## Detached payloads, and why you will not meet one

RFC 7515 Appendix F describes *detached content*: the payload segment is transmitted empty
and the actual payload is conveyed out of band, with the verifier reconstructing the signing
input. It is used in HTTP message signing and in some financial APIs (UK Open Banking's
`x-jws-signature` is the well-known case). It is **not** used by OAuth2 access tokens or
OIDC ID tokens. If you are looking at a bearer token with an empty middle segment, you have
found a bug or an attack, not a detached JWS.

## The one nesting case: `cty: JWT`

RFC 7519 §5.2 says that when nested signing or encryption is used, *"this Header Parameter
MUST be present"* and its *"value MUST be `JWT`"*. A nested JWT is a JWT whose payload is
itself a complete JWT — sign-then-encrypt produces one. Two operational points:

- If you see `cty: JWT`, the payload segment is **not** a claims set; do not parse it as
  one. RFC 7519 §7.2 step 7 exists precisely to catch this.
- Spring's `NimbusJwtDecoder` targets signed JWTs. Handling nested JWE requires configuring
  Nimbus directly through the processor customizer, and if your architecture needs it, that
  is a conversation about whether the resource server should be decrypting anything at all.

## Gotchas

**★ `token.split(".")` returns an empty array because `.` is a regex metacharacter.**
You need `split("\\.")`, and you almost certainly need `split("\\.", -1)` so a trailing
empty signature segment is preserved rather than silently dropped.

**★ A JWT with a trailing newline fails with "Malformed token" and no hint why.**
Reading a token from a file, an env var set by a heredoc, or a copy-paste from a terminal
brings `\n` or `\r\n` with it. `.strip()` the value at the boundary where it enters your
program, not deep inside the verifier.

**★ Any component that decodes and re-encodes a JWT invalidates it.**
The signature is over the received bytes, and JSON serialization is not canonical, so
re-serializing changes them. Gateways, service meshes and logging filters must forward the
original string verbatim. If a gateway needs to add information, it mints its *own* token —
**12 · Token relay** *(not written yet)* owns that pattern.

**★ Passing the whole `Authorization` header value to `JwtDecoder.decode` fails.**
The value is `Bearer <token>`; the space and the scheme are not part of the compact
serialization. In Spring the `BearerTokenAuthenticationFilter` handles the strip, so this
bites people writing their own filter or calling the decoder from a scheduled job.

**★ Compact serialization has no unprotected header, so "some headers are not signed" is a
JSON-serialization concept that does not apply.**
Every header parameter in a JWT is inside the protected header and is therefore covered by
the signature — *after* verification. Before verification it is attacker-controlled data,
which is the whole reason **11c · Header injection** *(not written yet)* exists.

**★ Duplicate JSON member names in the header must cause rejection.**
RFC 7515 §5.2 step 4 requires verifying that the resulting JOSE Header *"does not contain
duplicate Header Parameter names."* Some permissive JSON parsers silently keep the last (or
the first) occurrence, which lets an attacker present `{"alg":"RS256","alg":"none"}` and
have the parser and the verifier disagree about which one is in force.

**★ An empty third segment is a legal encoding of an unsecured JWS, not a malformed token.**
RFC 7519 §6.1's published example ends with a bare dot. Your code must recognise and reject
it deliberately rather than stumble into a generic parse-failure path.

**★ `cty: JWT` means the payload is another JWT and is not a claims set.**
Parsing it as claims produces garbage or an exception. RFC 7519 §7.2 makes checking `cty`
an explicit validation step for exactly this reason.

## Interview questions

**★ Walk me through what a verifier does with the string it takes out of the
`Authorization` header.**
Strip the `Bearer ` scheme and any surrounding whitespace. Split on `.` keeping empty
trailing fields; require three segments. Base64url-decode the first segment, confirm it is
valid UTF-8, parse it as JSON, reject duplicate member names, and read `alg`, `typ` and
`kid`. Check `alg` against the set of algorithms *this verifier permits* — not against
whatever the token asked for. Resolve a key, typically by `kid` against a cached JWK set.
Recompute the signature over the JWS Signing Input, which is the first two segments plus
the dot, taken as received. Only if that matches do you decode the payload and start
checking `iss`, `aud`, `exp` and `nbf`. Any failure at any step rejects the whole token.

**★ Why is the signature computed over the base64url text rather than over the JSON?**
Because JSON has no canonical form. Key order, whitespace, escaping of non-ASCII characters
and number formatting are all free choices, so two byte sequences can represent the same
object. If the signature were over "the JSON", every verifier would need to agree on a
canonicalisation, and canonicalisation bugs are a notorious source of signature-bypass
vulnerabilities — the XML-DSig world learned this expensively. Signing the received octets
removes the whole class: there is exactly one byte sequence, and you verify it or you do
not.

**★ A team reports that tokens verify in the service but fail after they put an API gateway
in front of it. What do you look at first?**
Whether the gateway is passing the token through byte-for-byte. The usual cause is a gateway
that parses the JWT to route or log on a claim and then re-emits it from its parsed form,
which changes the encoded bytes and breaks the signature. Second candidate: header
mangling — a proxy that folds, trims or case-normalises the `Authorization` value, or one
whose header size limit truncates a large token. Third: the gateway itself is minting a new
token with a different issuer or audience and the resource server is still configured for
the original one.

**★ What is the JWS Signing Input, precisely?**
`ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))` — RFC 7515
§2. The encoded header, a literal dot, and the encoded payload, interpreted as ASCII. The
signature segment is *not* part of it, and neither is the second dot.

**★ Why does a token produced with `alg: none` end with a dot, and why does that matter for
your parsing code?**
Because the JWS Signature is the empty octet sequence, so its base64url encoding is the
empty string, and the compact serialization still requires two dots. It matters because
Java's `String.split` with the default limit discards trailing empty strings, so naive code
sees a two-segment token and takes a "malformed" branch instead of an "unsecured token,
reject" branch. Those branches often differ in how carefully they log, and in badly written
code the malformed branch has sometimes been the one that fell through to accepting the
token.

**★ Can you tell, from the token alone, whether it is a JWS or a JWE?**
Yes, in practice. A JWS compact serialization has three segments and two dots; a JWE compact
serialization has five segments and four dots. RFC 7519 §7.2 makes the check explicit: after
decoding the header, determine whether the JWT is a JWS or a JWE — the header of a JWE
carries an `enc` parameter, which a JWS never has. Counting dots is the cheap first test.

---

← [Encoded, not encrypted](01-encoded-not-encrypted.md) · [Topic index](README.md) · Next → [base64url and JSON traps](02b-base64url-and-json-traps.md)
