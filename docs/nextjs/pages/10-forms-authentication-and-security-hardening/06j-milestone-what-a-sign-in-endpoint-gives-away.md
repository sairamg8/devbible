---
title: "A sign-in endpoint gives away three things for free unless you stop it — whether an address has an account, your domain as the first hop of a phishing link, and your email provider's sending quota"
sidebar_label: "06j · Milestone: what sign-in gives away"
sidebar_position: 36
description: "Chapter 10's capstone, step nine: safeRedirectTarget as an allow-list of shapes rather than a blocklist of strings, why the response must be identical for a known and an unknown address including its timing, and the rate limiter in front of an endpoint that sends email to any address it is given."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`) — sections *Rate limiting* and *Validating client input* — the
> [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`),
> and [Auth.js sign-in and sign-out](https://authjs.dev/getting-started/session-management/login) for `redirectTo`.
> Target: **Next.js 16.3.4** · **`next-auth` 5.0.0-beta.32** · zod 4.4.3.
> Documentation-verified; **no sandbox run** — no rates, quotas or timings here were measured.

**The sign-in form in [06i](06i-milestone-sign-in-as-a-form.md) is correct and, without this page, still leaks three things — and each leak is a single line of ordinary-looking code.** `redirect(next)` turns your domain into the first hop of somebody else's phishing link. A helpful *"we couldn't find that account"* turns your form into a free API for asking whether a given human uses your product. And an unguarded `signIn('resend', …)` turns your mail provider into an open relay pointed at any address an attacker types. None of the three is exotic, none produces an error in development, and all three are found by the first competent penetration test. This page closes them, in code.

## Leak 1 — your domain as the first hop

`?next=` is attacker-controlled, and the naive implementation of "send them back where they came from" is an open redirect: an attacker sends `https://sprintdesk.app/sign-in?next=https://sprintdesk-app.evil/`, the victim sees your domain in the link, signs in, and lands on a convincing clone.

```ts filename="lib/auth-redirect.ts"
const DEFAULT = '/boards'

/**
 * Accepts only same-origin, absolute-path targets.
 * Everything else — absolute URLs, protocol-relative URLs, backslash tricks,
 * arrays, and undefined — collapses to the default.
 */
export function safeRedirectTarget(raw: string | string[] | undefined): string {
  if (typeof raw !== 'string') return DEFAULT

  // Must start with exactly one forward slash: "/boards", not "//evil.com"
  // and not "/\evil.com", which some parsers treat as protocol-relative.
  if (!raw.startsWith('/')) return DEFAULT
  if (raw.startsWith('//')) return DEFAULT
  if (raw.startsWith('/\\')) return DEFAULT

  // No control characters: CR/LF enable response splitting, NUL confuses parsers.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT

  // Parse against a dummy origin; anything that escapes it is rejected.
  try {
    const url = new URL(raw, 'https://sprintdesk.invalid')
    if (url.origin !== 'https://sprintdesk.invalid') return DEFAULT
    return url.pathname + url.search
  } catch {
    return DEFAULT
  }
}
```

The rule to remember when you write this from scratch somewhere else: **an allow-list of shapes, never a deny-list of strings.** Every historical open-redirect bypass — `//evil.com`, `/\evil.com`, `https:/\/\evil.com`, percent-encoded schemes — defeats a blocklist and is defeated by "must begin with a single `/` and must not change origin when parsed".

## Leak 2 — whether the account exists

The sign-in form asks for an email address and then tells the user something. Whatever it tells them must be identical in both branches:

```ts
// 🚩 A free account-existence API.
if (!user) return { message: 'No account with that email.' }
return { message: 'Check your inbox.' }

// ✅ One sentence, true either way, useless to an attacker.
return { message: 'If that address has an account, a sign-in link is on its way.' }
```

**Why it matters more than it sounds.** "Does this person have an account here" is reconnaissance for credential stuffing and for targeted phishing — and for some products it is the sensitive fact itself. A recruitment tool, a health service, a whistleblowing platform: membership *is* the private information, and a sign-in form that confirms it has published it to anyone with a list of addresses.

**Timing counts as a response.** If the unknown-address branch returns immediately and the known-address branch spends time sending an email, the difference is measurable regardless of what the text says. Defer the expensive work so both branches return at the same point in the code:

```ts filename="app/sign-in/actions.ts"
import { after } from 'next/server'

after(() => sendMagicLinkIfUserExists(email))
return { message: 'If that address has an account, a sign-in link is on its way.' }
```

If you are ever verifying a *password* rather than a magic link, the equivalent rule is to run the hash comparison against a dummy hash when the user is not found, so the branches cost the same work — never to skip it.

⚠️ I have not measured any of this and no timing figures appear on this page. The claim is structural — *the two branches must do the same work* — not a quantified one about how large a difference is detectable in practice.

**The rate limiter must not become the oracle either.** If a tripped limit returns a different message from a successful send, an attacker learns which addresses are worth hammering. The action in [06i](06i-milestone-sign-in-as-a-form.md) returns the same sentence when the limiter trips, and that is deliberate rather than lazy.

## Leak 3 — your sending quota

> *"For expensive operations (sending emails, writing to a database), consider adding rate limiting to prevent abuse."*
> — [Data Security, Rate limiting](https://nextjs.org/docs/app/guides/data-security#rate-limiting) (`lastUpdated: 2026-08-25`)

Magic-link sign-in is the purest instance of that sentence in the whole application: an unauthenticated endpoint that sends real email to an arbitrary address on demand. Without a limit it is an abuse tool that bills you and burns your sender reputation.

The limiter belongs in the DAL, because it touches the database and because it is a control rather than a component concern:

```ts filename="lib/dal/rate-limit.ts"
import 'server-only'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_PER_ADDRESS = 3
const MAX_PER_CLIENT = 10

/** Never store a raw address in a throwaway table. A hash is enough to count. */
function key(scope: string, value: string): string {
  return createHash('sha256').update(`${scope}:${value}`).digest('hex')
}

async function hit(bucket: string, limit: number): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS)

  const count = await db.rateLimitHit.count({
    where: { bucket, at: { gte: since } },
  })
  if (count >= limit) return false

  await db.rateLimitHit.create({ data: { bucket, at: new Date() } })
  return true
}

/**
 * Two buckets, because either alone is trivially rotated: an attacker with one
 * address cannot spam it, and an attacker with a list of a thousand addresses
 * is still bounded by their client identity.
 */
export async function allowMagicLink(email: string): Promise<boolean> {
  const forwardedFor = (await headers()).get('x-forwarded-for') ?? 'unknown'
  const client = forwardedFor.split(',')[0]!.trim()

  // Both are evaluated. Do NOT write `await a() && await b()`.
  const okAddress = await hit(key('email', email), MAX_PER_ADDRESS)
  const okClient = await hit(key('client', client), MAX_PER_CLIENT)

  return okAddress && okClient
}
```

```prisma filename="prisma/schema.prisma"
model RateLimitHit {
  id     String   @id @default(cuid())
  bucket String
  at     DateTime @default(now())

  @@index([bucket, at])
}
```

Four notes, because a limiter written casually is worse than none.

**Both buckets are evaluated, never short-circuited.** Assigning each result before combining them means a request that trips the address limit still records a client hit. `await hitAddress() && await hitClient()` would skip the second whenever the first failed, and rotating addresses would then cost the attacker nothing.

**The keys are hashed.** A rate-limit table is the last place anyone thinks to protect, and an unhashed one is a list of every email address that has ever tried to sign in. Hashing keeps it countable and useless to read.

**`x-forwarded-for` is only as trustworthy as your proxy.** It is a header, so it is client-supplied unless something in front of you overwrites it. If your load balancer does not, the client bucket is decoration — the same trust question as `AUTH_TRUST_HOST` in [06c](06c-milestone-the-environment.md), with the same answer: know what your proxy sets.

**The index is not optional, and neither is pruning.** `@@index([bucket, at])` makes the `count` a range scan on a narrow index rather than a scan of a table that grows on every sign-in attempt. Nothing deletes old rows for you; a scheduled delete of hits older than the window belongs in the same change.

⚠️ A database-backed limiter is the version that needs no new dependency, which is why it is the one shown. It is also the version that writes to your primary database on every sign-in attempt, including the abusive ones. At real volume this belongs in Redis or at the edge; what carries over is the *placement* — before the send, two buckets, same response either way.

## Gotchas

**★ Symptom: a security report says your site hosts an open redirect.** Cause: `redirectTo` came from `?next=` and was used as given, so `https://sprintdesk.app/sign-in?next=https://evil.example` sends the victim off-site from a link that starts with your domain. Fix: `safeRedirectTarget`, which accepts only a single-leading-slash path that does not change origin when parsed. Rejecting a list of bad strings does not work; accepting one good shape does.

**★ Symptom: the redirect validator rejects `//evil.com` and is bypassed by `/\evil.com`.** Cause: a blocklist. Browsers and URL parsers have historically treated backslashes as slashes in the authority position, so a rule that names `//` misses `/\`, `\\` and `\/`. Fix: stop enumerating. Require a single leading `/`, reject anything else outright, then parse against a dummy origin and reject the result if the origin changed — a positive test that does not need to know the trick.

**★ Symptom: the validator passes and a header appears in the response that you did not set.** Cause: carriage-return or line-feed characters smuggled through the redirect target. Fix: reject control characters before the parse, not after — the `/[-]/` test in `safeRedirectTarget` above.

**★ Symptom: an attacker can enumerate which email addresses have accounts.** Cause: the form says "No account found" for unknown addresses and "Check your email" for known ones. Fix: one message for both outcomes, worded so it is true in both — *"If that address has an account, a sign-in link is on its way."*

**★ Symptom: the messages are identical and enumeration still works.** Cause: timing. The known-address branch sends an email and the unknown one returns immediately, so the two are distinguishable by clock rather than by text. Fix: move the expensive work off the response path so both branches return at the same point.

```ts
import { after } from 'next/server'

after(() => sendMagicLinkIfUserExists(email))
return { message: 'If that address has an account, a sign-in link is on its way.' }
```

**★ Symptom: the neutral message is defeated by the rate limiter's message.** Cause: a tripped limit returns *"Too many attempts for this address"*, which confirms the address is worth attacking and, worse, confirms someone else is already attacking it. Fix: return the same neutral sentence when the limiter trips, and put the diagnostic in your logs where only you can read it.

**★ Symptom: your email provider suspends the account after a spike in sends to addresses that do not exist.** Cause: the magic-link action sends on demand with no limit, so anyone can drive it with a list of addresses. Fix: `allowMagicLink` in front of the send, with both an address bucket and a client bucket.

**★ Symptom: the limiter is in place and an attacker cycles through a thousand addresses unimpeded.** Cause: only the address bucket exists, and each address is individually under its own limit. Fix: the second bucket keyed on the client, checked in the same call — and evaluated rather than short-circuited, so a request that fails the first check still counts against the second.

**★ Symptom: the rate-limit table turns out to be a plaintext list of everyone who has ever tried to sign in.** Cause: the bucket key was the raw email address. Fix: hash it. You only ever need to *count* rows for a key; you never need to read the key back.

```ts
function key(scope: string, value: string): string {
  return createHash('sha256').update(`${scope}:${value}`).digest('hex')
}
```

**★ Symptom: sign-ins get slower over months, and the rate-limit table is the largest in the database.** Cause: nothing deletes expired hits, and possibly no index on the lookup. Fix: `@@index([bucket, at])` on the model, plus a scheduled delete of rows older than the window. A limiter that degrades the thing it protects has inverted its own purpose.

**★ Symptom: the hidden `redirectTo` field was validated in the page, and a penetration test still redirects off-site.** Cause: the tester POSTed to the action directly with their own body. A hidden input is a suggestion to a browser, not a constraint on an HTTP endpoint. Fix: validate in the action too — one call to the same pure function, and the difference between a UX affordance and a control.

**★ Symptom: `x-forwarded-for` is being read and the client bucket never trips.** Cause: nothing in front of the app sets or overwrites that header, so it is either absent or entirely attacker-chosen. Fix: confirm what your proxy sets and read that; if nothing does, drop the client bucket rather than shipping a control that reports success while doing nothing. A limiter you believe in and that does not work is worse than one you know is missing.

**★ Symptom: `safeRedirectTarget` returns `/boards` for a legitimate deep link with a query string.** Cause: over-strict validation that rejected the `?` rather than preserving it. Fix: the implementation above returns `url.pathname + url.search`, which keeps the query and drops the fragment — a fragment never reaches the server anyway, so preserving it would be theatre.

## Interview questions

**★ What is wrong with `redirect(searchParams.next)` after a successful sign-in?**
It is an open redirect. An attacker crafts a link on *your* domain whose `next` points at a look-alike host, the victim checks the domain, signs in legitimately, and is delivered to the attacker's page already primed to trust it. The fix is an allow-list of shapes rather than a blocklist of strings: require a single leading `/`, reject `//` and `/\`, reject control characters, then parse against a dummy origin and reject anything whose origin changed. And validate it in the action as well as in the page, because the hidden field is only a suggestion to a browser.

**★ Why is a blocklist the wrong tool for redirect validation, specifically?**
Because the input space is a URL parser's, and URL parsers are permissive in ways nobody memorises: backslashes treated as slashes in the authority, percent-encoded schemes, control characters, whitespace, uppercase scheme names, protocol-relative forms. Every published bypass of a redirect blocklist is one of those. An allow-list inverts the burden — you name the one shape you accept, a same-origin absolute path, and everything you have never heard of falls outside it by construction rather than by your having anticipated it.

**★ Why should the sign-in form say the same thing whether or not the account exists?**
Because a differing response is a free account-existence API. Anyone can submit addresses and read off which ones are registered, which feeds credential stuffing, targeted phishing, and — for some products — a privacy harm on its own, since "has an account here" can be sensitive information. The mitigation is to make the observable behaviour identical: one message, and equal work in both branches so the timing does not give it away either. It costs a slightly less helpful error and removes an entire class of reconnaissance.

**★ The messages are identical. Name the two ways enumeration still works.**
Timing and the limiter. If the known-address branch sends an email inline and the unknown branch returns immediately, the difference is on the clock regardless of the text — which is why the send is deferred with `after()` so both branches return at the same point. And if the rate limiter returns its own distinct message when it trips, an attacker learns that this address is rate-limited, which is only true of addresses worth limiting. Any observable that differs between the two cases is the oracle, whether or not it is the one you were thinking about.

**★ Where does rate limiting belong on a sign-in page, and what are you protecting?**
In front of anything expensive or abusable, which for a magic-link flow is the send itself — the Data Security guide names sending emails as its first example of an expensive operation worth limiting. You are protecting three things: your provider's sending reputation, your bill, and third parties who never asked to receive mail from you. Key it on both the submitted address and the client identity, because either alone is trivially rotated, and return the same neutral message when it trips so the limiter does not become the oracle the neutral message was designed to remove.

**★ Why two buckets, and why must the checks not short-circuit?**
Two, because each defeats a different attacker. The address bucket stops someone hammering one victim's inbox; the client bucket stops someone walking a list of a thousand addresses, each of which is individually under its own limit. They must not short-circuit because `a && b` in JavaScript skips `b` when `a` is false — so a request that trips the address limit would never be recorded against the client, and rotating addresses would cost the attacker nothing. Evaluate both, then combine the results.

**★ Why hash the rate-limiter's keys?**
Because otherwise the table is a plaintext log of every address that has ever attempted to sign in, sitting in the database with none of the care a `User` table gets, and it is exactly the kind of auxiliary table that escapes a data-retention review. Hashing loses nothing you need — the limiter only ever counts rows for a key, it never reads a key back — and turns a privacy liability into an opaque counter.

**★ The page validates `redirectTo` and then the action validates it again. Is that not redundant?**
No, because they are protecting against different callers. The page's validation shapes what a browser is offered; the action's validation constrains what an HTTP client can achieve. A Server Action is a POST endpoint and its body is entirely attacker-controlled, so anything the page "already checked" is unchecked from the action's point of view. This is the same principle as re-authorizing inside every action rather than trusting the page that rendered it — and the cost here is one call to a pure function.

**★ Rate limiting, enumeration defence and redirect validation are three unrelated controls. Why are they on one page?**
Because they share a failure mode: each is a line of code that looks like ordinary application logic, works perfectly in development, and is only wrong from the point of view of someone attacking it. `redirect(next)` is what you would write. "No account with that email" is what a good product person asks for. Sending an email when a form is submitted is the feature. None of them is a bug in the sense of producing a wrong answer — they are all correct programs whose correctness was defined without an adversary in the room, which is why they need a checklist rather than a test suite.

---

← [06i · Sign-in as a form](06i-milestone-sign-in-as-a-form.md) · [Chapter 10 overview](01-explanation.md) · Next → [06k · Sign-out and the caches](06k-milestone-sign-out-and-the-caches.md)
