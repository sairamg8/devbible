---
title: "A CRUD API in the App Router is never one endpoint set — it is two entry points onto one service layer, and the contract is the thing both of them owe the caller, which is why writing it after the handlers produces a description rather than a contract"
sidebar_label: "01 · The resource contract"
sidebar_position: 10
description: "Route Handlers and Server Actions as two doors onto one Data Access Layer, why the honest answer for a real resource is both rather than a choice, what a contract commits you to that a description does not, and the SprintDesk cards resource stated before any code is written."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`version: 16.3.4`, `lastUpdated: 2026-04-30`), [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (`version: 16.3.4`) and [RFC 9110 · HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html).
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**Chapter 15 settled *which* entry point serves *which* caller. This chapter starts from the consequence nobody enjoys: for a resource that a browser edits and a script also reads, the answer is both, and the moment there are two doors there has to be exactly one room behind them. That room is the Data Access Layer, and the contract is what the doors promise on its behalf — the addresses, the verbs each address accepts, the status codes each verb may produce, and the shape of what comes back. Written first, that list is a set of commitments you can be held to. Written after the handlers exist, it is a transcript of whatever the code happened to do, and it changes silently every time somebody edits a `return`.**

## The resource this chapter builds

SprintDesk, carried forward from [chapter 15's milestone](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md). A **card** belongs to a **board**; a board belongs to a **team**; a team has members. Everything in the next twelve topics is one resource — `cards` — modelled, migrated, connected, authorised, written, read, updated, deleted, transacted, error-shaped and tested.

One sentence governs the whole chapter and it is worth reading twice:

> **A caller may touch a card only if they are a member of the team that owns the board that owns the card.**

That is the ownership predicate. Topic [04](04-the-data-access-layer.md) puts it inside the Data Access Layer, which is the only reason the CREATE, READ, UPDATE and DELETE topics have almost nothing to say about authorization. If the predicate lived in the handlers instead, every one of those topics would have to repeat it, and one of them would eventually get it wrong.

## Two doors, one room

```text
   browser form / optimistic UI          curl, a mobile app, a partner, CI
              │                                       │
       Server Action                            Route Handler
   'use server' + revalidateTag()          app/api/**/route.ts + status codes
              │                                       │
              └──────────────┬────────────────────────┘
                             ▼
                  lib/dal/cards.ts   ← 'server-only'
                  authentication, the ownership predicate,
                  validation of the domain rules, the query,
                  and the projection that comes back
                             ▼
                     Drizzle → pg Pool → Postgres
```

The framework documentation recommends exactly this arrangement for new projects, and gives the reason:

> *"For new projects, we recommend creating a dedicated **Data Access Layer (DAL)**. This is an internal library that controls how and when data is fetched, and what gets passed to your render context."*

> *"This approach centralizes all data access logic, making it easier to enforce consistent data access and reduces the risk of authorization bugs."*

It also tells you not to hedge:

> *"We recommend choosing one data fetching approach and avoiding mixing them. This makes it clear for both developers working in your code base and security auditors what to expect."*

Note what "one approach" is a statement about. It is not "one entry point". Two entry points are fine and normal; two *data access strategies* are not. The failure the guidance is naming is a codebase where some reads come from a DAL, some from a component querying the driver directly, and some from a Server Component fetching its own Route Handler — at which point "where is the authorization check for this read?" has three possible answers and no way to find out which applies without reading everything.

## Why the answer is both, not a choice

[02l · The decision rule](../15-databases-apis-and-full-stack-patterns/02l-the-decision-rule.md) reduces the question to one thing: *who is meant to call this?* Apply it to SprintDesk cards, one row at a time, and you do not get a single answer — you get a split down the middle of the same resource.

| The caller | Wants to | Entry point | Why the other cannot |
|---|---|---|---|
| The board UI, dragging a card | move it | **Server Action** | A handler drops the origin check and the single-response re-render, and you rebuild both by hand |
| The board UI, after that move | see its own write | **Server Action** | Only an action can invalidate the router cache in the same round trip |
| The "new card" form, before hydration | create | **Server Action** in a form's `action` prop | A handler needs `<form method="post">` plus manual redirect handling |
| A partner's integration | list a board's cards | **Route Handler** | An action has no URL; its id is a build artefact that rotates on deploy |
| The mobile app | everything | **Route Handler** | Nothing but your own bundle can construct an action invocation |
| A nightly export script | page through cards | **Route Handler** | An action cannot stream, cannot set `Content-Type`, cannot return `304` |
| Anything that needs a specific status code | any of it | **Route Handler** | An action returns a value; there is no `404`, `409` or `412` in it |

**So the resource has an HTTP surface *and* an action surface, and they are not competing designs — they are two projections of one service layer.** The mistake is not picking both. The mistake is letting them become two implementations, which is what happens the first time somebody adds a rule to the action because that is the file they had open.

## The six routes

These are the addresses. They are fixed for the rest of the chapter, and every later topic is one row of this table taken seriously.

```text
GET    /api/boards/[boardId]/cards      list the cards on a board
POST   /api/boards/[boardId]/cards      create a card on a board
GET    /api/cards/[cardId]              read one card
PATCH  /api/cards/[cardId]              partial update
PUT    /api/cards/[cardId]              full replace
DELETE /api/cards/[cardId]              delete
```

Two addresses, not six. `/api/boards/[boardId]/cards` is the **collection**, and it is nested because a card cannot exist without a board — the board id is not a filter, it is part of the card's identity. `/api/cards/[cardId]` is the **item**, and it is *not* nested, because a card id is globally unique and the board is already discoverable from the card. Nesting the item as `/api/boards/[boardId]/cards/[cardId]` buys you nothing and costs you a consistency problem: two ids in the URL that can disagree, and a decision to make about what a mismatch means. It does not have a good answer. Do not create the question.

In file terms:

```text
app/
└─ api/
   ├─ boards/
   │  └─ [boardId]/
   │     └─ cards/
   │        └─ route.ts     ← GET, POST
   └─ cards/
      └─ [cardId]/
         └─ route.ts        ← GET, PATCH, PUT, DELETE
```

A `route.ts` file exports one function per method, and the framework's supported set covers every verb above:

> *"The following [HTTP methods](https://developer.mozilla.org/docs/Web/HTTP/Methods) are supported: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`."*

and it fills in the discovery verb for you:

> *"If `OPTIONS` is not defined, Next.js will automatically implement `OPTIONS` and set the appropriate Response `Allow` header depending on the other methods defined in the Route Handler."*

Which methods each address accepts, and what each is allowed to return, is [01b](01b-the-six-routes-and-the-codes-they-commit-to.md).

## What a contract is, precisely

A contract is a list of things you have promised not to change without telling anyone. For one resource that is exactly five lists:

1. **The addresses** — the six above, and the fact that no seventh exists.
2. **The verbs each address accepts** — and therefore what `405` means and which `Allow` header goes with it.
3. **The status codes each verb may produce** — every one of them, including the failures, stated before the code exists.
4. **The representation** — the fields of a card the client receives, their types, their nullability, and which of them are stable.
5. **The guarantees** — which verbs are safe, which are idempotent, what happens on a retry, and what a client may cache.

Everything else is implementation. The table name is implementation. Whether `position` is a double or an integer is implementation. Whether the update runs in a transaction is implementation. The moment one of those leaks into the contract — a client that parses your primary key, a client that depends on rows coming back in insertion order because they always have — you have acquired an obligation you never agreed to.

## Why a contract written after the handlers is a description

This is the part that sounds like process advice and is not. It is a claim about what you can and cannot do afterwards.

**A description cannot be violated.** If the document says "PATCH returns 200 with the updated card" because somebody read `route.ts` and wrote down what it does, then the day someone changes the handler to return `204`, the document is not wrong — it is stale, which feels like a different and smaller category of problem. Nothing failed. No test broke. The client broke, three weeks later, in someone else's repository.

**A description cannot be reviewed.** "Is this the right status code for a duplicate title?" is a design question with a defensible answer. "Does this document match the code?" is a clerical question. Writing the contract second converts every design question into a clerical one, and clerical questions get approved.

**A description has no gaps, which is the problem.** Write the six routes and their codes on a page before writing a handler and you immediately have to answer: what does `DELETE` return for a card that is already gone? What does `PUT` do about a field the client omitted? What does `GET` on the collection return when the board exists but the caller is not a member? Each of those is a genuine decision with consequences three topics away. Derived from the code, they are not decisions at all — they are whatever the first implementation happened to do, usually a `500` from an unhandled `null`.

**And a description is written by the wrong person.** The contract's audience is the caller. The code's author knows what the database can do; only the contract forces them to think about what a client with no access to the database needs to be told.

The concrete, cheap form of "write it first" is a file:

```ts
// contracts/cards.ts — no imports, no framework, no database. Written before route.ts.

/** The card representation. Every field here is a promise. */
export type CardRepresentation = {
  id: string                       // uuid, stable for the life of the card
  boardId: string                  // uuid, changes when a card is moved
  title: string                    // 1..200 characters after trimming
  body: string | null              // null means "no description", not ""
  status: 'todo' | 'doing' | 'done'
  position: number                 // ordering key within a board; not an index
  version: number                  // increments on every accepted write
  createdAt: string                // RFC 3339, always UTC, always with offset
  updatedAt: string                // RFC 3339, always UTC, always with offset
}

/** The addresses, and the verbs each one accepts. A 405 means this list. */
export const SURFACE = {
  '/api/boards/[boardId]/cards': ['GET', 'POST'],
  '/api/cards/[cardId]': ['GET', 'PATCH', 'PUT', 'DELETE'],
} as const
```

That file has no dependencies, so it compiles in a test, in the client SDK, and in a document generator. It is also the thing a reviewer can disagree with before any of it is expensive.

⚠️ **What that file is not is an OpenAPI document.** A generated OpenAPI spec derived from your handlers is a description with a schema, and it inherits every property above. A hand-written one that the handlers are checked *against* is a contract. The direction of derivation is the whole distinction.

## Gotchas

**★ Symptom: the mobile team and the web team disagree about what a field means, and both are reading the same code.** Cause: there is no contract, so the source of truth is an implementation, and an implementation answers "what does it do" rather than "what may I rely on". Fix: write the representation down as a type with no imports, as above, and make it the artefact both teams read. The code then either satisfies it or fails a test.

**★ Symptom: a change to a Server Action fixed a bug for the web UI and the same bug is still live for the API.** Cause: the rule lived in the action rather than in the layer both doors call. Fix: the entry points contain only what their transport needs — the action adds `revalidateTag`, the handler adds status codes — and everything else lives in `lib/dal/cards.ts` ([04](04-the-data-access-layer.md)).

**★ Symptom: somebody proposes replacing the Route Handlers with Server Actions "since we have a UI anyway".** Cause: treating the two entry points as alternatives. Fix: check the caller list. A Server Action's identifier is a build artefact — it rotates on deploy and cannot be documented, so there is literally no URL to give a partner. If any non-browser caller exists now or is planned, the handlers are not optional. The argument is set out in [02l](../15-databases-apis-and-full-stack-patterns/02l-the-decision-rule.md).

**★ Symptom: the API grew a seventh route, `POST /api/cards/[cardId]/move`, and now two endpoints can change `boardId`.** Cause: a verb that felt awkward to express as `PATCH` got its own address. Fix: decide once whether the resource is the noun or the operation, and if it is the noun, moving a card is `PATCH /api/cards/[cardId]` with `{ "boardId": "…" }`. An action-shaped endpoint on a resource-shaped API means every future rule about card updates has two places to live.

**★ Symptom: a client depends on cards coming back in creation order, and a query-plan change breaks it.** Cause: an accident of the implementation was consumed as a guarantee, because the contract never said what the ordering was. Fix: state the ordering in the contract and put it in the query — `ORDER BY` with a total order including the id, which is exactly why the index in [02](02-the-schema-and-the-migration-story.md) is on `(board_id, created_at, id)` rather than `(board_id, created_at)`. An ordering the contract does not state is an ordering the database is free to change.

**★ Symptom: `OPTIONS /api/cards/abc` returns something nobody wrote, and a CORS preflight starts passing that should not.** Cause: Next.js implements `OPTIONS` automatically from the methods you exported. That is convenient and it is also a behaviour you did not author. Fix: know that it is there, and if the resource is meant to be same-origin only, do not add CORS headers anywhere on it — the automatic `OPTIONS` sets `Allow`, not `Access-Control-Allow-Origin`, so preflight only succeeds if you added those headers yourself.

**★ Symptom: the contract exists, and the handlers drifted from it within a month.** Cause: the contract is a document rather than a dependency. Fix: make the handler import it — the response type of every handler is `CardRepresentation`, so a field renamed in the database and forgotten in the mapper is a type error rather than a client incident. A contract nothing imports is a description again.

## Interview questions

**★ Why is "Route Handlers or Server Actions?" the wrong question for a CRUD resource?**
Because it presumes the resource has one kind of caller, and a resource worth building rarely does. The decision rule is *who is meant to call this*, and for a card in SprintDesk the honest answer is: the board UI, which wants an action so it gets the origin check, the pre-hydration form submission and a single response that both writes and re-renders; and every non-browser client, which wants a URL because a Server Action's id is a build artefact with no stable address. Both are correct simultaneously. What matters is not which door you pick but that both doors call the same room — because the number of places a rule lives should be one regardless of how many entry points exist.

**★ What does a contract commit you to that a description does not?**
Breakage. A contract can be violated, which means a violation is an event — a failing test, a rejected review, a version bump. A description merely becomes stale, which is not an event at all: nothing fails, nobody is paged, and the first person to find out is the client author whose integration stopped working. The second difference is the direction of authority. A contract is something the code must satisfy; a description is something the code produces. Reverse that arrow and every design question ("should a duplicate title be 409 or 422?") silently becomes a clerical one ("does the doc match the code?"), and clerical questions get waved through.

**★ Why is the item route `/api/cards/[cardId]` and not `/api/boards/[boardId]/cards/[cardId]`?**
Because a card id is already globally unique, so the board segment in the item URL carries no information the server needs — and information a URL carries but does not need is information that can be wrong. The nested form forces you to define behaviour for a request where the board id and the card's actual board disagree, and every available answer is bad: `404` hides a real card, `400` makes a routine client bug look like a validation failure, and ignoring the segment means two different URLs address the same resource, which breaks caching. The collection route *is* nested, because there the board id is genuinely required — you cannot list "the cards" without saying whose.

**★ Where does the ownership predicate live, and why not in the handler?**
In the Data Access Layer, inside the query. Not in the handler, because a handler is one entry point out of at least two, and a check written in one door is a check that has to be written again in the next one and in the queue consumer after that. Copies drift: one gets tightened during an incident and the other is found by a pentest a year later. Putting it in the DAL makes the number of places the rule lives independent of the number of doors — which is the actual security property, and it is why topics 05 through 08 in this chapter can discuss status codes without re-litigating authorization every time.

**★ A colleague wants to generate the API contract from the handlers so it can never be out of date. What is wrong with that?**
Nothing is wrong with generating documentation that way; a great deal is wrong with calling the result a contract. Generation guarantees the document agrees with the code, which is the property you least need — the code is available. What you actually need is a statement of intent the code can be *checked against*, so that changing a status code produces a failure rather than an updated document. A generated spec makes every behaviour, including the accidental ones, into a published promise the moment the generator runs, and makes every breaking change invisible because the artefact simply regenerates. Generate the client SDK from the contract; do not generate the contract from the server.

**★ Which parts of your database schema are allowed to appear in the contract?**
Only the parts you are willing to be unable to change. A field's name, type, nullability and value domain are contract if the client reads them; the storage type behind them is not. `position` is the clearest case in this chapter: the contract says "an ordering key, a number, higher is later", and the schema says `double precision` because sparse doubles let you insert between two neighbours without renumbering. If the contract had said "an integer index starting at 0", the storage decision would have been made for you by a document, and a reordering would have become an update of every row on the board. State the semantics, hide the representation.

**★ What does it mean for the contract file to have no imports?**
That it can be consumed by things that cannot run your server — a test, a client SDK, a documentation build, another team's repository. The moment the contract imports the Drizzle schema, it is no longer a statement about the API; it is a statement about the database that happens to be reachable over HTTP, and it stops compiling anywhere the driver does not. The DAL's return types are derived from the schema, which is correct and covered in [04d](04d-projections-not-rows.md); the contract is the other direction, and keeping the two apart is what lets you change one without the other.

{/* FOOTER */}
