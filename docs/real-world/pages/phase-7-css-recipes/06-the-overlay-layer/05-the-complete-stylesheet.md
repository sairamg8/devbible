---
title: "The complete overlay stylesheet"
sidebar_label: "05 · The complete stylesheet"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — assembles only what the preceding chunks established
> against MDN, the WAI-ARIA Authoring Practices and WCAG 2.2; each chunk carries
> its own sources. Layer order is fixed by the [phase index](../README.md), and
> the tokens come from [Dark mode](../05-dark-mode/README.md).
> No sandbox, no measured timings.

**The whole overlay layer, in the order it ships, plus the markup each rule
expects.** Nothing here is new — it is the four preceding chunks assembled so
the file can be read end to end, followed by the checklist that catches every
failure they documented.

## The markup contract

```html
<html>  <!-- scrollbar-gutter and scroll-padding live here -->
  <body>
    <header class="site-header" data-scrolled>
      <button popovertarget="cat-menu">Categories</button>
      <div id="cat-menu" popover class="menu">…</div>
    </header>

    <div id="sentinel" aria-hidden="true"></div>
    <main>…</main>

    <!-- Modal: opened with showModal(), never show() -->
    <dialog class="drawer" aria-labelledby="cart-title">
      <h2 id="cart-title">Your cart</h2>
      <div class="drawer__body">…</div>
      <footer class="drawer__actions">…</footer>
    </dialog>

    <!-- Rendered once, empty, at app mount -->
    <div id="toasts" popover="manual" class="toast-region">
      <ol class="toast-region__list" role="status" aria-relevant="additions"></ol>
    </div>

    <div class="consent-bar">…</div>
  </body>
</html>
```

## `src/styles/overlay.css`

```css
@layer base {
  :root {
    /* The only z-indexes in the application (chunk 01) */
    --z-header:  10;
    --z-inflow:  20;
    --z-consent: 30;

    --header-h: 4rem;

    /* Reserve the gutter permanently — this is what stops the modal-open jump */
    scrollbar-gutter: stable;
    scroll-padding-block-start: calc(var(--header-h) + var(--space-2));
  }

  /* Scrim: defined on :root because ::backdrop may not inherit (chunk 02) */
  :root                             { --overlay-scrim: rgb(0 0 0 / 0.5); }
  :root[data-theme="dark"]          { --overlay-scrim: rgb(0 0 0 / 0.7); }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --overlay-scrim: rgb(0 0 0 / 0.7); }
  }
}

@layer components {
  /* ---------- The sticky header ---------- */
  .site-header {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--z-header);
    block-size: var(--header-h);
    background: var(--surface-raised);
    border-block-end: 1px solid var(--border);
  }
  .site-header[data-scrolled] { box-shadow: var(--shadow-header); }

  /* ---------- Modal dialogs (chunk 02) ---------- */
  dialog {
    margin: auto;                    /* keep — this centres it */
    padding: 0;
    border: 0;
    background: var(--surface-raised);
    color: var(--text);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-overlay);
    max-inline-size: min(32rem, 100% - 2rem);
    max-block-size: min(40rem, 100dvb - 2rem);
    overflow: auto;

    opacity: 0;
    translate: 0 0.5rem;
    transition:
      opacity   150ms ease,
      translate 150ms ease,
      display   150ms allow-discrete,
      overlay   150ms allow-discrete;   /* stays promoted while it leaves */
  }
  dialog[open] { opacity: 1; translate: 0 0; }
  @starting-style { dialog[open] { opacity: 0; translate: 0 0.5rem; } }

  dialog::backdrop { background: var(--overlay-scrim); }

  /* The cart drawer is a dialog pinned to the inline edge */
  .drawer {
    margin: 0 0 0 auto;
    block-size: 100dvb;
    max-block-size: 100dvb;
    inline-size: min(26rem, 100%);
    border-radius: 0;
    display: flex;
    flex-direction: column;
  }
  .drawer__body    { overflow-y: auto; overscroll-behavior: contain; flex: 1; }
  .drawer__actions { border-block-start: 1px solid var(--border); padding: var(--space-3); }

  /* ---------- Popovers (chunk 02) ---------- */
  [popover] {
    inset: auto;                     /* undo the UA centring */
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--surface-raised);
    color: var(--text);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
  }
  .menu { inset-block-start: var(--header-h); padding: var(--space-3); }

  /* ---------- The toast region (chunk 03) ---------- */
  .toast-region {
    /* a positioning shell: no surface of its own */
    inset: auto; margin: 0; padding: 0;
    background: none; border: 0; box-shadow: none;

    position: fixed;
    inset-block-end: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    inset-inline-end: var(--space-4);
    inline-size: min(24rem, 100% - 2rem);
  }
  .toast-region__list {
    display: flex;
    flex-direction: column-reverse;   /* newest nearest the corner */
    gap: var(--space-2);
    margin: 0; padding: 0; list-style: none;
  }
  .toast {
    background: var(--surface-raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-inline-start: 4px solid var(--toast-accent, var(--accent));
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
    padding: var(--space-3);
    transition: opacity 150ms ease, translate 150ms ease;
  }
  @starting-style { .toast { opacity: 0; translate: 0 0.5rem; } }
  .toast--success { --toast-accent: var(--stock-in); }
  .toast--error   { --toast-accent: var(--danger);   }

  /* ---------- In-flow overlays: the only remaining numbers ---------- */
  .upload-progress { position: relative; z-index: var(--z-inflow); }
  .consent-bar     { position: fixed; inset-block-end: 0; z-index: var(--z-consent); }
}

/* Safe ONLY because it applies while a modal is open (chunk 04) */
body:has(dialog[open]) { overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  dialog, [popover], .toast { transition: none; }
}
```

