---
title: "Phase 2 — Args, argTypes and controls"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the [args](https://storybook.js.org/docs/writing-stories/args),
> [argTypes](https://storybook.js.org/docs/api/arg-types),
> [Controls](https://storybook.js.org/docs/essentials/controls),
> [Actions](https://storybook.js.org/docs/essentials/actions),
> [globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) and
> [parameters](https://storybook.js.org/docs/api/parameters) references, and
> [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — no page in this phase carries a console block.

**6 topics · 6 pages.** The args machine is what makes a story *interactive*
rather than a static render. Everything a non-engineer gets out of Storybook comes
from this phase.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Args as the source of truth](./01-args-as-the-source-of-truth.md) | <span className="db-tier t-master">Master</span> | Inputs as **data**; five features exist only because of it |
| 02 | [argTypes and control inference](./02-argtypes-and-inference.md) | <span className="db-tier t-understand">Understand</span> | Inference is docgen's output, not TypeScript's — which is why a union becomes a text box |
| 03 | [The Controls panel](./03-the-controls-panel.md) | <span className="db-tier t-understand">Understand</span> | Explore in Controls, promote to a story; edits are session-only on purpose |
| 04 | [Actions and spies](./04-actions-and-spies.md) | <span className="db-tier t-master">Master</span> | `fn()` from `storybook/test` on the meta — `argTypesRegex` gives logs, not spies |
| 05 | [Globals and toolbars](./05-globals-and-toolbars.md) | <span className="db-tier t-understand">Understand</span> | Session-wide environment; `globalTypes` declares, a **decorator** consumes |
| 06 | [Parameters and the merge order](./06-parameters-and-merge-order.md) | <span className="db-tier t-understand">Understand</span> | Config *about* a story; **parameters merge deeply, args shallowly** |

## The three channels

The question that resolves nearly every "where does this go" is **who needs to read
it?**

| Channel | Read by | Merge | Example |
|---|---|---|---|
| **args** | the component | **shallow** | `variant`, `orders`, `onClick: fn()` |
| **globals** | decorators, via context | replace | theme, locale, direction |
| **parameters** | Storybook and addons | **deep** | `layout`, `a11y`, `chromatic` |

All three merge global → meta → story, most specific winning. The **shallow vs
deep** difference between args and parameters is the detail that catches people.

## Two things the internet will tell you wrong

1. **`@storybook/addon-essentials` / `addon-controls` / `addon-actions`.** All
   deleted in 9.0 — Controls and Actions are core. Install nothing.
2. **`parameters: {actions: {argTypesRegex: '^on[A-Z].*'}}`.** Still works, still
   in most tutorials, and **the args it infers are not spies**. Since Storybook 8
   they cannot be used during rendering, so a `play` function's
   `expect(args.onClick).toHaveBeenCalled()` fails while the Actions panel shows the
   call. Assign `fn()` explicitly.

## Where this connects

| Track | Relationship |
|---|---|
| **React** | Args are props; a story is a component invocation expressed as data |
| **Jest & RTL** | `fn()` is the same spy idea as `jest.fn()` / `vi.fn()`, wired into the UI |
| **TypeScript** | Topic 02 — docgen reads your prop types, and a type that compiles can still be one it cannot follow |
| **CSS** | Topic 05's theme global is how the CSS track's tokens reach every story |

## Phase gate

Move on when you can:

- say which of args, globals or parameters a given piece of configuration belongs
  in, and why;
- explain why an object arg lost fields but a nested parameter did not;
- wire a callback so it both shows in the Actions panel *and* can be asserted in a
  `play` function, and say why `argTypesRegex` cannot do the second;
- add a theme toolbar that actually changes the component, not just the canvas
  background.

---

**Start →** [01 · Args as the source of truth](./01-args-as-the-source-of-truth.md) ·
**← Prev phase** [Phase 1 · The story format](../phase-1-story-format/README.md)
