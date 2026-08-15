---
title: "catch (e: unknown)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Errors*, *Process*), the
> **TypeScript 2.2 release notes** (the ES5 downlevel prototype break), and the
> **`lib` declarations shipped with the compiler**, read directly —
> `Error.isError` in `lib.esnext.error.d.ts`, `cause?: unknown` in
> `lib.es2022.error.d.ts`. `Error.isError` and `util.types.isNativeError` were
> confirmed present at runtime on **Node 24.19.0** by a `typeof` capability
> probe; **no transcript of it is reproduced**, and there is **no console block
> on any chunk**.

⚠️ **Read [phase 2 · `unknown` in `catch`](../../phase-2-narrowing/12-unknown-in-catch.md)
first.** It owns the language rule — `throw` accepts any expression, so
`catch (e)` is `unknown` under `strict`, `.catch()` still hands you `any`, and
the `getErrorMessage` / `toError` helpers. **This topic does not repeat it.**
What is here is everything that only becomes true once the code is deployed.

Four chunks. Three claims carry them:

> **`instanceof Error` is the weakest guard in a production process** — and
> every way it fails is a way that only exists in real deployments.
>
> **An error hierarchy is a discriminated union that happens to extend
> `Error`.** The class gives you `stack` and `cause`; the literal `code` gives
> you the type system, and it is the part that survives bundling.
>
> **An error object is one of the most-copied values in a system** — logged,
> serialised, attached to traces, shipped to a third party. Treat every property
> on it as public, and keep the transport's status code off it.
>
> **TypeScript cannot type what a function throws.** So a failure the caller
> must handle does not belong in a `throw` at all.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [Proving it on a server](./01-proving-it-on-a-server.md) | The five deployment realities that break `instanceof`; `Error.isError` and the `lib: esnext.error` catch; `util.types.isNativeError`; why `code` beats `message` and beats identity; and why `catch (e: any)` undoes all of it |
| 02 | [Making it recognisable](./02-making-an-error-recognisable.md) | `name`; the obsolete-but-explained `setPrototypeOf` ritual; the literal `code` discriminant and the survival table; exhaustiveness over an error union, and the widening that silently kills it |
| 03 | [What belongs on it](./03-what-belongs-on-an-error.md) | `cause` chains, their cycle guard and the fact that they do not serialise; `captureStackTrace` and its V8 dependency; context as properties rather than message text; and the three things that must never be on an error |
| 04 | [What you do with it](./04-what-you-do-with-it.md) | Expected outcome vs genuine fault; why throwing for routine failures is a type-system problem *and* the hidden cost behind `--enable-source-maps`; wrap-don't-swallow; one handler at the boundary; and why the process-level handlers are not a safety net |

## Phase gate

You are done when you can look at a `catch` block and say **which of the five
deployment realities would break its guard** — and when every failure mode a
caller is expected to handle appears in a function's **return type** rather than
in a `throw` the compiler cannot see.

The tell that it has not landed: `catch (e: any)`, an `instanceof` chain with a
silent `else`, and a `findUser` whose signature promises a `User`.

## Where this connects

- **← [Phase 2 · `unknown` in `catch`](../../phase-2-narrowing/12-unknown-in-catch.md)**
  — the language rule and the reusable helpers. Prerequisite, not duplicated.
- **← [Phase 2 · `instanceof` narrowing](../../phase-2-narrowing/04-instanceof-narrowing.md)**
  — the prototype-chain mechanics chunk 01 turns into a deployment argument.
- **← [Phase 2 · Discriminated unions](../../phase-2-narrowing/05-discriminated-unions.md)**
  and [exhaustiveness](../../phase-2-narrowing/06-exhaustiveness.md) — chunk 02
  is those two applied to errors.
- **← [02 · Shipping to production](../02-shipping-to-production/README.md)** —
  the `--enable-source-maps` latency caveat, whose mitigation is chunk 04's
  design point rather than a flag.
- **→ 08 · Typed middleware** *(not written yet)* — the four-argument Express
  error handler that TypeScript cannot enforce.
- **→ 13 · Typed errors → HTTP responses** *(not written yet)* — the exhaustive
  mapping from the error union to status codes, which chunk 02's discriminant
  makes possible.

---

← [Phase 7 index](../README.md) · Start → [01 · Proving it on a server](./01-proving-it-on-a-server.md)
