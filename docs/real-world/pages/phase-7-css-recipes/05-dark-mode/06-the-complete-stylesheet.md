---
title: "The complete theme layer"
sidebar_label: "06 · The complete stylesheet"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — assembles only what the preceding chunks established
> against MDN and the W3C CSS Color Adjustment and Properties-and-Values
> specifications; each chunk carries its own sources. Layer order is fixed by
> the [phase index](../README.md). No sandbox, no measured timings.

**Everything the theme needs, in the order it ships.** Four artifacts: the head
of `index.html`, the token layer, the component-facing rules that depend on it,
and the JavaScript module. The palette values below are a coherent set that
satisfies the contrast obligations from
[chunk 02](02-the-token-layer.md) — treat them as a starting point to be
re-checked against your own brand, not as values to copy blindly.

## 1 · `index.html` — the head

```html
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16181d" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff">   <!-- unmediated: JS keeps this current -->

<script>
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.style.colorScheme = t;
    }
  } catch (e) {}
</script>

<link rel="stylesheet" href="/src/styles/index.css">
```

Classic inline script, synchronous, before the stylesheet. Its CSP hash is
emitted by the build ([chunk 03](03-the-flash-and-the-boot.md)).

## 2 · `src/styles/tokens.css` — the theme layer

```css
@layer tokens {
  /* ---- Registered properties: typed, interpolable, with real fallbacks ---- */
  @property --series-1 { syntax: '<color>'; inherits: true; initial-value: #2563eb; }
  @property --series-2 { syntax: '<color>'; inherits: true; initial-value: #7c3aed; }
  @property --series-3 { syntax: '<color>'; inherits: true; initial-value: #0d9488; }
  @property --series-4 { syntax: '<color>'; inherits: true; initial-value: #c2410c; }
  @property --series-5 { syntax: '<color>'; inherits: true; initial-value: #4d7c0f; }
  @property --series-6 { syntax: '<color>'; inherits: true; initial-value: #b91c1c; }

  /* ---- 1. The complete LIGHT palette. This block is the SCHEMA:
           every token gets its one unconditional definition here. ---- */
  :root {
    color-scheme: light;

    --surface:          #ffffff;
    --surface-raised:   #f7f7f8;
    --surface-sunken:   #eeeef1;
    --text:             #16181d;
    --text-muted:       #5b616e;
    --border:           #d9dce1;
    --border-strong:    #9aa1ad;
    --accent:           #2563eb;
    --accent-contrast:  #ffffff;

    --stock-in:         #15803d;
    --stock-low:        #b45309;
    --stock-out:        #9f1239;

    --status-pending:   #92400e;
    --status-paid:      #1d4ed8;
    --status-shipped:   #0f766e;
    --status-delivered: #15803d;
    --status-cancelled: #52525b;
    --status-refunded:  #7c3aed;

    --price:            #16181d;
    --price-was:        #6b7280;
    --price-discount:   #b91c1c;

    --rating-filled:    #b45309;
    --rating-empty:     #b9bec7;

    --danger:           #b91c1c;
    --danger-contrast:  #ffffff;
    --danger-quiet:     #fdeaea;

    --media-plate:      #ffffff;   /* deliberately NOT themed — see chunk 04 */
    --logo:             url('/logo-light.svg');
  }

  /* ---- 2. SYSTEM dark, guarded against an explicit light choice ---- */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;

      --surface:          #16181d;
      --surface-raised:   #1e2128;
      --surface-sunken:   #23262e;   /* LIGHTER than surface — recessed, not darker */
      --text:             #e8e8ea;
      --text-muted:       #9aa1ad;
      --border:           #2c313a;
      --border-strong:    #5b616e;
      --accent:           #60a5fa;
      --accent-contrast:  #0b0d11;   /* flips to near-black: the lifted accent is light */

      --stock-in:         #4ade80;
      --stock-low:        #fbbf24;   /* chroma held: it is a signal, not a surface */
      --stock-out:        #fb7185;

      --status-pending:   #fcd34d;
      --status-paid:      #93c5fd;
      --status-shipped:   #5eead4;
      --status-delivered: #86efac;
      --status-cancelled: #a1a1aa;
      --status-refunded:  #c4b5fd;

      --price:            #e8e8ea;
      --price-was:        #9aa1ad;
      --price-discount:   #fca5a5;

      --rating-filled:    #fbbf24;
      --rating-empty:     #4b5563;

      --danger:           #f87171;
      --danger-contrast:  #0b0d11;
      --danger-quiet:     #2a1618;

      --media-plate:      #f2f2f4;   /* dulled, NOT darkened */
      --logo:             url('/logo-dark.svg');
    }
  }

  /* ---- 3. EXPLICIT dark. Identical body to block 2; both are build output. ---- */
  :root[data-theme="dark"] {
    color-scheme: dark;
    /* … the same declarations as block 2, emitted from the same source … */
  }
}
```

