---
title: "Three viewer states, not two"
sidebar_label: "01 · Three states"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme),
> [`color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme),
> [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) —
> and the **W3C CSS Color Adjustment Level 1** specification.
> Concept home: **[CSS 8·03 — Dark mode properly](../../../../css/pages/phase-8-color-theming/03-dark-mode-properly.md)**
> owns the token argument and the `color-scheme` mechanism; this chapter does not
> repeat either. No sandbox, no measured timings.

**A theme toggle has three states and the media query can only tell you about
two of them.** `prefers-color-scheme` resolves to `light` or `dark` for every
visitor — the spec dropped `no-preference`, so there is no CSS way to ask "has
this person actually chosen anything?" That single missing value is why a
storefront theme cannot be built from the media query alone, and it is the
reason every rule in this chapter is shaped the way it is: the media query
carries the *default*, and an attribute on the root element carries the
*override*, and the two have to be layered so that either can win.

## The three states, named

| State | What the user did | Where it lives | What decides the colours |
|---|---|---|---|
| **System** | nothing — the default | no attribute on `<html>` | `prefers-color-scheme` |
| **Light** | chose light explicitly | `data-theme="light"` | the attribute, over the media query |
| **Dark** | chose dark explicitly | `data-theme="dark"` | the attribute, over the media query |

The distinction between *system* and *an explicit choice that happens to match
the system* is not pedantry. A visitor on system-dark who has never touched the
control should follow their phone when it flips to light at sunrise. A visitor
who explicitly picked dark should not. Collapsing the two into a stored
`"dark"` string loses that, and the bug it produces is invisible in testing
because it only shows up when the OS theme changes while the tab is open.

**The storefront stores exactly one of three values**, and *system* is stored as
the absence of a value rather than the string `"system"` — no key in
`localStorage` means the user has never chosen, which is precisely the
condition we need to detect.

## Why the attribute goes on `<html>`, not `<body>`

The theme has to be readable before `<body>` exists. The boot script in
**[chunk 03](03-the-flash-and-the-boot.md)** runs in `<head>` and stamps the
attribute on `document.documentElement`, which is the only element guaranteed to
be parsed at that point. Putting it on `<body>` also puts the page background —
which the browser paints from the root — outside the themed subtree, and the
canvas flashes.

## The selector structure that survives both directions

This is the whole mechanism, and getting it wrong in one of the four blocks is
the most common way a toggle half-works.

```css
/* 1 — the complete LIGHT palette on bare :root.
       Every token gets its first and only unconditional definition here. */
:root {
  color-scheme: light;
  --surface:        #ffffff;
  --surface-raised: #f7f7f8;
  --text:           #16181d;
  --text-muted:     #5b616e;
  --border:         #d9dce1;
  --accent:         #2563eb;
}

/* 2 — SYSTEM dark. Guarded so an explicit light choice is not overridden. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface:        #16181d;
    --surface-raised: #1e2128;
    --text:           #e8e8ea;
    --text-muted:     #9aa1ad;
    --border:         #2c313a;
    --accent:         #60a5fa;
  }
}

/* 3 — EXPLICIT dark. Wins on a light-preferring system. */
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface:        #16181d;
  --surface-raised: #1e2128;
  --text:           #e8e8ea;
  --text-muted:     #9aa1ad;
  --border:         #2c313a;
  --accent:         #60a5fa;
}
```

Three blocks, and the dark values appear twice. That duplication is deliberate
and **[chunk 02](02-the-token-layer.md)** shows the two ways to remove it —
`light-dark()` and a shared custom-property block — along with what each costs.

### Why block 2 needs the `:not()` guard

Without it, a visitor whose OS is dark and who explicitly picks **light** gets
dark anyway. Both `:root` and `:root[data-theme="light"]` would match, block 2
comes later in the stylesheet, and later wins at equal specificity — except
block 2's selector is *also* one attribute selector heavier, so it wins on
specificity too. The guard removes the match entirely rather than trying to
out-specify it.

### Why block 3 is needed even though block 2 exists

Block 2 lives inside a media query that is false on a light-preferring system.
An explicit dark choice there matches nothing without block 3. **The symmetry
matters: three blocks handle all six combinations** of two system preferences
and three stored states.

| System | Stored | Block that decides | Result |
|---|---|---|---|
| light | *(none)* | 1 | light |
| light | `light` | 1 | light |
| light | `dark` | 3 | dark |
| dark | *(none)* | 2 | dark |
| dark | `light` | 1 — block 2 excluded by the guard | light |
| dark | `dark` | 2 and 3, same values | dark |

## `color-scheme` is set in all three blocks, and that is not redundant

Every block sets `color-scheme` alongside the tokens because it controls
something the tokens cannot reach: the **user-agent** surfaces — scrollbars,
the default canvas, form-control chrome, the spellcheck underline. The
mechanism is [CSS 8·03](../../../../css/pages/phase-8-color-theming/03-dark-mode-properly.md).
What matters here is that it must move *with* the tokens. A block that changes
`--surface` to near-black and leaves `color-scheme: light` standing produces a
dark page with white scrollbars and white `<select>` menus, which reads as a
broken dark mode rather than a missing one.

Declaring `color-scheme: light dark` once on `:root` and never changing it is
the other common approach, and **this storefront does not use it**, because it
makes the UA chrome follow the *system* while the tokens follow the
*attribute* — the two disagree for exactly the visitor who overrode their
system, which is the visitor who cared enough to click.

## What this chapter deliberately does not decide

The **palette values** above are placeholders standing in for the storefront's
real token set, which is chapter **[02](02-the-token-layer.md)**'s subject —
including the roles this app needs that no generic palette has, like stock
state and order status. The **contrast** obligations that constrain those
values are there too.

## Gotchas

### The toggle works one way and not the other
**Symptom.** Switching to dark works on a light machine; switching to light does
nothing on a dark machine.
**Cause.** Block 2 was written as a bare `:root` inside the media query, so it
matches even when `data-theme="light"` is present, and it comes later.
**Fix.** The guard, and it must be the negation of the *opposite* theme:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* … */ }
}
```

