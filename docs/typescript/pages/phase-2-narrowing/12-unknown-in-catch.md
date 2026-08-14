---
title: "`unknown` in `catch`"
sidebar_label: "12 · `unknown` in `catch`"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. **`TS1196` and `TS1197`, their exact wording, and the
> `useUnknownInCatchVariables` option record — including `strictFlag: true`, its
> description *"Default catch clause variables as unknown instead of any"* and
> its default *"true unless strict is false"* — were read out of the TypeScript
> compiler's own source**, not recalled. `Promise.prototype.catch`'s
> `onrejected?: (reason: any) => …` is read from **`lib.es5.d.ts`**, and
> `cause?: unknown` from **`lib.es2022.error.d.ts`**. ⚠️ The compiler inspected
> was TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No console
> block** — no recorded run covers this topic.

Every other page in this phase narrows something you chose to have. This one
narrows something the language handed you, and the reason it needs a page is a
fact about JavaScript rather than about TypeScript:

```js
throw new Error('normal');
throw 'a string';
throw 42;
throw { code: 'ENOENT' };
throw null;
throw undefined;
```

**All six are legal.** `throw` takes an expression, not an `Error`. So the
question "what did I just catch?" genuinely has no static answer, and any type
that claimed otherwise would be lying.

## `any` by default, `unknown` under `strict`

```ts
try { risky(); }
catch (e) {
  e.message;        // under strict: error — 'e' is of type 'unknown'
}
```

The flag is **`useUnknownInCatchVariables`**, and its record in the compiler's
option table settles three things at once:

- it is a **`strictFlag`** — so it is on for everyone who set `strict: true`,
  which is the recommendation from
  [Phase 0 · `strict`](../phase-0-how-typescript-runs/05-strict.md);
- its description is *"Default catch clause variables as unknown instead of
  any"*;
- its default is *"true unless `strict` is false"*.

Before this existed, `catch (e)` was `any`, and `e.message` compiled and then
printed `undefined` for every non-`Error` throw. The change is one of the few
that reliably finds real bugs in an existing codebase the day you turn `strict`
on.

## You may annotate it, but only two ways

Since TypeScript 4.0 the catch variable can carry an annotation — and the
compiler restricts it to exactly two types:

```ts
try { risky(); } catch (e: unknown) { … }   // ✅ explicit, works with any flag setting
try { risky(); } catch (e: any)     { … }   // ✅ opt out, locally and visibly
try { risky(); } catch (e: Error)   { … }   // ❌
```

```text
error TS1196: Catch clause variable type annotation must be 'any' or 'unknown'
if specified.
```

**`catch (e: Error)` is the thing everyone tries first**, and refusing it is
correct: nothing checks what arrives, so the annotation would be an
unverified assertion wearing an annotation's clothes — the exact confusion
[08 · `as` assertions](./08-as-assertions/README.md) is about.

The related restriction, for completeness:

```text
error TS1197: Catch clause variable cannot have an initializer.
```

A catch binding is filled by the runtime; a default value would never apply.

**Writing `catch (e: unknown)` explicitly is worth doing** even under `strict`.
It survives someone loosening the compiler options later, and it tells a reader
the `unknown` is intended rather than incidental.

## Proving what you caught

`unknown` gives you nothing until you narrow it, which is the whole point — this
page is [07 · Type guards](./07-type-guards.md) applied to a value you did not
choose.

```ts
try { risky(); }
catch (e) {
  if (e instanceof Error) {
    log(e.message, e.stack);
  } else {
    log('non-Error thrown', String(e));
  }
}
```

That is the right shape, and it has the failure mode from
[04 · `instanceof` narrowing](./04-instanceof-narrowing.md): `instanceof` walks
the prototype chain, so an `Error` created in **another realm** — an iframe, a
worker, a `vm` context — or by a **duplicated copy of a library** in the bundle
is not an `instanceof` your `Error`. In a browser app with iframes, or a Node
process using `vm`, this fails for values that are unambiguously errors.

The realm-safe alternative is structural, and less precise on purpose:

```ts
function isErrorLike(e: unknown): e is { message: string; stack?: string } {
  return typeof e === 'object' && e !== null && 'message' in e
    && typeof (e as Record<string, unknown>).message === 'string';
}
```

## The helper worth having once per codebase

Most `catch` blocks want one of two things: a string to log, or an `Error` to
re-throw. Write both once.

```ts
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e) ?? String(e); }
  catch { return String(e); }
}

export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(getErrorMessage(e), { cause: e });
}
```

Two details in `toError` are deliberate. The inner `try` guards `JSON.stringify`
against a circular structure — a `catch` helper that itself throws is a bad day.
And `{ cause: e }` keeps the original value: `Error.cause` is declared
`cause?: unknown` in `lib.es2022.error.d.ts`, precisely because the thing you are
wrapping is under no obligation to be an `Error` either.

Requires `lib` to include `es2022` or later; on an older target, attach the
original as your own property instead.

## 🔴 `.catch()` did not get the same treatment

This is the asymmetry worth knowing, and it is visible in the standard library:

