---
title: "Every argument to a Server Action and every value it returns is serialized across a network boundary, so the list of supported types is a hard API contract — and the entries most likely to bite are 'class instances are not supported' and 'events from event handlers are not supported'"
sidebar_label: "05c · What crosses the wire"
sidebar_position: 5.2
description: "The complete supported and unsupported type lists for Server Function arguments and return values, why an ORM row or a Decimal fails while a Date succeeds, why onClick={action} sends an event, promises as arguments, the 1MB body cap, and constraining returns."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against React's [`'use server'`](https://react.dev/reference/rsc/use-server) directive reference — the *Serializable parameters and return values* section — and [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (docs `lastUpdated` 2026-06-17) for the body-size cap and the return-value rule.
> Target: **Next.js 16.3.4**, React **19.2.8**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**The `import` at the top of your Client Component makes an action look like a function call, and the type checker will happily accept `await completeItem(row)` where `row` came out of your ORM. It will fail at runtime, because the call is a network call and `row` is a class instance. The supported-types list is not a style guide; it is the wire format, and it is short enough to learn once and never look up again. Two entries do most of the damage. **Class instances are not supported** — which rules out an ORM model object, a `Decimal`, a `Money`, and anything from a library that returns its own types. And **events from event handlers are not supported** — which is why `onClick={deleteItem}` compiles, ships, and fails, since the handler passes the click event as the first argument. The security consequence sits on top of all of it: the arguments are fully client-controlled ([05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)), and the return value is serialized straight to the browser.**

## The supported list, in full

React's reference gives these as the types you may pass as Server Function arguments.

| Group | Types |
|---|---|
| **Primitives** | `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, and `symbol` — **only** symbols registered globally via `Symbol.for` |
| **Iterables of serializable values** | `String`, `Array`, `Map`, `Set`, `TypedArray`, `ArrayBuffer` |
| **Other** | `Date`, `FormData` instances, plain objects created with object initializers whose properties are serializable, functions that are themselves Server Functions, and `Promise`s |

Two entries in that last row are easy to skim past and both are useful. **A Server Function may be passed to a Server Function** — which is how you hand a callback across. And **a `Promise` is serializable as an argument**, so you can pass an unresolved value across the boundary rather than awaiting it first.

**Return values follow the same rule as serializable props for a boundary Client Component** — the same list, applied on the way back.

## The unsupported list, and why each entry catches people

| Not supported | Where it shows up |
|---|---|
| React elements, or JSX | passing a rendered node to an action "so it can re-render it" |
| Functions, including component functions — anything not a Server Function | a callback, a formatter, a comparator |
| Classes | passing a constructor |
| **Instances of any class** other than the built-ins listed above, and objects with a **null prototype** | 🔴 an ORM row, a `Decimal`, a `Money`, a `URL`, an `Error`, `Object.create(null)` |
| Symbols not registered globally — `Symbol('x')` | a locally-minted symbol key |
| **Events from event handlers** | 🔴 `onClick={deleteItem}` |

### The ORM row

```ts
// ❌ compiles; fails at runtime — a Prisma/Drizzle row is a class instance,
//    and a Decimal column is another one nested inside it.
await updateProject(project)

// ✅ pass plain data the client legitimately owns
await updateProject({ id: project.id, name: nextName })
```

This is the same boundary RSC props cross, so if you have already been bitten passing a model object from a Server Component into a Client Component, it is the identical failure. A `Date` survives, because `Date` is on the supported list; a `Decimal` does not, because it is a library class. The habit that avoids the entire category is to project at the boundary: build a plain object with exactly the fields the other side needs, and never hand over something whose type you did not define.

### The event handler

```tsx
'use client'
import { deleteItem } from './actions'

// ❌ onClick passes the click event as the first argument.
//    Events from event handlers are not serializable.
<button onClick={deleteItem}>Delete</button>

// ✅ call it explicitly, inside a transition
<button onClick={() => startTransition(() => { deleteItem(itemId) })}>Delete</button>
```

The first form type-checks whenever the action's first parameter is loosely typed, which is exactly when it is easiest to write. It is worth a lint rule if your codebase has more than a handful of actions.

## The size of what crosses

Action requests are capped at **1MB** by default; `serverActions.bodySizeLimit` raises it ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)). That cap applies to the whole POST body: every argument, plus any variables an inline action captured, since those are encrypted and sent along with the reference ([05](05-server-actions-mutations-form-submissions-progressive-enhanc.md)).

Two consequences worth designing around:

- **A file upload through a Server Action has a low ceiling.** Raise the limit for a genuinely larger payload, or — for real uploads — hand the browser a signed URL from a Route Handler and keep the action for the metadata write ([04e](04e-reading-the-request-body-and-validating-at-the-boundary.md)).
- **A closure over a large object is a payload you did not know you were sending.** Capturing `project` in an inline action sends the encrypted whole row on every invocation; capturing `project.id` sends a string.

```tsx
// 🔴 captures the whole row, encrypted, on every submission
async function save() { 'use server'; await db.project.update({ where: { id: project.id }, data: patch }) }

