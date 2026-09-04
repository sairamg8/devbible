---
title: "Annotation mode turns the compiler into an opt-in tool you apply one function at a time, and the two directives that drive it fail silently if you put them anywhere but first"
sidebar_label: "02c · Annotation mode and directives"
sidebar_position: 111
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [`reactCompiler` config reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-02-11`) and the React
> [React Compiler directives reference](https://react.dev/reference/react-compiler/directives).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4 · React Compiler 1.0 · React 19.2.8**.

**`reactCompiler` takes a boolean or an options object, and the options object is where incremental adoption
lives: `compilationMode: 'annotation'` compiles nothing until a function asks for it with `"use memo"`.** The
two directives are ordinary string literals in directive position — the same position `'use client'` occupies —
which means a misplaced one is not an error, it is a no-op, and the component you thought you had opted in
silently stays uncompiled. This page covers annotation mode, both directives, their placement and precedence
rules, and the one place the Next.js and React documentation enumerate different things. Migrating a codebase
that already has hand-written memoization is
[02d](02d-migrating-existing-memoization.md); what the compiler costs is
[02b](02b-what-the-react-compiler-costs-and-the-rust-port.md).

## Annotation mode: compile nothing unless asked

By default the compiler decides for itself which functions to compile. Annotation mode inverts that.

> *"You can configure the compiler to run in \"opt-in\" mode as follows"*

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: {
    compilationMode: 'annotation',
  },
}

export default nextConfig
```

> *"Then, you can annotate specific components or hooks with the `\"use memo\"` directive from React to
> opt-in"*
> — Next.js `reactCompiler` reference

Note the config shape: `reactCompiler` accepts **either** a boolean **or** an options object. `true` and
`{ compilationMode: 'annotation' }` are two different postures, not a flag plus a modifier — writing the object
form replaces the boolean, it does not extend it.

**When annotation mode is the right call.** Three situations, and they are all about containing risk rather
than about performance:

1. **A large existing codebase.** You want the compiler on the three components that actually re-render too
   much, not on four hundred files at once, and you want the diff to say exactly which three.
2. **A codebase with known rough edges.** Older code that predates strict effect discipline, or components
   that mutate props defensively, is where automatic memoization is most likely to surface a latent bug.
3. **You are isolating a build-cost measurement.** Annotation mode narrows what Babel touches even further
   than the SWC pre-filter does ([02](02-react-compiler-retiring-manual-usememo-usecallback.md)), so the cost
   side of the trade stays near zero while you evaluate the benefit side on a handful of components.

## The two directives

React's directives reference is the authority on placement and precedence; the Next.js page names them and
hands off.

> *"You can also use the `\"use no memo\"` directive from React for the opposite effect, to opt-out a component
> or hook."*
> — Next.js `reactCompiler` reference

Placement, from React's reference:

> *"Place directives at the beginning of a function to control its compilation"*
> *"Place directives at the top of a file to affect all functions in that module."*

So a directive is a string literal in the same position a `'use client'` directive occupies — first statement
of a module, or first statement of a function body. And they nest, with the narrower one winning:

> *"Can be overridden at function level"* — function-level directives override module-level directives.

```tsx
// components/board/card-grid.tsx
'use client'
'use memo' // module-level: compile every function in this file

import { useState } from 'react'

export function CardGrid({ cards }: { cards: Card[] }) {
  const [query, setQuery] = useState('')
  const visible = cards.filter((c) => c.title.includes(query))
  return (
    <ul>
      {visible.map((card) => (
        <CardRow key={card.id} card={card} />
      ))}
    </ul>
  )
}

function CardRow({ card }: { card: Card }) {
  'use no memo' // function-level: overrides the module directive for this one component
  return <li>{card.title}</li>
}
```

**Function-level `"use memo"` is what annotation mode is designed around** — one directive, one component, one
line in the diff:

```tsx
'use client'

import { useState } from 'react'

export function FilterPanel({ facets }: { facets: Facet[] }) {
  'use memo'

  const [selected, setSelected] = useState<string[]>([])
  const grouped = groupFacets(facets, selected)
  return <FacetList groups={grouped} onToggle={setSelected} />
}
```

## What `compilationMode` accepts

⚠️ **The two documentation sets do not enumerate the same thing, and this is worth stating rather than
smoothing over.** The Next.js `reactCompiler` page shows exactly one value, `'annotation'`, described as
"opt-in" mode. React's directives reference describes three compilation modes and what each does with the
directives:

| Mode | React's description |
|---|---|
| `annotation` | *"Only functions with `\"use memo\"` are compiled"* |
| `infer` | *"Compiler decides what to compile, directives override decisions"* |
| `all` | *"Everything is compiled, `\"use no memo\"` can exclude specific functions"* |

🔴 **The Next.js documentation does not state which of these `reactCompiler: true` corresponds to, and it does
not document passing `infer` or `all` through the Next.js config.** Treat `'annotation'` as the value Next.js
supports on the record; if you need another mode, verify it against the version you have installed rather than
assuming the React-side option is plumbed through. This is a genuine gap in the Next.js docs, not an omission
in this page.

What the three-mode list *does* tell you unambiguously is how the directives interact with each mode, and that
is the useful half: `"use memo"` is the only thing that matters in `annotation`, `"use no memo"` is the only
thing that matters in `all`, and in `infer` both are overrides on top of a heuristic.

`"use no memo"` has a discipline attached to it that React states explicitly — it is meant to be temporary, and
it marks a bug rather than settling one. That rule, and the four-step process around it, is on
[02d](02d-migrating-existing-memoization.md), because the components that need it are almost always the ones a
migration surfaces.

## Gotchas

**★ Symptom: `"use memo"` was added to a component and it is not being compiled.** Cause: the directive is not
the first statement, so it is parsed as an ordinary expression statement rather than a directive — and an
expression statement consisting of a string literal is legal, so there is no error anywhere. React's rule is
*"Place directives at the beginning of a function"* / *"at the top of a file"*. Fix: move it above everything,
including imports at module level and any `const` at function level, with `'use client'` allowed to precede it.

```tsx
// ❌ Not a directive: it comes after a statement, so it is dead code.
export function Panel({ rows }: { rows: Row[] }) {
  const total = rows.length
  'use memo'
  return <p>{total}</p>
}

// ✅ First statement in the function body.
export function Panel({ rows }: { rows: Row[] }) {
  'use memo'
  const total = rows.length
  return <p>{total}</p>
}
```

**★ Symptom: `compilationMode: 'annotation'` is set and no component in the app is optimised, including ones
that clearly should be.** Cause: that is the mode working correctly — *"Only functions with `\"use memo\"` are
compiled."* Annotation mode compiles nothing you have not annotated. Fix: annotate the component, or move to
the boolean form when you are ready for the whole project.

```ts
// Evaluating a few components:
const nextConfig: NextConfig = { reactCompiler: { compilationMode: 'annotation' } }

// Ready for the whole project (and see 02b before you land this):
const nextConfig2: NextConfig = { reactCompiler: true }
```

**Symptom: `"use no memo"` is at the top of a file and one component in it is still being compiled.** Cause:
precedence — function-level directives override module-level ones, so a `"use memo"` inside a function beats a
`"use no memo"` at the top of the file. Fix: decide at one level. If the module is meant to be excluded
wholesale, remove the inner directive rather than adding a second module-level one.

```tsx
'use no memo' // module-level

export function A() { return <p>excluded</p> }

export function B() {
  'use memo'   // ❌ this still compiles — function level wins. Delete it.
  return <p>compiled anyway</p>
}
```

**Symptom: you tried `compilationMode: 'infer'` or `'all'` from React's documentation and are unsure whether
Next.js honours it.** Cause: the Next.js `reactCompiler` page documents only `'annotation'`; the three-mode
list is React's. Fix: do not assume the pass-through. Use `'annotation'` or the boolean form — the two shapes
Next.js documents — and if you need another mode, verify it against the installed version's behaviour before
relying on it in CI.

**Symptom: a directive was added to a file that also needs `'use client'`, and the client boundary stopped
working.** Cause: directive prologues are a *run* of string literals at the top of a module; anything
non-string between them ends the prologue. An import statement between `'use client'` and `'use memo'` breaks
the second one. Fix: keep both literals adjacent, before every import.

```tsx
// ✅
'use client'
'use memo'

import { useState } from 'react'
```

## Interview questions

**★ What does `compilationMode: 'annotation'` change, and when would you choose it over `reactCompiler: true`?**
It flips the compiler from deciding for itself to compiling only functions carrying the `"use memo"` directive
— *"Only functions with `\"use memo\"` are compiled."* You choose it when you want a per-component blast
radius: a large legacy codebase where automatic memoization might surface latent bugs, or an evaluation where
you want the build cost to stay near zero while you profile two or three components. It is also a much smaller
diff to review, because the set of affected components is literally enumerated in the source.

**★ Where exactly can these directives go, and what wins when both appear?**
At the top of a file, affecting every function in the module, or as the first statement of a function body,
affecting only that function. The function-level directive overrides the module-level one. The practical trap
is placement: a directive that is not the first statement is just a string expression, so it silently does
nothing — the same failure mode as a misplaced `'use client'`, and just as invisible, because a bare string
literal is valid JavaScript and nothing warns.

**Why does Next.js document only one `compilationMode` value when React documents three?**
The honest answer is that the Next.js `reactCompiler` reference only shows `'annotation'` and does not say what
`reactCompiler: true` maps to internally, while React's directives reference describes `annotation`, `infer`
and `all`. That is a documentation gap rather than a known restriction — I could not confirm from the Next.js
docs whether `infer` or `all` can be passed through the Next.js config. In an interview the useful move is to
say which document you are quoting, and to treat anything beyond `'annotation'` as unverified until checked
against the installed version.

**Is `"use memo"` related to `'use client'` or `'use server'`?**
Only syntactically. All three are directive-position string literals with the same placement rules and the same
silent-failure mode when misplaced, but they answer different questions: `'use client'` and `'use server'`
declare which environment a module belongs to, and are part of the React Server Components boundary model.
`"use memo"` and `"use no memo"` are compiler instructions with no runtime or boundary meaning at all — strip
the compiler out and they do nothing.

---

← [02b · What it costs](02b-what-the-react-compiler-costs-and-the-rust-port.md) · [Chapter index](01-explanation.md) · Next → [02d · Migrating existing memoization](02d-migrating-existing-memoization.md)
