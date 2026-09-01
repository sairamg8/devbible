---
title: "Consuming the theme in React, and the edges that outlive a click"
sidebar_label: "05b · React, motion and bfcache"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the React reference for
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
> and MDN —
> [`pageshow`](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event),
> [Back/forward cache](https://developer.mozilla.org/en-US/docs/Glossary/bfcache),
> [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion),
> [`transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition),
> [`aria-pressed`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-pressed).
> Concept homes: the storage hook is
> [chapter 4·05](../../phase-4-react-ui/05-uselocalstorage-and-cart.md); what is
> cheap to animate is
> [CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md).
> No sandbox, no measured timings.

**The plumbing in [chunk 05](05-persisting-and-syncing.md) makes changes
propagate. This chunk is about the components that read the result — and about
the two moments the plumbing does not cover: the frame the palette swaps, and a
page restored from cache that missed every event while it was frozen.**

## `useSyncExternalStore`, not `useState`

The theme lives in two external stores — `localStorage` and a `MediaQueryList` —
and React has a hook for exactly that shape:

```js
function subscribe(cb) {
  window.addEventListener('themechange', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('themechange', cb);
    window.removeEventListener('storage', cb);
  };
}

const getSnapshot = () =>
  document.documentElement.getAttribute('data-theme') ?? 'system';

const getServerSnapshot = () => 'system';

export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

**The snapshot is read from the DOM attribute, not from storage.** The attribute
is the *applied* truth — it was stamped before paint and it is what the cascade
actually matched — whereas storage is only where the preference is kept. Reading
storage here would also mean touching a throwing API during render, and would
report an explicit value in a tab whose attribute had not been applied yet.

`getServerSnapshot` returns `'system'` because the server cannot know the
choice, which is the neutral markup chunk
[03](03-the-flash-and-the-boot.md) requires. **Omitting it is not a style
choice** — a server-rendered tree calls it, and its absence throws during
hydration.

The obvious alternative — `useState` seeded from storage plus an effect — is
wrong in three separate ways: the seed runs during render on an API that can
throw, the effect lands after paint so the value is briefly wrong, and nothing
subscribes to the other tabs. `useSyncExternalStore` exists because this pattern
kept being written incorrectly.

### What the hook is, and is not, for

```jsx
function ThemeToggle() {
  const theme = useTheme();
  return (
    <button
      class="theme-toggle"
      aria-pressed={theme !== 'system'}
      aria-label={`Theme: ${theme}. Activate to change.`}
      onClick={() => applyTheme(nextTheme(theme))}
    >
      <span data-when="system">Auto</span>
      <span data-when="light">Light</span>
      <span data-when="dark">Dark</span>
    </button>
  );
}
```

**The visible label is still CSS's job** — all three spans are rendered and the
`data-theme` selectors from chunk 03 reveal one, so first paint is correct
before React has run. The hook drives the *click handler*, `aria-pressed` and
the accessible name: the parts that must be values rather than styling.

That division is the point. Anything the CSS can derive from `data-theme` should
be derived from `data-theme`, because the attribute is correct earlier than any
React state can be.

## Do not animate the theme change

The tempting `transition: background-color 200ms` on a broad selector makes
every element on the page animate at once on a swap — a full-page paint whose
cost lands hardest on exactly the long catalogue lists this app is built around,
for a transition nobody asked for. The cost model is
[CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md).

**This storefront animates nothing on a theme change.** There is a second reason
beyond cost: components already carry their own transitions for hover and focus,
and redefining their colours mid-flight makes those fire spuriously — every
button on screen appearing to be hovered at once.

That second problem needs solving whether or not a crossfade is wanted:

```css
:root.theme-swapping,
:root.theme-swapping * { transition: none !important; }
```

```js
function applyThemeWithoutTransitions(theme) {
  const root = document.documentElement;
  root.classList.add('theme-swapping');
  applyTheme(theme);
  // Force a style resolution so the class takes effect before it is removed.
  void root.offsetWidth;
  root.classList.remove('theme-swapping');
}
```

This is the **inverse** of the usual pattern, and it is deliberate: a class
added for one frame around the swap *suppresses* existing transitions rather
than adding one. It is one of the few honest uses of `!important` in this
stylesheet — it is a deliberate override of component rules, for one frame, and
nothing should be able to beat it.

Where a crossfade genuinely is wanted, it belongs to the root element alone and
is gated on motion preference:

```css
@media (prefers-reduced-motion: no-preference) {
  :root { transition: background-color 150ms linear, color 150ms linear; }
}
```

## Back/forward cache

A page restored from bfcache did not run its boot script and received no
`storage` events while frozen. If the theme changed in another tab meanwhile,
the restored page is stale — and this is one of the more common "it works
everywhere except on my phone" reports, because mobile browsers restore from
bfcache far more often.

```js
window.addEventListener('pageshow', (e) => {
  if (e.persisted) applyThemeFromStorage(readStoredTheme());
});
```

**Only on `e.persisted`.** A normal load already ran the boot script, and
repeating the work costs a redundant storage read on the hot path.

`applyThemeFromStorage` is the write-free path from chunk 05, for the same
reason it was needed there: re-writing the value on restore would fire `storage`
in every other tab and make a back-navigation look like a theme change.

## Gotchas

### Hydration throws on a server-rendered page
**Symptom.** An error naming `getServerSnapshot` the moment SSR is enabled.
**Cause.** The third argument was omitted because it was unnecessary in the SPA.
**Fix.** Supply it, returning the neutral `'system'`.

### The theme value is briefly wrong on mount
**Symptom.** A component that renders differently per theme flickers.
**Cause.** `useState` seeded in an effect, so the first render used the default.
**Fix.** `useSyncExternalStore`, whose snapshot is read synchronously from the
attribute the boot script already stamped.

### Every button looks hovered for a moment after toggling
**Symptom.** A wave of transitions across the page on each theme change.
**Cause.** Component hover and focus transitions firing because their colour
values changed underneath them.
**Fix.** The one-frame `theme-swapping` class that suppresses transitions during
the swap.

### The suppression class has no effect
**Symptom.** The class is added and removed, and the transitions still fire.
**Cause.** It was removed in the same task without forcing a style resolution,
so the browser never applied it.
**Fix.** Read a layout property between the add and the remove, as above.

### The whole page janks on every toggle
**Symptom.** A visible stutter, worst on long product lists.
**Cause.** A broad `transition: background-color`, so every element animates at
once.
**Fix.** Animate nothing. If a crossfade is required, confine it to the root and
gate it on `prefers-reduced-motion`.

### A returning tab shows the old theme
**Symptom.** Going back restores a page in the previous theme.
**Cause.** bfcache — the boot script did not re-run and `storage` events were
not delivered while the page was frozen.
**Fix.** Re-apply on `pageshow` when `e.persisted` is true.

### Navigating back makes other tabs change theme
**Symptom.** A back-navigation propagates as if someone had clicked the toggle.
**Cause.** The `pageshow` handler used the writing `applyTheme`.
**Fix.** The write-free path. Restoring is not choosing.

### The toggle label is out of sync after a cross-tab change
**Symptom.** The page themes but the button still says "Light".
**Cause.** The label was React state that only the click handler updated.
**Fix.** The label is rendered by CSS from `data-theme`, so it follows
automatically. The hook drives `aria-pressed` and the handler, not the text.

### The button announces nothing useful
**Symptom.** A screen reader reads "button" or reads all three labels.
**Cause.** Three spans are in the accessibility tree, and the hidden two are
hidden with `display: none` — correct — but no accessible name was supplied for
the control itself.
**Fix.** An `aria-label` naming the current state and what activation does,
driven by the hook.

## Interview questions

**Why `useSyncExternalStore` rather than `useState` plus an effect?**
The theme is external state living in `localStorage` and a `MediaQueryList`. The
hook subscribes and reads a snapshot synchronously without tearing, whereas the
`useState` version reads a throwing API during render, lands after paint, and
never hears about other tabs.

**Why is the snapshot read from the DOM attribute rather than from storage?**
The attribute is the applied truth that the cascade matched; storage is only
where the preference is kept. Reading storage during render would also touch an
API that can throw, and would report a value that had not been applied yet.

**What does `getServerSnapshot` return here, and what happens without it?**
`'system'` — the neutral state, because the server cannot know the choice.
Omitting it throws during hydration on a server-rendered tree.

**Why does the toggle's visible label come from CSS rather than the hook?**
Because `data-theme` is correct before any JavaScript runs, so a CSS-derived
label is right at first paint and cannot mismatch during hydration. The hook
supplies only what must be a value: the handler, `aria-pressed`, and the
accessible name.

**Why does this storefront not animate the theme swap?**
Because a transition on background colour applies to every element at once — a
full-page paint whose cost lands hardest on the long catalogue lists this app is
built around, for an effect nobody requested.

**What is the `theme-swapping` class for, given nothing is animated?**
To suppress *existing* component transitions for the one frame the palette
changes, so hover and focus transitions do not fire spuriously as their colours
are redefined. It is the inverse of the usual add-a-transition pattern.

**Why does the class need a forced style resolution?**
Because it is added and removed within one task. Without reading a layout
property in between, the browser never resolves style with the class present and
the suppression does nothing.

**Why is `pageshow` needed when a boot script already exists?**
A bfcache restore does not re-run the boot script, and the frozen page received
no `storage` events. Only the `persisted` case needs the re-apply — a normal
load has already done the work.

**Why must the `pageshow` handler use the write-free path?**
Because writing would fire `storage` in every other tab, making a back
navigation look like a deliberate theme change. Restoring is not choosing.

---

← Prev: [Persisting and syncing](05-persisting-and-syncing.md) · Index: [Dark mode](README.md) · Next → [The complete stylesheet](06-the-complete-stylesheet.md)
