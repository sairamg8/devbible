---
title: "05 — The ambient environment is not the language"
sidebar_label: "05 · The ambient environment is not the language"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by `grep -l` across all 100 `lib.*.d.ts` files shipped with
> **TypeScript 5.9.3**, and by reading the declarations in **`@types/node`
> 26.2.0** as installed in this repository (`node_modules/@types/node/`). **No
> sandbox, no console blocks.**

Here is the question this chunk exists to answer, and it is on the syllabus
because everybody hits it:

> `structuredClone` works when I run the code. TypeScript says
> `Cannot find name 'structuredClone'`. Why?

The answer is not about versions. It is about the difference between **the
language** and **the environment**, and once you have it, a whole class of
confusion goes away.

## Which of these are JavaScript?

```ts
JSON.parse(s);          // ①
new Map();              // ②
console.log(x);         // ③
setTimeout(f, 100);     // ④
fetch(url);             // ⑤
structuredClone(o);     // ⑥
new URL(href);          // ⑦
process.env.PORT;       // ⑧
```

Only ① and ② are. `JSON` and `Map` are specified by ECMAScript, so they are
declared in `lib.es5.d.ts` and `lib.es2015.collection.d.ts` and you get them from
`lib`.

**Nothing else on that list is JavaScript.** Grepping the 100 shipped lib files
for each name gives the same two-file answer every time:

| Name | Declared in |
|---|---|
| `console` | `lib.dom.d.ts`, `lib.webworker.d.ts` |
| `setTimeout` | `lib.dom.d.ts`, `lib.webworker.d.ts` |
| `fetch` | `lib.dom.d.ts`, `lib.webworker.d.ts` |
| `structuredClone` | `lib.dom.d.ts`, `lib.webworker.d.ts` |
| `URL` | `lib.dom.d.ts`, `lib.webworker.d.ts` |
| `process` | **no lib file at all** |

🔴 **`console` is not part of JavaScript.** Neither is `setTimeout`. They are
host APIs — the browser has them, Node has them, Deno has them, and each of those
gets its types from somewhere other than `lib.es*`. There is no
`lib.es2015.console.d.ts` and there never will be.

That is the whole explanation for the `structuredClone` question. It is a
`window`-family API. It is in `lib.dom.d.ts` and in no ES lib, at any version, at
any target — and no future TypeScript release will add it to one, because it is
not an ECMAScript feature.

## So where does Node get them?

From `@types/node`, which is a **`types`** concern, not a `lib` one — the subject
of the next chunk. The package even keeps these declarations in a directory named
for what they are:

```
node_modules/@types/node/web-globals/
  abortcontroller.d.ts  blob.d.ts       console.d.ts   crypto.d.ts
  domexception.d.ts     encoding.d.ts   events.d.ts    fetch.d.ts
  importmeta.d.ts       messaging.d.ts  navigator.d.ts performance.d.ts
  storage.d.ts          streams.d.ts    timers.d.ts    url.d.ts
```

Sixteen files, one per web API that Node grew. Read the list as a history of the
last decade of Node: `fetch`, `URL`, `AbortController`, `Blob`, streams,
`performance`, `crypto` and `localStorage` all started in browsers and arrived in
Node later, which is exactly why their types live in a package rather than in the
language's own libs.

`structuredClone` is in `messaging.d.ts`:

```ts
declare global {
    function structuredClone<T = any>(
        value: T,
        options?: worker_threads.StructuredSerializeOptions,
    ): T;
    // …
}
```

Note the `options` type: it comes from `node:worker_threads`. Node's
`structuredClone` and the browser's are the same API with different plumbing
behind them, and the two declarations are genuinely different types — which is
the seed of the collision below.

## 🔴 The complete answer, and it is three-way

Put the pieces together and the `structuredClone` question has three separate
correct answers depending on what your program contains:

1. **`lib` includes `dom` (or `webworker`)** → you have it, from the DOM lib.
2. **`@types/node` is in the program** → you have it, from `web-globals/messaging.d.ts`.
3. **Neither** → you do not have it, and no ES lib will ever give it to you.

Case 3 is the one people land in, and it is *created by doing the right thing*:
you had it by default (chunk 03 — the default lib is a `.full` file, so `dom` was
there), you tightened the config to `"lib": ["es2023"]` because it is a Node
service and the DOM has no business being in it, and `structuredClone` left with
the DOM.

**The fix is not to put the DOM back.** Adding `"dom"` to a server's `lib` to
recover one function also recovers `document`, `window`, `localStorage` and forty
thousand lines of interfaces that will type-check code that cannot run. The fix
is `@types/node`.

## 🔴 `@types/node` detects the DOM and stands down

The two mechanisms are not independent, and `@types/node` is written to notice.
Its `web-globals` files are full of this:

```ts
type _BroadcastChannel = typeof globalThis extends { onmessage: any } ? {}
    : worker_threads.BroadcastChannel;
```

`typeof globalThis extends { onmessage: any }` is a test for **"is the DOM lib
loaded?"** — `onmessage` is a `Window` member, so the conditional is true exactly
when `lib.dom.d.ts` is in the program. When it is, `@types/node` resolves its own
type to `{}` and lets the DOM's definition win. When it is not, it supplies its
own.

`fetch.d.ts` does the same for fourteen types in a row — `Request`, `Response`,
`Headers`, `FormData`, `MessageEvent`, `EventSource`, `CloseEvent`, `ErrorEvent`
and their `*Init` companions — each guarded by the identical conditional.

Two things follow from that, and both are worth internalising:

