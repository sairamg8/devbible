---
title: "What crosses the boundary"
sidebar_label: "05 · What crosses the boundary"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) (the full serializable and
> non-serializable prop lists, and the caveat on importing from a client module) and
> [`'use server'`](https://react.dev/reference/rsc/use-server) (the serializable argument
> and return-value lists). The exact wording of the "Functions cannot be passed directly to
> Client Components" message is the framework-surfaced runtime error widely reproduced in
> `vercel/next.js` issue threads (e.g. discussions #47846 and #49625), not a quote from
> react.dev.
> No sandbox script backs this page; claims are cited, not measured.

**One rule generates most RSC error messages: values crossing the boundary must be
serializable.** Not "should be", not "ideally" — the boundary is a wire, and anything that
cannot be taken apart on one side and rebuilt on the other simply cannot travel.

## The three crossings, and they are not identical

People memorise one list and then hit a wall, because there are three directions and two of
them have exceptions.

| Crossing | Direction | Governed by |
|---|---|---|
| **Props** to a Client Component | server → client | the `'use client'` serializable-props list |
| **Arguments** to a Server Function | client → server | the `'use server'` argument list |
| **Return value** of a Server Function | server → client | *"the same as serializable props"* |

Two differences between the first two are worth committing to memory, because they are the
ones that catch experienced people:

| | Props (server → client) | Arguments (client → server) |
|---|---|---|
| **`FormData`** | ✖ | ✅ |
| **React elements / JSX** | ✅ | ✖ |
| Events from event handlers | — | ✖ (named explicitly) |

Both make sense from the direction of travel. JSX flows outward — a rendered tree going
*to* the server means nothing. `FormData` flows inward, because a form submission is the
primary way a Server Function gets called ([Phase 9](../phase-9-forms-actions/02-actions.md)).

## What crosses

The list from the `'use client'` reference, in full:

- **Primitives** — `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, and
  **`symbol`, only symbols registered in the global Symbol registry via `Symbol.for`**
- **Iterables containing serializable values** — `String`, `Array`, `Map`, `Set`,
  `TypedArray`, `ArrayBuffer`
- **`Date`**
- **Plain objects** — *"those created with object initializers, with serializable
  properties"*
- **Functions that are Server Functions**
- **Client or Server Component elements (JSX)**
- **Promises**

Three of those deserve more than a line.

### Promises cross

A promise created on the server can be handed to a Client Component, which consumes it with
`use`. That is not a trick — it is the documented pattern for starting a fetch early on the
server and letting a lower-priority part of the page finish it in the browser
([topic 08](08-async-components.md), and `use` from
[Phase 8](../phase-8-concurrent-suspense/04-use-promise.md)).

### JSX crosses

Component elements are serializable, which is what makes
[topic 07](07-server-components-as-children.md) — passing Server Components as `children` —
possible at all. An element is data: a type reference plus props. It is not the component's
code.

### Server Function references cross

The one apparent contradiction to "functions cannot cross". What travels is a **reference**
that the framework creates; calling it performs a network request
([topic 04](04-use-server.md)). The function body never leaves the server.

## What does not cross

> **Notably, these are not supported:**
> - **Functions that are not exported from client-marked modules or marked with
>   `'use server'`**
> - **Classes**
> - **Objects that are instances of any class (other than the built-ins mentioned) or
>   objects with a null prototype**
> - **Symbols not registered globally, ex. `Symbol('my new symbol')`**

The middle two are the ones that bite in real applications, and they bite in the same place:
**your data layer**. An ORM row, a MongoDB document with an `ObjectId`, a `Decimal` from a
database driver, a model object from an SDK — all class instances, none serializable, all of
them the natural thing to hand straight to a component.

⚠️ **"Plain objects" is stricter than "looks like an object".** The rule is *created with
object initializers, with serializable properties* — so a plain wrapper around a class
instance still fails, because the property is what is checked. Nesting does not launder
anything.

## The error, and how to read it

The message frameworks surface for the most common violation reads:

> Functions cannot be passed directly to Client Components unless you explicitly expose it
> by marking it with `"use server"`.

Two things to take from it:

1. **The fix is named in the message.** If the function *should* be callable from the
   client, mark it — that is a Server Function and a deliberate endpoint
   ([topic 06](06-server-function-security/README.md)). If it should not, it does not belong in the
   props at all.
2. **The trigger is often not the prop you are looking at.** Serialization is recursive, so
   a function three levels deep inside an options object fails the whole prop. The reported
   prop name is the *top* of the chain, not the offender.

The other direction has its own restriction, from the same reference:

> **When a server evaluated module imports values from a `'use client'` module, the values
> must either be a React component or supported serializable prop values to be passed to a
> Client Component. Any other use case will throw an exception.**

So you cannot reach into a client module for a helper and call it server-side. The boundary
is a wire in both directions.

## Violation by violation

| You passed | Why it fails | What to do instead |
|---|---|---|
| `onClick={fn}` from a Server Component | a function is not serializable | move the handler into a Client Component ([topic 03](03-use-client.md)) |
| A database row / ORM model | class instance | map it to a plain object at the boundary |
| A `Date` | — | this one is fine; `Date` is on the list |
| `Symbol('id')` | not in the global registry | `Symbol.for('id')`, or use a string |
| A class you wrote | classes are not serializable | pass data, reconstruct on the client if needed |
| `{ user, format: (d) => … }` | the nested function fails the whole prop | pass formatted strings, or format client-side |
| A React element **to** a Server Function | JSX is excluded from arguments | pass the data the element was built from |
| The DOM event object | events are excluded from arguments | pass the fields you need, or take `FormData` |

**The recurring answer is "map at the boundary".** A small explicit mapping from your data
layer's objects to plain data is not boilerplate you are being forced into — it is the
serialization contract written down, and it is the same discipline an HTTP API would have
demanded anyway.

```jsx
// Server Component
const row = await db.users.findById(id);   // a model instance

// ✖ passes a class instance
return <Profile user={row} />;

// ✅ passes plain data
return <Profile user={{ id: row.id, name: row.name, joinedAt: row.joinedAt }} />;
```

Note `joinedAt` needs no conversion — `Date` crosses natively, which is one of the few
places RSC is *less* restrictive than `JSON.stringify`.

## Serialization is not JSON

Worth saying explicitly, because the instinct is to reach for "is it JSON-safe?" and that
instinct is wrong in both directions:

| | `JSON.stringify` | RSC boundary |
|---|---|---|
| `Date` | becomes a string | stays a `Date` |
| `Map` / `Set` | becomes `{}` | preserved |
| `undefined` | dropped | preserved |
| `bigint` | throws | supported |
| Promises | ignored | supported |
| Circular references | throws | — |

So "it survives `JSON.stringify`" is neither necessary nor sufficient. Check the list.

## Gotchas

**Symptom:** "Functions cannot be passed directly to Client Components…" naming a prop that
is obviously not a function.
**Cause:** serialization is recursive; something nested inside it is.
**Fix:** look inside the object, not at the prop name.

**Symptom:** passing a database row to a Client Component throws.
**Cause:** it is a class instance, not a plain object.
**Fix:** map to a plain object at the boundary — explicitly, field by field.

**Symptom:** wrapping the offending value in `{ data: value }` did not help.
**Cause:** "plain object **with serializable properties**" — the check is recursive.
**Fix:** fix the value, not the wrapper.

**Symptom:** a `Symbol` prop throws.
**Cause:** only symbols registered globally via `Symbol.for` are supported.
**Fix:** `Symbol.for(…)`, or use a string.

**Symptom:** `JSON.parse(JSON.stringify(row))` "fixed" it but dates came back as strings.
**Cause:** the round trip is lossy; the boundary itself is not.
**Fix:** map explicitly and keep the `Date`.

**Symptom:** importing a utility function from a `'use client'` file into a Server Component
throws.
**Cause:** server code may only import React components or serializable values from a client
module.
**Fix:** put the utility in a neutral module both graphs can import.

**Symptom:** passing JSX to a Server Function throws, though JSX works fine as a prop.
**Cause:** React elements are on the prop list and off the argument list.
**Fix:** pass the underlying data.

## Interview questions

**★ What is allowed to cross the RSC boundary?**
Primitives including `bigint` and globally registered symbols; iterables of serializable
values — `String`, `Array`, `Map`, `Set`, `TypedArray`, `ArrayBuffer`; `Date`; plain objects
with serializable properties; Server Functions; JSX elements; and Promises. Not allowed:
ordinary functions, classes, instances of classes, null-prototype objects, and symbols that
are not globally registered.

**★ Why does passing `onClick` from a Server Component fail, and what is the error really
telling you?**
Because a function is not serializable, and the boundary is a network hop. The message names
the fix — mark it `'use server'` — but that is only right if the function *should* be a
public endpoint. If it should not, the handler belongs inside a Client Component.

**★ Are the rules the same in both directions?**
No, and this is the detail that separates people who have read the reference from people who
have not. Server Function **arguments** add `FormData` and exclude React elements and DOM
events; Client Component **props** are the reverse on those two points. Return values follow
the prop rules.

**★ Is "serializable" the same as "JSON-serializable"?**
No, and it differs in both directions. `Date`, `Map`, `Set`, `undefined`, `bigint` and
Promises all cross the RSC boundary and none survive a JSON round trip intact. Meanwhile
plenty of JSON-*producible* things — a class instance, for example — are rejected.

**How do Promises and JSX cross if functions cannot?**
Because neither is code. A promise is a value React can stream a resolution for, and a JSX
element is data — a type reference plus props. Server Function references cross for a
different reason: what travels is a reference the framework creates, and calling it performs
a network request. The body never leaves the server.

**Your ORM rows will not serialize. What is the right response?**
Map to plain objects at the boundary, explicitly. It is the same contract an HTTP API would
have imposed — you would never have sent the model instance over the wire either — and it
keeps the shape a component depends on out of your data layer's hands. Avoid
`JSON.parse(JSON.stringify(…))`: it is lossy where the boundary is not, and it turns your
dates into strings for nothing.

---

← Prev: [`'use server'`](04-use-server.md) ·
Index: [Phase 10](README.md) ·
Next → [Server Function security](06-server-function-security/README.md)
