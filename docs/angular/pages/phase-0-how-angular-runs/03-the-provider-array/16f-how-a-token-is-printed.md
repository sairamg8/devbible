---
title: "The message and the `Path:` clause of the same error are produced by two different stringifiers that disagree in three specific ways — and neither of them is the one that could have told you which file the token came from"
sidebar_label: "16f · How a token is printed"
sidebar_position: 16.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/util/stringify.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/stringify.ts) (verbatim),
> [`core/src/render3/util/stringify_utils.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/util/stringify_utils.ts) (verbatim),
> [`core/src/di/null_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/null_injector.ts),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**An `NG0201` names your token twice, through two different functions, and they are not the same function.** The message text goes through `stringify`; the `Path:` entries go through `stringifyForError`. For a plain class both return `.name` and nobody notices. They diverge over `overriddenName`, over newlines and over arrays, so a message whose two clauses spell the same token differently is telling you something about the token. The more consequential fact is what neither of them does: the stringifier that can attach a file path and a line number is not on the DI error path at all, which is precisely why a duplicated class or a duplicated token is invisible in the error and has to be found in the dependency tree.

## Two stringifiers, and where they differ

The message and the path are produced by **different** functions, which is worth knowing before
you assume the token name in the text always matches the last entry in the path.

`stringify`, used by `NullInjector` for the message, verbatim from
[`packages/core/src/util/stringify.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/stringify.ts):

```ts
export function stringify(token: any): string {
  if (typeof token === 'string') {
    return token;
  }

  if (Array.isArray(token)) {
    return `[${token.map(stringify).join(', ')}]`;
  }

  if (token == null) {
    return '' + token;
  }

  const name = token.overriddenName || token.name;
  if (name) {
    return `${name}`;
  }

  const result = token.toString();

  if (result == null) {
    return '' + result;
  }

  const newLineIndex = result.indexOf('\n');
  return newLineIndex >= 0 ? result.slice(0, newLineIndex) : result;
}
```

`stringifyForError`, used by `prependTokenToDependencyPath` for the path, verbatim from
[`packages/core/src/render3/util/stringify_utils.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/util/stringify_utils.ts):

```ts
export function stringifyForError(value: any): string {
  if (typeof value === 'function') return value.name || value.toString();
  if (typeof value === 'object' && value != null && typeof value.type === 'function') {
    return value.type.name || value.type.toString();
  }

  return renderStringify(value);
}
```

For a plain class token they agree: both print `.name`. Three cases where they do not:

- `stringify` honours **`token.overriddenName`**; `stringifyForError` does not.
- `stringify` **truncates at the first newline**; `stringifyForError` (via `renderStringify`,
  which is `String(value)`) does not — a token whose `toString()` spans lines produces a
  one-line message and a multi-line path entry.
- `stringify` formats an **array** token as `[A, B]`; `stringifyForError` calls `String()` on it,
  which produces the comma-joined form without brackets.

Neither prints anything about the file the token came from. `debugStringifyTypeForError` in the
same file does — it consults `componentDef.debugInfo` for a path and line number — but it is not
on the DI error path, which is why an `NG0201` never tells you *which* `UserClient` it meant when
two of them exist ([16h](16h-when-it-is-a-different-token.md)).

## Gotchas

**★ Symptom: the token name in the message does not match the last entry in `Path:`.** Cause: they come from different stringifiers. The message uses `stringify`, which honours `overriddenName` and truncates at the first newline; the path uses `stringifyForError`, which does neither. Fix: for a plain class both print `.name` and agree — a mismatch means the token is not a plain class, and the `Path:` entry is the less-processed of the two.

**★ Symptom: the message names a class that does not exist in your codebase under that name.** Cause: `stringify` returns `token.overriddenName || token.name`, and `overriddenName` is honoured only there — `stringifyForError`, which builds the `Path:`, ignores it entirely. The same token can therefore be spelled two different ways in two clauses of the same error. Fix: nothing to change; read the `Path:` entry as the less-processed of the two names, and search for that one.

**★ Symptom: an array used as a provider token prints as `[A, B]` in the message and as `A,B` in the path.** Cause: `stringify` has an explicit `Array.isArray` branch — `` `[${token.map(stringify).join(', ')}]` `` — while `stringifyForError` falls through to `renderStringify`, which is `String(value)`, i.e. the default array `toString()`: comma-joined, no spaces, no brackets. Fix: do not use an array as a token. Declare one —

```ts
// tokens.ts
export const REPORT_COLUMNS = new InjectionToken<readonly string[]>('REPORT_COLUMNS');
```

**★ Symptom: the error names the token but never the file, and two files declare a class with that name.** Cause: the stringifier that *can* produce a file and line is `debugStringifyTypeForError`, which consults `componentDef.debugInfo` — and it is not on the DI error path. `NullInjector` uses `stringify`; `prependTokenToDependencyPath` uses `stringifyForError`; neither reads `debugInfo`. Fix: the DI error will not disambiguate them for you, so do it outside the error — resolve the duplicate in the dependency tree, or rename one of the two classes so the message becomes unambiguous ([16h](16h-when-it-is-a-different-token.md)).

## Interview questions

**★ Why can the token name in an `NG0201` message differ from the last entry of its own `Path:` clause?**
Because two different functions produce them and neither knows about the other. The message text is built by `NullInjector` with `stringify` from `packages/core/src/util/stringify.ts`; the path entries are built by `prependTokenToDependencyPath` with `stringifyForError` from `packages/core/src/render3/util/stringify_utils.ts`. For a plain class both return `.name` and they agree, which is why this almost never surfaces. They diverge in three places: `stringify` honours `token.overriddenName` and `stringifyForError` does not; `stringify` truncates at the first newline of a `toString()` and `stringifyForError` does not; and `stringify` formats arrays as `[A, B]` while `stringifyForError` leaves `String()` to produce the bare comma-joined form. If the two clauses disagree, the token is not a plain class, and that fact alone narrows the search.

**★ Angular has a stringifier that can print a token's file and line number. Why does an `NG0201` never use it?**
`debugStringifyTypeForError` exists in `render3/util/stringify_utils.ts` and does exactly that: it fetches the component definition, and if `componentDef.debugInfo` is present it renders the class name together with the file path and line number. But it is a *component* debug path — it depends on `getComponentDef(type)` returning a definition with `debugInfo` attached, which is a compiler-emitted, development-only affordance for components and directives. A DI token is very often neither: it is an `InjectionToken`, a plain service class, or an abstract type, none of which carry a component definition. The DI error path uses the two general-purpose stringifiers instead, and both stop at the name. The practical consequence is the one that matters for debugging: an `NG0201` can never distinguish two classes that share a name, so the duplicate-package and duplicate-token cases in [16h](16h-when-it-is-a-different-token.md) have to be diagnosed from the dependency tree rather than from the error.

{/* FOOTER */}
