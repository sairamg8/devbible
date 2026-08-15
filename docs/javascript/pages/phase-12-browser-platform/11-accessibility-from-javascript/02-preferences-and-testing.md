---
title: "02 · User preferences, and checking your work"
sidebar_label: "02 · Preferences and testing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme), [`prefers-contrast`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast), [`forced-colors`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors), [`Window.matchMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia), [`Element.animate()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [`Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView), [`:focus-visible`](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible). Documentation-validated; **no timings and no console output**.

The operating system already knows a great deal about how this user needs the web to behave. The
browser exposes it as media queries, and `matchMedia` makes them readable — and, crucially,
**watchable** — from JavaScript.

## The four preferences worth reading

| Query | Means | What to change |
|---|---|---|
| `(prefers-reduced-motion: reduce)` | motion causes discomfort or harm | no transforms flying across the screen, no parallax, no auto-carousel; cross-fade or cut instead |
| `(prefers-color-scheme: dark)` | the OS is in dark mode | the default theme, before the user picks |
| `(prefers-contrast: more)` | more contrast is needed | stronger borders and text colours, fewer subtle greys |
| `(forced-colors: active)` | a forced-colours mode (e.g. Windows High Contrast) | stop overriding colours; let the system win |

```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

reduce.addEventListener('change', apply);   // 🔴 it can change while the page is open
apply();

function apply() {
  document.documentElement.classList.toggle('reduce-motion', reduce.matches);
}
```

🔴 **Read it *and* listen for changes.** A one-time check at startup is the common bug — users
toggle these settings mid-session, precisely when something on the page has caused a problem.

## `prefers-reduced-motion` in scripted animation

CSS respects the media query on its own if you write it. **JavaScript animation does not** —
`Element.animate()` and any `requestAnimationFrame` loop run whatever you told them to:

```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

el.animate(
  reduce
    ? [{ opacity: 0 }, { opacity: 1 }]                               // a fade is fine
    : [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  { duration: reduce ? 1 : 300, easing: 'ease-out' },
);
```

**"Reduced" does not mean "none".** The intent is to remove large, unexpected or repeated motion —
not to strip every cue. A fade or an instant state change still tells the user something happened;
a 400 ms slide across the viewport is what causes the harm.

⚠️ **Smooth scrolling counts as motion.** Both of these need the check:

```js
const behavior = reduce ? 'auto' : 'smooth';
window.scrollTo({ top: 0, behavior });
el.scrollIntoView({ behavior, block: 'start' });
```

That includes the scroll in a router's `afterNavigate`
([08 · 02](../08-history-and-routing/02-building-a-router.md)) and any "scroll to error" helper.

## Theming without a flash

```html
<script>
  // inline, in <head>, before any stylesheet paints
  const stored = localStorage.getItem('theme');
  const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
</script>
```

🔴 **This is the one place a small blocking inline script is correct.** Anything deferred runs
after first paint, so the user sees a white flash before dark mode applies. The script does one
thing: set an attribute the CSS is already written against.

Three rules that follow:

- **The system preference is the default, not the decision.** An explicit user choice must win and
  must persist.
- **Tell the browser too:** the CSS `color-scheme` property makes form controls, scrollbars and
  the canvas background match — without it, dark mode has white select boxes.
- **Keep listening.** `matchMedia('(prefers-color-scheme: dark)')` fires `change` when the OS
  switches, and a user with no stored preference should follow it.

## `forced-colors`: stop fighting the user

In a forced-colours mode the browser replaces your palette with the system one. **The correct
response is to get out of the way**: do not reapply colours from JavaScript, do not rely on
colour alone to convey state, and check that icons drawn with `background-image` do not disappear
(`forced-color-adjust` and a `<svg>` with `currentColor` survive; a background image may not).

**Anything conveyed only by colour fails here as well as for colour-blind users** — pair colour
with a shape, an icon or text.

## Other signals a script should respect

| Signal | Respect it by |
|---|---|
| The user's font size | never sizing text or containers in fixed `px` from JS; measure, do not assume |
| `navigator.languages` | formatting dates and numbers with `Intl`, not a hand-rolled table |
| `saveData` | skipping prefetch and heavy media ([09 · 02](../09-window-document-navigator/02-navigator-and-screen.md)) |
| `:focus-visible` | styling it rather than removing the outline |

