---
title: "Read-then-check is correct today and structurally weaker forever — it leaves a row in memory before it is allowed to, a window between the check and the act, and a branch a refactor can delete, and a check written in a handler acquires one more copy every time you add a door"
sidebar_label: "04ca · Where it must not live"
sidebar_position: 25
description: "The three defects of read-then-check in order of visibility, the copies-per-entry-point arithmetic, the IDOR the documentation names and why shape validation is orthogonal to it, and the three placements that look like enforcement and are not — the layout, the proxy, and a database view."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Authentication and authorization*), [Next.js · Server Actions](https://nextjs.org/docs/app/guides/server-actions), [Next.js · Authentication](https://nextjs.org/docs/app/guides/authentication) — all `version: 16.3.4` — and the [PostgreSQL 18 Row Security Policies reference](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no penetration testing performed**; **no timings**.

**[04c](04c-the-ownership-predicate.md) put the membership test inside the query. This page is the argument for why that placement rather than any of the four that feel more natural — a check after the read, a check in the handler, a check in the layout, or a check in the proxy. Three of those are not enforcement at all, and the fourth is enforcement with a window in it. The distinction matters because every one of them produces working software on the day it is written; what separates them is what happens on the day somebody adds a second entry point, refactors a function, or moves a card between boards while a request is in flight.**

## Read-then-check, and the window it opens

The obvious alternative, and the one the framework's own example uses:

```ts
// 🔴 Correct today, and structurally weaker.
export async function deleteCardChecked(cardId: string): Promise<void> {
  const { userId } = await requireUser()

  const card = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1)
  if (!card[0]) throw new NotFound('card')

  const allowed = await isMemberOfBoardTeam(userId, card[0].boardId)
  if (!allowed) throw new NotFound('card')

  await db.delete(cards).where(eq(cards.id, cardId))
}
```

Three things are wrong with it, in increasing order of how hard they are to see.

1. **The row is in memory before the check.** It is one careless refactor — an early `return card[0]` added for debugging, a log line that stringifies it — away from being returned to a non-member. The predicate form never materialises a row the caller may not see.
2. **There is a window between the check and the act.** Between the membership read and the `DELETE`, the card can be moved to another board, or the caller can be removed from the team. The delete then executes on a fact that was true and is not. The predicate form has no window, because the check and the act are one statement.
3. **The check is a branch, and branches can be deleted.** Every one of those three lines can be removed by someone tidying up, and nothing fails — no test, no type error, no lint. Removing the predicate from a `WHERE` clause also silently widens it, but it changes the *query*, which is a much more visible kind of diff than deleting an `if`.

⚠️ **The upstream example that reads then compares is not wrong; it is the version that is easiest to explain.** It is also the reason so much production code looks like this: people copy the documented shape, which is optimised for teaching, into a codebase where the properties above matter. The predicate form is the one to ship.

The three defects are not equally severe, and it is worth ranking them honestly. The window (2) is a real concurrency bug and the rarest in practice. The materialised row (1) is a latent bug that becomes real during a refactor. The deletable branch (3) is the one that actually bites, because it is not a bug at all until the day somebody removes it, and there is no mechanism anywhere that would object.

## Why "check it in the handler" fails, as arithmetic

| Entry points | Copies of the rule (in handlers) | Copies (in the DAL) |
|---|---|---|
| Route Handler only | 1 | 1 |
| + Server Action | 2 | 1 |
| + queue consumer | 3 | 1 |
| + cron job | 4 | 1 |
| + the next one | 5 | 1 |

The left column is not a hypothetical: [01](01-the-resource-contract.md) established that this resource has two entry points on day one, and the milestone in [chapter 15](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) already adds a background worker. Copies drift — one is tightened during an incident, the other is found by a pentest a year later — and there is no mechanism that keeps them in sync, because they are separate code in separate files reviewed at separate times by different people.

The documentation names the vulnerability class this produces:

> *"Beyond authentication (is the user logged in?), remember to check **authorization** (does this user have permission to act on this specific resource?). This prevents [Insecure Direct Object Reference (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) vulnerabilities"*

and the sentence that kills the assumption that validation covers it:

> *"A well-formed `Item` object can still refer to a row the caller does not own."*
> — [Next.js · Server Actions](https://nextjs.org/docs/app/guides/server-actions)

zod will confirm `cardId` is a UUID matching your format. It has no opinion about whose card it is. **Shape validation and authorization are orthogonal**, and confusing them is the most common way a well-typed application leaks data — precisely because the type system's confidence is genuine and is about the wrong question.

And the reason centralising is the security property, rather than the individual check being better:

> *"This guarantees that wherever `getUser()` is called within your application, the auth check is performed, and prevents developers from forgetting to check that the user is authorized to access the data."*
> — [Next.js · Authentication](https://nextjs.org/docs/app/guides/authentication)

Read that as a claim about *people*. The DAL is not more secure per line. It is more secure because the next developer, writing the next feature, at speed, cannot reach the data without going through it.

## Three placements that look like enforcement and are not

**A layout.** A `layout.tsx` that redirects non-members is UX. It runs during rendering, it does not run for a Route Handler at all, and even for pages it governs what is displayed rather than what is fetched — a Server Component further down the tree still calls the DAL directly. It is worth having and it is not a control; [ch10 · 06e](../10-forms-authentication-and-security-hardening/06e-milestone-the-layout-is-not-a-boundary.md) argues it in full.

**A proxy.** Coarse filtering at the edge — bounce requests with no session cookie — is a genuinely useful first layer, and it is the wrong place for a row-level decision, because the proxy does not know which card the request is about and cannot query for membership cheaply. Treat it as a way to reject obvious garbage before it reaches a function, not as the thing that decides who owns a card ([ch10 · 04](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md)).

**A database view.** The subtlest of the three, because it feels like the strongest. A view over `cards` that joins membership genuinely scopes reads and does nothing about an `UPDATE` or `DELETE` issued against the base table — so as soon as a write path exists you are enforcing in application code again, with the added problem that everyone believes the database has it covered. A view is a partial measure that reads like a complete one, which is worse than no measure at all.

The option that *does* cover writes is row-level security, and it deserves an honest comparison rather than a dismissal:

| | Predicate in the DAL's queries | Row-level security |
|---|---|---|
| Covers reads | yes | yes |
| Covers writes | yes | yes |
| Covers a query somebody writes in `psql` | **no** | **yes** |
| Depends on session state surviving the pooler | no | **yes** — `set_config(…, true)` inside the transaction |
| Failure mode when misconfigured | a query returns too much | a cross-tenant leak, or every query returns nothing |
| Reviewable in one place | yes — one `sql` fragment | yes — one policy, in a migration |

RLS is stronger on the axis that matters most (it holds for writers your application does not control) and it brings the session-state hazard from [03d](03d-what-does-not-survive-the-pooler.md) with it, which is not a small thing behind a transaction pooler. It also does not remove the DAL, because something still has to set the setting correctly on every path — so it is an addition to this design rather than a replacement for it. [15 · 10c](../15-databases-apis-and-full-stack-patterns/10c-tenant-isolation-in-the-data-access-layer.md) works through the tenancy version.

## Gotchas

**★ Symptom: a user reads a card from another team by pasting an id, and the code has an ownership check.** Cause: the check is in one entry point and the request arrived at another. Fix: the predicate in the DAL's `WHERE` clause, so the query cannot return the row regardless of which door was used.

**★ Symptom: a card is deleted by a user who was removed from the team a moment earlier.** Cause: read-then-check has a window, and the membership was read before the delete. Fix: one statement — the predicate in the `WHERE` clause of the `DELETE` itself, so there is nothing between the check and the act.

**★ Symptom: a new endpoint was added and nobody remembered the ownership rule.** Cause: nothing forced them to. Fix: the arithmetic table above is the argument, and the mechanism is that the only way to reach `cards` is through `lib/dal/cards.ts` ([04b](04b-what-server-only-does-not-protect.md)'s lint boundary). A new endpoint then inherits the rule because there is no way to write a query without it.

**★ Symptom: the predicate was moved into a database view "so it is always applied", and now writes bypass it.** Cause: a view scopes reads and does nothing about `UPDATE` or `DELETE` against the base table. Fix: either row-level security, which does cover writes and brings the session-state problem in [03d](03d-what-does-not-survive-the-pooler.md) with it, or the predicate in every statement. A view is a partial measure that reads like a complete one.

**★ Symptom: the ownership check was removed in a refactor and every test still passed.** Cause: it was an `if`, and no test exercised a non-member — because writing that test requires two users, two teams and a fixture nobody wanted to build. Fix: move the rule into the query so removing it changes the SQL, and separately write the one test that has two users in it. That test is the most valuable one in the suite and it is always the last to be written.

**★ Symptom: a layout redirects non-members and the API still serves them.** Cause: a layout governs rendering and does not run for a Route Handler. Fix: treat layout redirects as UX and put the control in the DAL. The layout is still worth keeping — it stops a member of the wrong team seeing a broken page — but it is not the reason the data is safe.

**★ Symptom: RLS was enabled and every query started returning zero rows.** Cause: the policy reads a setting that was never established on this connection, most often because the `set_config` was session-scoped and the pooler handed over a fresh backend. Fix: `set_config(name, value, true)` inside the same explicit transaction as the query. The "returns nothing" failure is the good one; the same misconfiguration with `false` produces the leak instead.

**★ Symptom: a validation library was added and someone closed the authorization ticket.** Cause: shape and ownership conflated. Fix: state the orthogonality explicitly in review — *"A well-formed `Item` object can still refer to a row the caller does not own"* — and keep them as two separate checklist items, because a schema that validates a UUID reads exactly like a check.

## Interview questions

**★ Why is the membership test better in the `WHERE` clause than in an `if` statement?**
Three reasons, and they are cumulative. It removes the window: check-then-act is two statements, and between them the card can move to another board or the caller can lose membership, so the act executes on a fact that was true and is not — whereas one statement has no gap. It removes the branch: an `if` can be deleted by a refactor and nothing fails, while removing a clause from a `WHERE` changes the query, which is a far more visible diff. And it removes the row from memory: with the check after the read, a non-member's card sits in a variable one careless `return` away from the response. Put together, the check stops being something the function *does* and becomes something the function *is*.

**★ Which of those three defects actually causes incidents?**
The deletable branch, by a wide margin. The window is a genuine concurrency bug and it requires a membership change to land inside a specific few milliseconds, so it is rare. The materialised row is latent — it needs a subsequent refactor to become a leak. The branch is the one that gets removed, six months later, by someone consolidating two similar functions, and there is no test, no type and no lint rule that objects, because deleting a correct `if` produces code that compiles and passes. Ranking them honestly matters because it tells you which property to design for: not concurrency safety, but *undeletability*.

**★ Why not enforce ownership with a database view or with row-level security?**
A view is a partial measure that reads like a complete one: it scopes reads and does nothing about an `UPDATE` or `DELETE` against the base table, so the moment a write path exists you are enforcing in application code again with a false sense that the database has it covered. Row-level security genuinely does cover writes and is the strongest available option — it even covers a query somebody types into `psql`, which nothing in the application layer can. Its cost is that the policy identifies the current user from session state, which behind a transaction-mode pooler must be set with `set_config(..., true)` inside the same transaction, or it leaks to whoever is handed that backend next. So RLS is an addition to this design rather than a replacement, because something still has to set that value correctly on every path.

**★ How does putting the predicate in the DAL change what the CREATE, READ, UPDATE and DELETE topics have to say?**
It removes authorization from all four of them. Each verb topic then talks about what its verb is actually hard at — idempotency and status codes for create, pagination and caching for read, lost updates for update, cascades and idempotence for delete — rather than opening with a paragraph about checking ownership. That is a real measure of whether the layer is working: if a per-verb discussion still has to mention the ownership rule, the rule is not in one place. It is also why the arithmetic argument matters more than the security argument for most teams — the security benefit is a leak you may never observe, and the design benefit is visible on every page you write afterwards.

**★ A reviewer says the DAL and the handler should both check, as defence in depth. What is the counter-argument?**
That defence in depth applies to independent *layers*, not to duplicated *decisions*. Two copies of the same rule are not two defences; they are two things that can disagree, and when they do, the weaker one wins for whichever entry point uses it. The genuinely independent layers in this design are already present and do different jobs: the proxy rejects requests with no session, the DAL decides row ownership, and the database's foreign keys and constraints make certain states unrepresentable. Adding a second ownership check in the handler adds no layer and adds a maintenance obligation, so the correct answer is one authorization site per operation with the entry points translating its failure.

**★ Why is "we validate the input with zod" not an answer to IDOR?**
Because the two checks answer different questions and only one of them is about the caller. zod tells you the request is well-formed: `cardId` is a string of the right shape, `status` is in the enum, `title` is within bounds. Every one of those can be true of a request that names somebody else's card. The documentation states it as flatly as it can — *"A well-formed `Item` object can still refer to a row the caller does not own"* — and the reason the confusion persists is that a validation schema *looks* like a gate: it is code that rejects requests, sitting at the boundary, with a status code attached. The discipline is to keep them as two separate items on the review checklist, because merging them means the one everybody remembers is the one that does not protect anything.

---

← [04c · The ownership predicate](04c-the-ownership-predicate.md) · Next → [04d · Projections, not rows](04d-projections-not-rows.md)
