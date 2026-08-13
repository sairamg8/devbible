---
title: "DevTools for CSS"
sidebar_label: "12 · DevTools for CSS"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex08-what-devtools-shows.mjs`.

**Because CSS reports nothing, DevTools is not optional tooling — it is the
error console the language does not have.** The habit that separates fast
debugging from slow: inspect first, edit second.

## What the Styles pane is actually showing

The panel is a rendering of one question — *which rules match this element, and
which declarations lost?* That is answerable from the CSSOM, which means you can
reproduce it and see the mechanism:

```css
p                    { color: black; margin: 1em 0; }
.note                { color: blue; padding: 4px; }
#lead                { color: green; }
.note                { color: rebeccapurple; }
article p.note       { font-weight: 700; }
:where(.note)        { letter-spacing: 1px; }
```

```html
<article><p id="lead" class="note" style="text-indent: 2px">text</p></article>
```

```console
$ node ex08-what-devtools-shows.mjs
=== Every rule that matches #lead, in source order ===
  p                  spec 0,0,1   color: black          sets: color margin-top …
  .note              spec 0,1,0   color: blue           sets: color padding-top …
  #lead              spec 1,0,0   color: green          sets: color
  .note              spec 0,1,0   color: rebeccapurple  sets: color
  article p.note     spec 0,1,2   color: —              sets: font-weight
  :where(.note)      spec 0,0,0   color: —              sets: letter-spacing

=== What actually won ===
  color          rgb(0, 128, 0)
  fontWeight     700
  letterSpacing  1px
  textIndent     2px
  padding        4px
```

**Four rules set `color` and green won** — from `#lead`, at specificity
`1,0,0` — even though `.note { color: rebeccapurple }` comes *later* in the
file. In the Styles pane the three losing `color` declarations appear
**struck through**, in the order they were beaten. Reading that strike-through
is the single most useful skill in the panel: it tells you the rule matched and
lost, which is a completely different problem from a rule that never matched.

Note also `:where(.note)` at specificity `0,0,0` — its `letter-spacing`
applied because nothing else set `letter-spacing` at all. Zero specificity does
not mean no effect; it means anything else wins.

And `text-indent: 2px` came from the inline attribute, which is why DevTools puts
it in its own `element.style` block pinned at the top of the pane.

## The panel-by-panel map

| Panel | Question it answers |
|---|---|
| **Styles / Rules** | which rules match, in cascade order, with losers struck through |
| **Computed** | the one value that won, per property — and, expanded, where it came from |
| **Layout / Box model** | the actual content/padding/border/margin numbers |
| **Grid / Flexbox overlays** | line numbers, track sizes, gaps, drawn on the page |
| **Changes** | everything you edited in the panel, as a diff you can copy back |
| **Fonts** | which font is *actually* rendering, not which you asked for |

**Computed is underused.** When a value is wrong and you cannot find the rule,
Computed gives you the winner directly and links to its source — far faster
than scanning the Styles pane.

## The five things worth knowing how to do

1. **Force a state.** `:hov` (Firefox) / `:hover` toggles (Chrome) let you pin
   `:hover`, `:focus`, `:focus-visible`, `:active` and `:visited` so you can style
   states without chasing the mouse. Essential for focus rings.
2. **Show browser styles.** Off by default; turn it on to see the UA rules
   discussed in [page 06](./06-user-agent-stylesheets.md) rather than guessing
   where a default came from.
3. **Read the invalid-declaration warning.** A struck-through declaration with a
   warning triangle did not lose the cascade — it failed to parse. Different
   problem, different fix ([page 05](./05-css-fails-silently.md)).
4. **Use the grid/flex overlays.** They draw line numbers and track sizes on the
   page. Debugging a grid by reading the stylesheet is strictly harder.
5. **Copy your edits out.** The Changes panel gives a diff of everything tweaked
   live, so an afternoon of experimenting is not lost on refresh.

