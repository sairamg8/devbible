---
title: "An event missing from `CustomEventMap` is not a type error — its payload is `any`, so the whole typing mechanism is opt-in per event and the failure mode of forgetting one is silence"
sidebar_label: "Typing Custom Events"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § TypeScript for Custom Events](https://vite.dev/guide/api-plugin) (the `CustomEventMap` extension, the `.d.ts` note and the `InferCustomEventPayload` example) and [HMR API](https://vite.dev/guide/api-hmr) (the `ViteHotContext` signatures for `on`, `off` and `send`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Typing Custom Events

The last piece of the [custom-event](01od-hmr-custom-events.md) story. The payload of
`import.meta.hot.on` is typed by a declaration-merged interface, which means a plugin's events are
type-safe only if someone remembered to declare them — and the consequence of forgetting is not a
red squiggle.

---

## 1. Under-The-Hood Mechanics

### Where the type comes from

> *"Internally, vite infers the type of a payload from the `CustomEventMap` interface, it is possible
> to type custom events by extending the interface:"*

```ts
// events.d.ts
import 'vite/types/customEvent.d.ts'

declare module 'vite/types/customEvent.d.ts' {
  interface CustomEventMap {
    'custom:foo': { msg: string }
    // 'event-key': payload
  }
}
```

> *"Make sure to include the `.d.ts` extension when specifying TypeScript declaration files.
> Otherwise, Typescript may not know which file the module is trying to extend."*

That note is load-bearing and easy to skim: the module specifier is
`'vite/types/customEvent.d.ts'`, extension included, in **both** the import and the
`declare module`. Drop it and the augmentation targets a module TypeScript cannot resolve to the
same file, so the merge does not happen — and nothing reports an error.

### How it reaches your handler

> *"This interface extension is utilized by `InferCustomEventPayload<T>` to infer the payload type
> for event `T`."*

The HMR API's own signatures show where that plugs in:

```ts
interface ViteHotContext {
  on<T extends CustomEventName>(
    event: T,
    cb: (payload: InferCustomEventPayload<T>) => void,
  ): void
  off<T extends CustomEventName>(
    event: T,
    cb: (payload: InferCustomEventPayload<T>) => void,
  ): void
  send<T extends CustomEventName>(
    event: T,
    data?: InferCustomEventPayload<T>,
  ): void
}
```

All three are generic over the event name, so the same map types the listener **and** the client's
outgoing `send`. Declaring an event once gives you both directions.

### 🔴 An undeclared event is `any`, not an error

The documentation's own example says so explicitly:

```ts
type CustomFooPayload = InferCustomEventPayload<'custom:foo'>
import.meta.hot?.on('custom:foo', (payload) => {
  // The type of payload will be { msg: string }
})
import.meta.hot?.on('unknown:event', (payload) => {
  // The type of payload will be any
})
```

`CustomEventName` accepts names outside the map, and the payload degrades to `any`. So the mechanism
is opt-in **per event**, and forgetting one produces code that compiles, runs, and provides no
protection — the worst of both worlds, because the surrounding code looks typed.

⚠️ That also means a typo in an event name is not caught: `'custom:fooo'` is a valid
`CustomEventName` with an `any` payload, and it will simply never fire.

---

## 2. Real-World Engineering Scenario

**A payload shape change that TypeScript should have caught and did not.**

A plugin sent design tokens to the client as `{ tokens: Record<string, string> }`. A later refactor
flattened it to `Record<string, string>` — the wrapper object went away. The client handler still
read `data.tokens`, which was now `undefined`, so the app applied an empty token set and rendered
unstyled.

The whole codebase was TypeScript with `strict` on. Nothing was flagged, because the event had never
been added to `CustomEventMap`, so its payload was `any` on both sides — and `any.tokens` is `any`.

Adding six lines to a `.d.ts` file turned the same refactor into two compile errors, one at the
`send` and one at the `on`.

**The second failure, in the fix.** The first attempt at that declaration file wrote the module
specifier without the extension:

```ts
declare module 'vite/types/customEvent' {   // ⛔ no .d.ts
  interface CustomEventMap { 'tokens:updated': Record<string, string> }
}
```

It compiled. It also did nothing: the payload stayed `any`, because the augmentation did not resolve
to the same module Vite's types use. The documentation warns about exactly this — *"make sure to
include the `.d.ts` extension … Otherwise, Typescript may not know which file the module is trying to
extend"* — and the tell is that a deliberate type error in the handler does not appear.

**The transferable point:** every failure in this area is silent. The mechanism does not report
missing declarations, wrong specifiers or misspelled event names; it just hands you `any`.

---

## 3. Production-Grade Code Example

```typescript
// events.d.ts — one file, both directions, extension included in BOTH specifiers.
import 'vite/types/customEvent.d.ts'

declare module 'vite/types/customEvent.d.ts' {
  interface CustomEventMap {
    // server -> client
    'tokens:updated': { tokens: Record<string, string>; version: number }
    // client -> server
    'tokens:applied': { count: number }
    'tokens:ack': { ok: boolean; count: number }
  }
}
```

```typescript
// client.ts — payloads are inferred from the map; no annotations, no casts.
if (import.meta.hot) {
  const onTokens = (payload: { tokens: Record<string, string>; version: number }) => {
    applyTokens(payload.tokens);
    // `send` is generic over the same map, so this payload is checked too.
    import.meta.hot!.send('tokens:applied', { count: Object.keys(payload.tokens).length });
  };

  import.meta.hot.on('tokens:updated', onTokens);
  import.meta.hot.dispose(() => import.meta.hot!.off('tokens:updated', onTokens));
}
```

```typescript
// A quick way to prove the augmentation is actually in effect.
import type { InferCustomEventPayload } from 'vite/types/customEvent.d.ts';

// If the declaration merged, this is { tokens: …; version: number }.
// If it did not, this is `any` — and the @ts-expect-error below will fail to error.
type Tokens = InferCustomEventPayload<'tokens:updated'>;

// @ts-expect-error version is a number
const check: Tokens = { tokens: {}, version: 'one' };
```

```typescript
// ⛔ Three ways to get no type safety and no warning about it.
declare module 'vite/types/customEvent' {          // 1. missing .d.ts extension
  interface CustomEventMap { 'tokens:updated': { tokens: unknown } }
}

import.meta.hot?.on('tokens:updatd', (p) => p.tokens);  // 2. typo: payload is `any`, never fires

import.meta.hot?.on('tokens:updated', (p: any) => p.tokens);  // 3. an explicit any
                                                              //    discards the inference
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Omitting the `.d.ts` extension

*"Make sure to include the `.d.ts` extension when specifying TypeScript declaration files. Otherwise,
Typescript may not know which file the module is trying to extend."* The augmentation compiles and
silently does not merge.

### ⚠️ Pitfall 2 — Assuming an undeclared event is an error

It is not: *"the type of payload will be `any`"*. The mechanism is opt-in per event, so a plugin that
sends five events and declares three is partially typed with no indication of which parts.

### ⚠️ Pitfall 3 — Typos in event names

`CustomEventName` accepts anything, so a misspelled name typechecks, receives `any`, and never fires.
Keep names in exported constants and use them at both ends.

### ⚠️ Pitfall 4 — Annotating the callback parameter by hand

Writing `(payload: MyType) =>` overrides the inference rather than checking it, so it stays correct
only until the map changes. Let the parameter be inferred; if you need the type by name, use
`InferCustomEventPayload<'my:event'>`.

### ⚠️ Pitfall 5 — Declaring only the server-to-client direction

`send` is generic over the same map, so client-to-server events benefit identically. Declaring only
half is a common cause of an untyped acknowledgement payload.

### ⚠️ Pitfall 6 — Shipping the `.d.ts` but not including it

A declaration file that is not in the TypeScript program does nothing. Make sure it is covered by
`include` in `tsconfig.json`, or imported somewhere that is.

---

## Gotchas

**★ Symptom: a payload shape change compiles cleanly and breaks at runtime.** Cause: the event was never added to `CustomEventMap`, so its payload is `any` on both sides. Fix: declare it — the same declaration types the `on` handler and the `send` call.

**★ Symptom: the declaration file exists and the payload is still `any`.** Cause: the module specifier omitted the `.d.ts` extension, so *"Typescript may not know which file the module is trying to extend"*. Fix: `'vite/types/customEvent.d.ts'` in both the import and the `declare module`.

**★ Symptom: a handler never fires and nothing is flagged.** Cause: a typo in the event name; `CustomEventName` accepts it and infers `any`. Fix: export the name as a constant and use it at both the send and the listen site.

**★ Symptom: the callback parameter has the right type but stops matching the sender.** Cause: it was annotated by hand, which overrides inference. Fix: leave it inferred, or use `InferCustomEventPayload<'my:event'>`.

**★ Symptom: server-to-client events are typed and acknowledgements are not.** Cause: only one direction was declared. Fix: both directions live in the same interface — `send` is generic over it too.

**★ Symptom: adding the declaration changes nothing at all.** Cause: the `.d.ts` is not part of the TypeScript program. Fix: check `include` in `tsconfig.json`, and prove the merge with a `@ts-expect-error` probe on `InferCustomEventPayload`.

---

## Interview questions

**★ How are custom HMR event payloads typed, and what happens to an event you forget to declare?**
Vite *"infers the type of a payload from the `CustomEventMap` interface"*, which you extend by
declaration-merging into `'vite/types/customEvent.d.ts'`; `InferCustomEventPayload<T>` then resolves
the payload for a given event name, and `on`, `off` and `send` are all generic over it. An event that
is not in the map is **not** an error — the documentation's own example says *"the type of payload
will be any"* for an unknown event. That is the important half of the answer: the mechanism is opt-in
per event, so a partially declared plugin looks fully typed, and the compiler will not tell you which
handlers are actually checked.

**★ Why does the documentation insist on the `.d.ts` extension in the module specifier?**
Because module augmentation is matched by specifier, and *"Typescript may not know which file the
module is trying to extend"* without it. The failure is silent in the worst way: the file compiles,
the `declare module` block is accepted, and the interface simply never merges with the one Vite's
types use — so payloads stay `any` and it looks as though the map does not work. The practical
defence is to prove the merge rather than assume it: alias `InferCustomEventPayload<'my:event'>` to a
type and put a deliberate `@ts-expect-error` against it. If the augmentation did not take effect, the
expected error does not occur and TypeScript flags the unused directive.

**★ Does declaring an event give you type safety in both directions?**
Yes, because the same map is used by all three methods. The `ViteHotContext` signatures make `on`,
`off` and `send` generic over `CustomEventName` with the payload resolved by
`InferCustomEventPayload<T>`, so declaring `'tokens:applied'` types both the server-bound `send` on
the client and any listener for it. That is worth knowing because the common mistake is to declare
only the server-to-client events — the ones that feel like "the plugin's API" — and leave
acknowledgements untyped, which is exactly where payload drift goes unnoticed since acknowledgements
are rarely read closely.

**★ You maintain a plugin that injects client listeners. What do you ship so consumers get inference?**
A declaration file in the package that augments `CustomEventMap` with every event the plugin sends
or receives, referenced from the package's `types` so it is loaded automatically. Two details make
the difference between working and looking like it works: the specifier must carry the `.d.ts`
extension, and the file has to end up in the consumer's TypeScript program — which is why exporting
it via the package's own types entry beats documenting a copy-paste block in a README that will
drift from the implementation. It is also worth exporting the event names as constants, so consumers
can use them instead of retyping strings that would silently degrade to `any` if misspelled.

---

← [HMR Module Lifecycle](01odd-hmr-module-lifecycle.md) · [Vite overview](../../README.md) · Next → [Plugin Ordering & `enforce`](01p-plugin-ordering-and-enforce.md)
