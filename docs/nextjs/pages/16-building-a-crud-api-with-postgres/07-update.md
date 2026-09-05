---
title: "PUT and PATCH are not two spellings of the same verb — one replaces the resource and is idempotent, the other applies instructions and is not, and a handler that treats an absent field the same way in both has silently picked one and lied about the other"
sidebar_label: "07 · UPDATE — PUT vs PATCH"
sidebar_position: 50
description: "What PUT and PATCH actually mean per RFC 9110 and RFC 5789, what each does with a field the client did not send, why PATCH is not idempotent by default, how to make it so, and the two Route Handlers written against one Data Access Layer."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110 §9.3.4 (PUT), §9.2.2 (Idempotent Methods), §15.3.5 (204), §15.5.10 (409) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html) — and RFC 5789 §2 (The PATCH Method) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc5789.html). Quotes below are copied from the published RFC text files, not paraphrased.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Almost every argument about PUT versus PATCH is conducted as a style preference, and it is not one. The two verbs make different promises to the client about what happens to the parts of the resource the request did not mention, and those promises have consequences a client is entitled to rely on: a proxy may retry a PUT after a dropped connection and MUST NOT retry a PATCH. If you route both to the same handler, you have not offered two verbs — you have offered one verb under two names, and the name that is now wrong is whichever one you did not implement. This page settles the semantics, shows both handlers over the SprintDesk `cards` resource, and stops exactly at the point where a field the client did not send becomes indistinguishable from a field the client sent as `null` — which is [07b](07b-absent-versus-null.md) and is where the real damage happens.**

## The surface

```
PATCH /api/cards/[cardId]     partial update   — send only what changed
PUT   /api/cards/[cardId]     full replace     — send the whole resource
```

Both land on the same row and both go through [the Data Access Layer](04-the-data-access-layer.md), which owns [the ownership predicate](04c-the-ownership-predicate.md) — caller must be a member of the team that owns the board that owns the card. Nothing on this page re-checks authorization, because there is exactly one place it lives.

## What PUT actually promises

RFC 9110 §9.3.4:

> *"The PUT method requests that the state of the target resource be created or replaced with the state defined by the representation enclosed in the request message content."*

Read *replaced*. The representation in the body is not a set of changes; it **is** the new state. A field the client omitted is not "unchanged" — it is absent from the new state, and the server is being told the resource should no longer have it.

The RFC also pins the response codes, and it does so with `MUST`:

> *"If the target resource does not have a current representation and the PUT successfully creates one, then the origin server MUST inform the user agent by sending a 201 (Created) response. If the target resource does have a current representation and that representation is successfully modified in accordance with the state of the enclosed representation, then the origin server MUST send either a 200 (OK) or a 204 (No Content) response to indicate successful completion of the request."*

And it warns you not to over-promise:

> *"However, there is no guarantee that such a state change will be observable, since the target resource might be acted upon by other user agents in parallel … A successful response only implies that the user agent's intent was achieved at the time of its processing by the origin server."*

That sentence is the chapter's thesis wearing an RFC's clothes. "It worked" means "it worked at the instant I applied it", not "it is still true".

## What PATCH actually promises

RFC 5789 §2 draws the line in one paragraph:

> *"In a PUT request, the enclosed entity is considered to be a modified version of the resource stored on the origin server, and the client is requesting that the stored version be replaced. With PATCH, however, the enclosed entity contains a set of instructions describing how a resource currently residing on the origin server should be modified to produce a new version."*

A PATCH body is **instructions**, not state. Which means the format matters: `{"status":"done"}` is only an instruction if both parties agree that a present member means "set this" and an absent member means "leave alone". That agreement has a name and a media type — JSON Merge Patch, RFC 7396 — and it is worth adopting deliberately rather than reinventing per endpoint:

