---
title: "04 · Actions and spies"
sidebar_label: "04 · Actions and spies"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [Actions documentation](https://storybook.js.org/docs/essentials/actions),
> the [9.0 addon migration guide](https://storybook.js.org/docs/9/addons/addon-migration-guide)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Controls answer *what does this look like*. Actions answer *what did it do*.

A component's outputs are its callbacks. The Actions panel logs every call, with
its arguments and call count — so "did clicking that actually fire `onConfirm`
with the right id" stops being a `console.log` you forget to remove.

**Core since Storybook 9.** Nothing to install; `@storybook/addon-actions` is gone
and `@storybook/addon-essentials` with it.

## Use `fn()`

```tsx
import type {Meta, StoryObj} from '@storybook/react';
import {fn, expect} from 'storybook/test';
import {Alert} from './Alert';

const meta = {
  component: Alert,
  args: {
    title: 'Unsaved changes',
    onConfirm: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Confirming: Story = {
  play: async ({canvas, userEvent, args}) => {
    await userEvent.click(canvas.getByRole('button', {name: 'Confirm'}));
    await expect(args.onConfirm).toHaveBeenCalledOnce();
  },
};
```

`fn()` comes from **`storybook/test`** — note the unscoped path; it was
`@storybook/test` before the 9.0 consolidation. It does two jobs at once:

- **it logs to the Actions panel**, so a human reviewing the story sees the call;
- **it is a spy**, so a `play` function can assert on it.

Putting `fn()` on the **meta** rather than per story is the pattern: every story in
the file then has safe, assertable callbacks, and none of them can throw
"onConfirm is not a function".

## The four options, ranked

| Approach | Visible in the panel | Assertable in `play` | Verdict |
|---|---|---|---|
| `console.log` in the component | browser console only | no | never |
| `onClick: () => {}` | silent | no | no proof anything fired |
| `action('onClick')` from `storybook/actions` | yes | **no** | named log only |
| **`fn()` from `storybook/test`** | **yes** | **yes** | the default |

`action()` still exists, at `storybook/actions`, for when you want a named log
entry that is not tied to an arg — logging a DOM event, or labelling a call
differently from the prop name. It is the exception, not the starting point.

## 🔴 `argTypesRegex` is no longer the recommendation

You will find this everywhere, including in projects you inherit:

```ts
// .storybook/preview.ts — the old pattern
parameters: {
  actions: {argTypesRegex: '^on[A-Z].*'},
},
```

Any arg named like `onClick` or `onValueChange` becomes an action automatically,
with no per-prop wiring. Convenient — and **the automatically inferred args are
not spies**. Since Storybook 8, implicit actions from `argTypesRegex` cannot be
used during rendering, so a `play` function cannot assert on them.

The result is a trap with a confusing shape: the Actions panel shows the call
happening, and `expect(args.onClick).toHaveBeenCalled()` fails anyway — because
`args.onClick` is not the thing that logged.

**Assign `fn()` explicitly to any callback you care about.** It costs one line per
prop on the meta and it works in both places.

## Reading the panel

| What you see | Meaning |
|---|---|
| empty | nothing has fired yet — interact, or run the play function |
| a row | one call; the name comes from the arg or from `action('…')` |
| expand a row | the arguments, serialised |
| a count | how many times it fired |

**Clicked something and nothing appeared?** Three causes, in order:

1. the callback arg is not wired — no `fn()`, and no matching regex;
2. the component never calls the prop — that is a real bug, and the panel just
   found it;
3. you are looking at a different story than the one you clicked.

Cause 2 is the valuable one. A silent Actions panel on a button that visibly
responds is a component whose handler is not connected.

## Arguments are serialised

The panel shows a serialisable preview, not the live object. A React synthetic
event logs as a large structure that is not the object your handler received, and
class instances and functions do not survive the trip.

Practical consequence: **pass the payload, not the event.**

```tsx
// Hard to read in the panel, and hard to assert on.
onSelect={(e) => props.onSelect(e)}

// Both readable and assertable.
onSelect={() => props.onSelect(order.id)}
```

This is good component design independently of Storybook — the panel just makes
the cost visible.

## Gotchas

**Symptom — `expect(args.onClick).toHaveBeenCalled()` fails, but the Actions panel
clearly shows the call.** *Cause:* the action came from `argTypesRegex`, which
produces a log but not a spy. *Fix:* assign `fn()` to the arg explicitly. This is
the highest-value item on the page.

**Symptom — clicking a button in a story throws "onClick is not a function".**
*Cause:* no arg for the callback at all. *Fix:* `onClick: fn()` on the meta, so
every story in the file is covered.

**Symptom — `Cannot find module '@storybook/test'`.** *Cause:* it moved into core
in 9.0. *Fix:* `storybook/test`. Likewise `@storybook/addon-actions` →
`storybook/actions`.

**Symptom — the panel logs an unreadable blob for every call.** *Cause:* the
handler is passed a DOM or synthetic event, which is serialised into a large
structure that is not the original object. *Fix:* pass a meaningful payload
instead of the event.

**Symptom — actions from a previous story appear under the current one.** *Cause:*
the log is per session, not per story, and does not always clear on navigation.
*Fix:* use the Clear control before interacting when you are counting calls.

**Symptom — a story's assertions pass locally and fail in the test runner.**
*Cause:* often a shared `fn()` accumulating calls across runs. *Fix:* `fn()` on the
meta is created per story render, so prefer that over a module-scope `const spy =
fn()` shared between stories — the same isolation argument as the store in Phase 0.

## Interview questions

**★ What does `fn()` do, and where does it come from?**
`fn()` from `storybook/test` creates a mock function that Storybook spies on
automatically. It does two things at once: it logs every call to the Actions panel
so a human reviewing the story can see it, and it is assertable, so a `play`
function can check it was called with the right arguments. Note the unscoped import
path — it was `@storybook/test` before the 9.0 consolidation.

**★ Why is `argTypesRegex` not the recommended way to wire actions any more?**
Because the args it infers are logs, not spies. Since Storybook 8, implicit
actions from `argTypesRegex` cannot be used during rendering, so a `play` function
cannot assert on them. The failure is confusing: the panel shows the call and the
assertion fails anyway, because `args.onClick` is not what logged it. Assigning
`fn()` explicitly works in both places.

**★ What is the difference between `action()` and `fn()`?**
`action()` from `storybook/actions` produces a named log entry only. `fn()` from
`storybook/test` produces a log entry *and* a spy. `fn()` is the default; `action()`
is for the cases where you want a log that is not tied to an arg — a DOM event, or
a call you want labelled differently from the prop name.

**You click a button in a story and the Actions panel stays empty. What are you
looking at?**
Either the callback arg is not wired, or the component never calls the prop, or
you are on a different story than the one you clicked. The second is the
interesting case — a visibly-responding button with a silent panel means the
handler is not connected, and the panel just found a real bug.

**Why should a handler receive a payload rather than the event?**
Because the Actions panel serialises arguments, so a synthetic event logs as a
large structure that is not the object the handler received — unreadable to review
and awkward to assert on. Passing `order.id` instead of `e` is both better
component design and directly more useful in the panel and in `play`.

**Where should `fn()` go — on the meta or on each story?**
On the meta. Every story in the file then has safe, assertable callbacks with one
line per prop, and no story can throw "onConfirm is not a function". It is also
created per story render there, which keeps call counts isolated between stories.

---

**← Prev** [03 · The Controls panel](./03-the-controls-panel.md) ·
**Next →** [05 · Globals and toolbars](./05-globals-and-toolbars.md)
