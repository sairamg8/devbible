---
title: "Enterprise compliance is a mapping exercise, not a checklist: every OWASP category lands on a specific App Router seam, and the two that bite hardest are the ones RSC invented"
sidebar_label: "03 · OWASP mapping and token leakage"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js support policy ([nextjs.org/support-policy](https://nextjs.org/support-policy))
> and the August 2026 security release ([nextjs.org/blog/august-2026-security-release](https://nextjs.org/blog/august-2026-security-release)),
> both banked for this track. React's stable export surface **probed** on the installed
> package (`react` **19.2.8**, `Object.keys`). OWASP category names are mapped against the
> **Top 10:2021** edition — see the uncertainty note below.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**Compliance work fails in App Router codebases for a boringly specific reason: the OWASP categories were written for a world where the trust boundary was the HTTP request, and RSC moved it to the module graph.** An auditor asks "where is access control enforced" and gets pointed at `proxy.ts`, which is a coarse filter and not an authorization layer. They ask "can a token reach the browser" and get told "it's a Server Component, so no" — which is false, because a Server Component's *return value* is serialized and shipped. This page maps each category onto the seam that actually enforces it in Next.js 16.3.4, and then spends most of its length on the two categories that RSC materially changed: **A02 Cryptographic Failures**, which in this stack means accidental serialization of secrets, and **A06 Vulnerable and Outdated Components**, which is [supply-chain vigilance](03b-supply-chain-vigilance.md) and gets its own page.

⚠️ **Which OWASP edition.** The mapping below uses the **Top 10:2021** category identifiers, which is the edition this page can cite with confidence. OWASP re-publishes the Top 10 on a multi-year cadence and a newer edition may have superseded it, renumbering or merging categories; **the primary source was not re-fetched for this page**. Treat the identifiers as a mapping aid and confirm the current edition's numbering before quoting it into an audit document. The *seams* below do not move when the numbering does.

## The mapping — category to the seam that enforces it

| OWASP:2021 | Where it is actually enforced in an App Router app | The mistake auditors find |
|---|---|---|
| **A01** Broken Access Control | Inside each Server Action and Route Handler, and in the data layer | Enforced only in `proxy.ts`; see [ch10 · defense in depth](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md) |
| **A02** Cryptographic Failures | The **RSC serialization boundary** — what a Server Component returns and what props cross into `'use client'` | "It's server-side" treated as "it's private" |
| **A03** Injection | Query construction in the data layer; `dangerouslySetInnerHTML` | Server Actions assumed to be safe because they aren't "endpoints" |
| **A04** Insecure Design | Rendering-strategy choice — `force-static` blanking `cookies()` is a *design* defect | Caching decisions made for performance, never re-reviewed for authz |
| **A05** Security Misconfiguration | `next.config.js`, CSP headers, `images.remotePatterns` | CSP added, then silently defeated by a static export |
| **A06** Vulnerable & Outdated Components | Your lockfile and the **transitive** graph | Auditing `next`, not `libheif` under `sharp` — [03b](03b-supply-chain-vigilance.md) |
| **A07** Identification & Auth Failures | Session verification per request, not per navigation | Session read once in a layout and trusted below it |
| **A08** Software & Data Integrity Failures | Build provenance, SRI on third-party scripts | Trusting the build because CI ran it |
| **A09** Logging & Monitoring Failures | `instrumentation.ts` | Logging the request, and the token in it |
| **A10** SSRF | Any server-side `fetch` whose URL contains user input | Route Handlers proxying an attacker-supplied URL |

🔴 **A01 is the one that fails audits, and the reason is structural.** `proxy.ts` runs once per *request*, but a client-side navigation in the App Router can render a segment without one. Access control asserted only there is asserted only sometimes. The rule the corpus states elsewhere and this page restates because compliance reviewers ask for it in writing: **every Server Action and every Route Handler re-verifies the session itself, as its first statement, regardless of what any layout or proxy already checked.**

## A02 in this stack means token leakage, and the mechanism is serialization

The category name says "cryptographic failures". In an RSC codebase the overwhelming majority of real findings under it are not weak ciphers — they are secrets that reached the browser because something serialized them.

**There are exactly three doors.** Every leak this stack produces comes through one of them:

1. **A prop crossing into a Client Component.** Anything passed to a `'use client'` component is serialized into the RSC payload and is readable in the browser. This is the intended mechanism, not a bug.
2. **A Server Component's return value.** The rendered output is serialized and streamed. A secret interpolated into markup — even into an attribute you believe is server-only — ships.
3. **An object that merely *contains* a secret.** The classic: a full ORM `user` row passed to a profile component because it was convenient. `user.name` was wanted; `user.passwordHash` and `user.stripeCustomerId` came along.

**Door 3 is the one that leaks in practice**, because doors 1 and 2 look like what they are, and door 3 looks like ordinary React.

### The fix that is actually available to you

```tsx
// app/profile/page.tsx
// ❌ WRONG — the whole row crosses the boundary; every column ships to the browser
import { db } from '@/lib/db';
import { ProfileCard } from './ProfileCard'; // 'use client'

export default async function ProfilePage() {
  const user = await db.user.findUnique({ where: { id: 1 } });
  return <ProfileCard user={user} />; // passwordHash, stripeCustomerId, internalNotes — all serialized
}
```

```tsx
// ✅ CORRECT — the boundary crossing is an explicit, hand-written projection.
// This is the whole discipline: a Client Component never receives a database row,
// it receives a DTO you typed out by hand and can read in one glance.
import { db } from '@/lib/db';
import { ProfileCard } from './ProfileCard';

type ProfileDTO = { id: string; name: string; avatarUrl: string };

export default async function ProfilePage() {
  const user = await db.user.findUnique({ where: { id: 1 } });
  if (!user) return null;

  const dto: ProfileDTO = { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
  return <ProfileCard user={dto} />;
}
```

**Why a hand-written DTO and not a `delete user.passwordHash`?** Because a deny-list is wrong the moment someone adds a column. An allow-list is wrong only when someone edits it, which is a reviewable diff. This is the single highest-value control in the whole A02 mapping, and it is plain TypeScript.

### 🔴 The taint APIs: probed, and they are not where you expect

React ships `experimental_taintObjectReference` and `experimental_taintUniqueValue` to make door 3 throw instead of leak. **They are not on the stable React package.** Probed on the installed `react` **19.2.8** — which matches this track's pin — `Object.keys(require('react'))` returns:

`Activity, Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense, act, cache, cacheSignal, captureOwnerStack, cloneElement, createContext, createElement, createRef, forwardRef, isValidElement, lazy, memo, startTransition, unstable_useCacheRefresh, use, useActionState, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useEffectEvent, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useOptimistic, useReducer, useRef, useState, useSyncExternalStore, useTransition, version`

**No `experimental_taint*` entry exists.** The reason is the rule banked for chapter 1: the App Router *bundles React canary* rather than resolving the `react` in your `package.json`, and the taint APIs live in that channel. The consequences are concrete and this is where teams get surprised:

- In the **App Router**, the APIs are reachable via Next.js's bundled React once `experimental.taint` is enabled in `next.config.js`.
- In the **Pages Router**, React comes from your `package.json` — and the probe above shows stable 19.2.8 has no such export, so the same import is `undefined` and calling it is a `TypeError`.
- A **shared `lib/` module** imported by both routers therefore behaves differently depending on which side pulled it in.

⚠️ **The behaviour of `experimental.taint` under Next.js 16.3.4 specifically was not re-fetched for this page**, and an `experimental_`-prefixed React API carries no stability guarantee by definition. Treat tainting as a **backstop that catches mistakes in development**, never as the control you present to an auditor. The control you present is the DTO projection above, because it holds on both routers, needs no flag, and cannot be turned off by a config change.

### Where a token leaks that is not a component at all

**Logs.** `instrumentation.ts` and any request-logging middleware see the `Authorization` header and the cookie jar. A logger configured to serialize the whole request object writes bearer tokens into whatever aggregator you pay for — and that aggregator is very likely outside the compliance boundary you just certified. Redact at the point of logging, allow-list the fields you log, and treat the log pipeline as an egress path in the data-flow diagram.

**Error messages.** A thrown error's `message` can carry a connection string. In production Next.js strips server error details before they reach the client, but your own `catch` block that renders `error.message` into the UI puts it back.

## A05: the misconfiguration that reverses a decision you already made

`force-static` **blanks `cookies()` and `headers()`** — they return empty rather than throwing. An authorization check written as "read the session cookie, and if absent show the logged-out view" therefore takes the logged-out branch *silently* on any route someone later marks static. Nothing errors. The page renders, is cached, and is served to everyone.

```tsx
// ❌ The failure mode: this is correct code that a caching decision elsewhere breaks.
export const dynamic = 'force-static'; // added later, by someone optimising

export default async function Page() {
  const session = await getSession();      // cookies() is blanked → no session
  if (!session) return <LoggedOutView />;  // silently taken, then CACHED
  return <Dashboard user={session.user} />;
}
```

```tsx
// ✅ Make the contradiction loud. An authenticated route asserts it is dynamic,
// and the assertion is a line an auditor and a reviewer can both read.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) return <LoggedOutView />;
  return <Dashboard user={session.user} />;
}
```

⚠️ Under **Cache Components** (v16), the `dynamic` / `dynamicParams` / `revalidate` / `fetchCache` route segment exports are removed — so this particular guard rail changes shape on that path. Chapters 5 and 10 own that transition; the compliance point stands either way: **a rendering-strategy change is an authorization change, and must be reviewed as one.**

## What to actually hand an auditor

A compliance conversation goes badly when the answer is a framework feature list. It goes well when it is a **data-flow statement per category**. Four artifacts carry the weight:

1. **A boundary inventory** — every `'use client'` file, and for each, what props it receives. Mechanically derivable: `grep -rl "^'use client'" app/`.
2. **The DTO list** — every type that crosses the boundary, in one directory, reviewed like schema changes.
3. **A dependency provenance record** — the lockfile plus the transitive audit, per [03b](03b-supply-chain-vigilance.md).
4. **A patch SLA tied to the support policy** — Next.js runs **Active LTS on the current major line and Maintenance LTS on the previous one**, and on the maintenance line *updates land as semver-minor releases even when they are breaking*. An SLA that says "we take minors automatically" is therefore a different risk statement on 15.x than on 16.x.

## Gotchas

**★ Symptom: a security review finds a `stripeCustomerId` in the page source of a customer-facing page, and no code anywhere prints it.** Cause: an entire ORM row was passed as a prop to a Client Component, and the RSC payload serializes every enumerable property, not the ones you rendered. Fix: project to a hand-written DTO at the boundary — never pass a row.

```tsx
const dto = { id: user.id, name: user.name };  // allow-list, reviewable in a diff
return <ProfileCard user={dto} />;
```

**★ Symptom: `experimental_taintUniqueValue is not a function` in a Pages Router route, while the identical import works in `app/`.** Cause: the App Router uses Next.js's bundled React canary; the Pages Router uses the `react` in your `package.json`, and stable **19.2.8 exports no `experimental_taint*` at all** (probed). Fix: do not rely on tainting as the control. Use the DTO projection, which works on both, and guard any taint call so a shared module cannot crash the router that lacks it.

```ts
// lib/secrets.ts — safe in both routers
import * as React from 'react';
const taint = (React as Record<string, unknown>).experimental_taintUniqueValue as
  | ((msg: string, lifetime: object, value: string) => void)
  | undefined;

export function markSecret(lifetime: object, value: string) {
  taint?.('Do not pass a session token to the client', lifetime, value);
}
```

**★ Symptom: an authenticated dashboard starts serving the logged-out view to every user, and only after a deploy that changed no auth code.** Cause: a route gained `force-static`, which blanks `cookies()` and `headers()` rather than throwing, so the session lookup returned nothing and the logged-out branch was taken and then cached. Fix: assert dynamism on every authenticated route, and fail loudly rather than branching.

```tsx
export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) throw new Error('Authenticated route rendered without a session');
  return <Dashboard user={session.user} />;
}
```

**Symptom: access control passes review, then a penetration test reaches an admin segment without an admin session.** Cause: the check lived only in `proxy.ts`, which runs per request; a client-side navigation rendered the segment without one. Fix: re-verify inside the Server Action or Route Handler, as its first statement.

```ts
export async function deleteUser(id: string) {
  'use server';
  const session = await getSession();
  if (session?.role !== 'admin') throw new Error('Forbidden'); // first statement, every time
  await db.user.delete({ where: { id } });
}
```

**Symptom: bearer tokens appear in the log aggregator, which sits outside the certified boundary.** Cause: `instrumentation.ts` or a request logger serializing the whole request, headers included. Fix: allow-list the fields you log; never serialize a request object wholesale.

```ts
logger.info({ method: req.method, path: url.pathname, userId: session?.id }); // named fields only
```

**Symptom: a connection string appears in a browser-visible error toast.** Cause: a `catch` block rendering `error.message` into the UI. Next.js strips server error detail on its own error path, but not from a string you chose to render. Fix: render a correlation id, log the detail server-side.

```tsx
catch (e) {
  const correlationId = crypto.randomUUID();
  console.error({ correlationId, error: e });
  return <p>Something went wrong. Reference: {correlationId}</p>;
}
```

**Symptom: CSP is configured and verified in development, and the deployed site sends no CSP header at all.** Cause: a nonce-based CSP requires dynamic rendering to generate a per-response nonce; a statically exported or fully cached route has no response to attach one to. Fix: use the static-header CSP path for statically rendered routes — chapter 10 splits these two deliberately across [nonces](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md) and [static headers + SRI](../10-forms-authentication-and-security-hardening/11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md).

**Symptom: the SSRF finding is in a Route Handler nobody thought of as an endpoint.** Cause: a handler fetching a URL built from a query parameter — an image proxy, a webhook relay, a link previewer. Fix: allow-list the host, never the URL.

```ts
const ALLOWED = new Set(['images.acme.com', 'cdn.acme.com']);
const target = new URL(request.nextUrl.searchParams.get('url') ?? '');
if (!ALLOWED.has(target.hostname)) return new Response('Forbidden', { status: 403 });
```

**Symptom: the auditor asks which OWASP category a finding belongs to and the team cannot answer consistently across two reviews.** Cause: mapping done ad hoc, per review, from memory. Fix: pin the edition in writing — this page maps **Top 10:2021** — and keep the seam table, not the category list, as the working artifact. The seams outlive the numbering.

## Interview questions

**★ Why is "it runs on the server" not an answer to "can this token leak"?**
Because the trust boundary in an RSC app is the serialization boundary, not the process boundary. A Server Component runs on the server and its *output* is serialized into the RSC payload and streamed to the browser. Anything it returns, and anything it passes as a prop to a `'use client'` component, is readable by the client. The question that actually settles a leak is "does this value cross a serialization boundary", and the code that answers it is the prop list of every Client Component.

**★ You pass a full user row to a Client Component and delete the password hash first. Why is that still a finding?**
It is a deny-list. It is correct for exactly the set of columns that existed when it was written, and it silently becomes wrong the next time someone adds a column — which is a migration, not a code review anyone thinks of as security-relevant. A hand-written DTO is an allow-list: adding a column changes nothing, and widening the DTO is a diff a reviewer sees. The failure mode of a deny-list is silent and time-delayed; the failure mode of an allow-list is a type error.

**★ Why can the same taint call work in `app/` and throw in `pages/`?**
The App Router uses React canary bundled inside Next.js; the Pages Router resolves React from your `package.json`. The taint APIs are `experimental_`-prefixed and live in the canary channel — probing stable `react` 19.2.8 shows no `experimental_taint*` export at all. So a shared module imported by both routers finds the function on one side and `undefined` on the other. It is also the general lesson about `experimental_`: an API with that prefix is a development aid, not a control you certify.

**★ How does a caching decision become an authorization defect?**
`force-static` blanks `cookies()` and `headers()` rather than throwing, so a session lookup returns nothing and any `if (!session)` branch is taken. If that branch renders a logged-out view, the logged-out view is what gets rendered *and cached*, and then served to authenticated users. Nothing errors and no auth code changed — which is why it survives review. The defence is to make authenticated routes assert dynamism, and to throw rather than branch when a session is unexpectedly absent.

**Why is `proxy.ts` insufficient as an authorization layer even when its logic is correct?**
It is a coarse, per-request filter, and App Router navigations do not guarantee it runs before every segment render. It is genuinely useful for cheap, early rejection — redirecting anonymous traffic away from `/admin` — but the enforcement point has to be where the data is actually touched: inside the Server Action, the Route Handler, or the data-access layer. The rule of thumb is that a control you cannot point at from the line that reads the database is a control you cannot prove.

**Which OWASP categories does adopting RSC genuinely change, and which stay the same?**
A02 and A06 change shape substantially: A02 becomes a serialization problem rather than a cipher problem, and A06 widens because the framework pulls native transitive dependencies (image codecs, for instance) into your attack surface. A01, A03 and A10 are unchanged in *substance* but move location — they now live in Server Actions and Route Handlers rather than in an Express router, and Server Actions are the ones teams forget are endpoints. A09 gets harder, because `instrumentation.ts` sits close to raw request objects.

**An auditor asks for evidence, not assurances. What do you hand them for A02?**
The boundary inventory (`grep -rl "^'use client'" app/`), the DTO type list showing exactly what crosses each boundary, and the review rule that a database row may never be a prop. Those three are mechanically checkable and stable across releases. Handing over "we use Server Components" or "we enable the taint APIs" is handing over a feature name, and a feature behind an `experimental` flag is not evidence.

**Why does the Next.js support policy belong in a compliance document at all?**
Because it determines your patch SLA, and the two LTS tiers behave differently. On the current major (Active LTS) you get features, fixes and security patches, and minors follow ordinary semver expectations. On the previous major (Maintenance LTS) you get only critical fixes and essential security updates for two years from that major's initial release — and those *land as semver-minor releases even when they contain breaking changes*. So "we automatically accept minor upgrades", a perfectly reasonable policy on the active line, is an uncontrolled-change policy on the maintenance line. The compliance artifact has to name which line you are on and what that implies.

---

← [Micro-frontends and multi-zone architectures](01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md) · [Chapter index](01-explanation.md) · Next → [Supply-chain vigilance](03b-supply-chain-vigilance.md)