### The page flashes the wrong theme on every load
**Symptom.** A white flash before dark paints, on every navigation.
**Cause.** The attribute is stamped by React after hydration, so the first paint
uses block 1 or 2.
**Fix.** A blocking script in `<head>` — the whole of
**[chunk 03](03-the-flash-and-the-boot.md)**.

### Dark mode is correct until the OS theme changes
**Symptom.** The phone flips to light at sunrise; the open tab stays dark.
**Cause.** `prefers-color-scheme` re-evaluates live, so CSS handles this by
itself — unless the boot script stamped `data-theme` for a *system*-state
visitor, which pins them.
**Fix.** Stamp nothing when there is no stored choice. The absence of the
attribute is the system state, and CSS then tracks the OS with no JavaScript at
all. This is why the stored value must distinguish "no choice" from "chose the
thing that matched at the time".

### A token defined only inside the dark block
**Symptom.** One colour is `unset`/inherited in light mode, usually a new token
added late.
**Cause.** It was added to blocks 2 and 3 and not to block 1.
**Fix.** **Block 1 is the schema.** Every token gets its unconditional
definition on bare `:root`; the other blocks only ever *redefine*. A token that
appears in block 2 or 3 and not in block 1 is a bug by construction, and the
check is mechanical — the three blocks should have identical property lists.

### `data-theme` on `<body>`, background from `<html>`
**Symptom.** Content themes correctly; the area behind it, and the overscroll
rubber-band area on iOS, stays light.
**Cause.** The browser propagates the canvas background from the root element,
which is outside the themed subtree.
**Fix.** Attribute on `<html>`.

## Interview questions

**Why can't a theme toggle be built from `prefers-color-scheme` alone?**
Because the media feature resolves to `light` or `dark` for everyone — the spec
dropped `no-preference` — so CSS cannot distinguish a user who chose from a user
who did not. Storing the override outside CSS and exposing it as an attribute is
what recovers the third state.

**Why does the dark palette appear twice in the stylesheet?**
Because one copy lives inside a media query that is false on a light-preferring
system, and the other is an attribute selector that must win when it is. Chunk
02 covers deduplicating them and the trade-off.

**What does `:root:not([data-theme="light"])` protect against?**
A user on a dark system who explicitly chose light. Without it the media block
still matches and, being later and heavier, wins.

**Why store the absence of a choice rather than the string `"system"`?**
Both work, but the absence is self-describing: no key means never chosen. What
matters more is what it enables — leaving `data-theme` unstamped lets CSS track
live OS changes with no listener at all.

**Why is `color-scheme` set three times instead of once as `light dark`?**
Declaring it once makes UA chrome follow the *system* while tokens follow the
*attribute*. They then disagree for any visitor who overrode their system.

**What breaks if the attribute goes on `<body>`?**
The canvas background is painted from the root element, so it stays unthemed —
visible as a flash on load and in the iOS overscroll area.

---

← Prev: [Phase 7 index](../README.md) · Index: [Dark mode](README.md) · Next → [The token layer](02-the-token-layer.md)
