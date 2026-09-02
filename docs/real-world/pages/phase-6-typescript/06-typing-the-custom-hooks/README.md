---
title: "Typing the custom hooks"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read
> directly in this repo (`useState`, `useReducer`, `useRef`, `useCallback`,
> `useMemo`, `useContext`, `createContext`, `EffectCallback`, `Destructor`,
> `DependencyList`, `RefObject`, `Context`), the React reference pages for
> [`useRef`](https://react.dev/reference/react/useRef),
> [`useReducer`](https://react.dev/reference/react/useReducer),
> [`useContext`](https://react.dev/reference/react/useContext) and
> [`useEffect`](https://react.dev/reference/react/useEffect), and the
> TypeScript handbook's
> [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html).
> Target: **TypeScript 7.0.2** (the phase spine; TypeScript is not installed in
> this checkout, so the compiler version is not verified here), React
> **19.2.8**, `@types/react` **19.2.18**, Node **24.20.0**, zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**[Phase 4](../../phase-4-react-ui/README.md) wrote six hooks in JavaScript and
described their states in prose; this chapter turns that prose into types that
the compiler enforces.** The centrepiece is the one
[chapter 04 promised](../04-discriminated-unions/README.md): `AsyncState<T>` as
a discriminated union, shaped so that `data` exists on exactly one branch and a
component that renders it without narrowing does not compile. Everything else
here is the supporting cast — where a hook's type parameter actually comes
from, which return shape survives destructuring, the reducer's action union,
and the four React declarations (`useRef`, `EffectCallback`, `createContext`,
`useCallback`) whose exact text decides whether the obvious code compiles.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`AsyncState<T>` as a union](01-asyncstate-as-a-union.md)** | The union chapter 04 promised; why the four-field object is the bug; `WithRetry` as a distributive conditional; the component that cannot forget a branch |
| 1b | **[`idle` and keep-previous](01b-idle-and-keep-previous.md)** | The two members teams leave out; the `null` fetcher instead of an `enabled` flag; `previous` as a *different name* from `data`; where keep-previous is actively wrong; the mutation state |
| 1c | **[Narrowing at the call site](01c-narrowing-asyncstate-at-the-call-site.md)** | 🔴 `const {status, data} = state` does not compile, and the two fixes; zod's `?: never`; TS 4.4 aliased discriminants and 4.6 destructured ones; the component boundary; `assertNever` |
| 2 | **[Generic hooks and where inference comes from](02-generic-hooks-and-inference.md)** | `T` inferred from the fetcher, not written; 🔴 an explicit type argument is an **assertion**; why `useMemo`'s is checked and `useAsync`'s is not; `NoInfer` |
| 2b | **[The dependency array](02b-the-dependency-array-the-compiler-cannot-check.md)** | `DependencyList` is `readonly unknown[]` and nothing more; `additionalHooks` and the React team's own advice against the design; `fnRef`; `useEffectEvent` |
| 3 | **[Tuple or object: the return shape](03-tuple-or-object-returns.md)** | What an un-annotated array return really infers; `as const` versus a return-type annotation; when a tuple is right; 🔴 `useLocalStorage<T>` and the `JSON.parse` hole its `T` cannot close |
| 4 | **[`useReducer` and the action union](04-usereducer-and-the-action-union.md)** | `AnyActionArg`, `ActionDispatch<A>`, and why React 19 has no `Reducer` slot; the cart's action union; 🔴 the `default:` clause that must not survive the port |
| 4b | **[Wiring the reducer and dispatch](04b-wiring-the-reducer-and-dispatch.md)** | Annotate the reducer and the initial state becomes checked; the lazy-initialiser overload; `Dispatch` versus `ActionDispatch`; why `dispatch` should not be on the context |
| 5 | **[`useRef` and its three overloads](05-useref-and-its-three-overloads.md)** | 🔴 no zero-argument overload in React 19's types; which overload each call hits; the DOM ref's `null` is the contract; `ReturnType<typeof setTimeout>` for timer ids |
| 6 | **[Effects and cleanup, typed](06-effects-cleanup-and-abort.md)** | `EffectCallback = () => void \| Destructor` and the uninhabitable brand; why `void`-returning assignability makes the union necessary; the three effect errors it produces |
| 6b | **[Abort and the `unknown` rejection](06b-abort-and-the-unknown-rejection.md)** | A `.then` rejection handler is `any` and no flag changes it; `AbortError` versus `TimeoutError`; `signal.reason` is `any`; `AbortSignal.any` |
| 7 | **[Context with no `undefined` to consume](07-context-without-undefined.md)** | `createContext<T>` demands a default; the three escapes and what each costs; the guard hook whose `throw` narrows; the `createStrictContext` factory |
| 7b | **[Splitting contexts, union values](07b-splitting-contexts-and-union-values.md)** | Two contexts as a typing decision first; the session context as a discriminated union; `use(Context)`; the generic context that cannot be declared |
| 8 | **[`useState` initialisers](08-usestate-initialisers.md)** | `useState([])` is `never[]`; `useState()` is `undefined`, not `T \| undefined`; 🔴 the lazy initialiser that eats a function-valued state, in both the hook and the setter |
| 8b | **[Events and contextual typing](08b-events-and-contextual-typing.md)** | Inline versus hoisted handlers; `e.target` is a bare `EventTarget` everywhere but `ChangeEvent`; `bivarianceHack`; why `async` handlers are legal and `async` effects are not |
| 8c | **[`useForm`, typed from the schema](08c-useform-typed-from-the-schema.md)** | `z.input` in, `z.output` out — chapter 02's promise delivered; field names and error keys derived from the schema; `Extract<keyof …, string>`; what the typing cannot check |

## The five sentences to keep

1. **A state union puts `data` on the success branch only**, so the component
   narrows instead of null-checking, and a missing branch is a compile error.
2. **A hook's type parameter should be inferred from an argument.** A hook you
   have to call as `useThing<Order>(…)` is a hook whose `T` is an assertion.
3. **`as const` is what makes a tuple return a tuple.** Without it the array
   return infers a union-element array and destructuring gives you both types.
4. **A ref's type argument describes every value `.current` will ever hold**,
   not the one it starts with — and in React 19's types there is no
   zero-argument `useRef()` at all.
5. **Every type here stops at the network.** The compiler believes `T` because
   [chapter 07](../07-the-typed-api-client/README.md) parses it; without that
   parse, all of this is one `any` deep.

## Phase gate

You are done with this topic when you can write `AsyncState<T>` from memory and
say why `data: T | null` alongside a `status` field is worse; explain where the
`T` in `useAsync` comes from and what an explicit type argument silently does;
say what `as const` changes about a tuple return; write the cart reducer's
action union and its exhaustive switch; say which `useRef` overload
`useRef<HTMLInputElement>(null)` resolves to and why a DOM ref's type must
include `null`; explain why an `async` effect callback does not type-check while
an `async` submit handler does; and build a context whose consumers never see
`undefined`.

## Where this connects

Backwards to [chapter 04](../04-discriminated-unions/README.md), which owns the
discriminated-union pattern and hands `AsyncState` here; to
[chapter 02](../02-zod-as-the-source-of-truth/02b-defaults-and-optionals.md),
which promised the two-sided typing of `useForm`; and to the JavaScript
originals in [phase 4](../../phase-4-react-ui/README.md), which these chunks
type rather than redesign. Forwards to
[chapter 07 · The typed API client](../07-the-typed-api-client/README.md),
which is where the `T` these hooks carry is actually established, and to
**chapter 08** *(not written yet)* for the derivations
(`Parameters`, `ReturnType`, `keyof`) that several of these signatures use.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
← Prev chapter: [Typed Express handlers](../05-typed-express-handlers/README.md) ·
Next chapter → [The typed API client](../07-the-typed-api-client/README.md)
