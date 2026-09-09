---
title: "One code, two producers: `NullInjector` emits a backticked message with a name and a path, `throwProviderNotFoundError` emits a different sentence with neither — and the suffix `in Injector` means limp mode, not a missing registration"
sidebar_label: "16e · The two message shapes"
sidebar_position: 16.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`core/src/di/injector_compatibility.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injector_compatibility.ts),
> [`core/src/di/inject_switch.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/inject_switch.ts),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts) — all quoted verbatim.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`inject()` does not call `Injector.get()`, and `NG0201` does not have one message.** The call path runs through `retrieve()`, which converts the thrown not-found error back into a *return value* and hands it to `injectInjectorOnly`, which throws it again — a round trip that exists because `@angular/core/primitives/di` defines the injector contract and the `ɵNotFound` name is its wire protocol. Along that path there are three branches with three completely different diagnoses, and a second `NG0201` producer whose message shares nothing with the first except the code. One of its call sites is confirmed here and it is the one worth recognising: *limp mode*, where there is no current injector at all.

## `retrieve()` converts the throw into a return

`inject()` does not call `get()`. It calls `retrieve()`, which is the primitives-facing API, and
which catches the `ɵNotFound` error and hands it back as a value. Verbatim from `r3_injector.ts`:

```ts
  retrieve<T>(token: PrimitivesInjectionToken<T>, options?: unknown): T | NotFound {
    const flags: InternalInjectFlags =
      convertToBitFlags(options as InjectOptions | undefined) || InternalInjectFlags.Default;
    try {
      return (this as BackwardsCompatibleInjector).get(
        token as unknown as InjectionToken<T>,
        // When a dependency is requested with an optional flag, DI returns null as the default value.
        THROW_IF_NOT_FOUND as T,
        flags,
      );
    } catch (e: any) {
      if (isNotFound(e)) {
        return e;
      }
      throw e;
    }
  }
```

and the consumer, verbatim from
[`packages/core/src/di/injector_compatibility.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injector_compatibility.ts):

```ts
export function injectInjectorOnly<T>(
  token: ProviderToken<T>,
  flags = InternalInjectFlags.Default,
): T | null {
  const currentInjector = getCurrentInjector();
  if (currentInjector === undefined) {
    throw new RuntimeError(
      RuntimeErrorCode.MISSING_INJECTION_CONTEXT,
      ngDevMode &&
        `The \`${stringify(token)}\` token injection failed. \`inject()\` function must be called from an injection context such as a constructor, a factory function, a field initializer, or a function used with \`runInInjectionContext\`.`,
    );
  } else if (currentInjector === null) {
    return injectRootLimpMode(token, undefined, flags);
  } else {
    const options = convertToInjectOptions(flags);
    // TODO: improve the typings here.
    // `token` can be a multi: true provider definition, which is considered as a Token but not represented in the typings
    const value = currentInjector.retrieve(token as PrimitivesInjectionToken<T>, options) as T;
    ngDevMode && emitInjectEvent(token as Type<unknown>, value, flags);
    if (isNotFound(value)) {
      if (options.optional) {
        return null;
      }
      throw value;
    }
    return value;
  }
}
```

Three branches, three completely different failures, and knowing which one you are in is most of
the diagnosis:

- **`currentInjector === undefined`** — you are not in an injection context at all. That is
  `NG0203`, a different error entirely; see [16i](16i-the-codes-next-door.md).
- **`currentInjector === null`** — *limp mode*, described below.
- **otherwise** — the normal walk, whose failure is the `NG0201` this page is about.

⚠️ **The `NotFound` union permits a symbol.** `throw value` where `value: NotFound` can in
principle throw `NOT_FOUND`, which is not an `Error` and has no stack. `R3Injector.retrieve`
only ever returns the caught error, so in practice you get an `Error` — but if you write a
custom `Injector` implementing the primitives `retrieve` contract and return `NOT_FOUND`, that
symbol is what `inject()` throws. Code that does `catch (e) { console.error(e.message) }` would
print `undefined` for it. This is a reading of the types, not a documented behaviour.

## The other `NG0201`, and where it really comes from

There is a second function that throws the same code with a different string. Verbatim from
`errors_di.ts`:

```ts
/** Throws an error when a token is not found in DI. */
export function throwProviderNotFoundError(
  token: ProviderToken<unknown>,
  injectorName?: string,
): never {
  const errorMessage =
    ngDevMode &&
    `No provider for ${stringifyForError(token)} found${injectorName ? ` in ${injectorName}` : ''}`;
  throw new RuntimeError(RuntimeErrorCode.PROVIDER_NOT_FOUND, errorMessage);
}
```

Compare them side by side, because the difference is how you tell which machinery failed:

| | `NullInjector` | `throwProviderNotFoundError` |
|---|---|---|
| text | `` No provider found for `X`. `` | `No provider for X found` |
| backticks round the token | yes | no |
| trailing full stop | yes | no |
| `error.name` | `ɵNotFound` | `Error` (never set) |
| gets a `Path:` clause | yes, via the `r3_injector` catch | no |
| optional suffix | — | `` in <injectorName> `` |

🔴 **`isNotFound` returns `false` for the second one.** It never sets `name`, so a `catch` block
written round `isNotFound` will not recognise it. That is a real hole and it is worth knowing
before you build error handling on the type guard.

**One call site is confirmed**, verbatim from
[`packages/core/src/di/inject_switch.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/inject_switch.ts):