- **The collision is real and common**, or the library would not carry a
  defensive pattern repeated across sixteen files.
- **A conditional type is doing environment detection at check time.** This is
  one of the very few places where the clever end of the type system is load
  bearing in a package everyone depends on, and it is worth reading once as an
  example of the technique earning its keep.

## ⚠️ Where the pattern is not applied, the collision comes through

Not every declaration is guarded. `web-globals/timers.d.ts` declares
`setTimeout` unconditionally:

```ts
declare global {
    function setTimeout<TArgs extends any[]>(
        callback: (...args: TArgs) => void,
        delay?: number,
        ...args: MakeVoidParameterOptional<TArgs>
    ): NodeJS.Timeout;
    // …
}
```

`lib.dom.d.ts` also declares `setTimeout`, returning `number`. Function
declarations **merge into an overload set** rather than colliding, so this
compiles — but now `setTimeout` has two signatures with two different return
types, and which one a call resolves to depends on declaration order.

That is the mechanical explanation for the single most-reported TypeScript
annoyance in Node projects:

```ts
let t: number = setTimeout(tick, 1000);
//  Type 'Timeout' is not assignable to type 'number'.
```

**Nothing is broken.** You have a program that claims to be both a browser and
Node, and the two disagree about what a timer handle is. Three fixes, in order of
preference:

1. **Drop `dom` from the Node project's `lib`.** The real problem is the claim,
   not the annotation.
2. **`ReturnType<typeof setTimeout>`** if the code genuinely must run in both —
   it resolves to whatever the program's own overload set says.
3. **`NodeJS.Timeout`** only where the file is unambiguously server-side, since
   it hard-codes one of the two environments into the source.

⚠️ **`clearTimeout` accepts both**, which is why the error surfaces on the
*storage* of the handle rather than on its use, and therefore often a long way
from the config that caused it.

## Gotchas

**Symptom:** `Cannot find name 'structuredClone'` on Node 22, where it plainly
exists.
**Cause:** it is not a JavaScript API. It is in `lib.dom.d.ts` and in
`@types/node`, and your program has neither.
**Fix:** install `@types/node`. Do not add `"dom"` to a server's `lib` to get one
function.

**Symptom:** `Type 'Timeout' is not assignable to type 'number'`.
**Cause:** both `lib.dom.d.ts` and `@types/node` declare `setTimeout`; they merge
as overloads with different return types.
**Fix:** remove `dom` from a Node project's `lib`, or annotate with
`ReturnType<typeof setTimeout>`.

**Symptom:** `console.log` resolves fine, so you conclude `lib` is set correctly.
**Cause:** `console` arrives from *either* the DOM lib or `@types/node`, so its
presence proves nothing about which. It is the worst possible probe.
**Fix:** probe with something that exists in only one — `document` for the DOM,
`process` for Node.

**Symptom:** a browser project and a server project disagree about `Response`.
**Cause:** the DOM's `Response` and `undici-types`' `Response` are different
types, and which one you get depends on whether `lib.dom.d.ts` is present — see
the conditional above.
**Fix:** expected. Do not try to make one type flow between the two programs.

**Symptom:** two packages in a monorepo see different globals from identical
source.
**Cause:** ambient scope is per-**program**. Different `tsconfig.json`, different
`types`, different installed `@types`.
**Fix:** compare resolved `lib` + `types` + installed `@types`, not versions.

**Symptom:** adding `"webworker"` to a Node config "for the timers".
**Cause:** a reasonable-looking mistake — `lib.webworker.d.ts` does declare
`setTimeout` and `fetch`. It also declares `self`, `importScripts` and the whole
worker scope, and it collides with `dom` if that is present too.
**Fix:** `@types/node` is the only correct source of Node's globals.

## Interview questions

**Is `console.log` part of JavaScript?**
No. `console` is declared only in `lib.dom.d.ts` and `lib.webworker.d.ts` among
the bundled libs; on Node it comes from `@types/node`. ECMAScript does not
specify it.

**Why does `structuredClone` fail to type-check on Node?**
Because it is a web API. It is in the DOM lib and in `@types/node`'s
`web-globals/messaging.d.ts`, and a Node project with a narrowed `lib` and no
`@types/node` has neither.

**Will a newer `target` ever fix it?**
No. `target` moves the implied ES lib, and `structuredClone` is in no ES lib at
any version. This is the cleanest possible demonstration that `lib` version and
host environment are different axes.

**Why do `setTimeout` return types conflict?**
Because two sources declare it — the DOM lib (`number`) and `@types/node`
(`NodeJS.Timeout`) — and function declarations merge into overloads instead of
erroring. The program is claiming to be both environments.

**What does `typeof globalThis extends { onmessage: any }` mean in `@types/node`?**
It is a test for whether the DOM lib is loaded. `onmessage` is a `Window`
member, so when it is present `@types/node` yields `{}` and lets the DOM's
definition win instead of colliding with it.

**Why does `@types/node` need that guard at all?**
Because a program can legitimately contain both — an Electron app, a
server-rendered front end, a shared package — and without it every one of those
would get duplicate-identifier errors on `Request`, `Response` and friends.

**Given an unknown project, how would you find out where a global comes from?**
Go to its definition. The file path is the answer: a `lib.*.d.ts` next to the
compiler means `lib`, something under `node_modules/@types` means `types`, and
anything else means a `.d.ts` or a `declare global` in the program itself.

---

← [04 · Every value `lib` accepts](./04-every-lib-value.md) · Next → [06 · `types`, `typeRoots`, and the four sources of a global](./06-types-and-typeroots.md)
