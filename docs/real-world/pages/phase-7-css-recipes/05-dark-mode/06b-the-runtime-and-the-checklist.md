---
title: "The runtime, and the checklist that closes the chapter"
sidebar_label: "06b · The runtime and the checklist"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — assembles only what the preceding chunks established
> against MDN and the W3C CSS Color Adjustment and Properties-and-Values
> specifications; each chunk carries its own sources. Layer order is fixed by
> the [phase index](../README.md). No sandbox, no measured timings.

**The token layer from [chunk 06](06-the-complete-stylesheet.md) is inert on its
own.** Two artifacts make it a working theme: the rules that consume the tokens
— including the four surfaces `color-scheme` does not reach — and the module
that changes them. Both are given whole here, followed by the checklist that
catches every failure mode this chapter documented.


## 3 · `src/styles/base.css` — what depends on the tokens

```css
@layer base {
  :root {
    accent-color: var(--accent);
    scrollbar-color: var(--border-strong) transparent;
  }

  body { background: var(--surface); color: var(--text); }

  ::selection   { background: var(--accent); color: var(--accent-contrast); }
  ::placeholder { color: var(--text-muted); opacity: 1; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  input, textarea, select { caret-color: var(--text); }

  /* Autofill remediation — non-standard, must degrade legibly (chunk 04b) */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 100px var(--surface-raised) inset;
    -webkit-text-fill-color: var(--text);
    caret-color: var(--text);
  }

  /* One frame of suppression around a swap (chunk 05b) */
  :root.theme-swapping,
  :root.theme-swapping * { transition: none !important; }
}

@layer components {
  .product-tile__media {
    background: var(--media-plate);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
  .product-tile__media--cutout { background: transparent; padding: 0; border: 0; }

  .review__photo {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
  }

  .brand {
    width: 8rem; aspect-ratio: 4 / 1;
    background: var(--logo) center / contain no-repeat;
  }

  .btn-primary        { background: var(--accent); color: var(--accent-contrast); }
  .btn-primary:hover  { background: color-mix(in oklab, var(--accent) 88%, var(--surface)); }
  .btn-primary:active { background: color-mix(in oklab, var(--accent) 78%, var(--surface)); }

  /* The toggle's label is chosen by CSS, so it is right at first paint */
  .theme-toggle [data-when] { display: none; }
  :root:not([data-theme])   .theme-toggle [data-when="system"] { display: inline; }
  :root[data-theme="light"] .theme-toggle [data-when="light"]  { display: inline; }
  :root[data-theme="dark"]  .theme-toggle [data-when="dark"]   { display: inline; }
}

@media (forced-colors: active) {
  .product-tile__media { border: 1px solid CanvasText; }
  .status-badge        { forced-color-adjust: none; }
}
```

## 4 · `src/theme.js`

```js
const ORDER = ['system', 'light', 'dark'];
export const nextTheme = (c) => ORDER[(ORDER.indexOf(c) + 1) % ORDER.length];

const readStored = () => {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch { return 'system'; }
};

function paint(theme) {
  const root = document.documentElement;
  root.classList.add('theme-swapping');
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    root.style.removeProperty('color-scheme');
  } else {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }
  void root.offsetWidth;                 // resolve style with the class present
  root.classList.remove('theme-swapping');

  const bg = getComputedStyle(root).getPropertyValue('--surface').trim();
  document.querySelector('meta[name="theme-color"]:not([media])')
    ?.setAttribute('content', bg);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

/** User chose. Writes. */
export function applyTheme(theme) {
  paint(theme);
  try {
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
  } catch {}
}

/** Something else changed it. NEVER writes — that is what ping-pongs. */
const applyThemeFromStorage = (theme) => paint(theme);

window.addEventListener('storage', (e) => {
  if (e.key !== 'theme' && e.key !== null) return;
  const t = e.newValue;
  applyThemeFromStorage(t === 'light' || t === 'dark' ? t : 'system');
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (document.documentElement.hasAttribute('data-theme')) return;
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'system' } }));
});

window.addEventListener('pageshow', (e) => {
  if (e.persisted) applyThemeFromStorage(readStored());
});
```

## The review checklist

