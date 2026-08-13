---
title: "Styling hooks that are not classes"
sidebar_label: "13 · Styling hooks"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**What you select on is an interface between three teams: design, behaviour and
tests.** Using one class for all three is why a CSS rename breaks the test suite
and a test-id rename breaks the design.

## Three consumers, three hooks

| Consumer | Hook | Why |
|---|---|---|
| **Styling** | `class` | what CSS is for; cheap, repeatable, no semantics |
| **State** | `data-*` or `aria-*` | describes a condition, not an appearance |
| **Tests / automation** | `data-testid` | changes only when behaviour changes |
| **Script targeting** | `data-*` or a `js-` class | so a design refactor cannot break behaviour |

The rule: **each hook has exactly one consumer.** Then renaming a class is a
styling decision with styling-sized consequences.

## State belongs on attributes

```css
[data-state="loading"] .spinner { display: block; }
[data-state="error"]   .message { color: var(--danger); }
[aria-expanded="true"] .chevron { rotate: 180deg; }
[aria-current="page"]           { font-weight: 700; }
[aria-busy="true"]              { cursor: progress; }
```

Two advantages over `.is-loading` / `.is-error` classes:

1. **A `data-state` attribute holds one value at a time.** Setting
   `el.dataset.state = 'error'` cannot leave `loading` behind, which is exactly
   the bug `classList.add`/`remove` pairs produce on error paths.
2. **`aria-*` attributes are required anyway.** Styling on them means the visual
   state and the announced state are the same value and cannot drift.

Specificity is unchanged — an attribute selector is `0,1,0`, the same as a class
— so migrating `.is-open` to `[data-state="open"]` never disturbs the cascade.

## Never style on `data-testid`

```css
/* wrong — now the test id is load-bearing for the design */
[data-testid="submit"] { background: var(--accent); }
```

The whole value of a test id is that it is stable and meaningless. Once CSS
depends on it, renaming it becomes a visual regression, and the test suite's
selectors have quietly become a styling API.

The reverse is equally true: **tests should not select on styling classes.** A
test that finds `.btn--primary` fails when the design system renames the variant,
which is a false failure — the behaviour never changed.

## Naming state values

```html
<!-- good: one attribute, mutually exclusive values -->
<div data-state="idle">      <!-- idle | loading | success | error -->

<!-- also good: independent booleans as separate attributes -->
<div data-open data-selected>

<!-- bad: booleans crammed into one attribute -->
<div data-state="open selected loading">
```

Boolean attributes are matched by presence, which reads well:

```css
[data-open] .panel { display: block; }
[data-selected]    { outline: 2px solid var(--accent); }
```

## Where `:has()` changes the design

With [`:has()`](./06-has.md), a lot of state no longer needs an attribute at
all — the DOM already says it:

```css
/* instead of toggling a class on <body> when the dialog opens */
body:has(dialog[open]) { overflow: hidden; }

/* instead of an .is-invalid class synced from a validation library */
.field:has(:user-invalid) { --border: var(--danger); }

/* instead of .has-image on the card */
.card:has(> img) { grid-template-columns: 8rem 1fr; }
```

**The best state hook is often no hook** — the condition is already expressed in
the markup, and querying it directly removes the synchronisation code entirely.

## The `js-` prefix convention

Where script must find an element and `data-*` feels heavy, a prefixed class
signals ownership:

```html
<button class="btn btn--primary js-submit">Save</button>
```

`js-submit` is never styled; `btn btn--primary` is never queried from script.
Each name has one owner, and a lint rule can enforce it.

## Gotchas

**Symptom:** two state classes are applied at once — `is-loading` and
`is-error` together.
**Cause:** an `add`/`remove` pair where the remove was missed on an error path.
**Fix:** a single `data-state` attribute holding one value; assignment replaces
rather than accumulates.

**Symptom:** renaming a component class broke end-to-end tests.
**Cause:** the tests select on styling classes.
**Fix:** `data-testid` for tests, classes for styling, and stop crossing them.

**Symptom:** a screen reader announces a collapsed panel as expanded.
**Cause:** the visual state comes from a class and the ARIA attribute was set
separately — the two drifted.
**Fix:** style on `[aria-expanded="true"]` so there is only one source of truth.

**Symptom:** styles broke after a JavaScript refactor renamed an id.
**Cause:** CSS coupled to the anchor/ARIA namespace.
**Fix:** classes or `data-*` attributes; leave ids to fragments and ARIA
relationships.

## Interview questions

**★ Why style on `data-*` or `aria-*` attributes instead of state classes?**
Because a single attribute holds one value at a time, so `dataset.state = 'error'`
cannot leave a stale `loading` behind the way an `add`/`remove` class pair can.
And styling on `aria-*` makes the visual state and the announced state the same
value, so they cannot drift. Specificity is identical to a class — `0,1,0` — so
the migration is cascade-neutral.

**★ Should CSS ever select on `data-testid`?**
No. A test id's value is that it is stable and meaningless; once styling depends
on it, renaming it becomes a visual regression and the test suite has become a
styling API. The reverse holds too — tests selecting on design classes fail when
the design is renamed, which is a false failure.

**How does `:has()` change the way state is modelled?**
It often removes the need for a state hook at all. `body:has(dialog[open])`
replaces a body class toggled by script, and `.field:has(:user-invalid)`
replaces an `.is-invalid` class synced from a validation library — deleting the
synchronisation code and the bugs in it.

**What is the `js-` prefix convention for?**
Marking classes that exist only for script to query, so they are never styled,
and styling classes are never queried. It makes ownership explicit and is easy to
enforce with a lint rule.

**Does using attribute selectors for state change specificity?**
No — `[data-state="open"]` is `0,1,0`, exactly the same as `.is-open`, so
switching from one to the other never disturbs existing overrides.

---

← [12 · Nesting](./12-nesting.md) · Next: [14 · @scope](./14-scope.md) →
