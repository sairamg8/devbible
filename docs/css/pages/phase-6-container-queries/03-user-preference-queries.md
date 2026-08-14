---
title: "User-preference queries"
sidebar_label: "03 · User-preference queries"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)**,
> [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme),
> [`prefers-contrast`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast) and
> [`forced-colors`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors),
> and the **W3C Media Queries Level 5** specification.

**These are the media queries that are requirements rather than polish.** A
breakpoint is a design choice; `prefers-reduced-motion` is an accessibility
obligation, and ignoring it can make a site unusable for someone with a
vestibular disorder.

## `prefers-reduced-motion`

The most important of the four.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

That blanket reset is a reasonable safety net, but it is a blunt instrument. The
better practice is **reduce or replace the motion, never delete the state
change**:

```css
.panel { transition: transform 300ms ease; transform: translateX(0); }
.panel[hidden] { transform: translateX(-100%); }

@media (prefers-reduced-motion: reduce) {
  .panel { transition: opacity 150ms ease; transform: none; }
  .panel[hidden] { opacity: 0; transform: none; }
}
```

The panel still communicates that it opened and closed — it fades instead of
sliding. **Removing the transition entirely is not the same as reducing motion**;
a state change with no transition at all can be more disorienting, not less,
because nothing signals that something changed.

What triggers it: the user's OS-level "reduce motion" setting. The problematic
motion is large-area movement, parallax, and anything simulating depth or
acceleration — not a colour fade or a small opacity change.

**Write animations reduced-motion-aware from the start.** Retrofitting means
auditing every keyframe in the codebase.

## `prefers-color-scheme`

```css
:root { color-scheme: light dark; }

@media (prefers-color-scheme: dark) {
  :root { --surface: #16181d; --text: #e8e8ea; }
}
```

Two things do the work here, and the first is often missed:

**`color-scheme: light dark`** tells the browser the page supports both, so
**native controls** — form fields, scrollbars, the default canvas — follow the
system theme. Without it, a dark page keeps white scrollbars and light form
controls, which looks broken and is the most common dark-mode complaint.

Modern colour handling can also avoid the query entirely:

```css
:root { --surface: light-dark(#ffffff, #16181d); }
```

`light-dark()` picks by the active colour scheme, which is shorter and keeps both
values adjacent. It is **newly available (2024-05-13)** rather than widely, so
check support before relying on it alone.

Whichever is used, an **explicit user override must beat the system preference** —
covered in Phase 8, and the reason a `data-theme` attribute usually sits above
the media query in the cascade.

## `prefers-contrast`

```css
@media (prefers-contrast: more) {
  :root { --border: #000; --text: #000; --muted: #333; }
}
```

Values are `more`, `less`, `custom` and `no-preference`. The usual response to
`more` is to strengthen borders and remove low-contrast greys — which is worth
doing because subtle grey-on-grey UI is precisely what fails for these users.

## `forced-colors`

Windows High Contrast Mode replaces your palette wholesale with the user's chosen
one. The query lets you repair what that breaks:

```css
@media (forced-colors: active) {
  .button { border: 1px solid ButtonText; }
  .icon   { forced-color-adjust: auto; }
}
```

Two rules worth knowing:

- **Do not fight it.** Re-specifying colours inside `forced-colors: active`
  defeats the point. Fix *structure* instead — most commonly, add borders to
  elements that were distinguished only by background colour, since backgrounds
  are overridden.
- **System colour keywords** (`ButtonText`, `Canvas`, `LinkText`, `Highlight`)
  are how you reference the user's palette rather than imposing your own.

## Testing them

All four are settable without changing OS preferences: Chrome and Edge DevTools
expose them under *Rendering → Emulate CSS media features*, and Firefox has the
same under its Inspector's accessibility panel. There is no excuse for shipping
these untested — but note that emulation does not always reproduce
`forced-colors` faithfully, so that one deserves a real check on Windows if it
matters.

## Trade-off

**Every preference query doubles a surface's states, and they multiply.** Dark
mode plus high contrast plus reduced motion is eight combinations, and nobody
tests eight. In practice teams verify light/dark and trust the rest, which means
the contrast and forced-colors paths quietly rot.

The mitigation is to make the preferences act on **tokens rather than on
components**: if dark mode and high contrast only change custom-property values
at `:root`, the component layer has one implementation and the combinations
collapse. A codebase where individual components carry
`@media (prefers-color-scheme: dark)` rules is one where this becomes unmanageable.

`prefers-reduced-motion` is the exception that cannot be tokenised, because it
changes behaviour rather than values — which is the argument for handling it once
per animation, at the point the animation is written.

## Gotchas

**Scrollbars and form controls stay light in dark mode.**
*Symptom:* native UI does not match the theme.
*Cause:* missing `color-scheme`.
*Fix:* `:root { color-scheme: light dark; }`.

**Reduced motion removes the feedback entirely.**
*Symptom:* users cannot tell that something changed.
*Cause:* transitions were deleted rather than replaced.
*Fix:* substitute a small opacity or colour transition; keep the state change
perceptible.

**High contrast mode breaks the interface.**
*Symptom:* buttons and cards become indistinguishable.
*Cause:* they were distinguished only by background colour, which forced colors
overrides.
*Fix:* add borders using system colour keywords inside
`@media (forced-colors: active)`.

**A user's explicit theme choice is ignored.**
*Symptom:* the system preference wins over the toggle.
*Cause:* the media query outranks the override in the cascade.
*Fix:* apply the override via an attribute selector that wins — and see
[Phase 2 · What the cascade compares](../phase-2-cascade/01-what-the-cascade-compares.md).

**The animation still runs with reduce enabled.**
*Symptom:* motion persists.
*Cause:* the animation is applied by JavaScript, or by an inline style the query
cannot reach.
*Fix:* check `matchMedia('(prefers-reduced-motion: reduce)')` in script too.

## Interview questions

**★ How should `prefers-reduced-motion` be implemented properly?**
Reduce or replace the motion, never delete the state change. Swap a large
transform for a short opacity or colour transition so the change is still
perceptible. Removing all transitions can be more disorienting, because nothing
signals that anything happened.

**★ What does `color-scheme` do that `prefers-color-scheme` does not?**
`color-scheme: light dark` tells the browser the page supports both schemes, so
**native** UI — form controls, scrollbars, the default canvas — follows the
system theme. The media query only changes your own declarations; without
`color-scheme` the native parts stay light and the page looks half-themed.

**★ What is `forced-colors` and how should you respond to it?**
Windows High Contrast Mode replacing the palette with the user's own. Do not
re-specify colours; fix structure — most often by adding borders to elements that
relied on background colour alone — using system colour keywords such as
`ButtonText` and `Canvas`.

**Which of these queries are accessibility requirements rather than preferences?**
`prefers-reduced-motion` most of all — large-area motion can trigger vestibular
symptoms. `prefers-contrast` and `forced-colors` are also accessibility features;
`prefers-color-scheme` is closer to a comfort preference.

**How do you keep the combinations manageable?**
Have preferences change **tokens** at `:root` rather than component rules, so the
component layer has one implementation. Otherwise dark × contrast × motion
produces eight combinations nobody tests.

**How do you test them?**
DevTools media-feature emulation in Chrome, Edge and Firefox. `forced-colors`
emulation is the least faithful and deserves a real check on Windows if it
matters.

---

← [02 · Layouts that need no query](./02-layouts-that-need-no-query.md) · Back to [Phase 6 overview](./README.md)
