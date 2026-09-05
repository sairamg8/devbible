---
title: "The predicate decides whether a caller may touch a card; this topic decides what the API says when they may not — and 401, 403 and a deliberate 404 are three different promises about what a stranger is allowed to learn"
sidebar_label: "11 · Ownership on the API surface"
sidebar_position: 72
description: "401 versus 403 versus answering 404 on purpose, why a 403 on an invisible resource is an existence oracle, the ambiguity of zero affected rows, and why a list endpoint never returns 403."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110, *HTTP Semantics* — [§15.5.2 `401 Unauthorized`](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.2), [§15.5.4 `403 Forbidden`](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.4) and [§15.5.5 `404 Not Found`](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.5) — and the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`). ⚠️ **RFC status-code text below is given in attributed prose rather than as block quotes**: a plain-text fetch of RFC 9110 truncated before these sections, so nothing here is presented as verbatim that was not read verbatim.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**[Topic 04](04c-the-ownership-predicate.md) settled where the ownership predicate lives, and its answer — inside the DAL's queries, so a non-member's `SELECT` returns zero rows rather than passing a check — is what lets topics 05 through 08 talk about status codes without re-litigating security on every page. It left one question open on purpose, and it is the one that shows up in the response: when the predicate excludes somebody, what does the API actually say? There are three defensible answers and they are three different promises. `401` promises that authenticating would help. `403` promises that it would not, and in doing so confirms the resource exists. A deliberate `404` promises nothing at all — and it is the only one of the three that does not hand a stranger a way to enumerate your data. Choosing between them is a product decision, not a technical one, and the failure mode is not choosing: an API that returns whichever code the handler happened to produce has made the decision anyway, inconsistently, per endpoint.**

## The three answers, and what each one tells a stranger

| Code | Says | Tells an unauthorised caller |
|---|---|---|
| `401` | we do not know who you are | nothing about the resource — but it says the *route* exists |
| `403` | we know who you are and the answer is no | 🔴 **that the resource exists**, which is often the fact you were protecting |
| `404` | there is nothing here | nothing — and it is indistinguishable from a genuinely absent row |

RFC 9110 describes `401` as the response when the request lacks valid authentication for the target resource, and it is explicit that the server must include a `WWW-Authenticate` header field with at least one challenge. `403` it describes as the server understanding the request but refusing to fulfil it, and it notes that a server wishing to hide the existence of a forbidden target may respond `404` instead. **That last sentence is the whole of this page's licence**: answering 404 for a resource the caller may not see is not a trick, it is a documented option.

⚠️ **The `WWW-Authenticate` requirement is worth being honest about.** A cookie-session API — which is what SprintDesk has, per [ch10](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md) — usually returns a bare `401` with no challenge header, because there is no HTTP authentication scheme to challenge with. That is a real, common deviation from the specification. It is not a security problem and it is not worth contorting your API to fix, but you should know you are deviating rather than believe you are conformant.

## The 403 that is an existence oracle

This is the failure the topic exists for, and it is easy to reproduce accidentally.

```
Attacker has a valid session for their own team. They iterate card ids.

GET /api/cards/8f3c…   -> 403   "this exists and belongs to someone else"
GET /api/cards/8f3d…   -> 404   "this does not exist"
GET /api/cards/8f3e…   -> 403   "this exists and belongs to someone else"
```

**Three requests and they have started mapping your database.** They cannot read the cards, and they were never trying to — they now know how many exist, and with a sequential or timestamp-ordered identifier they can estimate creation rate, customer count, and growth. For a B2B product that is competitive intelligence; for a medical or legal product it can be worse, because the *existence* of a record is the sensitive fact.

🔴 **The predicate from topic 04 makes the correct answer nearly free.** Because ownership is in the `WHERE` clause rather than in a branch, the DAL cannot distinguish "no such card" from "not your card" — both are zero rows. The naive implementation is therefore already the safe one, and it takes *extra* code to leak:

```ts
// ✅ The predicate is in the query, so zero rows is the only outcome.
export async function getCard(cardId: string, userId: string): Promise<CardDTO> {
  const row = await findCardVisibleTo(cardId, userId)     // ownership in the WHERE clause
  if (!row) throw new ApiFailure('not_found', 'No such card.')
  return toCardDTO(row)
}