```ts
export function injectRootLimpMode<T>(
  token: ProviderToken<T>,
  notFoundValue: T | undefined,
  flags: InternalInjectFlags,
): T | null {
  const injectableDef: ɵɵInjectableDeclaration<T> | null = getInjectableDef(token);
  if (injectableDef && injectableDef.providedIn == 'root') {
    return injectableDef.value === undefined
      ? (injectableDef.value = injectableDef.factory())
      : injectableDef.value;
  }
  if (flags & InternalInjectFlags.Optional) return null;
  if (notFoundValue !== undefined) return notFoundValue;
  throwProviderNotFoundError(
    token,
    typeof ngDevMode !== 'undefined' && ngDevMode ? 'Injector' : '',
  );
}
```

*Limp mode* is what happens when the current injector is explicitly `null`: DI falls back to the
token's own `ɵprov.factory`, but **only if `providedIn` is `'root'`**. So a message reading
`No provider for ReportStore found in Injector` — with the literal word `Injector` — means the
lookup went through limp mode and the token was not `providedIn: 'root'`. That is a very
different diagnosis from the ordinary walk: it says *there was no injector*, not *the injector
did not have it*. It also shows why [14](14-providedin-root-vs-the-array.md)'s decorator route
and the array are not interchangeable at the margins — limp mode can serve a `providedIn: 'root'`
service where it cannot serve an array entry.

⚠️ **`throwProviderNotFoundError` has other call sites in `render3` that I did not read.** The
research bank flags this as unsettled and it stays unsettled here: attribute the second message
shape to the function by name, and do not claim that it maps cleanly onto "the element
injector". One call site is confirmed — limp mode — and that is all this page asserts.

## Gotchas

**★ Symptom: two `NG0201`s in the same application read completely differently.** Cause: there are two producers. `NullInjector` emits `` No provider found for `X`. `` with backticks, a full stop and `name = 'ɵNotFound'`; `throwProviderNotFoundError` emits `No provider for X found` with no backticks, no full stop, no `name`, and an optional `` in <injectorName> `` suffix. Fix: treat the suffix as the signal. `in Injector` specifically means limp mode — no current injector, and the token was not `providedIn: 'root'`.

**★ Symptom: `inject()` threw something with no `.message`.** Cause: `injectInjectorOnly` does `throw value` where `value: NotFound`, and `NotFound` is the union `` typeof NOT_FOUND | NotFoundError `` — the symbol branch is not an `Error`. ⚠️ `R3Injector.retrieve` only ever returns the caught error, so this cannot happen with Angular's own injector; it can if a custom `Injector` implements the primitives `retrieve` contract and returns `NOT_FOUND`. Stated from the types, not observed. Fix: guard with `isNotFound(e)` before touching `e.message`.

## Interview questions

**★ One error code, two entirely different message strings. Which is which, and why does it matter?**
`NG0201` has two producers. `NullInjector.get` is the end of the environment-injector walk: it emits `` No provider found for `X`. ``, sets `error.name = 'ɵNotFound'`, and its error is the one that collects a `Path:` and a `Source:` on the way out. `throwProviderNotFoundError` emits `No provider for X found`, optionally suffixed `` in <injectorName> ``, never sets `name`, and produces no path. It matters for two reasons. First, `isNotFound` — the framework's own public type guard — checks `name === 'ɵNotFound'`, so it recognises the first and not the second; any `catch` block built on it has a hole. Second, the suffix is diagnostic: `in Injector` comes from `injectRootLimpMode`, which runs when the current injector is explicitly `null`, and it means the token was not `providedIn: 'root'` and there was no injector to ask — a different problem from a provider being absent from an injector that exists. I would be careful in an interview not to claim the second shape maps cleanly onto "the element injector": limp mode is the call site I can point at, and the `render3` call sites are ones I have not read.

**★ `inject()` never calls `Injector.get()`. What does it call, and why does the difference matter?**
It calls `retrieve()`. `injectInjectorOnly` reads the current injector and does `currentInjector.retrieve(token, options)`, then tests the result with `isNotFound(value)` and does `throw value` if it is not found and not optional. `R3Injector.retrieve` in turn calls its own `get()` with `THROW_IF_NOT_FOUND`, catches, and — if `isNotFound(e)` — **returns** the error rather than rethrowing it. So the not-found condition crosses one boundary as a thrown exception and the next as a return value, and only becomes a throw again at the very last step. Three things fall out of that. First, `retrieve()` is the injector contract the `@angular/core/primitives/di` package defines, which is why the `NotFound` union and the `ɵNotFound` name exist at all — they are the interop protocol between the primitives layer and the framework. Second, `{optional: true}` is handled twice: `R3Injector.get` converts `notFoundValue` from `THROW_IF_NOT_FOUND` to `null` before the walk reaches `NullInjector`, so an optional lookup never throws in the first place, and `injectInjectorOnly`'s `if (options.optional) return null` is the belt to that braces. Third, and this is the one to say out loud: because the production branch of `get`'s catch throws a *fresh* `RuntimeError` with no `name`, `retrieve`'s `isNotFound(e)` test fails there and it rethrows instead of returning — a divergence between builds that I read out of the two sources and could not find documented anywhere.

{/* FOOTER */}