🔴 **Blocks 2 and 3 are emitted from one token source.** They are shown
separately because CSS cannot span a media-query boundary with one selector
list, not because they are maintained twice
([chunk 02b](02b-deriving-and-deduplicating.md)).

## Reading the palette

Three choices in the block above are the ones worth defending in review, because
each looks like a mistake.

**`--accent-contrast` flips from `#ffffff` to `#0b0d11`.** The dark theme lifts
`--accent` from `#2563eb` to `#60a5fa` so it stays visible against a near-black
canvas — and a lifted accent needs *dark* text on it. The token tracks the
accent, not the surface, which is the whole reason it exists separately
([chunk 02](02-the-token-layer.md)).

**`--surface-sunken` is `#eeeef1` in light and `#23262e` in dark — lighter than
its own surface.** The role means *recessed*, and against a near-black canvas
recessed is lighter. A dark theme that pushes it below `#16181d` makes input
wells and skeleton bases disappear.

**`--media-plate` stays light in both themes.** It is the one deliberately
un-themed role in the file, because catalogue photography has a white background
baked into the pixels ([chunk 04](04-images-media-and-controls.md)). It is
*dulled* to `#f2f2f4` rather than darkened, because anything below the
photograph's own white produces a visible seam around every product.

Two more, quieter: the six status colours vary in **lightness and chroma**
rather than hue alone, so they stay distinguishable from each other after the
dark theme lifts all of them; and `--stock-low` keeps its chroma in dark mode
(`#fbbf24`) while the surfaces around it lose theirs, because it is a signal and
chroma reduction belongs on surfaces.

## Gotchas

### The theme works but component rules need `!important`
**Symptom.** Token changes are overridden by component styles.
**Cause.** The token blocks were written outside `@layer tokens`, so an
unlayered component rule beats them — unlayered styles win over layered ones.
**Fix.** Layer order is declared once in the entry stylesheet; the token blocks
belong in `tokens`, which sits below `components`.

### A token resolves to inherited text colour
**Symptom.** One element ignores its token entirely and renders in the
surrounding text colour.
**Cause.** A typo makes the value guaranteed-invalid, and `var()` then falls
back to inherited.
**Fix.** Register it with `@property` so `initial-value` catches it. A visibly
wrong colour is a better failure than a silent one.

### `--surface-sunken` looks wrong in one theme
**Symptom.** Wells and skeleton bases vanish in dark mode.
**Cause.** The dark value was made darker than `--surface`, mirroring the light
theme's *direction* instead of its *intent*.
**Fix.** In dark mode it is lighter. The role names an intent.

### A token was added to the dark blocks only
**Symptom.** A new colour works in dark mode and is invisible in light.
**Cause.** Block 1 was not updated.
**Fix.** Block 1 is the schema. Because blocks 2 and 3 are generated from one
source, the check is mechanical: the three property lists must match.

### The stylesheet is correct and the page still flashes
**Symptom.** Everything themes, and there is still a flip on load.
**Cause.** The boot script is missing, deferred, or its CSP hash is stale after
a reformat.
**Fix.** Classic inline script in `<head>`, hash generated by the build
([chunk 03](03-the-flash-and-the-boot.md)).

### Blocks 2 and 3 have drifted
**Symptom.** An explicit dark choice renders slightly differently from system
dark.
**Cause.** They were edited by hand.
**Fix.** They are build output from one token source. If the project genuinely
hand-maintains tokens, use `light-dark()` instead and accept its fallback
block — never keep two hand-edited copies.

## Interview questions

**Why must the token blocks live in a cascade layer?**
So component rules never have to out-specify the theme. Unlayered rules beat
layered ones, so leaving the tokens unlayered is exactly what leads to
`!important` appearing in component styles.

**Why does block 1 contain every token even though most are overridden?**
It is the schema. A token that exists only in a dark block resolves to
guaranteed-invalid in light mode; and because both dark blocks are generated
from one source, matching key sets are the invariant that makes the arrangement
safe.

**Why is `--accent-contrast` white in light mode and near-black in dark?**
Because the dark theme lifts `--accent` to stay visible against a near-black
canvas, and a lifted accent needs dark text on it. It is text on the accent, so
it tracks the accent rather than the surface.

**Why is one role deliberately not themed?**
`--media-plate` sits behind catalogue photography whose white background is in
the pixels. Darkening it produces a seam around every product, so it is dulled
rather than themed — and it carries a comment, because it reads as a bug.

**Why register the chart series with `@property` when nothing here animates
them?**
Two reasons beyond animation: `initial-value` turns an invalid token into a
visibly wrong colour instead of a silent fallback, and the declared
`syntax: '<color>'` makes the value interpolable for the dashboard's highlight
transition.

---

← Prev: [React, motion and bfcache](05b-consuming-the-theme-in-react.md) · Index: [Dark mode](README.md) · Next → [The runtime and the checklist](06b-the-runtime-and-the-checklist.md)
