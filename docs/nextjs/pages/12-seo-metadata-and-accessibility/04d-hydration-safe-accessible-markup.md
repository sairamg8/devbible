---
title: "React gives no guarantee that mismatched attributes are patched up after hydration, so an `aria-*` value that differs between server and client can stay wrong in the live DOM with nothing but a development warning to show for it"
sidebar_label: "04d · Hydration-safe a11y markup"
sidebar_position: 116
description: "useId and why every aria-labelledby needs it, the identical-tree requirement, the attribute-mismatch guarantee React explicitly does not make, suppressHydrationWarning's one-level limit, two-pass rendering, and doing prefers-reduced-motion in CSS instead."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the React reference —
> [`useId`](https://react.dev/reference/react/useId) and
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) — quoted verbatim,
> and **WCAG 2.2** criterion 4.1.2 ([w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)).
> Version spine: **React 19.2.8** · Next.js 16.3.4. `react` **is** installed in this checkout at
> **19.2.8**, matching the pin, but nothing here was probed — these are documentation claims about
> behaviour, not export lists. **No sandbox run.**

**Accessibility attributes are the part of your markup most likely to differ between the server render and the client one, and the part where React makes the weakest promise about fixing it. Ids are generated. Labels depend on state. `aria-expanded` reflects something a component thinks it knows on first render. And React's own documentation says, in as many words, that there are no guarantees attribute differences will be patched up after a mismatch. So a wrong `aria-describedby` does not throw, does not visibly break, and does not appear in production logs — it simply points at nothing, forever, for the users who need it.**

## `useId`, and why it exists

React's reference is unusually direct about the purpose:

`useId` generates unique IDs for accessibility attributes — `aria-describedby`, `aria-labelledby`, and the `htmlFor`/`id` pairing. It is not a general-purpose unique id: the docs say explicitly that it is **not** for list keys and **not** for `use()` cache keys.

The problem it solves is a component rendered more than once on a page:

```tsx
// 🔴 Two of these on one page and every label points at the first input
export function TitleField({ error }: { error?: string }) {
  return (
    <>
      <label htmlFor="title">Title</label>
      <input id="title" aria-describedby="title-error" />
      {error && <p id="title-error">{error}</p>}
    </>
  )
}
```

Duplicate ids do not throw. The browser resolves each reference to the *first* matching element, so the second field's label labels the first field's input, and the second field's error is announced against the first. ⚠️ Note that WCAG 2.2 **removed** 4.1.1 Parsing — it is listed as *"(Obsolete and removed)"* — so duplicate ids are no longer a criterion failure on their own. They still break 4.1.2, because the relationship you intended is not the one the tree exposes.

```tsx
'use client'
import { useId } from 'react'

export function TitleField({ error }: { error?: string }) {
  const id = useId()
  const inputId = `${id}-input`
  const errorId = `${id}-error`

  return (
    <>
      <label htmlFor={inputId}>Title</label>
      <input
        id={inputId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
      />
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </>
  )
}
```

**One `useId` call, several derived ids.** That is the documented pattern and it is better than several calls: fewer hook slots, and the relationship between the ids is visible.

🔴 **`useId` cannot currently be used in async Server Components.** That is a documented caveat, and it is a real constraint in an App Router codebase — a field component that needs generated ids must be a Client Component, or must receive its ids as props from something that generated them. For a form whose fields are static, the simplest correct answer is often a hand-written unique id string, because the component is only ever rendered once.

## The identical-tree requirement

> *"With server rendering, `useId` requires an identical component tree on the server and the client."*

That is the sharpest statement of a general rule. `useId` values are derived from the component's position in the tree, so if the server rendered a tree with an extra wrapper — or skipped a conditional branch the client renders — the ids diverge and every `aria-labelledby` and `htmlFor` pairing built from them points at nothing.

The related constraint for pages with multiple React roots: `hydrateRoot`'s `identifierPrefix` must match the prefix used on the server, or ids collide across roots.

## The guarantee React does not make

This is the sentence to remember from the whole page:

> *"There are no guarantees that attribute differences will be patched up in case of mismatches."*

Alongside:

> *"hydrateRoot() expects the rendered content to be identical with the server-rendered content. You should treat mismatches as bugs and fix them."*

Read together: when server and client HTML differ, React logs a development warning and does its best, but it explicitly does not promise to reconcile **attributes**. Visible text mismatches are loud — the content is wrong on screen and someone notices. `aria-*` mismatches are silent, because nothing renders them.

So this pattern, which is extremely common, is a real defect:

```tsx
// 🔴 The server has no window, so aria-expanded starts wrong and may stay wrong
'use client'
export function Sidebar() {
  const expanded =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

  return (
    <>
      <button aria-expanded={expanded} aria-controls="sidebar-nav">
        Menu
      </button>
      <nav id="sidebar-nav" hidden={!expanded}>
        {/* … */}
      </nav>
    </>
  )
}
```

The server renders `aria-expanded="false"`; on a wide viewport the client would render `true`. React may or may not correct the attribute, and if it does not, a screen-reader user is told the menu is collapsed while it is visibly open — precisely the "bad ARIA" failure of [04c](04c-aria-is-a-promise-you-then-have-to-keep.md), arrived at by accident.

## The three fixes, in order of preference

**1 · Do it in CSS.** The best answer to "the server does not know the viewport" is not to ask JavaScript.

```css
/* No JS, no hydration risk, no mismatch */
@media (min-width: 1024px) {
  .sidebar { display: block; }
}
```

The same applies to reduced motion, which is otherwise a classic mismatch source:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

🔴 **Reading `prefers-reduced-motion` with `matchMedia` during render is a hydration mismatch by construction** — the server has no media queries. The CSS form has no such problem and covers the majority of cases. Only reach for JS when you must *not run* an animation (a canvas loop, an autoplaying carousel) rather than merely shorten it, and then read it in an Effect.

**2 · Two-pass rendering, when the truth really is client-only.**

```tsx
'use client'
import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // First pass matches the server exactly; the second knows the client
  if (!mounted) {
    return (
      <button type="button" aria-live="off" disabled>
        Theme
      </button>
    )
  }

  return <ActualToggle />
}
```

React documents this as the sanctioned approach for deliberately-different client content, with an explicit caveat: it makes hydration slower because the component renders twice, and it can feel jarring as the UI changes after load. **Use it for a genuinely client-only fact, not as a general escape from mismatches.**

⚠️ For the accessibility case specifically, the first pass must be *coherent*, not empty. Rendering `null` and then a button means a control appears after load with no announcement — worse than rendering a disabled placeholder with the same name.

**3 · `suppressHydrationWarning`, and its documented limits.**

> *"This only works one level deep, and is intended to be an escape hatch."*

And separately: React will not patch mismatched **text** content in a suppressed subtree — you are telling it not to complain, not telling it to fix anything.

```tsx
// The legitimate use: a timestamp that is unavoidably different on each side
<time dateTime={iso} suppressHydrationWarning>
  {formatRelative(iso)}
</time>
```

🔴 **Never put `suppressHydrationWarning` on an element carrying `aria-*` attributes to silence a warning about them.** The warning was the only signal you had that the tree was wrong; suppressing it converts a visible development problem into an invisible production one.

## Locale, timezone and the two mismatches you will actually hit

`new Intl.DateTimeFormat()` with no explicit locale or timezone resolves differently on a server in UTC than in a browser in Europe/Berlin. That produces a text mismatch, which is loud — but it also produces an **accessible name** mismatch whenever the formatted value ends up in an `aria-label` or a `<time>` element's content, and *that* half is silent.

```tsx
// ✅ deterministic on both sides; the machine-readable value never varies
<time dateTime={task.dueAt.toISOString()}>
  {new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(task.dueAt)}
</time>
```

Pin the locale and the timezone, or format on the client only behind the two-pass pattern. The `dateTime` attribute should always be the ISO string regardless — it is what assistive technology and search crawlers both read.

## Gotchas

**★ Two instances of a field component and the second label focuses the first input.** Hard-coded `id` values. Fix: `useId` once per instance and derive the ids from it.

**★ `useId` in an async Server Component.** Documented as not currently usable there. Fix: make the component that needs ids a Client Component, or pass ids in as props from a caller that can generate them.

**★ Ids diverge between server and client and every relationship breaks.** `useId` requires an identical tree on both sides; a conditional wrapper that only renders on one side is enough to shift them. Fix: make the tree identical — including wrappers you added for layout — and never branch on `typeof window` above a `useId` call.

**★ A hydration warning about an `aria-*` attribute was silenced and the attribute is still wrong.** React does not guarantee attribute differences are patched, and `suppressHydrationWarning` only stops the message. Fix: remove the suppression, find the source of the difference, and eliminate it.

**★ `aria-expanded` is wrong on a desktop viewport.** The initial value came from `window.matchMedia` during render, which the server could not evaluate. Fix: express the responsive behaviour in CSS, or use two-pass rendering with a coherent first pass.

