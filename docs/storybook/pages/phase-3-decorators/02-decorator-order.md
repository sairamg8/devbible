---
title: "02 · Decorator order"
sidebar_label: "02 · Decorator order"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [decorators documentation](https://storybook.js.org/docs/writing-stories/decorators)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

When more than one decorator applies, the nesting decides which one wins for any
context both provide. This page splits what the documentation states from what it
does not — because the second half is where people get burned.

## What the documentation states

Decorators run in this order:

> - Global decorators, in the order they are defined
> - Component decorators, in the order they are defined
> - Story decorators, in the order they are defined, starting from the innermost
>   decorator and working outwards and up the hierarchy in the same order

So across the three levels the nesting is:

```
global          ← outermost
  component
    story       ← innermost
      <Story />
```

**Global wraps component wraps story.** The story-level decorator is closest to
the component.

## What that means in practice

The **innermost** provider of a given context is the one the component sees. So a
story-level decorator overrides a global one for the same context:

```tsx
// preview.ts — global
decorators: [(Story) => <ThemeProvider mode="light"><Story /></ThemeProvider>],
```

```tsx
// one story
export const InDarkMode: Story = {
  decorators: [(Story) => <ThemeProvider mode="dark"><Story /></ThemeProvider>],
};
```

Rendered nesting:

```
<ThemeProvider mode="light">      ← global, outer
  <ThemeProvider mode="dark">     ← story, inner
    <Component />                 ← reads "dark"
```

The component reads the **nearest** provider, so `dark` wins. This is ordinary
React context resolution — nothing Storybook-specific — which is why "the narrower
level wins" is a reliable rule for providers.

⚠️ **It is only reliable for context providers.** A decorator that does something
other than provide context — sets a CSS class on a wrapper, applies a transform,
registers a listener — composes rather than overrides. Two wrappers both adding
padding give you both paddings, not the inner one.

## 🔴 What the documentation does not state

**Within a single `decorators` array, the docs do not say whether the first
element becomes the innermost or the outermost wrapper.** The quoted ordering
describes the hierarchy across levels; it does not define array position.

I could not confirm the within-array nesting from the official documentation, so
this page does not assert it.

**The consequence for you is not "go and test it".** It is: *do not write code
whose correctness depends on it.*

### Where it matters, and the fix

It only matters when **one provider in the array depends on another**:

```tsx
// ⚠️ Correctness depends on array-order nesting, which is not documented.
decorators: [
  (Story) => <QueryClientProvider client={qc}><Story /></QueryClientProvider>,
  (Story) => <AuthProvider><Story /></AuthProvider>,   // does AuthProvider need the query client?
],
```

If `AuthProvider` calls a hook that requires `QueryClientProvider` above it, this
either works or throws depending on an order you did not choose.

```tsx
// ✅ Nesting written down, not inferred.
decorators: [
  (Story) => (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Story />
      </AuthProvider>
    </QueryClientProvider>
  ),
],
```

**Rule: independent decorators can share an array; dependent ones go in one
decorator with explicit JSX nesting.** This also documents the dependency for the
next reader, which the array form never does.

## Debugging unexpected wrapping

The reliable tool is the DOM, not reasoning:

1. Open the story at `/iframe.html?id=…` — no manager chrome in the way
   ([Phase 0](../phase-0-how-storybook-runs/02-manager-and-preview.md)).
2. Inspect the element and read outwards. Every decorator that rendered markup is
   visible in the tree, in its real nesting order.
3. For context-only providers that render no DOM, add a temporary `data-*`
   attribute on a wrapper `div` to make them visible.

This answers "which decorator is actually outside which" in ten seconds, and it
answers it for the version you are actually running.

## Gotchas

**Symptom — a story-level theme override does not take effect.** *Cause:* usually
not order — usually the global decorator reads a *global* (`context.globals.theme`)
rather than being a fixed provider, so the story-level one is overriding something
that was never the source of truth. *Fix:* set `globals: {theme: 'dark'}` on the
story instead of adding a decorator (Phase 2 topic 05).

**Symptom — two decorators both applied when you expected one to win.** *Cause:*
they are not both providing the same context — wrappers that add markup compose
rather than override. *Fix:* expected behaviour. Only the *nearest provider of a
given context* wins; anything else stacks.

**Symptom — a provider throws "must be used within X" although X is in the same
`decorators` array.** *Cause:* the nesting produced by array position is not what
you assumed, and it is not documented. *Fix:* combine them into one decorator with
explicit JSX nesting.

**Symptom — the same setup behaves differently in a docs page than in the story
canvas.** *Cause:* docs render stories in a different context, and some decorators
are sensitive to `context.viewMode`. *Fix:* branch on `context.viewMode` inside the
decorator if it genuinely needs to differ.

**Symptom — you cannot tell which decorators ran.** *Fix:* inspect the DOM at
`/iframe.html?id=…` and read outwards. Do not reason about it from the config.

## Interview questions

**★ In what order do global, component and story decorators wrap a story?**
Global is outermost, then component, then story innermost — the story-level
decorator sits closest to the component. The documentation states this explicitly
for the hierarchy.

**★ Why does a story-level provider override a global one?**
Because a component reads the **nearest** provider of a given context, and the
story-level decorator is the innermost. That is ordinary React context resolution
rather than a Storybook rule — which is why it applies reliably to providers and
not to decorators that merely add markup, since those compose instead.

**★ Two providers in the same `decorators` array, and one depends on the other.
What do you do?**
Combine them into a single decorator with the nesting written out in JSX. The
documentation does not state whether the first array element becomes the innermost
or outermost wrapper, so relying on array position makes correctness depend on
something unspecified. Independent decorators can share an array; dependent ones
should not.

**How would you find out what is actually wrapping a story?**
Open it at `/iframe.html?id=…` to remove the manager chrome, then inspect the
element and read the tree outwards. Decorators that render no DOM can be made
visible temporarily with a `data-*` attribute on a wrapper. This beats reasoning
about config, and it answers the question for the version you are running.

**Does the "narrower level wins" rule always hold?**
Only for context providers, where the nearest one wins. Decorators that add
markup, styling or side effects compose — two wrappers each adding padding give you
both paddings. The rule is about React context resolution, not about decorators in
general.

---

**← Prev** [01 · What a decorator is](./01-what-a-decorator-is.md) ·
**Next →** [03 · Providers in decorators](./03-providers-in-decorators.md)