> *"If the provided merge patch contains members that do not appear within the target, those members are added. If the target does contain the member, the value is replaced. Null values in the merge patch are given special meaning to indicate the removal of existing values in the target."*
> — [RFC 7396 §1](https://www.rfc-editor.org/rfc/rfc7396.html)

🔴 **That last sentence is the whole of [07b](07b-absent-versus-null.md).** Under merge-patch rules `{"body": null}` means *clear the body* and `{}` means *change nothing* — and a validation schema that folds both into "the value is `undefined`" cannot tell them apart.

RFC 5789 also requires atomicity, which is why the update is one statement and not a read followed by three writes:

> *"The server MUST apply the entire set of changes atomically and never provide (e.g., in response to a GET during this operation) a partially modified representation. If the entire patch document cannot be successfully applied, then the server MUST NOT apply any of the changes."*

## Idempotency is the difference that reaches the network

RFC 9110 §9.2.2:

> *"A request method is considered 'idempotent' if the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request. Of the request methods defined by this specification, PUT, DELETE, and safe request methods are idempotent."*

And the reason it is not academic:

> *"Idempotent methods are distinguished because the request can be repeated automatically if a communication failure occurs before the client is able to read the server's response. For example, if a client sends a PUT request and the underlying connection is closed before any response is received, then the client can establish a new connection and retry the idempotent request."*

RFC 5789 is blunt about the other verb:

> *"PATCH is neither safe nor idempotent as defined by [RFC2616], Section 9.1."*

So: **a PUT that times out can be replayed by an HTTP client, a load balancer, or a retrying fetch wrapper, and that replay is legal.** A PATCH cannot — RFC 9110 says *"A proxy MUST NOT automatically retry non-idempotent requests"* and *"A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent."*

That "unless" is your escape hatch. A merge-patch of `{"status":"done"}` **is** idempotent in effect, because applying it twice lands on the same state. A patch of `{"position":{"op":"increment","by":1}}` is not. RFC 5789 anticipates exactly this:

> *"A PATCH request can be issued in such a way as to be idempotent, which also helps prevent bad outcomes from collisions between two PATCH requests on the same resource in a similar time frame."*

**Design rule that falls out of it:** keep your patch format to absolute values, never deltas. `{"position": 4096}` replayed twice is harmless; `{"positionDelta": 1}` replayed twice moves the card twice, and you will not know it happened.

## Both handlers, one Data Access Layer

```ts
// app/api/cards/[cardId]/route.ts
import { z } from 'zod'
import { getCardForCaller, replaceCard, patchCard } from '@/lib/dal/cards'

const status = z.enum(['todo', 'doing', 'done'])

// PUT: every field of the resource is required, because the body IS the new state.
const CardReplacement = z.strictObject({
  title: z.string().min(1).max(200),
  body: z.string().max(20_000).nullable(),   // nullable, NOT optional
  status,
  position: z.number().finite(),
})

// PATCH: every field optional. What `body: null` means is 07b's subject.
const CardPatch = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20_000).nullable().optional(),
  status: status.optional(),
  position: z.number().finite().optional(),
})

export async function PUT(req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params
  const parsed = CardReplacement.safeParse(await req.json())
  if (!parsed.success) return Response.json({ issues: parsed.error.issues }, { status: 400 })

  const card = await replaceCard(cardId, parsed.data)   // ownership checked inside
  return Response.json(card, { status: 200 })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params
  const raw = await req.json()
  const parsed = CardPatch.safeParse(raw)
  if (!parsed.success) return Response.json({ issues: parsed.error.issues }, { status: 400 })

  const card = await patchCard(cardId, parsed.data)
  return Response.json(card, { status: 200 })
}
```

Two things to notice before [07b](07b-absent-versus-null.md) takes them apart:

1. **`body` is `.nullable()` on the PUT schema and `.nullable().optional()` on the PATCH schema.** Those are different types on purpose. On a replace, the client must say what the body is — including "there isn't one". On a patch, it may say nothing at all.
2. **Both schemas are `z.strictObject`.** A typo'd field name should be a 400, not a silently ignored key. Probed on the installed `zod` **4.4.3**: `z.strictObject({title: z.string()}).safeParse({title:'x', nope:1})` fails with issue code `unrecognized_keys`.

Neither handler shows the concurrency check yet. That is deliberate — as written, both of these lose updates, and the demonstration is [07c](07c-the-lost-update.md).

## Which one should the endpoint offer?

The honest answer is that most APIs need PATCH and ship PUT out of habit.

| Client | Wants | Because |
|---|---|---|
| A card detail form in the UI | **PATCH** | It knows which field the user touched; sending the whole card means overwriting fields it rendered from a stale read |
| A drag-and-drop board | **PATCH** | Only `position` and `boardId` changed; the title is irrelevant to the interaction |
| A sync client / importer | **PUT** | It genuinely owns the whole record and wants replace-or-create semantics with retry safety |
| A mobile client on a flaky network | **PUT**, or an idempotent PATCH | It needs to be able to replay after a dropped connection |

**Offering only PUT is defensible. Offering only PATCH is defensible. Offering both and implementing them identically is not** — whichever one you implemented, the other verb's name is now a lie the client will believe.

## Gotchas

**★ Symptom: a user edits a card title in one tab, and the card's description disappears.** Cause: the client sent a PUT built from a representation it read earlier, the description had since been edited elsewhere, and PUT *replaced* the resource with the stale state. This is PUT working correctly. Fix: either make the client send PATCH with only the field it touched, or make the PUT conditional so the stale write is rejected rather than applied — `If-Match` and 412, which is [07e](07e-etag-if-match-and-412.md).

**★ Symptom: a PUT with a missing field returns 200 and leaves the column unchanged.** Cause: the schema marked the field `.optional()`, so the handler built a partial `SET` clause. That is PATCH behaviour served under the PUT verb. Fix: on the replacement schema, required fields are required and nullable fields are `.nullable()` — never `.optional()`:

```ts
const CardReplacement = z.strictObject({
  title: z.string().min(1).max(200),
  body: z.string().max(20_000).nullable(),   // must be sent; may be null
  status: z.enum(['todo', 'doing', 'done']),
  position: z.number().finite(),
})
```

**★ Symptom: a card's position advances by two after a network blip.** Cause: the PATCH body carried a relative instruction (`{"positionDelta": 1}`) and something retried it — a fetch wrapper, a service worker, an impatient user. Fix: patch bodies carry absolute values only, so replay is a no-op:

```ts
// ✅ replay-safe
await fetch(`/api/cards/${id}`, { method: 'PATCH', body: JSON.stringify({ position: 4096 }) })
```

**★ Symptom: a proxy or HTTP client library retries an update and it applies twice.** Cause: the endpoint is a PATCH doing something non-idempotent, and something in the chain treated it as safe to replay. Fix: you cannot forbid this from the server — make the effect idempotent (absolute values, as above), or move the operation to POST with an idempotency key, which is [05d · Idempotency keys for a retried POST](05d-idempotency-keys-for-a-retried-post.md).

**★ Symptom: PATCH succeeds with a body the API never intended to accept, like `{"id": "..."}` or `{"createdAt": "..."}`.** Cause: the schema was `z.object`, which ignores unrecognised keys, and the handler spread the parsed object into the `SET` clause. Fix: `z.strictObject` for every request body, so an unknown key is a 400 rather than a silent no-op — and never spread client input into a `SET` clause; map it field by field, which [07b](07b-absent-versus-null.md) does.

**★ Symptom: the API accepts a PATCH that sets `boardId` to a board the caller cannot see.** Cause: the field was validated as a UUID and never authorized. Validation says *this is shaped like a board id*; it does not say *you may put a card there*. Fix: a move across boards is a second authorization — the DAL must check membership on **both** the source and the destination board before the write, and that check lives in [the DAL's ownership predicate](04c-the-ownership-predicate.md), not in the handler — a check written in a handler is exactly the placement [04ca](04ca-where-the-check-must-not-live.md) rules out.

**★ Symptom: PATCH returns 200 and the response body shows the old values.** Cause: the handler wrote and then read, and the read went through a cache or a read replica that had not caught up. Fix: return the row the write itself produced. In `drizzle-orm` **0.45.2** the update builder has a `returning` clause for exactly this, and using it means the response cannot disagree with what was committed:

```ts
const [card] = await tx.update(cards).set(patch).where(eq(cards.id, cardId)).returning()
```

**★ Symptom: a 204 response from PUT breaks a client that expected the updated resource.** Cause: RFC 9110 permits either 200 or 204 for a PUT that modified an existing representation, and the two are not interchangeable to a client that parses the body. Fix: pick one per API and document it. If you send 204, RFC 9110 §15.3.5 notes the metadata still applies — *"if a 204 status code is received in response to a PUT request and the response contains an ETag field, then the PUT was successful and the ETag field value contains the entity tag for the new representation"* — so a 204 with an `ETag` is genuinely useful, and a bare 204 forces a round trip.

**★ Symptom: two PATCHes arrive in a fraction of a second and the resulting row is a mixture neither client asked for.** Cause: nothing in this page prevents it. Both requests read, both computed a patch, both wrote. Fix: this is the lost-update problem and it is the centre of the topic — [07c](07c-the-lost-update.md) shows the interleaving, [07d](07d-optimistic-concurrency-with-a-version-column.md) fixes it.

## Interview questions

**★ What does PUT do with a field the client did not send, and what does PATCH do?**
PUT replaces the resource with the enclosed representation, so an absent field is absent from the new state — the column goes to null or its default, and the old value is gone. PATCH applies instructions, so under merge-patch rules an absent field means "leave it alone". The trap is that both look the same at the schema level if every field is marked optional; you then have a PUT that behaves like a PATCH, and clients that trusted the verb's contract get a surprise the first time they omit something.

**★ Why can a proxy retry a PUT but not a PATCH?**
Because PUT is defined as idempotent and PATCH is not. RFC 9110 says an idempotent request "can be repeated automatically if a communication failure occurs before the client is able to read the server's response", and explicitly says a proxy MUST NOT automatically retry non-idempotent requests. The practical consequence is that if your PATCH does something like an increment, a dropped connection somewhere in the chain can apply it twice, and there is nothing you can do about it from the server side except make the effect idempotent.

**★ Can a PATCH be made idempotent, and how?**
Yes, and RFC 5789 explicitly recommends it. Keep the patch format to absolute values rather than deltas — `{"position": 4096}` rather than `{"positionDelta": 1}` — so applying it twice lands on the same state. That does not make the *method* idempotent in the specification's sense, so proxies still must not retry it automatically, but it removes the damage when something retries anyway.

**★ Why does RFC 5789 require the whole patch to apply atomically?**
Because a partially applied patch leaves the resource in a state neither the client nor the server ever intended, and the client has no way to discover which half landed. Concretely, it means the handler applies the update as a single SQL statement or inside a transaction, never as a sequence of independent updates with an early return between them. If any part fails validation or a constraint, none of it is written.

**★ A client PUTs a card it read five minutes ago. Is the API behaving correctly if a colleague's edit disappears?**
Yes — that is what PUT means, and the RFC even warns that a successful response "only implies that the user agent's intent was achieved at the time of its processing". The behaviour is correct and the *design* is wrong: an unconditional PUT on a resource multiple people edit will lose work. The fix is not to change PUT's semantics but to make the request conditional, so the server can reject a write built on a stale read.

**★ Why is `z.object` the wrong default for a request body?**
Because it drops unrecognised keys silently. A client that misspells `stauts` gets a 200 and no change, and will spend an afternoon convincing itself the server is broken. `z.strictObject` turns that into a 400 with an `unrecognized_keys` issue naming the offending field, which is both a better error and a defence against a client trying to set a column the API does not expose, like `id` or `version`.

**★ If you could ship only one of PUT and PATCH, which and why?**
PATCH, for a resource a UI edits field by field — which describes almost every CRUD API. A UI that must send the whole resource has to have read the whole resource recently, and every field it did not touch becomes a chance to overwrite someone else's edit. PUT earns its place when the client genuinely owns the record end to end — an importer, a sync agent, a system that regenerates the resource from its own source of truth — and there the retry safety of an idempotent method is worth real money.

---

← [06g · Conditional requests](06g-conditional-requests-and-etag.md) · [Chapter 16 overview](01-explanation.md) · Next → [07b · Absent vs null](07b-absent-versus-null.md)
