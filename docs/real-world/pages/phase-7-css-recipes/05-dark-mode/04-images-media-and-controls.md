---
title: "Images and media the token layer cannot reach"
sidebar_label: "04 · Images and media"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`<picture>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture),
> [`filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/filter),
> [`image-set()`](https://developer.mozilla.org/en-US/docs/Web/CSS/image/image-set),
> [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme).
> Concept homes: colour theming is
> [CSS 8·03](../../../../css/pages/phase-8-color-theming/03-dark-mode-properly.md);
> image sizing and layout shift are
> [chapter 7·01](../01-the-product-grid/05-images-without-layout-shift.md).
> The uploads this chapter frames come from
> [chapter 4·08](../../phase-4-react-ui/08-upload-with-progress.md).
> No sandbox, no measured timings.

**The token layer themes everything the storefront draws. It does not theme what
the storefront *shows*.** Product photography, brand logos and user-uploaded
review images arrive as fixed pixels, and a dark mode that is otherwise perfect
still looks broken when every catalogue tile is a lit rectangle. None of it is
fixed by adding tokens, and the most obvious fix — inverting — is the one thing
this storefront must never do.

## 🔴 Product photography is never inverted

The temptation is `filter: invert(1) hue-rotate(180deg)`, the trick that darkens
a document while approximately preserving hues. **On a storefront it is a
defect, not a style choice.** A red dress renders cyan-ish, a beige sofa renders
blue, and the customer buys a colour the photograph did not show. Colour
fidelity on a product image is a commercial obligation — it is what returns get
argued about — and no theme is worth it.

The same applies to review uploads. They are photographs of real objects taken
by customers, and filtering them changes evidence.

**What is actually wrong** is narrower than "the images are too bright":
catalogue photography is shot on white, so each tile becomes a lit rectangle on
a dark page. The fix is to make that rectangle *look intentional*.

```css
/* The image tile keeps a light plate in BOTH themes. */
.product-tile__media {
  background: var(--media-plate);      /* a themed role, but barely themed */
  border-radius: var(--radius-md);
  padding: var(--space-3);
  border: 1px solid var(--border);
}
```

```css
:root                    { --media-plate: #ffffff; }
:root[data-theme="dark"] { --media-plate: #f2f2f4; }   /* still light, slightly dulled */
```

The dark theme **dulls** the plate rather than darkening it. Pulling it below the
photograph's own background produces a visible seam around every product, which
looks worse than the bright tile did. **The plate is the one role in the token
file that deliberately does not follow the theme**, and it is worth a comment
saying so, because it looks like a bug to the next reader.

Where the catalogue can guarantee **transparent** PNG or WebP cut-outs, the
plate can be dropped and the product placed straight on `--surface-raised`. That
is the better result and it is a *content pipeline* decision, not a CSS one — so
the stylesheet supports both and the tile class carries a modifier:

```css
.product-tile__media--cutout { background: transparent; padding: 0; border: 0; }
```

Which modifier applies is decided from the product record, not guessed from the
file: a transparency flag set at ingest. Sniffing an alpha channel at runtime
tells you the format supports transparency, not that the photograph uses it.

## Review uploads get a frame, not a filter

User photographs have unknown backgrounds — some dark, some blown out, some a
screenshot. There is no plate colour that suits all of them, so the treatment is
a **border and a radius** rather than a background:

```css
.review__photo {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);   /* only ever seen behind transparency */
}
```

The border does the whole job: it separates the image from the surface in both
themes without making any claim about the image's own colours.

## Logos and icons

**Icons are SVG with `fill="currentColor"`** and theme for free, inheriting from
`--text` wherever they sit. Nothing else here is that easy, and any icon that
arrived as a raster asset should be converted rather than themed.

**A brand logo with fixed colours needs two assets — and the obvious mechanism
is wrong.**

```html
<!-- ⚠️ follows the SYSTEM, not the user's choice -->
<picture>
  <source srcset="/logo-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="/logo-light.svg" alt="Storefront">
</picture>
```

`<picture>` selects on media queries only. It cannot see `data-theme`, so a
visitor on a light system who chose dark gets the dark page with the **light**
logo — exactly the visitor chapter [01](01-three-states-not-two.md) built the
third state for. The failure is invisible to anyone testing by changing their OS
theme, which is how it survives review.

The mechanism that does see the attribute is CSS:

```html
<span class="brand" role="img" aria-label="Storefront"></span>
```

```css
.brand {
  width: 8rem; aspect-ratio: 4 / 1;
  background: var(--logo) center / contain no-repeat;
}
:root                             { --logo: url('/logo-light.svg'); }
:root[data-theme="dark"]          { --logo: url('/logo-dark.svg');  }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --logo: url('/logo-dark.svg');  }
}
```

The same three-block structure as every other token, which is the point: **the
logo is a themed token whose value happens to be a URL.** Note the `role="img"`
and `aria-label` — a CSS background has no alt text, and dropping the label
loses the brand name from the accessibility tree.

The alternative is shipping both `<img>` tags and toggling `display`. It keeps
native alt text and avoids the ARIA, at the cost of a wasted request unless both
are inlined as data URIs. Either is defensible; `<picture>` is not.

## Third-party frames

An embedded iframe from another origin cannot be themed — no selector reaches
inside it, and a filter would hit the same fidelity objection as product
imagery. The honest treatment is to give it a plate, exactly like a product
photo, rather than to leave it glowing against the dark page.

## The transactional emails are not this stylesheet's problem

The order-confirmation emails sent by the worker in
[Phase 2](../../phase-2-node-services/README.md) are outside this stylesheet
entirely. Email clients vary in whether they honour `prefers-color-scheme` at
all, and several apply their own inversion to messages that do not declare
support — which means the email may be inverted by the client no matter what the
template says.

The one rule that carries across is the one at the top of this chapter: **the
product image in the email must not be inverted either.** Where a client's
forced inversion is a real risk, the defence is a light plate baked into the
image itself, not a CSS filter.

## Gotchas

### Product colours are wrong in dark mode
**Symptom.** A red item photographs cyan; customers complain after delivery.
**Cause.** `filter: invert()` applied to product imagery.
**Fix.** Never filter product or review photography. Frame it with a plate
instead.

### Every product tile is a glowing rectangle
**Symptom.** The dark catalogue is a grid of bright squares.
**Cause.** Photography shot on white, placed directly on a dark surface.
**Fix.** A deliberate light plate with padding and a border, so it reads as a
frame.

### A seam appears around every product
**Symptom.** Each photo has a visible rectangular edge in dark mode.
**Cause.** The plate was darkened to follow the theme, so it no longer matches
the photograph's own white background.
**Fix.** Dull the plate, do not darken it. It is the deliberate exception in the
token file.

### The cut-out modifier is applied to the wrong products
**Symptom.** Some products float on the surface; others show a white box inside
a transparent frame.
**Cause.** Transparency was inferred from the file format at runtime. PNG
*supports* alpha; it does not follow that this image uses it.
**Fix.** A transparency flag recorded at ingest, carried on the product record.

### The logo is wrong for exactly one group of users
**Symptom.** Light-system visitors who chose dark get the light logo on a dark
page.
**Cause.** `<picture>` with `media="(prefers-color-scheme: dark)"` — it selects
on media queries and cannot see `data-theme`.
**Fix.** Make the logo a themed custom property holding a `url()`, with the same
three-block structure as every other token.

### The brand name disappeared from screen readers
**Symptom.** The logo is announced as nothing after the `<picture>` was replaced
with a CSS background.
**Cause.** A background image has no alt text.
**Fix.** `role="img"` plus `aria-label` on the element, or go back to two
`<img>` tags toggled by CSS.

### Review photos look wrong against one theme or the other
**Symptom.** Whatever plate colour is chosen, some uploads clash.
**Cause.** User photographs have unknown backgrounds; there is no correct plate.
**Fix.** A border and radius instead of a background. The separation comes from
the edge, which makes no claim about the image.

## Interview questions

**Why is inverting images acceptable on a documentation site and not here?**
Because the images are the product. Hue-rotating a photograph changes the colour
the customer believes they are buying, which is a commercial and returns problem
rather than an aesthetic one.

**Why does the image plate stay light in dark mode instead of following the
theme?**
Because catalogue photography has a white background baked in. A dark plate
behind a white-background photo produces a visible seam around every item. The
plate is dulled, not darkened, and it is the deliberate exception in the token
file.

**What is wrong with using `<picture>` to swap a logo for dark mode?**
`<picture>` selects on media queries, so it follows the system preference and
cannot see the `data-theme` override. It silently gives the wrong logo to
exactly the users who set an explicit theme — and testing by flipping the OS
theme never reproduces it.

**What does moving the logo into a CSS background cost?**
The alt text. A background image is invisible to the accessibility tree, so the
element needs `role="img"` and an `aria-label`, or the two-`<img>` approach.

**Why are review uploads framed with a border rather than a plate?**
Their backgrounds are unknown and inconsistent, so no plate colour is right for
all of them. A border separates the image from the surface in both themes
without asserting anything about its contents.

**How is it decided which products get the transparent-cut-out treatment?**
From a flag set when the image is ingested. Runtime format sniffing tells you
the format permits alpha, not that this particular photograph uses it.

**Do the order-confirmation emails inherit any of this?**
No — they are outside the stylesheet, and some clients invert messages
regardless. The only rule that carries is that the product image must not be
inverted, which for email means baking a light plate into the asset.

---

← Prev: [The flash and the boot](03-the-flash-and-the-boot.md) · Index: [Dark mode](README.md) · Next → [Controls the browser draws](04b-controls-the-browser-draws.md)