**★ Animations still run for users who asked for reduced motion.** `prefers-reduced-motion` was read in JavaScript during render and defaulted to "no preference" on the server. Fix: the CSS media query, which is evaluated by the browser and cannot mismatch.

**★ A theme toggle flashes the wrong state and announces the wrong state.** Same mismatch, visible half and invisible half. Fix: two-pass rendering for the control, plus the pre-hydration inline script that sets the attribute on `<html>` so the *page* never flashes ([09 · design system milestone](../09-styling-and-ui/06-project-milestone-sprintdesk-design-system-pass.md)).

**★ `suppressHydrationWarning` is applied to a wrapper and the mismatch is two levels down.** It only works one level deep, per the reference. Fix: put it on the element that actually differs, and if you cannot identify that element, you have not found the bug.

**★ A relative timestamp in an `aria-label` differs between server and client.** Locale and timezone resolution differ by environment, and the accessible-name half is silent. Fix: pin `locale` and `timeZone` in the formatter, and always emit the ISO value in `dateTime`.

**★ `Math.random()` or `Date.now()` in a generated id.** Guaranteed mismatch, every render. Fix: `useId` — that is what it is for.

**★ The first pass of a two-pass component renders `null`.** A control materialises after hydration with no announcement, and focus order changes under the user. Fix: render a coherent disabled placeholder with the same accessible name and roughly the same size.

## Interview questions

**★ Why is a mismatched `aria-*` attribute more dangerous than mismatched visible text?**
Because of who notices. A text mismatch is on screen — somebody sees the wrong word and files a bug. An attribute mismatch renders nothing, so the only signal is a development-mode console warning that is routinely ignored or suppressed. And React's `hydrateRoot` documentation is explicit that there are no guarantees attribute differences will be patched up in the case of a mismatch, so the wrong value can persist in the live DOM indefinitely. The result is a control that announces a state it is not in, which is worse than an unlabelled control because the user has no reason to doubt it.

**★ What exactly does `useId` guarantee, and what does it require from you?**
It guarantees ids that are unique per component instance and stable across the server and client renders — which is what makes `aria-labelledby`, `aria-describedby` and `htmlFor` safe in a component rendered more than once. What it requires is an identical component tree on both sides, because the value derives from the component's position; any branch that renders a different structure on the server than on the client shifts the ids and silently breaks every relationship built from them. It also has two documented non-uses — list keys and `use()` cache keys — and it is not currently usable in an async Server Component.

**★ How would you implement a sidebar that starts open on desktop and closed on mobile, without a hydration mismatch?**
In CSS. The server cannot evaluate a media query, so any JavaScript that reads the viewport during render is a mismatch by construction — including the `aria-expanded` on the toggle, which is the half nobody sees. The responsive default belongs in a `@media` rule, and the button only manages the *user's* override, which starts in a known state on both sides. If the component genuinely must know the viewport in JS — because it is measuring, not styling — then the reading belongs in an Effect and the component needs the two-pass pattern with a coherent first render.

**★ When is `suppressHydrationWarning` legitimate, and what does it not do?**
Legitimate for a value that is unavoidably different on each side and where the difference is harmless — a relative timestamp, a value derived from `Date.now()` at render. What it does not do is fix anything: it silences the warning, works only one level deep by the reference's own statement, and React will still not patch mismatched text content in the suppressed subtree. So it must never be applied to an element carrying accessibility attributes, because there the warning is the only detection mechanism that exists.

**★ A `prefers-reduced-motion` check is implemented with `matchMedia` in a component. What is wrong with it and what is the fix?**
It is a hydration mismatch by construction — the server has no media queries, so the first render always assumes "no preference", and a user who asked for reduced motion gets the full animation at least once and possibly permanently, depending on whether React reconciles the resulting attributes. The fix is the CSS media query, which the browser evaluates before first paint and which cannot mismatch because JavaScript is not involved. JS is only needed when the requirement is to *not start* something — a canvas animation loop, an autoplaying video — and then it belongs in an Effect, after hydration, where reading the environment is safe.

**★ Duplicate `id`s no longer fail a WCAG criterion. Does that mean they are fine?**
No. WCAG 2.2 lists 4.1.1 Parsing as obsolete and removed, so duplicate ids are not a conformance failure in themselves — modern browsers recover from them consistently, which is why the criterion went away. But the *consequences* still fail 4.1.2 Name, Role, Value: `aria-labelledby`, `aria-describedby` and `htmlFor` all resolve to the first matching element, so in a component rendered twice the second instance's relationships silently point at the first instance's elements. The criterion changed; the bug did not.

{/* FOOTER */}