```ts
// lib.es5.d.ts
catch<TResult = never>(
  onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
): Promise<T | TResult>;
```

**`reason` is `any`.** `useUnknownInCatchVariables` governs the `catch` *clause*
of a `try` statement — it does not touch the promise method that happens to share
the name.

```ts
try { await p; } catch (e) { /* e: unknown — checked */ }

p.catch(e => { e.message; });   /* e: any — not checked, no error */
```

Two spellings of "handle the rejection", and only one of them is type-safe. The
practical rule: **prefer `try`/`catch` around `await` over a `.catch()`
callback**, and where you must use the callback, annotate the parameter
`unknown` yourself:

```ts
p.catch((e: unknown) => { … });
```

`(reason: any)` accepts a narrower parameter type, so this is allowed and costs
nothing.

## Node: the error you actually get

Node throws real `Error` objects with extra properties, and the useful one is
`code`:

```ts
catch (e) {
  if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
    return null;                       // missing file is not exceptional here
  }
  throw e;
}
```

`'code' in e` is [03 · `in` operator narrowing](./03-in-operator-narrowing.md)
doing exactly the job it exists for. Match on `code`, never on `e.message` — the
message text is not a stable interface and changes between Node versions.

## Re-throwing, and the empty binding

If a handler does not fully handle something, re-throw the **original**:

```ts
catch (e) {
  if (isRetryable(e)) return retry();
  throw e;                    // not `throw new Error(String(e))`
}
```

Re-wrapping loses the stack, and a lost stack costs far more debugging time than
the tidier message saves. When wrapping genuinely adds context, use
`cause` so the original survives.

And when you do not need the value at all, the binding is optional (ES2019):

```ts
try { return JSON.parse(s); } catch { return null; }
```

Nothing to type, nothing to narrow, no unused-variable warning.

## Gotchas

**Symptom:** `'e' is of type 'unknown'` on `e.message`
**Cause:** `useUnknownInCatchVariables`, which `strict` turns on.
**Fix:** Narrow with `e instanceof Error`, or use a `getErrorMessage` helper.
Do not annotate it `any` to make the message go away.

**Symptom:** `TS1196: Catch clause variable type annotation must be 'any' or
'unknown' if specified`
**Cause:** `catch (e: Error)` — the first thing everyone tries.
**Fix:** `catch (e: unknown)` and narrow. Nothing verifies what was thrown, so
the annotation could not be honest.

**Symptom:** `e instanceof Error` is false for something that is clearly an error
**Cause:** It came from another realm (iframe, worker, `vm`) or a duplicated copy
of a library in the bundle.
**Fix:** A structural `isErrorLike` guard, or match on `e.name`/`e.code`.

**Symptom:** `.catch(e => e.message)` compiles and prints `undefined`
**Cause:** `Promise.prototype.catch` declares `reason: any`, and the strict flag
does not reach it.
**Fix:** Annotate `(e: unknown)`, or use `try`/`catch` around `await`.

**Symptom:** A stack trace points at the `catch` block rather than the failure
**Cause:** The handler threw a new `Error` instead of re-throwing.
**Fix:** `throw e`, or `new Error(msg, { cause: e })` when wrapping adds
something.

**Symptom:** `e.message` is `undefined` at runtime with no compile error
**Cause:** `strict` is off, so the catch variable is still `any`.
**Fix:** Turn `strict` on, or annotate `catch (e: unknown)` at each site.

## Interview questions

**★ Why is a `catch` variable `unknown` rather than `Error`?**
Because `throw` accepts any expression — a string, a number, an object literal,
`null`. Nothing guarantees an `Error`, so typing it as one would be an
unchecked assertion. `useUnknownInCatchVariables` is a `strict` flag; before it,
`catch (e)` was `any` and `e.message` compiled and printed `undefined`.

**★ Can you write `catch (e: Error)`?**
No — `TS1196`, the annotation must be `any` or `unknown`. There is nothing to
check the claim against, so an `Error` annotation would be an assertion in
disguise. Annotate `unknown` and narrow with `instanceof` or a structural guard.

**★ Does `.catch(e => …)` give you `unknown` too?**
No, and this is the asymmetry to know: `lib.es5.d.ts` declares
`catch(onrejected?: (reason: any) => …)`, so the callback parameter is `any` and
the strict flag does not apply. Prefer `try`/`catch` around `await`, or annotate
the parameter `unknown` yourself.

**How do you handle an `Error` that fails `instanceof Error`?**
It has crossed a realm — iframe, worker, `vm` context — or there are two copies
of the library in the bundle, so the prototype chains do not meet. Use a
structural guard checking for a `string` `message`, or match on `name`/`code`.

**What is the right way to add context to a caught error?**
`throw new Error('loading config failed', { cause: e })`. `Error.cause` is
declared `cause?: unknown` because the thing being wrapped need not be an
`Error`, and it preserves the original where re-wrapping with just a string
would destroy the stack. Otherwise re-throw the original unchanged.

---

← Prev: [11 · Narrowing you lose](./11-narrowing-lost/README.md) · Next → [13 · The non-null assertion `!`](./13-non-null-assertion.md)
