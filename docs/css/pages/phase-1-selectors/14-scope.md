---
title: "@scope"
sidebar_label: "14 · @scope"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex10-nesting-scope-pseudo.mjs`.
> Baseline: **Newly available since 2025-12-12** (`web-features`).

**`@scope` limits rules to a subtree, and — uniquely — can stop them before a
lower boundary.** That second half, "donut scoping", is something no selector
could express before.

## The shape

```css
@scope (.widget) to (.slot) {
  p { color: green; }
}
```

- **`(.widget)`** is the *scoping root* — rules apply inside it.
- **`to (.slot)`** is the *scoping limit* — rules stop at it, and do not apply
  inside it.

```html
<div class="widget">
  <p id="in-scope">inside the widget</p>
  <div class="slot">
    <p id="in-slot">inside the slot</p>
  </div>
</div>
```

```console
$ node ex10-nesting-scope-pseudo.mjs
=== @scope — does the lower bound hold? ===
  p inside .widget (in scope)       rgb(0, 128, 0)
  p inside .slot (below the bound)  rgb(0, 0, 0)
  green is                          rgb(0, 128, 0)
  default is                        rgb(0, 0, 0)
```

**The bound holds.** The paragraph inside `.widget` is green; the one inside
`.slot` is untouched black, even though it is also inside `.widget`.

## Why the lower bound matters

This is the "donut" problem, and it has no selector-based solution:

> Style all the content inside this card — **except** the slot where arbitrary
> child components get injected.

Without `@scope`, the options were all bad: `:not()` chains that must enumerate
every descendant of the hole, resetting everything inside the slot, or moving
the rules into the child component where they do not belong.

```css
/* a rich-text container that must not style embedded components */
@scope (.prose) to (.embed) {
  h2 { font-size: 1.5rem; }
  p  { margin-block: 0 1em; }
  a  { text-decoration-thickness: 2px; }
}
```

Anything inside `.embed` renders with its own styling, untouched.

## Scoped without a limit

Used with only a root, `@scope` is a scoping mechanism that does not add
specificity:

```css
@scope (.card) {
  .title { font-weight: 700; }   /* specificity 0,1,0 — NOT 0,2,0 */
}
```

Compare with `.card .title`, which is `0,2,0`. **`@scope` narrows *where* rules
apply without making them harder to override**, which is the same idea as
`:where()` applied to containment rather than to a selector.

## `:scope` and implicit scoping

Inside `@scope`, `:scope` refers to the scoping root:

```css
@scope (.card) {
  :scope { border: 1px solid; }     /* the .card itself */
  :scope > .title { }               /* direct child      */
}
```

There is also an implicit form, where the root is the element the `<style>` is
inside — useful in component frameworks that inline styles:

```html
<div class="card">
  <style>
    @scope {
      .title { font-weight: 700; }   /* only inside THIS .card */
    }
  </style>
</div>
```

## Proximity: the tiebreak nobody else has

When two scoped rules match, the one whose **scoping root is closer** to the
element wins — before specificity is considered:

```css
@scope (.light) { a { color: black; } }
@scope (.dark)  { a { color: white; } }
```

A link inside `.dark` inside `.light` is white, because `.dark` is the nearer
root. Equal specificity, and the tie is broken by proximity rather than by source
order. This is the only place in CSS where DOM distance affects the cascade.

## When to reach for it

| Situation | Better tool |
|---|---|
| Component styles in a build pipeline | **CSS Modules** — scoping is free and static |
| Preventing leakage into nested instances | `>` combinators, or `@scope` |
| A hole in the middle of a styled region | **`@scope … to (…)`** — nothing else does this |
| Theming by nearest ancestor | **`@scope` proximity** |
| Total isolation | **Shadow DOM** ([page 16](./16-shadow-dom-selectors.md)) |

Baseline is **Newly available (2025-12-12)** — recent enough that a fallback
matters for conservative audiences. And an unsupported engine drops the whole
block, so the styles inside must be an enhancement, not the base.

## Gotchas

**Symptom:** everything inside `@scope` is ignored in an older browser.
**Cause:** an unsupported at-rule drops its entire block.
**Fix:** do not put base styling inside it. Check Baseline; guard with
`@supports at-rule support` is not available, so structure the fallback outside.

**Symptom:** the scoping limit does not exclude what you expected.
**Cause:** `to (.slot)` excludes `.slot` **and everything inside it** — the
boundary element itself is out of scope too.
**Fix:** that is the definition. If the boundary element should be styled, target
it outside the `@scope` block.

**Symptom:** two scoped rules fight and the "wrong" one wins.
**Cause:** proximity is compared before specificity — the nearer scoping root
wins regardless of how specific the other selector is.
**Fix:** that is the feature. If proximity is not what you want, do not scope.

**Symptom:** `@scope (.card) { .title { } }` is easier to override than expected.
**Cause:** scoping does not add specificity; the rule is still `0,1,0`.
**Fix:** intended behaviour — add weight deliberately if the rule must win.

## Interview questions

**★ What can `@scope` do that a selector cannot?**
Set a lower boundary. `@scope (.prose) to (.embed)` styles everything inside
`.prose` but stops at `.embed` and does not reach inside it — "donut scoping".
Measured, a paragraph inside the root was styled and one inside the limit was
not. No combination of combinators and `:not()` expresses that cleanly.

**★ Does `@scope` add specificity?**
No. `@scope (.card) { .title { } }` leaves `.title` at `0,1,0`, whereas
`.card .title` would be `0,2,0`. It narrows where rules apply without making them
harder to override — the containment equivalent of `:where()`.

**What is proximity in `@scope`, and when does it apply?**
When two scoped rules match the same element, the one whose scoping root is
closer in the DOM wins — evaluated before specificity. It is the only place in
CSS where DOM distance participates in the cascade, and it makes
nearest-ancestor theming work naturally.

**Is `@scope` a replacement for CSS Modules?**
Not generally. CSS Modules scope at build time with no runtime cost and no
browser-support question. `@scope` earns its place for the donut case and for
proximity-based theming, which build-time scoping cannot express.

**Is it safe to use today?**
It is Baseline **Newly available (2025-12-12)** — supported in all core browsers
but without the 30-month margin, so an older-device audience may not have it.
And because an unsupported at-rule drops its whole block, whatever is inside must
be an enhancement rather than the base styling.

---

← [13 · Styling hooks](./13-styling-hooks.md) · Next: [15 · Selector performance](./15-selector-performance.md) →