- [ ] Every token in blocks 2 and 3 also exists in block 1 — the property lists match.
- [ ] No component rule names a primitive or a literal colour.
- [ ] Every `color-mix()` target is a themed token, never `white` or `black`.
- [ ] Contrast checked in **both** themes: 4.5:1 text, 3:1 non-text and large text.
- [ ] The six status colours are distinguishable **from each other**, and each carries a text label.
- [ ] `::placeholder` sets `opacity: 1` alongside its colour.
- [ ] `--media-plate` is light in both themes, with the comment saying why.
- [ ] The logo is a token, not a `<picture>`.
- [ ] The boot script is a classic inline script in `<head>`, and its CSP hash is generated by the build.
- [ ] Nothing writes to storage from an inbound-change handler.
- [ ] Nothing stamps `data-theme` for the system state.
- [ ] The autofill block degrades to something legible if it stops applying.
- [ ] The toggle's visible label comes from CSS, not from React state.
- [ ] `getServerSnapshot` is supplied if the app is ever server-rendered.

## Gotchas

### Two tabs oscillate after one click
**Symptom.** The theme flips back and forth across open tabs.
**Cause.** The `storage` handler called the writing `applyTheme`, whose write
fires `storage` in the originating tab.
**Fix.** `applyThemeFromStorage` — the same paint, no write. That is the only
difference between the two exported functions, and it is the reason both exist.

### The address bar colour drifts from the page
**Symptom.** They match at launch and diverge after a palette tweak.
**Cause.** `paint()` was changed to map a theme name to a hard-coded hex.
**Fix.** Read the resolved `--surface`. One source of truth, as with the chart
series.

### The transition suppression does nothing
**Symptom.** The class is added and removed, and component transitions still
fire on a swap.
**Cause.** Both happened in one task with no style resolution in between, so the
browser never applied the class.
**Fix.** `void root.offsetWidth` between the add and the remove.

### The system state is pinned after the first toggle
**Symptom.** Cycling back to Auto leaves the page following the last explicit
theme.
**Cause.** `paint()` set the attribute for `'system'`, or `removeProperty` was
not called on the inline `color-scheme`.
**Fix.** Both must be removed. The inline style outlives the attribute and will
keep UA chrome on the old scheme by itself.

### A back navigation propagates like a click
**Symptom.** Returning to a page changes the theme in other tabs.
**Cause.** The `pageshow` handler used the writing path.
**Fix.** Restoring is not choosing — use the write-free path.

### The autofill block was escalated with `!important`
**Symptom.** Nothing, until a browser update drops the prefixed selectors and
the fields become unreadable.
**Cause.** Treating a non-standard remediation as a guarantee.
**Fix.** Make the un-remediated field legible, and leave the block beatable.

### `forced-colors` rules were written as a third theme
**Symptom.** High-contrast users get the brand palette back.
**Cause.** `forced-color-adjust: none` applied broadly to "keep the design".
**Fix.** The forced-colors block redraws lost boundaries and nothing else.
Opting out is defensible only where colour carries data *and* the element is not
relying on colour alone.

## Interview questions

**Why do `applyTheme` and `applyThemeFromStorage` both exist when they paint
identically?**
They differ only in whether they write. Writing from an inbound-change handler
fires `storage` in the tab that originated the change, and the two tabs
oscillate. The shared `paint()` keeps them from diverging in any other way.

**Why does `paint()` read `--surface` instead of using the theme name?**
So the browser-chrome colour has one source of truth. Mapping a theme name to a
hard-coded hex is exactly how the address bar drifts from the page after a
palette change.

**Why does returning to the system state remove an inline style as well as the
attribute?**
Because the boot script and `paint()` both set `documentElement.style
.colorScheme` to beat the `color-scheme` meta immediately. An inline style
outlives the attribute, so leaving it behind keeps UA chrome — scrollbars, form
controls — on the abandoned scheme.

**Why is `accent-color` set in `base` rather than on each control?**
It inherits. One declaration on `:root` themes every checkbox, radio and range
in the app without opting any of them out of native rendering.

**What is `void root.offsetWidth` doing, and why is it not a hack?**
Forcing a style and layout resolution so the suppression class is actually
applied before it is removed in the same task. It is load-bearing: without it
the class has no effect at all.

**Why does the checklist ask whether the toggle's label comes from CSS?**
Because a label derived from React state is wrong at first paint and mismatches
during hydration, while `data-theme` is correct before any JavaScript runs. It
is the one item on the list that catches a bug users see on every load.

**What is the single check that catches the most failure modes?**
That blocks 1, 2 and 3 carry identical property lists. It catches the
themed-in-dark-only token, the token that silently falls back to inherited, and
drift between the two dark blocks — which is why it is the first line of the
checklist.

---

← Prev: [The complete theme layer](06-the-complete-stylesheet.md) · Index: [Dark mode](README.md) · Next → **The overlay layer** *(not written yet)*
