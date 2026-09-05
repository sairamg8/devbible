---
title: "Sorting SprintDesk's decisions into free and load-bearing is done by counting files rather than by arguing about importance — and the count says the caching model and the data access layer are structural, while the ORM everybody spent a week debating is very nearly free"
sidebar_label: "01b · The load-bearing decisions"
sidebar_position: 2
description: "The cost-of-reversal test made mechanical, the seven decisions SprintDesk is now standing on with the grep that counts each one, the five that turned out to be free, and the finding that one decision bought the freedom of three others."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 4 through 17 of this book against the Next.js 16.3.4 documentation, and takes its sorting method from [01](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md). It introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**[01](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md) named three piles and asserted that treating them alike is how a quarter gets spent. This page does the sort, decision by decision, and the reason it is worth a page rather than a bullet list is that the sort is *counter-intuitive in both directions*. The choice teams argue about hardest — Prisma or Drizzle — turns out to be nearly free in SprintDesk, and the reason it is free is a completely different decision made five chapters earlier. Meanwhile a one-line boolean in `next.config.ts` is the most expensive thing in the repository to reverse, because reversing it does not restore a previous state; it deletes the only caching vocabulary the codebase has and puts nothing back. The third pile — the decisions nobody made — is [01ba](01ba-the-inherited-pile.md), and it is where the surprises are.**

## The test, made mechanical

"Load-bearing" is useless as an adjective and precise as a measurement. The measurement is **cost of reversal**, and it has two axes, because one of them is not in the codebase at all:

| Axis | Question | How you answer it |
|---|---|---|
| **File count** | If we reverse this, how many files change? | A grep. Run it; do not estimate it. |
| **Invariant or promise** | What guarantee stops holding, that no file names? | A sentence, written by whoever proposes the reversal |

🔴 **A decision can be load-bearing on the second axis with a file count of three.** Transactional enqueue is the example later on this page: moving SprintDesk's queue to an external broker touches almost nothing and destroys a property the application currently has for free. A sort that only counts files files that decision as trivial, which is exactly how a team ships the reversal and discovers the invariant six weeks later.

The discipline that makes the exercise honest is that **every row below carries the command that produced its number**, so the next person can re-run it rather than re-litigate it.

## Pile 2 · Load-bearing

### L1 · `cacheComponents: true` — the most expensive line in the repository

Chapter 5's milestone turned it on. Every route SprintDesk has was written afterwards, against the model it enables.

```bash
# What assumes it. Run all three; the sum is the reversal cost.
grep -rl "'use cache'" app lib
grep -rn "cacheLife(\|cacheTag(" app lib
grep -rn "updateTag(\|revalidateTag(" app
```

What makes this decision different from every other one on the page is that **it is not a toggle with a previous position to return to.** Chapter 5 states what the flag brings with it, and the list is exhaustive:

> Three things arrive with it, and nothing else does: the `use cache` directive, the `cacheLife` function, and the `cacheTag` function.
> — [ch5 · the explicit caching model](../05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md)

So turning the flag off removes the three things every cached read in SprintDesk is written with. It is true that **v16.0.0 removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` *when Cache Components is enabled*** ([ch1 · hybrid static and dynamic](../01-introduction-to-next-js/03b-hybrid-static-dynamic-and-the-cost-model.md)), and equally true that switching the flag off makes those exports legal again — but SprintDesk does not contain any. They were never written, because the milestone that introduced caching was written under the new model from the first line.

**Verdict: load-bearing, and asymmetric.** The forward migration is a migration; the reverse is a rewrite of every data-reading module in the application against a model none of them has ever used. Reversal cost is not "the flag plus N files" — it is N files, and the flag is the cheap part.

### L2 · One `server-only` Data Access Layer — the good kind of load-bearing

Chapter 10 committed to it in one sentence: `auth()` is called in exactly one module, and everything else calls `getCurrentUser()` ([ch10 · the Data Access Layer](../10-forms-authentication-and-security-hardening/06d-milestone-the-data-access-layer.md)).

```bash
# The count: every caller that would need its own session handling back.
grep -rn "getCurrentUser(\|requireBoardAccess(" app