## Checking your work

**The three passes, in increasing cost and increasing value:**

1. **Keyboard only.** Unplug the mouse. Can you reach everything, in a sensible order, and see
   where you are? Can you leave every widget you entered? This finds most of what
   [01 · The four moments](./01-the-four-moments.md) is about, in a few minutes.
2. **The accessibility tree in DevTools.** It shows what assistive technology actually sees — the
   computed name, role and state of each node. A button whose accessible name is "" is a button
   nobody can ask for by voice ([01 · DevTools · The panels](../01-devtools/02-the-panels.md)).
3. **A screen reader.** VoiceOver, NVDA or Narrator, on the flow you changed. Nothing else tells
   you whether an announcement makes sense; a live region can fire correctly and still say
   something useless.

**Automated tooling belongs in CI and does not replace any of the above.** `axe`, Lighthouse and
`eslint-plugin-jsx-a11y` catch missing names, bad contrast, invalid ARIA and unlabelled inputs —
the mechanical failures. **They cannot judge whether the focus went somewhere sensible, whether
an announcement is comprehensible, or whether a keyboard user can escape a widget.** A clean
automated report is a floor, not a pass.

⚠️ **Test with JavaScript slow, not only fast.** A user on a slow connection meets the loading
state you never look at — which is why an announced loading state matters more than an animated
one.

## Gotchas

**Symptom: a reduced-motion user still gets the slide animation.**
Cause — the animation is in `Element.animate` or a `rAF` loop; the media query only governs CSS
you wrote against it.
Fix — branch on `matchMedia(...).matches` when building the keyframes and duration.

**Symptom: `scrollIntoView` still animates.**
Cause — `behavior: 'smooth'` is unconditional.
Fix — pick `'auto'` when reduced motion is set.

**Symptom: dark mode flashes white on load.**
Cause — the theme is applied by a deferred script or after hydration.
Fix — a tiny inline script in `<head>` that sets the attribute; and set CSS `color-scheme`.

**Symptom: the theme stops following the OS after the user toggles it once.**
Cause — a stored value that is never cleared.
Fix — store an explicit choice, offer "system", and keep the `change` listener for that case.

**Symptom: form controls stay light in dark mode.**
Cause — no `color-scheme` declaration.
Fix — set it on `:root`; it governs UA-rendered widgets.

**Symptom: icons vanish in Windows High Contrast.**
Cause — they were background images, which forced colours does not repaint.
Fix — inline SVG using `currentColor`.

**Symptom: the automated audit is green but users report problems.**
Cause — automated checks cover mechanical failures only.
Fix — the keyboard pass and a screen-reader pass on the changed flow.

## Interview questions

**★ How do you respect `prefers-reduced-motion` in JavaScript animation?**
Read it with `matchMedia`, listen for `change`, and build different keyframes and durations —
a fade or an instant change instead of large motion. CSS honours the query only where you wrote
it; `Element.animate` and `rAF` honour nothing by default.

**★ Does reduced motion mean removing all animation?**
No. It means removing large, repeated or unexpected motion. A short fade still communicates that
something changed, which the user needs.

**★ Why is theme selection an inline blocking script?**
Because anything deferred runs after first paint, so the user sees a flash of the wrong theme. The
script does one cheap thing — set an attribute the stylesheet already targets — and the CSS
`color-scheme` property makes UA-rendered controls match.

**★ What should JavaScript do when `forced-colors` is active?**
Stop applying colour. The system palette wins by design; reapplying your own from script is
fighting an accessibility feature. Also check that anything drawn as a background image still
appears.

**★ How much of accessibility can be tested automatically?**
The mechanical part — missing accessible names, invalid ARIA, contrast, unlabelled inputs. Not
whether focus landed somewhere sensible, whether an announcement is meaningful, or whether a
keyboard user can leave a widget. Automated checks are a CI floor; the keyboard and screen-reader
passes are the actual test.

**What is the fastest useful check?**
Unplug the mouse and use the feature. Order, visibility of focus, and being able to escape every
widget — most of the failures in this topic surface within a minute.

---

← [01 · The four moments](./01-the-four-moments.md) · [Topic index](./README.md)
