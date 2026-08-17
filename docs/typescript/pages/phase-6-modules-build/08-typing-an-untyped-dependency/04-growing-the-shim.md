---
title: "Growing the shim, and containing it"
sidebar_label: "04 · Growing and containing it"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files →
> Do's and Don'ts* for the `any`/`unknown` guidance, quoted verbatim) and the
> compiler's diagnostic table for `TS7016`, `TS2571` and the `TS7xxx`
> implicit-`any` family, read out of the installed **5.9.3** message table.
> **No sandbox, no console blocks.**

A one-line shim is a starting position, not a resting one. This chunk is the two
things you do next: **narrow the `any`**, and **stop the untyped surface from
spreading**. They are separate moves and the second matters more.

## The problem with stopping at `any`

The handbook, on `any` in a declaration:

> The compiler *effectively* treats `any` as "please turn off type checking for
> this thing". In cases where you don't know what type you want to accept, you
> can use `unknown`.

`any` does not stay where you put it. A value from an untyped module flows
outward through inference: assign it to a variable, return it from a function,
put it in an array, and each of those becomes `any` too — silently, with no
diagnostic, because that is what `any` is for.

**So the size of the problem is not "one untyped package". It is every line
downstream of every call into it**, and none of those lines look untyped.

## Move one — declare what you use, incrementally

You do not have to type the package. You have to type *your calls into it*, and
that set is small, enumerable and already written down — it is your own import
list.

```ts
// step 0 — unblocked, everything any
declare module 'legacy-lib';
```

```ts
// step 1 — the two functions this codebase actually calls
declare module 'legacy-lib' {
  export function render(input: string, options?: unknown): string;
  export function version(): string;
}
```

```ts
// step 2 — the options bag, once you have read their docs
declare module 'legacy-lib' {
  export interface RenderOptions {
    width: number;
    height: number;
    background?: string;
  }
  export function render(input: string, options?: RenderOptions): string;
  export function version(): string;
}
```

🔴 **`unknown` is the right intermediate value, and step 1 is why.** You know
`render` takes a second argument and you have not yet worked out its shape.
`options?: any` says "anything is fine" and checks nothing at the call site;
`options?: unknown` says "I have not described this yet" and forces the caller to
assert deliberately. The first is indistinguishable from a finished declaration;
the second is visibly unfinished, which is what you want in a file you intend to
come back to.

⚠️ **`unknown` is not free — it is a real constraint at the call site**, and that
is the point. If it blocks more than it should, that is the signal to go and read
the package's documentation rather than to widen it back to `any`.

**Do not try to finish it in one pass.** A shim you complete speculatively is a
large surface of unverified claims (chunk 03), and the parts you never call are
the parts most likely to be wrong.

## Move two — contain it behind your own module

This is the more important half, and it is the one usually skipped.

However good the shim gets, it is unverified. So put a boundary between it and
the rest of your codebase — one module that imports the untyped package, and
exports a surface you *do* control:

```ts
// src/lib/renderer.ts — the ONLY file that imports 'legacy-lib'
import { render as rawRender } from 'legacy-lib';

export interface RenderRequest {
  html: string;
  width: number;
  height: number;
}

export function renderPage(req: RenderRequest): string {
  const out = rawRender(req.html, { width: req.width, height: req.height });
  if (typeof out !== 'string') {
    throw new TypeError('legacy-lib.render did not return a string');
  }
  return out;
}
```

What that buys, concretely:

1. **The blast radius of a wrong shim is one file.** If the declaration is a lie,
   it is a lie in one place you can go and read, instead of at forty call sites.
2. **There is somewhere to put the runtime check.** The `typeof out !== 'string'`
   line is doing what the type system cannot: the declaration is a claim, and
   this is the one place cheap enough to actually verify it.
3. **Replacing the dependency becomes a local change.** The reason untyped
   packages are often unmaintained ones (chunk 02) is the same reason this
   matters.
4. **Your codebase's types are yours.** `RenderRequest` is a type you wrote and
   the compiler fully checks, rather than a type you asserted about somebody
   else's code.

📌 **This is the same shape as every other boundary discipline in this corpus** —
[Phase 7 · Typing `process.env`](../../phase-7-server/03-typing-process-env/README.md)
argues it for environment variables, and the general principle is that *an
annotation is a claim, not a check*. An untyped dependency is that principle with
the claim written by you.

## What not to do instead

Four shortcuts that all appear to work:

| Shortcut | What it actually does |
|---|---|
| `noImplicitAny: false` | Suppresses `TS7016` **project-wide**, so every untyped import everywhere goes quiet — including the ones you have not met yet |
| `// @ts-ignore` on the import | Hides that line's error and any future error on it. Leaves nothing to improve later |
| `const lib = require('legacy-lib') as SomeType` | An unchecked assertion with no file to maintain, invisible to anyone auditing the untyped surface |
| `allowJs: true` | Silences `TS7016` entirely (chunk 01) and gives you inference over the package's shipped JavaScript — types of unknown quality, presented as if known |

🔴 **All four share one defect: they leave no artefact.** A shim file is a
*record* — `grep -rl "declare module '" src/types/` is an inventory of every
untyped dependency in the project, with the surface you rely on written out. None
of the four alternatives can be inventoried, and an untyped surface nobody can
list is one nobody will ever pay down.

