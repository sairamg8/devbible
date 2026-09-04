---
title: "base64url is not base64, unpadded is not padded, and a permissive JSON parser will happily disagree with the verifier about what the token said — the encoding layer is where hand-rolled JWT code goes wrong before it reaches any crypto"
sidebar_label: "03 · base64url and JSON traps"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 4648 §3.2 (Padding of Encoded Data), §3.5
> (Canonical Encoding), §5 (Base 64 Encoding with URL and Filename Safe Alphabet);
> RFC 7515 §2 (Terminology — *Base64url Encoding*), §5.2 (Message Signature or MAC
> Validation), §10.12; RFC 7519 §7.2 (Validating a JWT); RFC 8725 §2.6
> (Multiplicity of JSON Encodings), §3.7 (Use UTF-8); `java.util.Base64` javadoc
> (JDK 25).
> ([rfc4648](https://www.rfc-editor.org/rfc/rfc4648.txt),
> [rfc7515](https://www.rfc-editor.org/rfc/rfc7515.txt),
> [rfc8725](https://www.rfc-editor.org/rfc/rfc8725.txt))
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x.

**Before a single signature is checked, a JWT has already passed through two parsers — a
base64url decoder and a JSON parser — and both of them have configuration-dependent
behaviour that an attacker can aim at. RFC 8725 devotes an entire threat section to the
fact that different JSON parsers disagree, and the JOSE specifications respond by making
the *encoding* strict: one alphabet, no padding, UTF-8 only, no duplicate member names.
Every one of those rules exists because somebody exploited its absence.**

## base64url, exactly

RFC 7515 §2 defines the encoding JOSE uses in a single sentence:

> *"Base64url Encoding: Base64 encoding using the URL- and filename-safe character set
> defined in Section 5 of RFC 4648 [RFC4648], with all trailing `'='` characters omitted
> (as permitted by Section 3.2) and without the inclusion of any line breaks, whitespace,
> or other additional characters."*

Three separate constraints, and Java's standard library maps onto them imperfectly:

| Constraint | RFC | What breaks if you get it wrong |
|---|---|---|
| Alphabet: `-` and `_` for positions 62 and 63 | RFC 4648 §5 | `Base64.getDecoder()` throws `IllegalArgumentException` on any token containing `-` or `_` — which is most of them |
| No `=` padding | RFC 7515 §2, RFC 4648 §3.2 | Encoders that pad produce tokens other implementations reject |
| No line breaks or whitespace | RFC 7515 §2 | MIME decoders accept newlines; JOSE must not |

RFC 4648 §5 explains the choice of `-` and `_` and why not `.`:

> *"The remaining unreserved URI character is `'.'`, but some file system environments do
> not permit multiple `'.'` in a filename, thus making the `'.'` character unattractive as
> well."*

and warns against conflating the two encodings:

> *"This encoding should not be regarded as the same as the `'base64'` encoding and should
> not be referred to as only `'base64'`."*

That is not pedantry — a JWT uses `.` as its *segment separator*, so `.` had to stay out of
the alphabet. If base64url had used `.` for character 63, the compact serialization could
not exist.

## The Java mapping, and the one decoder you want

```java
import java.util.Base64;

// ✅ The only correct choice for JOSE.
//    Uses the RFC 4648 §5 alphabet and tolerates absent padding.
Base64.Decoder decoder = Base64.getUrlDecoder();

// ❌ RFC 4648 §4 alphabet: rejects '-' and '_'.
Base64.getDecoder();

// ❌ MIME decoder: ignores characters outside the alphabet entirely,
//    which means it silently accepts corrupted input.
Base64.getMimeDecoder();
```

For **encoding**, the padding must be stripped explicitly — `Base64.getUrlEncoder()` still
emits `=`:

```java
// ✅ base64url, unpadded, as RFC 7515 §2 requires
String seg = Base64.getUrlEncoder().withoutPadding()
                   .encodeToString(json.getBytes(StandardCharsets.UTF_8));
```

`Base64.getMimeDecoder()` deserves a specific warning. Its javadoc behaviour is to **ignore
all characters outside the base64 alphabet** rather than reject them. Feed it a token
segment with an injected character and it returns bytes instead of throwing, which turns a
"reject this" into a "decode something". It is the wrong tool by a wide margin.

## Why unpadded, and why that is safe

RFC 4648 §3.2 makes padding the default:

> *"Implementations MUST include appropriate pad characters at the end of encoded data
> unless the specification referring to this document explicitly states otherwise."*

RFC 7515 §2 is exactly such a specification, and states otherwise. Padding is redundant when
the length is known, and `=` is percent-encoded in URIs — RFC 4648 §5 notes that
*"the pad character `'='` is typically percent-encoded when used in an URI."* A JWT is meant
to survive a URL, so the padding goes.

The subtle part is **canonicality**. A base64 encoding of a byte sequence whose length is
not a multiple of three leaves spare bits in the last character. RFC 4648 §3.5 requires:

> *"These pad bits MUST be set to zero by conforming encoders."*

A *non-canonical* encoding — same bytes, different final character because the spare bits
are non-zero — decodes to identical bytes but is a different string, and therefore a
different JWS Signing Input, and therefore a different signature. This is a real signature
malleability vector for anything that treats "the decoded claims" as the identity of the
token. If you deduplicate or denylist tokens, **key on the exact received string or on the
`jti` claim, never on a re-encoding of the decoded content.**

## The JSON layer, and RFC 8725's warning

RFC 8725 §2.6, *Multiplicity of JSON Encodings*:

> *"This ambiguity, where older implementations and those used within closed environments
> may generate non-standard encodings, may result in the JWT being misinterpreted by its
> recipient."*

and §3.7, *Use UTF-8*:

> *"Implementations and applications MUST do this and not use or admit the use of other
> Unicode encodings for these purposes."*

RFC 7519 §7.2 turns that into a validation step: after base64url-decoding a segment, verify
*"that the resulting octet sequence is a UTF-8-encoded representation of a completely valid
JSON object"* — and reject if it is not.

The four JSON hazards, in the order they bite:

**1 · Duplicate member names.** RFC 7515 §5.2 step 4 requires verifying that the JOSE Header
*"does not contain duplicate Header Parameter names."* JSON itself has no rule here: some
parsers keep the first occurrence, some the last, some build a multimap. If your logging
layer keeps the first and your verifier keeps the last, `{"alg":"RS256","alg":"none"}` reads
as `RS256` in your logs and `none` in your security decision. Jackson, which Spring uses,
takes the *last* occurrence by default; it can be made to fail via
`DeserializationFeature.FAIL_ON_TRAILING_TOKENS` and
`JsonReadFeature.STRICT_DUPLICATE_DETECTION`. Nimbus (used by Spring Security) parses with
its own strict JSON handling. **The rule for you: never write a second parse of a token in
your own code with a different parser than the one that validated it.**

**2 · Unicode escapes and homoglyphs.** JSON permits `\u` escapes inside strings, so the
member name `"iss"` may legally arrive on the wire as `"\u0069ss"`, and claim *values* can
contain right-to-left overrides, zero-width joiners and confusable characters. A
comparison of `iss` must be a byte/codepoint comparison of the *parsed* value against a
configured constant — never a "looks like our issuer" heuristic, never a
`startsWith`/`contains`.

**3 · Numbers.** RFC 7519's `NumericDate` is *"a JSON numeric value representing the number
of seconds from 1970-01-01T00:00:00Z UTC until the specified UTC date/time, ignoring leap
seconds."* Nothing forbids an issuer writing `1735689600.0`, and nothing forbids a value
beyond a 32-bit range. A parser that maps JSON numbers to `int` overflows; one that maps to
`double` loses precision above 2^53. **04b · The time claims** *(not written yet)*
covers what this does to `exp`.

**4 · Depth and size.** The payload is attacker-supplied JSON of unbounded size. A verifier
that parses before checking length is a denial-of-service target. Enforce a maximum token
length at the edge — a few kilobytes is generous — before anything parses it.

## A safe, explicitly-unsafe peek helper

If you need to look inside a token you have not verified — during an incident, or to route
by `kid` — write it once, name it so nobody mistakes it, and keep it out of the request
path:

```java
/**
 * Decodes a compact JWS WITHOUT verifying anything. The returned values are
 * attacker-controlled. Never use them in a security decision.
 */
static Map<String, Object> unsafePeekClaims(String compactJws) {
    String[] parts = compactJws.strip().split("\\.", -1);
    if (parts.length != 3) {
        throw new IllegalArgumentException("not a JWS compact serialization");
    }
    byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
    String json = new String(payload, StandardCharsets.UTF_8);
    // any strict JSON parser; the result is untrusted either way
    return new ObjectMapper()
        .enable(JsonReadFeature.STRICT_DUPLICATE_DETECTION.mappedFeature())
        .readValue(json, new TypeReference<Map<String, Object>>() {});
}
```

Note `.strip()`, `split("\\.", -1)`, `getUrlDecoder()`, explicit UTF-8, and strict duplicate
detection. That is four separate traps handled in eight lines, which is a fair measure of
how much this layer costs you when you do it yourself. The reason to use
**`NimbusJwtDecoder`** *(not written yet)* is that it has already paid all of them.

## Gotchas

**★ `Base64.getDecoder()` throws on most real tokens.**
JOSE uses the URL-safe alphabet, so `-` and `_` appear routinely. The standard decoder
rejects them with `IllegalArgumentException: Illegal base64 character 2d`. Use
`Base64.getUrlDecoder()`.

**★ `Base64.getMimeDecoder()` silently ignores illegal characters instead of failing.**
That turns "this token was tampered with" into "here are some bytes". Never use the MIME
decoder on JOSE input.

**★ `Base64.getUrlEncoder()` still emits `=` padding.**
RFC 7515 §2 requires *"all trailing `'='` characters omitted."* You must call
`.withoutPadding()`. A padded segment produces a token that strict verifiers reject and, if
you are signing, a signing input that differs from what you intended.

**★ Deduplicating tokens by their decoded content is signature-malleable.**
Non-canonical base64 (RFC 4648 §3.5) means the same claims can arrive as different strings.
Key a denylist or a replay cache on `jti` or on the exact received string, never on a
re-encoding.

**★ Two different JSON parsers on the same token can disagree about duplicate keys.**
Logging with Jackson defaults and validating with Nimbus is enough to produce a log line
that contradicts the security decision. Parse once, in the verifier, and log from the
verified `Jwt` object.

**★ A JSON parser that accepts UTF-16 or a BOM violates RFC 8725 §3.7.**
*"Implementations and applications MUST … not use or admit the use of other Unicode
encodings."* Decode the segment explicitly as `StandardCharsets.UTF_8` rather than relying
on a platform default — which, on JDK 18+, is UTF-8 anyway, but relying on it is how the
bug returns when the code is ported.

**★ There is no length limit in the format, so you must impose one.**
Parse-then-check is a DoS. Reject anything over a fixed maximum at the filter or gateway
before the token reaches a parser. This is also what protects you from the header-size
failures described in [01](01-encoded-not-encrypted.md).

**★ `NumericDate` is "a JSON numeric value", not an integer.**
Fractional seconds and values outside `int` range are both legal JSON. Parse into a `long`
or a `double`-tolerant path and convert to `Instant`; do not use `Integer.parseInt`.

**★ Whitespace inside a segment is illegal but many decoders tolerate it.**
RFC 7515 §2 says *"without the inclusion of any line breaks, whitespace, or other additional
characters."* If your decoder tolerates it, two implementations can compute different
signing inputs from the same wire bytes.

## Interview questions

**★ Why does JOSE use base64url instead of base64, and why unpadded?**
Two reasons, both structural. The alphabet: standard base64's 62nd and 63rd characters are
`+` and `/`, which need percent-encoding in a URL and, in the case of `/`, in a path. RFC
4648 §5's URL-safe alphabet uses `-` and `_` instead. Critically it could not use `.`,
because `.` is the JWT segment separator — RFC 4648 §5 notes `.` was rejected anyway for
filesystem reasons. The padding: `=` is also percent-encoded in URIs and is redundant when
the length is known, so RFC 7515 §2 explicitly overrides RFC 4648 §3.2's "MUST pad" and
requires trailing `=` to be omitted.

**★ What can go wrong if the component that logs a token and the component that validates it
use different JSON parsers?**
They can disagree about duplicate member names. JSON does not define the behaviour, so one
parser may keep the first occurrence and another the last. A token with
`{"alg":"RS256","alg":"none"}` or with `sub` twice can therefore be logged as one thing and
acted on as another — you lose your audit trail exactly when you need it, and in the worst
case an attacker chooses which parser sees which value. RFC 7515 §5.2 requires the verifier
to reject duplicate header parameter names outright; the practical rule is to parse once, in
the verifier, and derive everything else from the verified object.

**★ You are asked to build a replay cache for JWTs. What do you key it on?**
`jti`, if the issuer sets it — RFC 7519 §4.1.7 exists for exactly this and requires the value
be assigned so that *"there is a negligible probability that the same value will be
accidentally assigned to a different data object."* If `jti` is absent, key on the exact
received compact serialization string. Do **not** key on a hash of the decoded claims or on
a re-encoding: base64 is not canonical, so the same claims can legitimately arrive as
different strings, and an attacker can generate variants that miss your cache while still
verifying. Also give the cache a TTL tied to `exp` so it does not grow without bound.

**★ Why is "verify that the decoded octets are valid UTF-8 JSON" a separate, explicit
validation step in RFC 7519 §7.2?**
Because base64url decoding always succeeds in producing *bytes*, and those bytes are
attacker-controlled. Without the step, a verifier can end up feeding arbitrary binary into a
JSON parser, where lenient error recovery, alternative encodings or a BOM can produce an
object the attacker shaped. RFC 8725 §3.7 goes further and forbids admitting any Unicode
encoding other than UTF-8. Making it a numbered step means an implementation cannot treat it
as an optimisation to skip.

**★ Could an attacker change a token's bytes without changing its meaning?**
Yes, at the encoding layer, and that is why you must never re-derive identity from decoded
content. Base64 leaves spare bits in the final character when the input length is not a
multiple of three; RFC 4648 §3.5 requires conforming *encoders* to zero them, but a decoder
that does not enforce it will accept several distinct strings that decode to identical
bytes. Those strings have different signing inputs, so they will not carry a valid signature
for the original key — meaning the attack is not a signature bypass, but it *is* a way to
evade a naive denylist or a deduplication cache that hashes the decoded payload.

---

← [Compact serialization](02-compact-serialization.md) · [Topic index](README.md) · Next → [The header contract and alg](03-the-jose-header.md)