## The review checklist

- [ ] Every overlay was classified by the two questions in [chunk 01](01-the-storefront-overlays.md).
- [ ] No `z-index` literal outside the three named values; nothing above `30`.
- [ ] No `z-index` on any top-layer element.
- [ ] `showModal()` everywhere; no `show()`.
- [ ] Scrim tokens are defined on `:root`, and the dark scrim is stronger.
- [ ] Every `[popover]` reset includes `inset: auto` and `margin: 0`.
- [ ] Every transitioned overlay lists `display` **and** `overlay` with `allow-discrete`, and has `@starting-style`.
- [ ] The toast region is `popover="manual"`, transparent, and rendered empty at mount.
- [ ] `role="status"` for confirmations, `role="alert"` only for errors.
- [ ] No toast carrying an action auto-dismisses; timers pause on hover **and** focus.
- [ ] `scrollbar-gutter: stable` is unconditional.
- [ ] The scroll lock is `:has()`-driven, not class-driven.
- [ ] Every scrollable region inside an overlay has `overscroll-behavior: contain`.
- [ ] Full-height overlays use `dvb`/`dvh`, never `vh`.
- [ ] `--header-h` is referenced by the scroll padding, the menu offset and the toast offset — not repeated.
- [ ] No ancestor of the header carries a non-`visible` `overflow` outside the modal-open rule.

## Gotchas

### The overlay rules need `!important` to beat a component
**Symptom.** Dialog styling is overridden by a card or panel rule.
**Cause.** The overlay rules were written outside `@layer components`, or after
an unlayered block.
**Fix.** Layer order is declared once in the entry stylesheet; overlays are
components.

### `.drawer` lost its centring and now the confirm dialog has too
**Symptom.** Changing `margin` on `.drawer` moved every dialog.
**Cause.** `margin: auto` on the bare `dialog` selector is what centres modals;
the drawer overrides it deliberately.
**Fix.** Override on the modifier class only, never on the element selector.

### The consent bar covers a modal
**Symptom.** The cookie bar sits over the checkout dialog.
**Cause.** It is on the numeric scale by design — but the dialog is not in the
top layer, so `show()` was used.
**Fix.** `showModal()`. A top-layer element is above the entire document
including `--z-consent`.

### Reduced motion still animates one overlay
**Symptom.** The toast slides for a user who asked for no motion.
**Cause.** The guard lists `dialog` and `[popover]` but the toast is neither —
it is a child of the region.
**Fix.** Name `.toast` in the guard, as above. Any new overlay needs adding.

## Interview questions

**Why is `body:has(dialog[open]) { overflow: hidden }` outside the layers?**
It is a document-level state rule rather than a component style, and keeping it
unlayered makes it obvious it is not something a component may override. Its
safety argument — that it only applies while a modal is open — is what lets it
coexist with `position: sticky`.

**Why does the drawer override `margin` rather than the dialog rule?**
`margin: auto` on the element selector is the mechanism that centres every
modal. Editing it to pin the drawer to the edge would move the confirm dialog,
the login prompt and the image zoom too.

**Why is `--toast-accent` a component token with a fallback?**
So a toast variant is a single custom-property override rather than a new rule
for each part of the toast. The fallback means the base `.toast` is complete on
its own.

**How many `z-index` values does the finished stylesheet contain?**
Three, all named, none above 30 — because everything that would have driven
escalation is in the top layer instead.

**What does the checklist item about `display` and `overlay` catch?**
Overlays that appear instantly, or fade out behind the content they were
covering. Both are the same root cause: discrete properties are not transitioned
unless `allow-discrete` is given, and the element leaves the top layer at once
unless `overlay` is in the list.

---

← Prev: [Scroll lock and the header](04-scroll-lock-and-the-sticky-header.md) · Index: [The overlay layer](README.md) · Next → [Phase 7 index](../README.md)