⚠️ **`@ts-expect-error` is the one of these worth using**, and only in the narrow
case where you expect the error to disappear — when an upstream fix is on its way
and you want the build to tell you it landed. The general argument is
[Phase 10 · Why `@ts-expect-error` wins](../../phase-10-strictness/08-suppression-directives/02-why-expect-error-wins.md).

## Knowing when it is finished

A shim is done when the module boundary in move two type-checks with no `any` and
no assertion crossing it. That is a much weaker condition than "the package is
fully typed", and it is the right one: **you are not maintaining a types package,
you are describing a dependency edge.**

If you find yourself typing generics, overloads and options you never pass, stop
— that work belongs upstream, and putting it there is
[chunk 06](./06-the-upstream-fix.md).

## Gotchas

**Symptom:** The shim is `any` and unrelated files started losing type safety.
**Cause:** `any` propagates through inference from every call into the module.
**Fix:** Narrow the shim, and contain the import behind one module so the
propagation has a boundary.

**Symptom:** You replaced `any` with `unknown` and the call sites stopped
compiling.
**Cause:** That is `unknown` working — it will not be used without a deliberate
narrowing or assertion.
**Fix:** Narrow at the call site, or finish describing the type. Reverting to
`any` throws away the only signal you had.

**Symptom:** A shim was completed in one sitting and half of it is wrong.
**Cause:** Speculative declarations for API you never call — unverified claims
with nothing exercising them.
**Fix:** Declare what you use. Delete the rest; it is not carrying its weight.

**Symptom:** `noImplicitAny: false` fixed the error and six months later there
are untyped imports nobody knew about.
**Cause:** It suppresses the diagnostic project-wide, including for dependencies
added later.
**Fix:** Turn it back on and shim the individual packages. Expect a list.

**Symptom:** Nobody can say how much of the codebase depends on untyped packages.
**Cause:** The untypedness was handled with `@ts-ignore`, casts and flags, none
of which leave an artefact.
**Fix:** Convert them to shim files. `grep -rl "declare module '"` then becomes
the inventory.

**Symptom:** A shim signature was wrong and the failure surfaced in forty places.
**Cause:** The package is imported directly all over the codebase.
**Fix:** Wrap it — one module imports it, everything else imports the wrapper.

**Symptom:** The wrapper module exists and people import the package directly
anyway.
**Cause:** Nothing enforces the boundary.
**Fix:** A lint rule restricting the import to one path (`no-restricted-imports`
and its equivalents) is the only thing that makes this stick.

**Symptom:** The shim is correct and the runtime still returns something else.
**Cause:** A declaration is a claim, not a check — a package can change its
behaviour in a patch release and nothing in the type system notices.
**Fix:** The runtime check in the wrapper. It is the only place cheap enough to
put one.

**Symptom:** `@ts-ignore` on the import means a real, unrelated error on that line
is also hidden.
**Cause:** `@ts-ignore` suppresses whatever the line produces, now and in future.
**Fix:** `@ts-expect-error` at minimum, so it fails when the error goes away — or
better, the shim.

## Interview questions

**★ Why is `declare module 'x';` a bad place to stop?**
Because it types the module as `any`, and `any` propagates through inference —
every value that flows out of that module turns off checking wherever it lands.
The visible problem is one package; the actual problem is every line downstream
of it, none of which look untyped.

**★ Why use `unknown` rather than `any` in a half-finished shim?**
`unknown` is visibly unfinished: it forces callers to narrow or assert, so the
places relying on the undescribed part are exactly the places that stop
compiling. `any` in the same position is indistinguishable from a completed
declaration and silently checks nothing.

**★ What is the most valuable thing you can do about an untyped dependency,
after the shim?**
Contain it — one module imports it, everything else imports that module. It caps
the blast radius of a wrong declaration to a single file, gives you somewhere to
put a runtime check, and makes replacing the dependency a local change.

**★ Why is a shim file better than `@ts-ignore` or `noImplicitAny: false`?**
Because it leaves an artefact. A shim is a record of which packages are untyped
and which surface you depend on, greppable and reviewable. The alternatives
suppress the signal without recording anything, so the untyped surface can never
be inventoried and therefore never gets paid down.

**★ How much of a package's API should the shim describe?**
The part you call, and no more. Speculative declarations are unverified claims
with nothing exercising them, and they are the ones most likely to be wrong. The
finish line is "the wrapper module type-checks with no `any` crossing it", not
"the package is fully typed".

**When is `@ts-expect-error` the right tool here?**
When you expect the error to disappear — an upstream types release is coming and
you want the build to tell you it landed. That is precisely what `@ts-expect-error`
does that `@ts-ignore` does not.

**A colleague suggests `allowJs` to get types from the package's own JavaScript.
What do you say?**
That it silences `TS7016` project-wide and gives you inference over shipped —
often transpiled or minified — JavaScript, at a default `maxNodeModuleJsDepth` of
`0`. It is a defensible interim state, but it presents types of unknown quality
as if they were known, and it hides every future untyped import too.

**How do you audit how much of a codebase is exposed to untyped dependencies?**
If shims were used, `grep -rl "declare module '"` over the types directory lists
every one, and each file states the surface relied on. If casts and `@ts-ignore`
were used instead, you cannot — which is the argument for the shim.

---

← Prev: [03 · The shim](./03-the-shim.md) · Next → [05 · When the shipped types are wrong](./05-when-the-shipped-types-are-wrong.md)