// 🔴 This is the version that leaks, and it looks more careful.
export async function getCard(cardId: string, userId: string): Promise<CardDTO> {
  const row = await findCardById(cardId)                   // unscoped read — first mistake
  if (!row) throw new ApiFailure('not_found', 'No such card.')
  if (!(await isMember(row.boardId, userId))) {
    throw new ApiFailure('forbidden', 'You are not a member of this board.')  // the oracle
  }
  return toCardDTO(row)
}
```

The second one reads like better engineering — it distinguishes cases and gives a helpful message. It is also the one that answers a question nobody was entitled to ask.

## When 403 is right, and it often is

Answering 404 everywhere is not the sophisticated choice; it is a different trade with its own costs, and the costs land on people you like.

**Use `403` when the caller can already see that the resource exists.** A user who is on the board, viewing the card, clicking *Delete* on a card they lack permission to delete has learned nothing from a `403` — they are looking at the card. Returning `404` there is a lie that makes the UI say "this card no longer exists" about a card visibly on screen.

**Use `403` when the distinction is actionable.** *"You are not a member of this board — ask an owner for access"* is a real workflow. A `404` makes that flow impossible, and support tickets become "the link my colleague sent me is broken".

**Use a deliberate `404` when existence is itself confidential**, or when the identifier is guessable, or when the resource belongs to a different tenant entirely. For SprintDesk's cards this is the right default, because a card id is a bearer-ish handle passed around in links and a stranger holding one should learn nothing.

🔴 **The rule that makes this manageable: decide per resource, write the decision into the contract from [topic 01](01-the-resource-contract.md), and implement it in the DAL rather than the translator.** The [failure taxonomy in topic 10](10-errors-and-one-response-shape.md) can express all three; only the DAL knows which one this resource promised.

## Zero affected rows means three different things

The write side has a sharper version of the same problem. Every mutation in this chapter ends with an affected-row count, and `0` is ambiguous:

```
UPDATE cards SET ... WHERE id = $1 AND version = $2 AND <ownership predicate> AND deleted_at IS NULL
                              │              │                    │                     │
rowCount = 0 could mean ──────┴──────────────┴────────────────────┴─────────────────────┘
     no such card (404) · version moved (409) · not yours (404 or 403) · already deleted (404 or 410)
```

**Collapsing all four into one status is wrong in both directions.** Returning `404` for a version conflict tells a client to stop retrying when it should refetch and retry. Returning `409` for a card that never existed sends it into a refetch loop against nothing.

The disambiguation costs one extra read, and it must be a **scoped** read — otherwise you have reintroduced the oracle:

```ts
export async function updateCard(cardId: string, userId: string, patch: CardPatch, expectedVersion: number) {
  const { rowCount } = await db.update(cards)
    .set({ ...patch, version: sql`version + 1`, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.version, expectedVersion), isNull(cards.deletedAt), visibleTo(userId)))

  if (rowCount === 1) return

  // The card is re-read through the SAME predicate. If the caller cannot see it,
  // this returns nothing and the answer stays 'not_found' — no oracle.
  const current = await findCardVisibleTo(cardId, userId)
  if (!current) throw new ApiFailure('not_found', 'No such card.')
  if (current.version !== expectedVersion) {
    throw new ApiFailure('conflict', 'This card was changed by someone else.', { currentVersion: current.version })
  }
  throw new ApiFailure('not_found', 'No such card.')   // soft-deleted between the two statements
}
```

⚠️ **The second read is not free and it is not atomic** — the card can change between the two statements, which is why the final line exists rather than an assertion. Topic 07 owns the concurrency argument; this page owns the fact that the *disambiguating* read must be scoped exactly like the first one.

## A list endpoint never returns 403

Worth stating because it is a common instinct and it is wrong.

`GET /api/boards/[boardId]/cards` for a board the caller is not on does **not** return `403`. Under the predicate the collection is simply empty — and if the board itself is invisible, the endpoint is `404` for the same reason a card is. Filtering is not an error condition; a caller seeing fewer rows than exist is the system working.

🔴 **The corollary is that a list endpoint's pagination metadata must be computed after the predicate, not before.** A `total` count that ignores ownership leaks the size of the whole table through a field nobody thinks of as sensitive — and it does so on the one endpoint that is definitionally safe to call.

```ts
// 🔴 leaks: total counts every card on the board, including invisible ones
const total = await db.select({ n: count() }).from(cards).where(eq(cards.boardId, boardId))

