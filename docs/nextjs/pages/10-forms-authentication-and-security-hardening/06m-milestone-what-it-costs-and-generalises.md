---
title: "Every shortcut this milestone refused is a shortcut somebody will propose, so here they all are with the specific thing each one breaks — and the one module you would rewrite if you replaced Auth.js tomorrow"
sidebar_label: "06m · Milestone: cost and generalisation"
sidebar_position: 39
description: "Chapter 10's capstone, closing: the eighteen deviations a reader will be tempted into and what each one breaks, what the database-session-plus-DAL design actually costs in queries and code, how the same shape survives swapping Auth.js for Clerk, Supabase or Better Auth, and the audit greps that keep it true."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`) — section *Auditing* — the [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`) — section *Auth Libraries* — [Auth.js JWT vs Database session strategies](https://authjs.dev/concepts/session-strategies),
> and the [`proxy.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · **`next-auth` 5.0.0-beta.32**. Documentation-verified; **no sandbox run**
> — no query counts, latencies or benchmark figures appear anywhere in this milestone.

**A milestone is only worth writing if the next person can tell which of its decisions are load-bearing and which are taste, so this page separates them.** The load-bearing ones are three: identity is resolved in exactly one module, authorization lives in the function that touches the data, and sessions are revocable. Everything else — the Prisma adapter, the Resend provider, the exact shape of `BoardAccess` — is replaceable without touching a component. This page is the list of shortcuts that look harmless and are not, the honest cost of the design, the part that survives replacing the auth library, and the greps that tell you whether any of it is still true six months from now.

## The deviations, and what each one breaks

Every row here is something a competent developer will propose, with a good reason.

| # | The shortcut | Why it is tempting | What it breaks |
|---:|---|---|---|
| 1 | `await auth()` directly in a component | It is one import and it works | A second source of truth about identity. Six months later there are eleven call sites and three notions of "signed in". Fix: [06d](06d-milestone-the-data-access-layer.md) |
| 2 | The auth check in a `(protected)` layout | It reads as centralisation | Nothing is protected. Layouts do not gate their children, and do not re-run on navigation. [06e](06e-milestone-the-layout-is-not-a-boundary.md) |
| 3 | `return null` from a top-level component when unauthorized | Looks defensive; standard in SPAs | The docs name it **not recommended** — nested segments and Server Actions are separate entry points and still run |
| 4 | `forbidden()` for a non-member | It is the semantically correct status | Confirms the resource exists to a stranger. Also experimental, and returns 200 on a streamed route. [06g](06g-milestone-hide-do-not-forbid.md) |
| 5 | Trusting `proxy.ts` as the control | It runs on every route, so it feels total | A refactor that moves a Server Function to another route silently removes coverage, with no failing test. [06l](06l-milestone-proxy-as-ux-not-control.md) |
| 6 | Validating the session in the proxy | It seems more rigorous than a cookie check | Runs on every prefetch. Twenty links on a page becomes twenty session lookups for clicks nobody made |
| 7 | `requireBoardAccess(boardId, userId)` | A background job needed it | The subject becomes a parameter, so any caller can pass any id. [06f](06f-milestone-authorization-on-the-board.md) |
| 8 | Taking `boardId` from the form and authorizing against it | The client already knows which board | Submit a board you are on plus a card you are not, and every check passes. [06h](06h-milestone-authorization-on-writes.md) |
| 9 | `return db.card.update(...)` from an action | The row is right there | Return values are serialized to the client, including every column the schema gains later |
| 10 | A bare `findUnique` with no `select` in the DAL | Fewer lines | The DTO silently grows whenever another team adds a column |
| 11 | An object literal instead of a DTO class | Classes feel heavy | Losing the serialization boundary. A class cannot be passed to a Client Component; an object literal can, silently |
| 12 | JWT sessions because they are the default | Nothing was decided, so nothing was wrong | Revocation becomes impossible without a blocklist. Discovered during an incident. [06](06-project-milestone-sprintdesk-auth-authjs.md) |
| 13 | `"next-auth": "^5.0.0-beta.32"` | Caret ranges are the habit | A caret over a prerelease sequence, which is precisely where breaking changes are expected |
| 14 | `NEXT_PUBLIC_` on anything with a secret in it | It made the client-side error go away | The value is inlined into the browser bundle. There is no warning because it is the documented behaviour. [06c](06c-milestone-the-environment.md) |
| 15 | `try/catch` around `signIn` / `signOut` / a DAL call | Errors should be handled | Swallows the framework's redirect and interrupt throws. The form appears to do nothing, or the mutation proceeds unauthorized |
| 16 | `redirect(searchParams.next)` | Sending users where they were going | An open redirect on your domain. [06j](06j-milestone-what-a-sign-in-endpoint-gives-away.md) |
| 17 | *"No account with that email"* | Better error messages | A free account-existence API for anyone with a list of addresses |
| 18 | `revalidatePath('/')` after any mutation | It definitely refreshes | Purges every user's cached data on that path because one person moved a card |

Eighteen rows, and not one of them produces an error in development. That is the property they share and the reason the list exists.

## What the design costs, honestly

**Per authenticated request:** one session-table read, plus one user-row read, both memoised for the render pass by React's `cache()` — so nine components asking who the user is cost one lookup, not nine. Under Cache Components the session read additionally sits in a `'use cache: private'` scope held in browser memory ([12](12-authentication-with-cache-components-reading-the-session.md)), which removes it from repeat navigations without ever storing per-user data on the server.

**Per authorized resource:** one membership read, also memoised. The board read itself is cached and tagged, so it is shared across every member of that board and survives filter changes.

🔴 **No numbers appear in those paragraphs, and that is deliberate.** This milestone was written without a sandbox: I can tell you the *shape* of the cost — which queries happen, how often, and what removes the duplicates — but any latency or throughput figure here would be invented. Measure your own; the shape is what transfers.

**In code:** roughly six small modules — `lib/auth.ts`, `lib/dal/env.ts`, `lib/dal/session.ts`, `lib/dal/user.ts`, `lib/dal/board.ts`, `lib/dal/board-writes.ts` — plus a rate limiter, a redirect validator and a proxy. None of them is long. The board page from chapter 8 gained three lines and lost one.

**The bill you will actually notice** is the database on the read path. Every page that shows a name depends on your primary database being up, which was not true when the session was a self-contained token. That is the price of revocation, it was paid knowingly, and if it ever becomes the constraint the mitigation is a short-lived cached session lookup — not a return to unrevocable tokens.

## Where this generalises

Swap the library and count the files that change.

| Library | What changes | What does not |
|---|---|---|
| **Clerk** | `lib/auth.ts` and the body of `readSession()` | Everything else |
| **Supabase Auth** | The same two, plus the session cookie names in `proxy.ts` | Everything else |
| **Better Auth** | The same two | Everything else |
| **Hand-rolled with `jose`** | The same two, plus you now own token signing, expiry and rotation | Everything else |

That is the entire return on the indirection in [06d](06d-milestone-the-data-access-layer.md), and it is why `readSession()` returns SprintDesk's own `{ userId }` rather than passing the library's session object through. Every component, every action, every authorization check is written against `getCurrentUser()` and `requireBoardAccess()`, which are yours.

The framework's guide lists a dozen compatible libraries and does not pick one; what it prescribes is the *structure* — a DAL, DTOs, checks near the data. That prescription is the transferable part, and it is why this milestone is worth reading even if you never type `npm install next-auth`.

**The two things that do not generalise** are worth naming so you re-decide them rather than inheriting them:

- **The session strategy.** Hosted providers make this decision for you, and the answer is usually a short-lived token plus a refresh, which gives you a bounded revocation window rather than an immediate one. Ask what that window is before you assume revocation works.
- **The `notFound()`-over-`forbidden()` choice.** It is right for a product where resource *existence* is confidential. In an internal admin tool where every user can see every entity's name in a picker, a 403 leaks nothing and a 404 is user-hostile.

## The audit, as commands

The Data Security guide's audit checklist is prose. This is the same list as things you can run.

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*
>
> *"**`"use server"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*
>
> *"**`/[param]/.`** Folders with brackets are user input. Are params validated?"*
>
> *"**`proxy.ts` and `route.ts`:** Have a lot of power. Spend extra time auditing these using traditional techniques."*
> — [Data Security, Auditing](https://nextjs.org/docs/app/guides/data-security#auditing) (`lastUpdated: 2026-08-25`)

```bash
# 1. Only the DAL reads the session or the auth library.
#    Expected: lib/dal/session.ts and app/api/auth/[...nextauth]/route.ts
grep -rn "from '@/lib/auth'" app/ lib/ --include='*.ts' --include='*.tsx'
grep -rn "from 'next/headers'" app/ lib/ --include='*.ts' --include='*.tsx'

# 2. Only the DAL reads the environment. Expected: lib/dal/env.ts
grep -rn 'process\.env' app/ lib/ --include='*.ts' --include='*.tsx'

# 3. Only the DAL imports the database client. Expected: lib/dal/*
grep -rln "from '@/lib/db'" app/ lib/

# 4. Every server-only module says so.
grep -rL "import 'server-only'" lib/dal/

# 5. No un-projected reads. Every findUnique/findFirst/findMany has a select.
grep -rn -E 'find(Unique|First|Many)' lib/dal/ -A3 | grep -B1 -v 'select'

# 6. No non-null assertions on a user.
grep -rn 'user!' app/ lib/

# 7. Nothing prefixed NEXT_PUBLIC_ looks like a secret.
grep -rn 'NEXT_PUBLIC_[A-Z_]*\(SECRET\|KEY\|TOKEN\|PASSWORD\)' .
```

Wire greps 1, 2 and 7 into CI. A rule nothing enforces is a comment, and the whole argument of this milestone is that the enforcement has to be structural rather than cultural.

## Where this connects

- **Content Security Policy** — [10 · CSP, nonces and the dynamic rendering tax](10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md) and [11 · CSP without nonces](11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md). Authentication decides *who* runs your code; CSP decides *whose* code runs.
- **Auth under Cache Components** — [12 · reading the session](12-authentication-with-cache-components-reading-the-session.md) and [13 · sharing, caching and mutating](13-authentication-with-cache-components-sharing-caching-and-mutating.md). Read both before enabling `cacheComponents` on an authenticated app; the session read becomes a build-time constraint rather than a preference.
- **The vulnerability record** — [14 · the 2026 CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md), and the habit that keeps you ahead of it, [15 · the patching habit](15-the-patching-habit-scheduled-security-releases-and-lts.md). Nothing on this page protects you from a framework vulnerability; those two pages are the part that does.
- **Chapter 8's milestone** — [07 · SprintDesk board filters in the URL](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md). This milestone added identity to that application without changing its state ownership table.

## Phase gate

You are done with this milestone when you can take an unfamiliar App Router codebase and, in under ten minutes, answer four questions with evidence rather than opinion: **where is the session read**, **can a session be revoked right now**, **which function would a new mutation have to call to be authorized**, and **what would a refactor have to do to silently un-protect something**. If any of the four takes a code-reading session to answer, the codebase has the problem this milestone exists to prevent, and the fix is structural.

## Gotchas

**★ Symptom: the design is correct on the day it ships and eroded a year later.** Cause: every rule here was enforced by review, and reviews change hands. Fix: the greps above, in CI, as a failing job. The three that matter most are the ones with a knowable allow-list — the auth import, the `next/headers` import and `process.env` — because a violation is a single new line and the check is exact.

**★ Symptom: a new developer adds a mutation and it is unauthorized, despite reading the docs.** Cause: they wrote it the way the framework's shortest example shows, with the logic inside the `'use server'` file. Fix: make the DAL the path of least resistance. If `lib/dal/board-writes.ts` already exports a function that does the check, the next mutation is written next to it; if the only example in the codebase is a fat action, that is what gets copied. Architecture is mostly a question of what is nearest to hand.

**★ Symptom: swapping the auth library turns into a month-long project.** Cause: `auth()` was imported directly across the app. Fix: this is not repairable cheaply after the fact, which is the argument for the indirection on day one — but the migration path is the same shape either way. Introduce `readSession()` first, mechanically replace every direct import with it, verify with the grep, and only then change what is inside it.

**★ Symptom: the audit greps pass and a penetration test still finds an IDOR.** Cause: the greps prove *where* the session and the database are read; they say nothing about whether a particular `WHERE` clause is scoped correctly. Fix: pair them with a review rule that every DAL function taking an id from a caller must constrain on something derived from the session, and grep for the shape of the exception rather than the rule — `findFirst({ where: { id:` with no sibling constraint is a readable pattern in a diff.

**★ Symptom: the team adopts the DAL pattern and puts business logic in it until it is the whole application.** Cause: no stated boundary. Fix: the DAL owns identity resolution, authorization, the query and the projection. It does not own workflow, orchestration or presentation. A useful test: if removing the auth requirement would leave the function still worth existing, it probably belongs somewhere else.

**★ Symptom: a second application in the same organisation copies this milestone and gets the `notFound()` rule wrong.** Cause: the rule was copied without its premise. Hiding existence is right when existence is confidential; in an internal tool where every entity is listed in a picker, a 404 for something the user can see the name of is confusing and protects nothing. Fix: re-decide it per product, and write the reason in a comment beside the interrupt so the next reader inherits the argument rather than the behaviour.

**★ Symptom: nobody can say what the revocation window is.** Cause: a hosted auth provider was adopted and its session model was never asked about. Fix: ask before you adopt. "Can an admin end a session immediately, and if not, what is the maximum delay" is a two-line answer for every provider, and it is the same question this milestone's first page is built on — it does not stop being the question because someone else runs the sessions.

## Interview questions

**★ Which three decisions in this design are load-bearing, and which are replaceable?**
Load-bearing: identity is resolved in exactly one module, authorization lives in the function that touches the data, and sessions are revocable. Replaceable: the auth library, the adapter, the providers, the DTO's exact fields, and every interrupt choice. The test is what a change costs — swapping Auth.js for Clerk touches two files because of the first decision; moving the authorization back into components touches every component and re-opens every bug this milestone closed. If a decision can be reversed by editing two files, it was taste; if reversing it requires editing forty, it was architecture.

**★ You inherit an App Router codebase. What four questions do you ask first?**
Where is the session read — one place or many. Can a session be revoked right now, or only by waiting out an expiry. Which function would a new mutation have to call in order to be authorized, and is it easier to call it than to reimplement it. And what would a refactor have to do to silently un-protect something — which, if the answer involves `proxy.ts`, means the documented Server-Function-matcher gap applies. All four are answerable with greps and a config file, and together they predict the codebase's security posture better than reading any individual check.

**★ What does this design actually cost, and what would you say to someone who wants JWTs back for performance?**
It costs a session read and a user read per authenticated request, both memoised per render pass, and it makes every authenticated page depend on the primary database. To the person asking for JWTs I would first ask for the measurement, because "the database is the bottleneck" is a hypothesis until it is a graph. Then I would point out what the change buys back and what it spends: it removes those reads and it removes immediate revocation, which is a product capability someone already asked for. If the numbers genuinely demand it, the middle path is a short-lived cached session lookup — keeping revocation bounded rather than abandoning it.

**★ How much of this milestone would survive replacing Auth.js with Clerk?**
Everything except `lib/auth.ts` and the body of `readSession()` — and, for a provider whose cookie is named differently, one array in `proxy.ts`. That is the whole return on wrapping the library, and it is why `readSession()` returns SprintDesk's own `{ userId }` rather than passing a library session object through the application. The framework's own guide lists a dozen compatible providers and prescribes structure rather than a choice: a DAL, DTOs, checks near the data. The structure is the transferable asset; the library is an implementation detail with a version number.

**★ Which of the eighteen shortcuts is the most dangerous, and why?**
Trusting `proxy.ts` as the control, because it is the only one whose failure is *introduced by unrelated work*. Every other shortcut is wrong from the moment it is written, so a review can catch it and a test can pin it. The proxy one is correct on the day it ships and stops being correct when somebody moves a component to a different route — the reference states plainly that a matcher change or a refactor that moves a Server Function can silently remove Proxy coverage. A defect that appears without anyone touching the defective code is the hardest class there is, and no test fails.

**★ Why does this page insist there are no performance numbers in it?**
Because the milestone was written without a sandbox, and a plausible-looking latency figure is worse than none: it would be quoted in a design review by someone who assumed it was measured. What can be stated honestly is structural — which queries run, how often, what deduplicates them, and what the memoisation does and does not guarantee. That transfers to any deployment; a number from mine would not transfer to yours even if I had one.

**★ What is the single best predictor that an authentication design will still be correct in a year?**
Whether the rules are enforced by something that fails a build. Every rule in this milestone that depends on a person remembering it will be violated eventually — not through carelessness, but because the people change and the reason does not travel with the code. The rules that survive are the ones with mechanical enforcement: `import 'server-only'` turning an import into a build error, a DTO class making a serialization mistake fail, a check inside the data function that a caller cannot skip without also getting no data, and a CI grep with a short allow-list. Design for the developer who has never read the page.

---

← [06l · `proxy.ts` as UX, not as the control](06l-milestone-proxy-as-ux-not-control.md) · [Chapter 10 overview](01-explanation.md) · Next → [10 · CSP, nonces and the dynamic rendering tax](10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md)
