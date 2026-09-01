---
title: "Persisting the choice, and keeping every surface in step"
sidebar_label: "05 · Persisting and syncing"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [the `storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event),
> [`Window.matchMedia`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia),
> [`MediaQueryList`](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList),
> [`theme-color`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/theme-color),
> [`pageshow`](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event),
> [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) —
> and the React reference for
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).
> Concept homes: the storage hook is
> [chapter 4·05](../../phase-4-react-ui/05-uselocalstorage-and-cart.md);
> motion cost is
> [CSS 9·01](../../../../css/pages/phase-9-motion/01-what-is-cheap-to-animate.md).
> No sandbox, no measured timings.

**Once the attribute is stamped and the tokens resolve, three things can still
fall out of step: the other tabs, the operating system, and everything that
copied a colour out of CSS.** Each has a different mechanism and the common
mistake is to solve all three with one — usually a React effect that re-applies
the theme on every render, which fixes none of them and pins the system state
along the way.

The rule that keeps this small: **CSS handles the OS by itself.** Every listener
in this chunk exists to notify *JavaScript consumers*, never to re-apply styles.

## The toggle cycles three states

```js
const ORDER = ['system', 'light', 'dark'];

function nextTheme(current) {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    root.style.removeProperty('color-scheme');
    try { localStorage.removeItem('theme'); } catch (e) {}
  } else {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  syncThemeColorMeta();
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
```

**`removeAttribute` and `removeItem` are what "system" means.** Storing the
string `"system"` and stamping `data-theme="system"` would match neither the
media block's guard nor the explicit selectors from chapter
[01](01-three-states-not-two.md), so the page would fall to the light palette on
a dark system — the third state broken in the one place it exists.

The `try`/`catch` is here for the same reason as in
[chunk 03](03-the-flash-and-the-boot.md): storage access can throw. The
difference is that here the failure is worth surviving loudly — the theme still
applies for this page view, it just will not persist.

**One custom event is dispatched, and it is the only thing JavaScript consumers
subscribe to.** Both listeners below funnel into it, so the chart in
[chunk 04b](04b-controls-the-browser-draws.md) subscribes once and does not care
whether the change came from a click, another tab, or the OS.

## Other tabs — the `storage` event

```js
window.addEventListener('storage', (e) => {
  if (e.key !== 'theme' && e.key !== null) return;
  const t = e.newValue;                       // null when removeItem was called
  applyThemeFromStorage(t === 'light' || t === 'dark' ? t : 'system');
});
```

The `storage` event fires on **other** documents of the same origin — not on the
one that made the change. That is exactly the semantics wanted: the tab that
clicked has already applied the theme synchronously, and every other tab hears
about it.

Two details that cause bugs:

- **`e.newValue` is `null` for a removal**, which is the system state. Treating
  `null` as "no change" leaves other tabs pinned to the old explicit theme after
  someone selects Auto.
- **`e.key` is `null` when storage is cleared wholesale.** The guard above lets
  that through deliberately, because a clear does remove the theme.

`applyThemeFromStorage` is `applyTheme` **without the write** — re-writing
storage from a storage handler is how two tabs ping-pong.

## The operating system — and why CSS already handles it

A visitor in the system state needs no listener at all. `prefers-color-scheme`
re-evaluates live, the media block has no attribute to fight, and the page
re-themes with zero JavaScript. **This is the whole payoff for storing the
system state as an absence** — and it is why a well-meaning effect that stamps
`data-theme` on mount is a real bug rather than a redundancy: it converts every
system-state visitor into a pinned one.

A listener is still wanted, but only to notify consumers:

```js
const mq = window.matchMedia('(prefers-color-scheme: dark)');
mq.addEventListener('change', () => {
  if (document.documentElement.hasAttribute('data-theme')) return;  // explicit: OS is irrelevant
  syncThemeColorMeta();
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'system' } }));
});
```

No styles are applied in that handler. It exists so the canvas chart redraws and
the `theme-color` meta updates — nothing more.

## The mobile browser chrome

```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16181d" media="(prefers-color-scheme: dark)">
```

The `media` attribute makes these follow the **system**, which is the same trap
as the `<picture>` logo in [chunk 04](04-images-media-and-controls.md): a
visitor who overrode their system gets browser chrome that disagrees with the
page. The declarative version is the correct default; the override needs
JavaScript:

```js
function syncThemeColorMeta() {
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface').trim();
  document.querySelector('meta[name="theme-color"]:not([media])')
    ?.setAttribute('content', bg);
}
```

Reading the resolved `--surface` rather than a hard-coded hex is what keeps the
chrome correct when the palette changes — one source of truth, as with the
charts.

## Gotchas

### Selecting "Auto" does nothing in other tabs
**Symptom.** Tab A returns to system; tab B stays dark.
**Cause.** The `storage` handler ignored `newValue === null`, which is what a
removal reports.
**Fix.** Treat `null` as the system state, and let `e.key === null` — a
wholesale `clear()` — through as well.

### Two tabs flip back and forth
**Symptom.** An oscillation after a single click.
**Cause.** The `storage` handler called the full `applyTheme`, which writes to
storage, which fires `storage` in the first tab, and so on.
**Fix.** A write-free path for inbound changes. The rule generalises: **a
handler for an external change must not re-emit that change.**

### The system state stops following the OS
**Symptom.** The phone flips at sunrise; the page does not.
**Cause.** A React effect stamps `data-theme` on mount "to keep state in sync",
converting the absence into an explicit value.
**Fix.** Never stamp the attribute for the system state. CSS tracks the OS with
no JavaScript at all; the absence of the attribute *is* the mechanism.

### The chart redraws on OS changes but not on clicks
**Symptom.** Half the paths work.
**Cause.** The consumer subscribed to `matchMedia` directly instead of to the
one `themechange` event.
**Fix.** Both sources dispatch the same event; consumers subscribe once and stay
ignorant of where a change came from.

### Mobile browser chrome disagrees with the page
**Symptom.** A dark page under a white address bar, for some users only.
**Cause.** `<meta name="theme-color" media="…">` follows the system, not the
`data-theme` override — the same class of bug as the `<picture>` logo in
[chunk 04](04-images-media-and-controls.md).
**Fix.** Keep the declarative pair as the default and update an unmediated
`theme-color` meta from the resolved `--surface`.

### The address bar colour drifts from the page
**Symptom.** They match at launch and diverge after a palette tweak.
**Cause.** The meta was updated with a hard-coded hex rather than read from the
token layer.
**Fix.** Read the resolved `--surface`. One source of truth, as with the chart
series.

### The theme is applied during a React render
**Symptom.** Warnings about mutating the DOM during render, and occasional
double application under Strict Mode.
**Cause.** `applyTheme` called from a component body rather than from an event
handler.
**Fix.** It is an event handler's job. The only code that touches the attribute
outside a handler is the boot script in
[chunk 03](03-the-flash-and-the-boot.md).

## Interview questions

**Why does the system state remove the attribute instead of storing `"system"`?**
Because the CSS selectors key on the attribute's absence. A stored `"system"`
string stamped onto `data-theme` matches neither the media block's guard nor the
explicit selectors, so a dark-system visitor falls back to light. The absence is
also what lets CSS track live OS changes with no listener.

**Where does the `storage` event fire, and why is that the right semantics?**
In every same-origin document *except* the one that made the change. The
originating tab has already applied the theme synchronously, so the event is
exactly the cross-tab notification wanted, with no echo to suppress.

**What does `e.newValue === null` mean and why does it matter?**
The key was removed — the user selected Auto. Treating it as "no change" leaves
every other tab pinned to the previous explicit theme.

**When is `e.key` null, and should the handler act on it?**
On a wholesale `clear()`. It should act: clearing storage does remove the theme,
so the correct response is to fall back to the system state.

**If CSS already re-themes on an OS change, why listen to `matchMedia` at all?**
To notify JavaScript consumers — the canvas chart and the `theme-color` meta —
that copied values out of CSS. The handler applies no styles, and it returns
early when an explicit theme is set, because the OS is then irrelevant.

**Why funnel three different sources into one custom event?**
So consumers subscribe once and do not have to know whether a change came from a
click, another tab, or the operating system. Subscribing to `matchMedia`
directly is how a consumer ends up handling one path and missing two.

**Why must the inbound `storage` handler not write to storage?**
Because the write fires `storage` in the tab that originally changed it, which
writes again. A handler for an external change must not re-emit that change.

---

← Prev: [Controls and canvas](04b-controls-the-browser-draws.md) · Index: [Dark mode](README.md) · Next → [Consuming the theme in React](05b-consuming-the-theme-in-react.md)
