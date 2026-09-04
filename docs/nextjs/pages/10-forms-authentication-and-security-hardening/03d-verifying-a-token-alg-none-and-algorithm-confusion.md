---
title: "Every JWT mistake that matters happens in the verify call, and every one of them fails open — the token is accepted, nothing is logged, and the application behaves normally"
sidebar_label: "Verifying a token, correctly"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [RFC 8725 — JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.txt) (BCP 225), the [`jose` `JWTVerifyOptions`](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md) reference, the [`jsonwebtoken` README](https://github.com/auth0/node-jsonwebtoken), and [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`). Documentation-verified; no sandbox run.
> Target: **Next.js 16.3.4** · **jose 6.2.11** · **jsonwebtoken 9.0.3**.

**A signature check has exactly two outcomes and only one of them is visible. When verification is too strict you get an error, a ticket and a fix. When it is too loose you get a working application in which anyone can mint a session for any user, and there is nothing to notice. This page is about the second case. The named attacks are thirty seconds of work for an attacker and one line of configuration for you, and the JWT specification's own Best Current Practices document lists them because libraries and applications kept shipping them.**

## The first mistake: decoding is not verifying

`jsonwebtoken` documents this with two consecutive warnings on a single function, which tells you how often it is misused:

> *"`jwt.decode(token [, options])` (Synchronous) Returns the decoded payload without verifying if the signature is valid."*

> *"**Warning:** This will **not** verify whether the signature is valid. You should **not** use this for untrusted messages. You most likely want to use `jwt.verify` instead."*

> *"**Warning:** When the token comes from an untrusted source (e.g. user input or external request), the returned decoded payload should be treated like any other user input; please make sure to sanitize and only work with properties that are expected."*

`decode` reads base64url. That is all it does. A token whose payload says `{"userId":"admin"}` and whose signature is the string `x` decodes perfectly. The reason this reaches production is that `decode` is *easier* — it is synchronous, it needs no key, and it works in every runtime — so it gets used in the place where the key is inconvenient: a middleware, a helper that also runs on the client, a "just show the user's name" utility. Then someone reuses that helper for an authorization decision.

🔴 **A rule that costs nothing: no module in your codebase exports a function that returns claims without a key.** If a caller needs the user's name, give them the verified session from the Data Access Layer.

## The two named attacks

RFC 8725 §2.1, verbatim:

> *"Signed JSON Web Tokens carry an explicit indication of the signing algorithm, in the form of the `alg` Header Parameter, to facilitate cryptographic agility. This, in conjunction with design flaws in some libraries and applications, has led to several attacks:"*

> *"The algorithm can be changed to `none` by an attacker, and some libraries would trust this value and 'validate' the JWT without checking any signature."*

> *"An `RS256` (RSA, 2048 bit) parameter value can be changed into `HS256` (HMAC, SHA-256), and some libraries would try to validate the signature using HMAC-SHA256 and using the RSA public key as the HMAC shared secret."*

The second one is worth restating because it is not intuitive. With RSA, the *public* key is public — it is on your JWKS endpoint. If the verifier is willing to accept `HS256`, it will use whatever key it has as the HMAC secret, and the key it has is the public one. The attacker knows the public key. So they forge any payload they like, HMAC it with the public key, set `alg: HS256`, and the verifier agrees. A published key becomes a signing key.

The mitigation, RFC 8725 §3.1, verbatim:

> *"Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations. The library MUST ensure that the `alg` or `enc` header specifies the same algorithm that is used for the cryptographic operation. Moreover, each key MUST be used with exactly one algorithm, and this MUST be checked when the cryptographic operation is performed."*

Three requirements, and the one applications skip is the first: **you must pass the allowlist.** The library is required to let you; it is not required to guess.

## What the defaults actually are

`jose` documents its `algorithms` option precisely:

> *"A list of accepted JWS `alg` (Algorithm) Header Parameter values. By default all `alg` (Algorithm) values applicable for the used key/secret are allowed."*

> *"**NOTE:** Unsecured JWTs (`{ "alg": "none" }`) are never accepted by this API."*

So `jose` closes the `none` attack unconditionally — that is a library guarantee, stated in its own reference, and it is why the Next.js guide's example is safe by construction. It does **not** narrow the algorithm set for you: with a symmetric key it will accept any HMAC variant that key is applicable to. That is a much smaller hole than RS→HS confusion, but it is still not an allowlist, and the RFC's *"each key MUST be used with exactly one algorithm"* is not satisfied by a default.

`jsonwebtoken` documents its per-key-type defaults:

> *"`algorithms`: List of strings with the names of the allowed algorithms. For instance, `["HS256", "HS384"]`. If not specified a defaults will be used based on the type of key provided — secret: `['HS256', 'HS384', 'HS512']`, rsa: `['RS256', 'RS384', 'RS512']`, ec: `['ES256', 'ES384', 'ES512']`, default: `['RS256', 'RS384', 'RS512']`."*

Modern `jsonwebtoken` therefore does not blindly cross key types either. Neither library is the naive one described in the RFC — but the RFC describes *applications*, not only libraries, and an application that passes a raw string as the key and never states an algorithm has published its trust decision as "whatever the library felt like".

## The verification you should actually ship

The Next.js guide's version, which is the minimum:

```ts
// app/lib/session.ts — as published in the Next.js authentication guide
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { SessionPayload } from '@/app/lib/definitions'

const secretKey = process.env.SESSION_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    console.log('Failed to verify session')
  }
}
```

Note `algorithms: ['HS256']` is present even though `jose` already rejects `none`. That is the RFC's rule being followed rather than delegated.

Here is the version with the remaining `JWTVerifyOptions` that matter, each of which closes something specific:

```ts
// lib/session.ts
import 'server-only'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const SECRET = process.env.SESSION_SECRET
if (!SECRET) throw new Error('SESSION_SECRET is not set')

const key = new TextEncoder().encode(SECRET)

const ISSUER = 'sprintdesk'
const AUDIENCE = 'sprintdesk:web'

export type SessionPayload = JWTPayload & {
  userId: string
  role: 'admin' | 'member'
  sessionVersion: number
}

export async function signSession(claims: Omit<SessionPayload, keyof JWTPayload>, expiresAt: Date) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'session+jwt' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key)
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key, {
      algorithms: ['HS256'],          // RFC 8725 §3.1 — state it, do not inherit it
      issuer: ISSUER,                 // reject tokens minted by another of your services
      audience: AUDIENCE,             // reject tokens minted for another audience
      typ: 'session+jwt',             // RFC 8725 §3.11 — explicit typing
      requiredClaims: ['userId', 'role', 'sessionVersion'],
      clockTolerance: 5,              // seconds, for fleet clock drift
      maxTokenAge: '7 days',          // cap absolute age independent of `exp`
    })
    return payload
  } catch {
    return null                       // any failure is "no session", never a partial one
  }
}
```

What each option is doing, from the `jose` reference:

- **`issuer` / `audience` / `subject`** — each *"makes the … Claim presence required"* as well as checking it. Without them, a token your billing service minted for its own purposes is accepted by your web app if it happens to share a secret.
- **`typ`** — *"Expected JWT `typ` (Type) Header Parameter value. This option makes the JWT `typ` (Type) Header Parameter presence required."* This is RFC 8725 §3.11: *"Sometimes, one kind of JWT can be confused for another. If a particular kind of JWT is subject to such confusion, that JWT can include an explicit JWT type value, and the validation rules can specify checking the type."* It is how you stop a password-reset token being presented as a session token.
- **`clockTolerance`** — *"Clock skew tolerance in seconds … Used when validating the JWT `nbf` (Not Before) and `exp` (Expiration Time) claims."*
- **`maxTokenAge`** — *"Maximum time elapsed from the JWT `iat` (Issued At) Claim value … This option makes the JWT `iat` (Issued At) Claim presence required."* A belt to `exp`'s braces: a token forged with a distant `exp` still fails if `iat` is old, and a token with no `iat` at all is rejected.
- **`requiredClaims`** — a token missing `role` should be an error, not `undefined` flowing into a comparison that evaluates to `false` and silently denies (or, worse, into `?? 'admin'`).

## The secret itself

RFC 8725 §2.2:

> *"Some applications use a keyed Message Authentication Code (MAC) algorithm, such as `HS256`, to sign tokens but supply a weak symmetric key with insufficient entropy (such as a human-memorable password). Such keys are vulnerable to offline brute-force or dictionary attacks once an attacker gets hold of such a token."*

"Once an attacker gets hold of such a token" is a low bar — every user of your site holds one. The Next.js guide's generator is the right shape:

```bash
openssl rand -base64 32
```

> *"This command generates a 32-character random string that you can use as your secret key and store in your environment variables file."*

A `SESSION_SECRET` that a human typed is a password you have published to every visitor in signed form.

## The headers you must not trust

RFC 8725 §3.10, verbatim:

> *"The `kid` (key ID) header is used by the relying application to perform key lookup. Applications should ensure that this does not create SQL or LDAP injection vulnerabilities by validating and/or sanitizing the received value."*

> *"Similarly, blindly following a `jku` (JWK set URL) or `x5u` (X.509 URL) header, which may contain an arbitrary URL, could result in server-side request forgery (SSRF) attacks. Applications SHOULD protect against such attacks, e.g., by matching the URL to a whitelist of allowed locations and ensuring no cookies are sent in the GET request."*

These live in the **unverified** part of the token. Anything you read before checking the signature is attacker-controlled, and `kid` is the classic one because key lookup necessarily happens first. If you accept multiple keys, map `kid` through a fixed dictionary; never interpolate it into a path, a query or a URL.

```ts
const KEYS: Record<string, Uint8Array> = { 'v1': keyV1, 'v2': keyV2 }

// A fixed lookup: an unknown `kid` yields undefined and the verify never runs.
const candidate = KEYS[header.kid ?? '']
if (!candidate) return null
```

## Signing is not encrypting

A JWS — what `SignJWT` produces — proves the payload was not altered and was produced by someone holding the key. It does **not** hide the payload; base64url is an encoding. Anyone with the token reads every claim.

RFC 8725 §2.3 records the failure mode of the encrypted variant too:

> *"Some libraries that decrypt a JWE-encrypted JWT to obtain a JWS-signed object do not always validate the internal signature."*

So an encrypted token is not automatically an authenticated one. If you nest JWS inside JWE, verify the inner signature after decrypting — decryption alone tells you the sender had the encryption key, which in a shared-key setup is everyone.

⚠️ Auth.js's session token is genuinely encrypted; the Next.js guide's example is a plain signed JWT despite its function being named `encrypt`. That naming has misled people into putting an email address in the payload. It is signed, not sealed.

## The `none` algorithm is not simply banned

RFC 8725 §3.2 is more nuanced than the folklore, and it is worth knowing so you do not misquote it:

> *"That said, if a JWT is cryptographically protected end-to-end by a transport layer, such as TLS using cryptographically current algorithms, there may be no need to apply another layer of cryptographic protections to the JWT. In such cases, the use of the `none` algorithm can be perfectly acceptable. The `none` algorithm should only be used when the JWT is cryptographically protected by other means. … JWT libraries SHOULD NOT generate JWTs using `none` unless explicitly requested to do so by the caller. Similarly, JWT libraries SHOULD NOT consume JWTs using `none` unless explicitly requested by the caller."*

For a session cookie, none of that applies — the token crosses a trust boundary you do not control, namely the user's browser. `alg: none` is never acceptable for a session token. But the RFC's actual rule is *explicit request*, not prohibition, and `jose` chose to go further and never accept it at all.

## Where verification runs

Verification needs the key, and the key lives in the Data Access Layer, which carries `import 'server-only'`. That is the whole answer to "where should I verify". Not in a Client Component (the key would ship to the browser). Not in a shared utility imported by both (same outcome). Not in a proxy that then *passes the decoded claims onward as a trusted header* — the DAL should verify the token itself, per request, because a header injected upstream is only as trustworthy as your ability to guarantee nothing else can set it.

## Gotchas

**★ Symptom: an authorization check reads a `role` that the user set themselves.** Cause: the code path used `decode` rather than `verify` — usually in a helper written for a place where the key was awkward to reach. Fix: delete the decode-only helper; return claims exclusively from the verifying function.

```ts
const session = await verifySession(await readSessionCookie())
if (!session) redirect('/login')
if (session.role !== 'admin') throw new Error('Forbidden')
```

**★ Symptom: a security review flags that anyone with your public JWKS can forge a token.** Cause: verification accepted both RSA and HMAC families, so an attacker re-signed with `alg: HS256` using your public key as the HMAC secret. Fix: pass the exact algorithm.

```ts
await jwtVerify(token, publicKey, { algorithms: ['RS256'] })
```

**★ Symptom: `verifySession` returns `undefined` and callers treat that as "anonymous", but one caller treats it as "not checked yet" and proceeds.** Cause: the catch block returns nothing, so failure and absence are the same value with different meanings at different call sites. Fix: return `null` explicitly and type the function as `Promise<SessionPayload | null>`, so every caller must handle it.

**★ Symptom: a password-reset link, once used, also works as a session cookie.** Cause: both tokens were signed with the same key and neither declares a type, so the session verifier happily accepts the reset token. Fix: distinct `typ` values and a `typ` option on every verify — RFC 8725 §3.11 exists for exactly this.

```ts
new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: 'password-reset+jwt' })
await jwtVerify(token, key, { algorithms: ['HS256'], typ: 'session+jwt' })
```

**★ Symptom: tokens issued by a sibling service are accepted by the web app.** Cause: a shared `SESSION_SECRET` and no `issuer`/`audience` check, so any token signed with that secret validates everywhere. Fix: set and verify both, or give each service its own key.

**★ Symptom: intermittent `"exp" claim timestamp check failed` on freshly issued tokens.** Cause: clock drift across instances with zero tolerance. Fix: `clockTolerance: 5`. Do not "fix" it by widening the token's lifetime.

**★ Symptom: `SESSION_SECRET` is a memorable phrase and a pentest cracks it offline.** Cause: an HMAC key with insufficient entropy — RFC 8725 §2.2 — and every user holds a token to attack it with. Fix: regenerate with `openssl rand -base64 32`, deploy, and accept that every existing session is invalidated (which is the correct outcome).

**★ Symptom: an SSRF from your auth service to an internal metadata endpoint.** Cause: the verifier fetched the key from the token's own `jku` header. Fix: never read `jku`/`x5u` from the token; resolve keys from a fixed configuration, and if you support `kid`, look it up in a literal map.

**★ Symptom: the token is encrypted and the team believes it is therefore trustworthy.** Cause: decryption succeeded and the inner signature was never checked — RFC 8725 §2.3. Fix: verify the inner JWS after decrypting; do not treat successful decryption as authentication.

**★ Symptom: a user's email appears in a browser-side error report.** Cause: it was a claim in a *signed* (not encrypted) token, and the token is fully readable by anything holding it. Fix: put the id in the token and read the email from the database in the DAL.

**★ Symptom: `verifySession` throws, an unhandled rejection surfaces in a Server Component, and the whole route 500s for an expired cookie.** Cause: `jwtVerify` rejects on expiry, and expiry is a normal event, not an exceptional one. Fix: catch and map to `null`, as in the helper above — an expired session is an anonymous user, not a server error.

## Interview questions

**★ Explain the `alg: none` attack and why "our library is fine" is only half an answer.**
The `alg` header is attacker-controlled data inside the token. A verifier that reads it and dispatches on it can be told there is no signature, and a naive implementation then "validates" a token it never checked. Modern libraries close this — `jose` states outright that unsecured JWTs *"are never accepted by this API"* — but the RFC's requirement is on the *application*: it *"MUST enable the caller to specify a supported set of algorithms"*, and the caller has to actually specify. Relying on a library default means your trust decision lives in a dependency's changelog.

**★ How does RS256-to-HS256 confusion turn a public key into a signing key?**
RSA verification uses the public key, which is published. HMAC verification uses a shared secret. If the verifier accepts whichever family the `alg` header names and passes it the key it happens to hold, an attacker sets `alg: HS256` and computes an HMAC over their forged payload using the *public* key bytes as the secret. Both sides then compute the same MAC, and the token validates. The whole attack is possible because the algorithm was taken from the token instead of from configuration.

**★ Why is `jwt.decode` in a codebase a smell even when the specific call site is harmless?**
Because it is a function that returns claims without proving anything, and functions get reused. The harmless call site — rendering a name, logging a user id — is a template that the next engineer copies into an authorization check. `jsonwebtoken` warns twice on that single function for a reason. Keeping exactly one path from token to claims, and having it require the key, removes the possibility rather than relying on review.

**★ What do `issuer`, `audience` and `typ` protect against that a signature does not?**
Signature confusion between *your own* tokens. A signature only says "someone with this key produced this". If several of your services or several token kinds share a key, that is true of a password-reset token, a service-to-service token and a session token alike. `iss`/`aud`/`typ` make the verifier assert *which* token it is looking at, and `jose` makes each of those options additionally require the claim's presence, so an omitted claim fails rather than defaulting.

**★ Why does `maxTokenAge` matter if you already set `exp`?**
Because `exp` is a value inside the token and `maxTokenAge` is a rule outside it. If a signing path is ever misconfigured — a bug, a migration, a service that sets a ten-year expiry for a batch job — `exp` alone accepts it. `maxTokenAge` bounds the token by elapsed time since `iat` regardless of what `exp` claims, and it makes `iat` mandatory, which closes the variant where the token omits `iat` altogether.

**★ Is `alg: none` forbidden by the spec?**
Not unconditionally, and quoting it as forbidden is a good way to lose an argument with someone who has read RFC 8725. The RFC says it *"can be perfectly acceptable"* where the JWT is *"cryptographically protected end-to-end by a transport layer"*, and that libraries SHOULD NOT produce or consume it *"unless explicitly requested by the caller"*. For a browser session cookie there is no such protection — the token sits in the user's own browser, which is the untrusted party — so it is never acceptable there. The right formulation is "not for anything crossing a trust boundary", not "banned".

**★ A colleague wants to verify the token once in the proxy and pass `x-user-id` downstream so the DAL does not repeat the work. What is wrong with that?**
The downstream code now trusts a header, and a header is trustworthy only if you can guarantee nothing else can set it — which means guaranteeing the proxy runs on every path (it does not: matchers exclude routes, and Server Actions and Route Handlers are separately reachable) and that no client-supplied `x-user-id` survives. That is a lot of guarantees to buy a signature verification, which is microseconds. Verify in the DAL, memoized with `cache()`, and the question disappears.

**★ Your secret rotates. How do you verify tokens signed with the old one without opening a hole?**
Keep a literal map from `kid` to key, sign new tokens with the new `kid`, and accept both during the overlap. Two rules make it safe: the `kid` is only ever used as a key into that fixed map — never interpolated into a path or URL, per RFC 8725 §3.10 — and the old key is removed on a scheduled date rather than "when we get to it". An unknown `kid` must yield "no session", not a fallback to a default key.

---

← [Stateless vs stateful sessions](03c-stateless-vs-stateful-sessions-the-revocation-question.md) · [Chapter 10 overview](01-explanation.md) · Next → [Auth.js in the App Router](03e-authjs-nextauth-in-the-app-router.md)