## The console is a CSS tool too

```js
// what actually won, for one property
getComputedStyle($0).color;              // $0 is the selected element

// does this element match a selector I think it does?
$0.matches('article p.note');            // true

// every rule in the page that mentions a property
[...document.styleSheets].flatMap(s => [...s.cssRules])
  .filter(r => r.style?.getPropertyValue('z-index'))
  .map(r => r.cssText);

// is this value even valid?
CSS.supports('display', 'grid');
```

`$0` is the currently selected element in both Firefox and Chrome. Reaching for
the console when the panel does not answer the question is the difference
between five minutes and an hour.

## The debugging order

Ask these in sequence and almost every CSS bug resolves in under a minute:

1. **Is the element in the DOM?** Inspect it. Half of "my CSS is broken" is
   markup that never rendered.
2. **Did the rule parse?** Warning triangle in the Styles pane, or absent from
   the CSSOM.
3. **Did it match?** `$0.matches('your selector')`.
4. **Did it win?** Struck through in Styles; check Computed for the winner.
5. **Is the box where you think?** Layout panel — and check the containing block
   (**Phase 4**).

Steps 2 and 3 are the ones people skip, and they are the two the language gives
you no other way to answer.

## Gotchas

**Symptom:** you edit a value in DevTools, it works, you copy it to the
stylesheet, and it stops working.
**Cause:** the panel edit landed in `element.style`, which outranks your
stylesheet rule. The same declaration in a file has to win the cascade.
**Fix:** edit the *rule* in the Styles pane rather than the element.style block,
so you are testing at the real specificity.

**Symptom:** a rule is visible in the Styles pane but has no effect, with no
strike-through.
**Cause:** it is matching a different element than you think, or the property
does not apply to this element's display type — `width` on an inline element,
`gap` on a non-flex/grid container.
**Fix:** check Computed for the property. If it is absent or `auto`, the property
does not apply here.

**Symptom:** styles work in DevTools and not on reload.
**Cause:** you are looking at a cached stylesheet, or the change was never saved.
**Fix:** hard reload with cache disabled (Network panel → Disable cache), and
confirm in the Network panel which stylesheet actually loaded.

**Symptom:** the font looks wrong but the `font-family` in Styles is correct.
**Cause:** the requested font failed to load and a fallback is rendering.
**Fix:** the Fonts panel shows what is *actually* used, not what was asked for.

## Interview questions

**★ A declaration is struck through in DevTools. What are the two possible
causes, and how do you tell them apart?**
Either it lost the cascade — another declaration for the same property won — or
it failed to parse. A parse failure carries a warning icon and the property will
be missing from Computed entirely; a cascade loss has a winner you can find in
Computed and jump to. They need opposite fixes: one is a syntax problem, the
other a specificity or layer problem.

**★ How do you debug a CSS rule that "isn't working"?**
In order: is the element in the DOM, did the rule parse, did it match
(`$0.matches(selector)`), did it win (strike-through / Computed), and is the box
where you expect (Layout panel). Skipping straight to editing values is what
turns a one-minute bug into an hour.

**How do you style a `:hover` or `:focus-visible` state you cannot hold open?**
Force the state from the Styles pane — `:hov` in Firefox, the state checkboxes
in Chrome. This is the only practical way to iterate on focus rings and hover
treatments.

**Where do browser default styles show up in DevTools?**
They are hidden by default; enable "Show browser styles" / "Show user agent
styles" and UA rules appear in the Styles pane alongside author rules, in the
correct cascade position.

**What does the Computed panel give you that the Styles panel doesn't?**
The single winning value per property, already resolved — including inherited
and default values that no author rule set. It answers "what is this element
actually using", where Styles answers "what rules are competing".

---

← [11 · Vendor prefixes](./11-vendor-prefixes.md) · Back to [Phase index](./) · Next phase: [Phase 1 · Selectors](../phase-1-selectors/) →