// ✅ capture only what the closure needs
const projectId = project.id
async function save() { 'use server'; await db.project.update({ where: { id: projectId }, data: patch }) }
```

⚠️ Whether the compiler is smart enough to capture only the referenced property is not stated on the pages verified here. Assume it captures what you wrote, and write the narrow thing.

## Constraining what comes back

Return values are serialized to the client wholesale. The documented rule is to shape them to what the UI renders, not to raw database records — and the reason it matters more than it sounds is schema drift: a column added next quarter widens what ships to browsers on a query nobody revisited.

```ts
'use server'
export async function createUser(formData: FormData): Promise<{ id: string; name: string }> {
  const user = await db.user.create({ data: { /* … */ } })
  return { id: user.id, name: user.name }   // not: return user
}
```

An explicit return type on the action is the cheapest enforcement available: it makes "return the row" a compile error rather than a code-review catch. It also happens to solve the class-instance problem on the return path, because a projected plain object is serializable by construction.

The same rule applies to `useActionState`'s `initialState`, which React documents as needing to be serializable when the action is a Server Function — plain objects, arrays, strings and numbers ([05d](05d-the-action-hooks-in-depth.md)).

## Gotchas

**★ Symptom: passing an ORM row to an action fails at runtime with something that reads like a bundler error.** Cause: instances of any class other than the built-ins are not serializable, and an ORM row is a class instance — often with more class instances (`Decimal`, `Buffer`) nested inside it. Fix: project to a plain object at the boundary.

```ts
await updateProject({ id: project.id, name: nextName })   // not: updateProject(project)
```

**★ Symptom: `onClick={deleteItem}` deletes nothing, or deletes the wrong thing.** Cause: the click handler passes the event as the first argument, and events from event handlers are not serializable. Fix: call the action explicitly inside a transition, passing what you actually mean.

```tsx
<button onClick={() => startTransition(() => { deleteItem(itemId) })}>Delete</button>
```

**★ Symptom: a `Decimal` money column round-trips as an error, while the `Date` beside it is fine.** Cause: `Date` is on the supported list; a library's `Decimal` is a class instance and is not. Fix: convert at the boundary — `amount: money.toString()` or `Number(money)` depending on your precision requirements — and decide that conversion once, in the projection, rather than at three call sites.

**★ Symptom: a callback passed to an action is rejected.** Cause: functions are not serializable unless they are themselves Server Functions. Fix: pass a discriminator the server can switch on, or pass an actual Server Function if the intent really is "call this on the server".

**★ Symptom: an object built with `Object.create(null)` fails to cross.** Cause: objects with a null prototype are explicitly unsupported, alongside class instances. Fix: `{ ...bag }` into a plain object literal before passing it — which is also what you want for a lookup table you are about to serialize.

**★ Symptom: a symbol key survives in development and fails elsewhere.** Cause: only symbols registered in the global registry via `Symbol.for` are supported; a locally-minted `Symbol('x')` is not. Fix: use a string key, which is what the wire format wants anyway.

**★ Symptom: a file upload through an action fails above roughly a megabyte with no useful message.** Cause: action requests are capped at 1MB by default. Fix: raise `serverActions.bodySizeLimit` for a genuinely larger payload, or move the upload to a signed URL from a Route Handler and keep the action for the metadata write.

**★ Symptom: an action's payload is far larger than its arguments.** Cause: an inline action captured more than it needed — the whole row rather than the id — and captured variables are encrypted and sent with the reference, inside the same 1MB budget. Fix: hoist the narrow value out and capture that.

**★ Symptom: a returned object leaks fields the UI never renders.** Cause: return values are serialized wholesale, so returning a database row ships every column — including ones added to the schema after you wrote the query. Fix: project explicitly, and put an explicit return type on the action so the projection is enforced by the compiler.

```ts
export async function createUser(fd: FormData): Promise<{ id: string; name: string }> { /* … */ }
```

**Symptom: an `Error` instance returned from an action does not arrive as an `Error`.** Cause: `Error` is a class instance, and class instances other than the listed built-ins are not supported. Fix: return a plain result object — `{ ok: false, code, message }` — which is the shape you want anyway, because a returned error is a normal return value that `useActionState` can render ([05e](05e-errors-authorization-and-when-a-route-handler-is-the-right-tool.md)).

**Symptom: JSX passed to an action is rejected.** Cause: React elements are explicitly unsupported. Fix: send the data the element was built from and let the server render or store that; an action that receives markup is almost always a design that wanted a Server Component.

**Symptom: `initialState` for `useActionState` is a class instance and things behave oddly.** Cause: React documents `initialState` as needing to be serializable when the action is a Server Function. Fix: make it a plain object literal — which it should be anyway, since it is the shape the action returns.

**Symptom: a `URL` object passed as an argument fails.** Cause: `URL` is a class instance and is not one of the listed built-ins — `Date`, `FormData`, `Map`, `Set`, `TypedArray`, `ArrayBuffer` and `Promise` are, and `URL` is not among them. Fix: pass `url.toString()` and reconstruct on the server, where validating it against an allowlist is something you should be doing anyway.

## Interview questions

**★ What can and cannot be passed to a Server Action, and why is the list worth memorising?**
Supported: primitives including `bigint`, `undefined`, `null` and globally-registered symbols; iterables of serializable values — `String`, `Array`, `Map`, `Set`, `TypedArray`, `ArrayBuffer`; and `Date`, `FormData`, plain objects with serializable properties, Server Functions, and `Promise`s. Not supported: JSX, ordinary functions, classes, instances of any other class, null-prototype objects, locally-minted symbols, and events from event handlers. It is worth memorising because TypeScript will not catch most of the violations — the parameter type says `Project`, the value is a `Project`, and the failure is at the network boundary rather than in the type system.

**★ Why does passing an ORM row to an action fail, and what is the general habit that avoids it?**
Because instances of any class other than the listed built-ins are unsupported, and an ORM row is a class instance — frequently with more class instances nested inside it, such as a `Decimal` for a money column. The general habit is to project at the boundary: build a plain object with exactly the fields the other side needs and never hand over a value whose type you did not define. That habit also solves the return-value disclosure problem, because a projection cannot accidentally widen when somebody adds a column.

**★ `onClick={deleteItem}` compiles and ships. What happens at runtime?**
The click handler calls the action with the click event as its first argument, and events from event handlers are explicitly not serializable. So the call fails, or — worse, if the action's first parameter is loosely typed — it proceeds with garbage. The correct form is an arrow that calls the action with the value you actually mean, wrapped in `startTransition`, since an event handler does not create the Transition that a form's `action` would create for you.

**★ Two things count against the 1MB action body limit. What are they?**
The arguments, and any variables an inline action captured — closures are encrypted and travel with the reference, so they are part of the same POST body. The second is the one that surprises people: a per-row inline action that closes over the whole row sends that whole row, encrypted, on every invocation, while one that closes over the id sends a string. Hoist the narrow value out and capture that, and if the payload is genuinely a file, use a signed upload URL from a Route Handler instead of raising a limit that exists for a reason.

**★ Why is an explicit return type on a Server Action more than a style preference?**
Because return values are serialized to the client wholesale, so returning a database row ships every column — including the ones the schema grows after you wrote the query — and a `Promise<{ id: string; name: string }>` annotation makes "return the row" a compile error instead of a review catch. It also removes the class-instance failure on the return path, because a projected plain object is serializable by construction. Two problems, one annotation.

**★ `Date` crosses the boundary and a `Decimal` does not. Why?**
Because the serializable list is enumerated, not structural: `Date`, `FormData`, `Map`, `Set`, `TypedArray`, `ArrayBuffer` and `Promise` are named as supported, and everything else that is an instance of a class is not. A `Decimal` from an ORM is a library class, so it fails — as would a `URL`, a `Money`, or an `Error`. The rule is not "does it look like data" but "is it on the list", which is why the list is short and worth knowing rather than inferring.

**A `Promise` is a supported argument type. When would you use that?**
When the caller has started work that the action will need but does not need to wait for before dispatching — the action can receive the unresolved promise and await it on the server. It is a narrow tool and easy to over-use, because the usual answer to "I have async work to do" inside an action is to do that work inside the action, where it runs on the server without crossing anything. But it is on the supported list deliberately, and it is the mechanism behind passing a not-yet-resolved value across an RSC boundary generally.

**What is the same about the argument list and the return list?**
They are the same list — React documents supported return values as being the same as serializable props for a boundary Client Component. Which is the useful generalisation: this is not a Server Actions rule, it is *the* RSC serialization boundary, and the same types cross it in every direction. If you have already learned which props may be passed from a Server Component to a Client Component, you have already learned this.

---

← [05b · Invoking an action](05b-invoking-an-action-and-what-progressive-enhancement-really-buys.md) · [Chapter 4 overview](01-explanation.md) · Next → [05d · The action hooks in depth](05d-the-action-hooks-in-depth.md)