# The check that the decision still holds — this should print NOTHING.
grep -rn "\bauth()" app lib | grep -v "lib/dal"
```

This is load-bearing by any measure, and it is the one entry on the page where that is unambiguously good news, for a reason worth stating precisely: **the cost of reversing it is high and the cost of keeping it is approximately zero.** It also changes the shape of a question you will otherwise be asked in an incident. *"Is every path authorized?"* is an unbounded audit over the whole application. *"Is this module correct?"* is one file. Chapter 10's milestone puts it more bluntly — get it wrong and the answer to "is this endpoint protected" becomes "probably, let me grep".

⚠️ **The second grep is the important one, and it is a decay check, not a design check.** The decision was made once; it holds only while nothing routes around it. A single component that calls `auth()` directly does not break anything, does not fail a test, and quietly moves this decision from pile 2 back towards nothing at all.

### L3 · Server Actions for the UI, Route Handlers for everything else

Chapter 15 argues the rule from one question — *who is meant to call this?* — rather than from ergonomics ([ch15 · the decision rule](../15-databases-apis-and-full-stack-patterns/02l-the-decision-rule.md)).

```bash
grep -rln "'use server'" app        # actions that would have to become handlers
grep -rn "action={" app             # forms whose progressive enhancement depends on it
```

**This one is load-bearing in exactly one direction.** Adding a Route Handler beside an existing action is free — the DAL from L2 means both entry points share the authorisation path, so a new handler is a thin wrapper. Converting the mutations *to* handlers is not, and the reason is a specific capability, not a preference:

> `updateTag` is *"Server Actions only"*
> — quoted in [ch15 · the decision rule](../15-databases-apis-and-full-stack-patterns/02l-the-decision-rule.md)

SprintDesk's board relies on read-your-own-writes after a drag. That is `updateTag`, and `updateTag` does not exist in a Route Handler. A migration to handlers therefore costs the forms, the origin check, the body cap, the single-response re-render **and** the freshness guarantee the board's whole interaction model is built on.

### L4 · SSE rather than WebSockets — the cost is not in the code

The code is one Route Handler. That is why this decision gets mis-estimated.

Chapter 15's argument is structural: a Route Handler is a function from `Request` to `Response`, and after a WebSocket handshake there is no response left to return ([ch15 · WebSockets and the serverless request model](../15-databases-apis-and-full-stack-patterns/03i-websockets-and-the-serverless-request-model.md)). So adopting WebSockets requires a long-running process that owns the socket.

🔴 **Which means it reverses chapter 17's milestone, not chapter 15's.** SprintDesk is [deployed twice](../17-deployment-scaling-and-observability/06-project-milestone-sprintdesk-deployed-twice.md) — Vercel and a container — precisely so that portability is a measured property rather than an aspiration. A WebSocket deletes one of those two targets. The file count is one; the cost is a deployment target, an operational model and the property the chapter 17 milestone exists to demonstrate.

### L5 · Board filters in the URL

Chapter 8's milestone put them there and filed every other piece of board state under one of three other owners ([ch8 · state ownership](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md)).

```bash
grep -rn "searchParams" app/\(dashboard\)
```

The file count is modest and misleading. The reversal cost lives outside the repository: **every board URL anyone has ever pasted into a ticket, a chat message or a bookmark stops selecting the same view.** There is no migration for that, no redirect that recovers it, and no test that fails. It is a product promise the codebase happens to implement, which puts it firmly on the second axis.

### L6 · Postgres as the queue — load-bearing by invariant, not by file count

The enqueue sites are few:

```bash
grep -rn "insert(jobs)" app lib
```

Chapter 15's milestone shows the enqueue inside the same transaction as the write that causes it, with the comment that states the entire argument: *"If the update rolls back, the job was never enqueued. No broker can promise this."* PostgreSQL's own manual names the queue use case for the clause that makes it work:

> *"Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table."*
> — [PostgreSQL 18 · `SELECT`](https://www.postgresql.org/docs/18/sql-select.html), quoted in [ch15 · Postgres as a queue](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md)

Move to an external broker and every enqueue site must choose between publishing before the commit — and sending mail for a write that failed — or after it, and losing the job if the process dies in between. Neither is a bug you can fix; it is the choice the architecture now forces. **Three files change and one invariant disappears**, which is the clearest example on this page of why file count alone is not the test.

### L7 · Two connection strings, one pooled and one direct

Not Neon, and not Drizzle. The load-bearing decision is that **the application and the migration runner use different endpoints** ([ch15 · the three kinds of pool](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md)).

```bash
grep -rn "DATABASE_URL\|DIRECT_URL" . --include=*.ts --include=*.yml --include=Dockerfile
```

Collapsing them to one variable is a two-line change that either puts the application on real backend processes — where its connection use is instances × pool `max` — or points migrations at a transaction pooler. Both fail later, under load, in a way that reads as a database problem rather than a configuration one.

## Pile 1 · Free

| Decision | Why it is free | The one place it is not |
|---|---|---|
| **Drizzle rather than Prisma** | queries live behind the DAL, so the blast radius is `lib/db` and the DAL's internals | the queue's `SKIP LOCKED` claim query is SQL a criteria-object client cannot model |
| **Tailwind v4 plus CSS custom properties** | tokens are consumed through variables, so swapping the implementation touches the definitions and nothing that reads them | the root layout, where the font `className`, the global stylesheet and the pre-hydration theme script all meet |
| **Neon as the host** | it is a Postgres URL | nothing — this really is a URL |
| **Auth.js as the provider** | the DAL hands out a projection, so no component has ever seen a provider type | the sign-out path, which is provider-shaped |
| **Vitest rather than Jest** | the tests that matter are pure functions over a query builder | Playwright's configuration, which is a separate decision |

### The ORM argument, settled by arithmetic

Chapter 15 is blunt about this and it is worth repeating in a retrospective because the argument recurs annually:

> 🔴 **The one decision people get wrong is the second, and it is not really an ORM question.** Whichever ORM you pick, instance count multiplied by pool size is the number that exhausts Neon, and the escapes are the same three.
> — [ch15 · milestone](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md)

The choice decides how pleasant the schema and queries are over months. It does not touch the number that decides whether the first traffic spike is an outage. And in SprintDesk the ergonomic difference is contained further still, because of L2 — which is the actual finding of this page.

### The one that changed piles: the session strategy

Chapter 10 settled JWT-versus-database sessions with one question — *a contractor left this morning, can we end their session right now?* — and SprintDesk answered it with database sessions ([ch10 · milestone](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md)).

That reads like a foundational decision, and its *implementation* is free: the DAL returns a projection rather than a session row, so nothing outside one module knows which strategy is in use. Switching strategies is one file.

🔴 **The promise is load-bearing even though the implementation is not.** "We can revoke a session immediately" is now something the product says to customers, and a switch to stateless tokens silently withdraws it. Separate the two when you sort: *how expensive is the code change* and *what did we tell someone* are different questions, and only the first one has a grep.

## What the sort actually revealed

Read the two piles together and one decision is doing most of the work:

**L2 — the single `server-only` data access layer — is what makes F1, F4 and the session strategy free.** Because every query goes through one module, the ORM is an implementation detail of that module; because every session read goes through one module, the provider and the strategy are too. Reverse L2 and three entries move from pile 1 to pile 2 without anybody touching them.

That is the general shape worth taking away: **a boundary is not overhead, it is a purchase of future freedom, and the sort is where you find out what it bought.** It is also why L2's decay check matters more than L2's file count — the moment a component imports the database directly, the freedom quietly expires.

## Gotchas

**★ Symptom: two engineers give opposite answers on whether a decision is load-bearing, and the meeting runs an hour.** Cause: they are using "load-bearing" to mean "important", which is a matter of taste. Fix: replace the adjective with a command and run it in the room — `grep -rl "'use cache'" app lib | wc -l` ends the discussion in ten seconds, and the loser of the argument is the one who did not want to count.

**★ Symptom: the annual Prisma-versus-Drizzle argument consumes a sprint of planning.** Cause: the argument is being conducted in ergonomics, where both sides are right. Fix: move it to the number that hurts. Instances × pool `max` is what exhausts the database and it is identical under either tool, so settle the capacity question first; then note the one place the choice is genuinely constrained, which for SprintDesk is the queue's claim query needing SQL a criteria-object client cannot express.

**★ Symptom: someone proposes turning `cacheComponents` off "to simplify things while we debug".** Cause: reading a config boolean as a toggle with a previous position. Fix: show them what disappears — `use cache`, `cacheLife` and `cacheTag` are the three things the flag brings and the only caching vocabulary in the codebase. Run `grep -rl "'use cache'" app lib` and the proposal ends. Debugging a caching problem is [01c](01c-the-checklist-pass-rendering-caching-and-the-build.md)'s job, not the flag's.

**★ Symptom: a "let's use WebSockets" ticket is estimated at two days because it is one route file.** Cause: it was costed as a code change. Fix: cost it as a deployment change. A socket needs a process that outlives the request, which removes the Vercel half of the two-target deployment chapter 17 built, and takes the portability property with it. Write that on the ticket before anyone estimates it.

**★ Symptom: the free pile is empty and everything looks structural.** Cause: nobody counted, so every decision inherits the anxiety of the biggest one. Fix: count the smallest one first. Once one entry has a file count of two, the rest of the sort goes quickly, because the team has seen that the numbers genuinely differ.

**★ Symptom: reversing a decision the sort filed as free turns out to touch forty files.** Cause: the boundary that made it free was bypassed by later code — a component that imports `@/db` directly, or calls `auth()` itself. Fix: make the boundary a CI check rather than a convention, because it is the only reason the entry was in pile 1:

```bash
# fails the build if anything outside the data access layer imports the database
grep -rn "from '@/db'" app components | grep -v "^lib/dal" && exit 1
```

**★ Symptom: a decision has a file count of three and turns out to be catastrophic to reverse.** Cause: the sort used only the file-count axis. Transactional enqueue is three files and one invariant; URL filters are a handful of files and every link anyone ever shared. Fix: require a sentence on the second axis for every entry — *what guarantee stops holding that no file names* — and file the decision by the worse of the two answers.

**★ Symptom: the team migrates mutations from Server Actions to Route Handlers "for testability", and the board starts showing stale cards after a drag.** Cause: `updateTag` is Server-Actions-only, so read-your-own-writes went away with the actions. Fix: keep the mutation as an action and test the module it calls, not the entry point — which is the shape the DAL already gives you, and the reason the entry point was thin in the first place.

**★ Symptom: the sort is done once, filed, and contradicted by a pull request three weeks later.** Cause: it was written as prose in a document nobody opens during review. Fix: put the load-bearing list where the next change has to read it — chapter 14's milestone is exactly this, [a context file that carries decisions rather than advice](../14-agent-driven-development/07-project-milestone-sprintdesk-gets-an-agentsmd.md).

**★ Symptom: a decision is filed as free, and reversing it breaks a customer commitment.** Cause: the sort measured the code and not the promise. Fix: for anything user-visible — session revocation, shareable URLs, email delivery guarantees — write the customer-facing sentence beside the file count, and let the sentence win when the two disagree.

## Interview questions

**★ How do you decide whether an architectural decision is load-bearing, without it becoming an opinion contest?**
Turn the adjective into a measurement with two axes. The first is a file count: write the grep that finds everything which assumes the decision, run it, and put the number next to the decision. The second is the invariant or promise that stops holding — a sentence nobody can produce a number for, but which anyone proposing the reversal must write down. Most disagreements evaporate on the first axis. The ones that survive are almost always cases where the file count is small and the second axis is enormous, and those are the decisions worth the meeting.

**★ Why is `cacheComponents: true` more load-bearing than any other decision in SprintDesk, given it is one line?**
Because it is not a toggle with a previous position to go back to. The flag is what provides `use cache`, `cacheLife` and `cacheTag` — those three and nothing else — so switching it off does not restore an earlier configuration, it removes every word the codebase's caching is written in. It does re-legalise the route segment exports that v16.0.0 removes under Cache Components, but SprintDesk contains none of them: the caching milestone was written under the new model from its first line, so there is nothing to un-delete. The reversal is therefore a rewrite of every data-reading module against a model none of them has ever used, and the line in `next.config.ts` is the cheapest part of it.

**★ Prisma versus Drizzle is treated as a foundational decision everywhere. Why is it nearly free in this application?**
Because of a decision made five chapters earlier. Every query in SprintDesk goes through one `server-only` data access layer, so the ORM is an implementation detail of that module rather than a vocabulary spread across the application. Reversing it touches `lib/db` and the DAL's internals; no route, action or component would notice. The part that is *not* free is one query — the queue's `FOR UPDATE SKIP LOCKED` claim — which is SQL a criteria-object client cannot model, so a migration would have to keep raw SQL for it either way. And the argument people actually have about the two tools is orthogonal to all of that: the number that takes the database down is instances multiplied by pool size, and it is the same under both.

**★ SprintDesk chose database sessions over JWTs so a session can be revoked immediately. Is that load-bearing?**
The implementation is not; the promise is. Nothing outside the data access layer knows which strategy is in use, because the layer hands out a projection rather than a session object — so swapping strategies is one file. But "we can end a contractor's session right now" is a sentence the product has said to customers, and moving to stateless tokens withdraws it silently, with a green test suite. That split is worth naming explicitly in any retrospective: cost-of-code and cost-of-promise are different measurements, and only one of them has a grep.

**★ The SSE-versus-WebSockets decision is one Route Handler. Why is it expensive to reverse?**
Because the cost is not in the handler. A Route Handler is a function from `Request` to `Response`, and after a WebSocket handshake there is no response left to return, so a socket requires a process that outlives the request. That deletes the serverless half of a two-target deployment — and the two-target deployment is not decoration, it is the mechanism by which chapter 17 proves which of the application's assumptions were the framework's and which were the platform's. So a one-file change removes a deployment target and the property that target existed to demonstrate. This is the clearest case in the application of a decision whose real cost is one layer down from the code.

**★ What exactly do you lose by moving from a Postgres queue to a dedicated broker?**
Atomicity between the write and the enqueue. Right now the job row is inserted in the same transaction as the card move, so if the update rolls back the job was never enqueued, and if the job exists the write definitely happened. A broker cannot join your database transaction, so every enqueue site has to pick between publishing before the commit — and sending mail for a write that failed — or after it, and losing the job if the process dies in between. Neither is a bug that gets fixed; it is the failure mode the architecture now has. Three files change and a guarantee disappears, which is why file count alone would file this as trivial.

**★ Can a decision move between piles, and what moves it?**
Yes, in both directions, and what moves it is almost always a different decision. In SprintDesk the ORM, the auth provider and the session strategy are all in the free pile *because* one module owns all data and session access; remove that module and three entries become load-bearing without anyone editing them. Movement in the other direction happens by decay rather than by design: one component that imports the database directly, or calls `auth()` itself, erodes the boundary that was buying the freedom. That is why the useful artefact from a sort is not the piles, it is the checks that keep the entries where they are.

**★ Why call the data access layer a "good" kind of load-bearing, when load-bearing is the expensive pile?**
Because the two costs are independent. Reversing it is expensive — every route and action would need its own session handling back — but *keeping* it costs almost nothing, and it converts an unbounded question into a bounded one. Without it, "is every path authorized?" is an audit of the whole application that has to be redone after every feature. With it, the same question is "is this one module correct?", answered by reading one file. A decision that is expensive to reverse and cheap to maintain is exactly what you want architecture to be; the pile is about reversibility, not about regret.

**★ Board filters in the URL — the grep finds a handful of files. Where is the real cost?**
Outside the repository. Every board URL anyone has pasted into a ticket, a chat message or a bookmark encodes a view, and moving filters into a client store means all of them stop selecting that view. No migration recovers it, no redirect approximates it, and nothing in CI notices. It is a product promise the code happens to implement, which puts it on the invariant axis rather than the file-count one — and it is the entry most likely to be mis-sorted by a team that only counts files.

← [01 · SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md) · [Chapter 19 overview](01-explanation.md) · Next → [01ba · The inherited pile](01ba-the-inherited-pile.md)