// ✅ the same predicate as the page query
const total = await db.select({ n: count() }).from(cards).where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt), visibleTo(userId)))
```

## Ownership is not authorisation

One boundary worth drawing, because conflating them is how this topic sprawls.

**Ownership** — *may this caller touch this row at all?* — is what this chapter enforces, and it is a property of the data: membership of the team that owns the board.

**Authorisation** — *may this member perform this action?* — is roles and permissions, and [chapter 10](../10-forms-authentication-and-security-hardening/06f-milestone-authorization-on-the-board.md) owns it. A viewer who may read a card but not delete it is a `403` and always a `403`, because they can already see the card.

The two compose in one order and only one: **ownership first, then role.** Checking the role first means answering "you may not delete cards" to somebody asking about a card in another company's workspace — which confirms the card exists, and confirms it to the last person who should hear it.

## Gotchas

**★ Symptom: an attacker enumerates your resources by watching 403 and 404 alternate.** Cause: the handler reads the row unscoped, then checks membership, so the two failures are distinguishable. Fix: put ownership in the `WHERE` clause so the query cannot tell them apart — the version that leaks is strictly *more* code than the version that does not.

**★ Symptom: a user on the board is told a card they can see does not exist.** Cause: a blanket "always 404" policy applied to a permission failure rather than a visibility failure. Fix: 404 is for resources the caller cannot see; a caller looking at the card has already seen it, so a refused action there is `403`. The policy is per resource and per failure reason, not per API.

**★ Symptom: support cannot explain why a shared link does not work.** Cause: an invisible resource returns 404, which is correct, and nobody wrote down that it was deliberate. Fix: record the choice in the contract from [topic 01](01-the-resource-contract.md) and give support a way to distinguish the two internally — the correlation id from [topic 10](10-errors-and-one-response-shape.md) resolves to a log line that says which it was.

**★ Symptom: 404 is returned for hidden resources, and an attacker still distinguishes them by response time.** Cause: the hidden case does more work — an extra query, or a membership lookup — before answering. Fix: the predicate approach avoids this by construction, because both cases are the same single query returning zero rows. If you must branch, make both paths do the same work; a status code that is constant while latency is not is still an oracle.

**★ Symptom: a `409` is returned for a card that does not exist.** Cause: `rowCount === 0` was mapped straight to conflict, because the update was written with optimistic concurrency in mind and the missing-row case was never considered. Fix: disambiguate with a scoped re-read, and map the four causes separately. Returning `409` to a client that will refetch-and-retry sends it into a loop against nothing.

**★ Symptom: the disambiguating re-read reintroduces the oracle you just closed.** Cause: the second query used `findCardById` rather than the scoped finder, because at that point in the function "we already know it exists" felt true. Fix: every read in the function goes through the same predicate. There is no point in the request where the ownership question stops applying.

**★ Symptom: the list endpoint returns an empty array and a `total` of 4,812.** Cause: the count query was written before the predicate existed and never revisited — it is the query nobody thinks of as returning data. Fix: the count and the page share a `WHERE` clause. This is a good argument for building both from one query builder rather than writing them as two statements.

**★ Symptom: a user removed from a team can still act on cards for several minutes.** Cause: membership was read once into the session or a cached projection, so the predicate is evaluating stale data. Fix: the predicate joins `team_members` at query time. If you cache membership for performance, that cache is now a security boundary and needs an invalidation story — which is [ch15's cross-instance invalidation problem](../15-databases-apis-and-full-stack-patterns/05h-a-shared-cache-across-instances.md), with worse consequences than a stale board.

**★ Symptom: a role check refuses the action and leaks the resource in doing so.** Cause: the role was checked before ownership. Fix: ownership first, always. *"You lack permission to delete cards"* is a fine answer to a member and a disclosure to a stranger, and only the ownership check knows which one is asking.

**★ Symptom: everything is scoped correctly and the 404 body still names the board.** Cause: a helpful message — *"card not found on board Acme Q3 Planning"* — was written into the failure. Fix: the body of a deliberate 404 must be as empty as the status. Any detail that varies with the hidden resource is the leak in a different field, and [10b](10b-never-leak-a-driver-error.md) makes the same point about the driver's `detail`.

**★ Symptom: two endpoints for the same resource disagree — one returns 403, the other 404.** Cause: each handler decided independently, which is what happens when the decision is not written down. Fix: the DAL decides, once per resource, and both entry points inherit it. This is the same argument as [topic 10](10-errors-and-one-response-shape.md)'s: the service layer describes the failure, the entry point only renders it.

## Interview questions

**★ Why is a `403` sometimes a security bug?**
Because it confirms the resource exists. A caller iterating identifiers and seeing `403` and `404` alternate is being told exactly which ones are real, and that is frequently the fact you were protecting — for a B2B product it discloses customer count and growth rate; for a medical or legal record the existence of the record can be more sensitive than its contents. RFC 9110 anticipates this and explicitly permits a server that wishes to hide the existence of a forbidden target to respond `404` instead, so the substitution is a documented option rather than a trick.

**★ Then why not return 404 for every authorisation failure?**
Because it lies to the people you are trying to serve. A user looking at a card on their screen who clicks an action they lack permission for has already seen the card; telling them it does not exist produces a UI that contradicts itself and a support ticket nobody can resolve. It also destroys an actionable workflow — *"you are not a member of this board"* leads somewhere, and *"not found"* does not. The choice is per resource and per failure reason: 404 where the caller cannot see the resource, 403 where they demonstrably can.

**★ How does putting the ownership predicate in the `WHERE` clause make the safe answer the default?**
Because the query loses the ability to distinguish the two failures. A `SELECT` scoped to the caller returns zero rows for "no such card" and zero rows for "not your card", so the handler has one outcome to map and the only status it can produce is `404`. Leaking then requires *adding* code — an unscoped read followed by a membership check — which is why the vulnerable implementation is consistently the longer and more deliberate-looking one. Security defaults that require extra effort to break are worth more than any amount of review discipline.

**★ An `UPDATE` affects zero rows. What are the possible causes and why does it matter?**
Four: the card does not exist, the caller cannot see it, the version in the `WHERE` clause has moved, or the row is soft-deleted. They map to different statuses and different client behaviour — a `409` tells a client to refetch and retry, a `404` tells it to stop. Collapsing them means either sending a client into a retry loop against a row that will never exist, or telling it to give up on a conflict it could have resolved. Disambiguating costs one extra read, and that read must go through the same ownership predicate, or you have closed the oracle on the first query and reopened it on the second.

**★ Why does a list endpoint never return 403?**
Because filtering is not an error. Under a predicate the caller simply sees the rows they may see, and an empty result is a legitimate, successful answer — there is no refusal to report. The subtlety is the metadata: a `total` computed without the predicate leaks the size of the whole table through a field nobody classifies as sensitive, on the one endpoint that is definitionally safe to call. The count and the page must share a `WHERE` clause.

**★ In what order do the ownership check and the role check run, and why does the order matter?**
Ownership first, then role. Checking the role first means a stranger asking about another company's card can be told *"you may not delete cards"* — which confirms the card exists, and confirms it to precisely the person who should learn nothing. Ownership answers *may this caller touch this row at all*, and it is a property of the data; the role question is only meaningful once the answer to the first is yes.

**★ You have returned 404 for every invisible resource and an attacker still tells them apart. How?**
Timing, or the body. If the hidden case runs an extra query — a membership lookup, or a "does it exist" check before deciding to lie — it takes measurably longer, and a constant status code with a variable latency is still an oracle. The body is the other channel: a 404 whose message names the board, or whose shape differs between the two cases, has leaked in a field nobody was watching. The predicate approach avoids both by construction, because there is genuinely only one query and one outcome.

**★ A user is removed from a team. When does their access actually stop?**
At the next query, if the predicate joins `team_members` at query time — which is the argument for keeping it a join rather than a cached flag. If membership was read once into a session or a cached projection, access persists for the life of that cache, and the cache has quietly become a security boundary with an invalidation problem. That is the same cross-instance invalidation problem chapter 15 describes, with the difference that a stale board is a cosmetic bug and stale membership is unauthorised access.

## Where this connects

- [04c · the ownership predicate](04c-the-ownership-predicate.md) — where the check lives; this page is what it says when it fails
- [10 · errors and one response shape](10-errors-and-one-response-shape.md) — the taxonomy that can express all three answers
- [ch10 · authorization on the board](../10-forms-authentication-and-security-hardening/06f-milestone-authorization-on-the-board.md) — roles and permissions, which are a different question

---

← [10b · Never leak a driver error](10b-never-leak-a-driver-error.md) · Next → **12 · Testing the API** *(not written yet)*
