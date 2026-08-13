---
title: "Vendor prefixes in 2026"
sidebar_label: "11 · Vendor prefixes"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex07-at-rules-and-prefixes.mjs`.

**Vendor prefixes are mostly history, and the exceptions are not the ones you
would guess.** You need to recognise them in old code, delete them confidently,
and know the handful that are still load-bearing.

## What they were for

`-webkit-`, `-moz-`, `-ms-`, `-o-`: a browser shipping an experimental
implementation under its own name so the unprefixed property stayed free for the
final specification. The theory was that authors would remove the prefixes once
the standard landed.

It failed. Authors shipped `-webkit-` only, mobile sites broke in non-WebKit
browsers, and the ecosystem calcified around prefixes that were supposed to be
temporary. **Browsers now ship new features behind flags rather than prefixes,**
which is why nothing invented in the last several years has one.

## What is actually true today

```console
$ node ex07-at-rules-and-prefixes.mjs
engine: Firefox/153.0

=== Vendor prefixes — what is still real ===
  line-clamp                false
  -webkit-line-clamp        true
  backdrop-filter           true
  -webkit-backdrop-filter   false
  user-select               true
  -webkit-user-select       true
  box-shadow                true
  -webkit-box-shadow        true
  border-radius             true
  -moz-border-radius        false
  appearance                true
  -webkit-appearance        true
  text-size-adjust          false
  -webkit-text-size-adjust  false
```

Four findings, none of them obvious:

1. **`-webkit-line-clamp` is still required.** The unprefixed `line-clamp` is
   `false` in Firefox 153, the prefixed one is `true`. This is the one prefix
   you still write by hand, and `web-features` reports the whole `line-clamp`
   feature as Limited availability.
2. **`-moz-border-radius` is `false`.** Mozilla removed its *own* prefix.
   Prefixes are not permanently supported — deleting them is not risk-free in
   the direction people assume, and keeping them is not free either.
3. **Firefox implements `-webkit-` properties on purpose** — `-webkit-user-select`,
   `-webkit-box-shadow` and `-webkit-appearance` all return `true`. Sites shipped
   WebKit-only CSS for years, so refusing them broke real pages. **A `-webkit-`
   prefix is therefore not a Safari/Chrome detector.**
4. **`-webkit-backdrop-filter` is `false` while `backdrop-filter` is `true`.**
   The prefix is a Safari concern, not a universal one — so it is worth writing
   for that engine, and it does nothing here.

## What to do about it

**In new code:** write unprefixed properties. Add a prefix only when a specific,
checkable feature needs it — in practice `-webkit-line-clamp`, and
`-webkit-backdrop-filter` for Safari.

**In old code:** prefixed declarations for `border-radius`, `box-shadow`,
`transition`, `transform`, `flexbox` (`-webkit-box`, `-ms-flexbox`) and
`gradient` are dead weight. Deleting them is safe and shrinks the stylesheet.

**In the build:** let a tool decide. Autoprefixer (via PostCSS) or Lightning CSS
reads your browser support target and adds exactly the prefixes that target
needs:

```js
// browserslist in package.json — the single source of truth for the tool
"browserslist": ["> 0.5%", "last 2 versions", "not dead"]
```

The trade-off: a tool means you stop thinking about prefixes, which is the
point, but it also means the output depends on a config that drifts. Check what
your browserslist actually resolves to occasionally — `npx browserslist` prints
it.

## The related legacy: `-webkit-` pseudo-elements

Prefixed *pseudo-elements* are a separate story and several are still the only
way to do the job:

| Prefixed | Standard | Status |
|---|---|---|
| `::-webkit-scrollbar` | `scrollbar-width` / `scrollbar-color` | standard version is Baseline; the prefixed one still gives finer control in WebKit |
| `::-webkit-input-placeholder` | `::placeholder` | use the standard one |
| `::-webkit-slider-thumb` | — | still no standard; required for range inputs |
| `::-moz-focus-inner` | — | Firefox-only, for removing an inner focus border |

## Gotchas

**Symptom:** multi-line truncation does nothing.
**Cause:** you wrote `line-clamp`, which is not implemented — measured `false` in
Firefox 153.
**Fix:** the full incantation is still `display: -webkit-box;
-webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;`.

**Symptom:** a frosted-glass panel works in Chrome and Firefox but not Safari.
**Cause:** Safari needs `-webkit-backdrop-filter` alongside the standard
property.
**Fix:** write both. Measured, the prefixed one is `false` in Firefox, so it
costs nothing there.

**Symptom:** you used a `-webkit-` prefix to target Chrome/Safari specifically
and the rule applied in Firefox too.
**Cause:** Firefox implements several `-webkit-` properties for web
compatibility.
**Fix:** never use a prefix as a browser detector. Use `@supports`, and if you
genuinely need engine-specific styling, question the requirement.

**Symptom:** deleting old prefixes broke an old browser you still support.
**Cause:** possible but rare — and the reverse also happens, since
`-moz-border-radius` is no longer supported by Firefox.
**Fix:** decide support from browserslist and let autoprefixer generate them,
rather than maintaining prefixes by hand in either direction.

## Interview questions

**★ Do you still need vendor prefixes in 2026?**
Almost never. Modern features ship behind flags instead. The real exceptions are
`-webkit-line-clamp` — measured, the unprefixed `line-clamp` is still `false` in
Firefox 153 — and `-webkit-backdrop-filter` for Safari. Everything else
(`border-radius`, `box-shadow`, `transform`, `transition`, flexbox) is dead
weight in modern stylesheets.

**★ Why did vendor prefixes fail as a strategy?**
Authors shipped one vendor's prefix and never removed it, so sites depended on
`-webkit-` behaviour and broke elsewhere. Browsers then had to implement each
other's prefixes for web compatibility — Firefox supports `-webkit-user-select`
and `-webkit-appearance` today — which destroyed the entire point. Feature flags
during development replaced them.

**Can you use a `-webkit-` prefix to target Chrome and Safari?**
No. Firefox implements several `-webkit-` properties deliberately, so the rule
will apply there too. Use `@supports` for capability-based branching.

**How should prefixes be managed in a project?**
By build tooling — autoprefixer or Lightning CSS driven by a browserslist
config — so the prefixes present always match the declared support target
instead of drifting by hand.

**Is it safe to delete old prefixed declarations?**
Generally yes for long-standardised properties, and keeping them is not risk-free
either: `-moz-border-radius` returns `false` in Firefox 153, so Mozilla dropped
its own prefix. Let the tool regenerate whatever your target actually needs.

---

← [10 · Baseline](./10-baseline-and-shipping.md) · Next: [12 · DevTools for CSS](./12-devtools-for-css.md) →
