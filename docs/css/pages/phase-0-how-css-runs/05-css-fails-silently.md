---
title: "CSS fails silently"
sidebar_label: "05 · CSS fails silently"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex02-error-recovery.mjs`.

**CSS has no errors. A mistake is discarded, and nothing tells you.** No console
message, no exception, no build failure. This is the single most important thing
to know about the language, because every hour lost to "why isn't this working"
starts here.

## Three kinds of mistake, three different blast radii

```css
/* 1. a bad declaration — dropped, the rule survives */
.a { color: green; colour: red; font-size: notasize; padding: 10px; }

/* 2. a bad selector in a plain list — the WHOLE RULE is discarded */
.c, ::nonsense { color: green; }

/* 3. the same list inside :is() — forgiven */
:is(.d, ::nonsense) { color: green; }

/* 4. an unclosed brace — swallows what follows */
.e { color: green;
.f { color: green; }
```

```console
$ node ex02-error-recovery.mjs
engine: Firefox/153.0

=== An invalid declaration is dropped; its neighbours survive ===
  authored declarations                           4 (color, colour, font-size, padding)
  longhands kept (padding expands to 4)           5
  cssText as the engine stored it                 .a { color: green; padding: 10px; }
  color (valid, kept)                             rgb(0, 128, 0)
  padding-left (valid, kept)                      10px
  font-size (invalid value, dropped → inherited)  16px

=== An invalid SELECTOR discards the whole rule ===
  selectors that survived parsing        [".a",".b",":is(.d, ::nonsense)",".e"]
  .c color (rule was discarded)          rgb(0, 0, 0)
  .d color (:is() forgave the bad half)  rgb(0, 128, 0)

=== An unclosed brace swallows the rules after it ===
  total rules in the sheet  4
  .e color                  rgb(0, 128, 0)
  .f color                  rgb(0, 0, 0)

=== What the engine reported about any of it ===
  (nothing — no console message, no error event, no exception)
```

Read the results one at a time.

**A bad declaration is local.** `colour` (misspelled) and `font-size: notasize`
both vanished; `color` and `padding` survived. The stored rule is literally
`.a { color: green; padding: 10px; }` — the engine kept no trace of what you
wrote. `font-size` fell back to the inherited 16px, which looks like the rule
"didn't apply" when in fact one declaration of it didn't.

**A bad selector is fatal to the rule.** `.c, ::nonsense` does not become
`.c` — the entire rule is thrown away, and `.c` is black. A single typo in a
long comma-separated selector list silently disables styling for every selector
in it. This is a real production failure mode: add one experimental selector to
a list of eight and the other seven stop working.

**`:is()` and `:where()` forgive.** `:is(.d, ::nonsense)` kept `.d` green.
Their argument lists are *forgiving*: invalid members are dropped, valid ones
survive. That is a genuine reason to prefer `:is(a, b, c)` over `a, b, c` when
any member is new or uncertain.

**An unclosed brace eats the next rule.** Five rules authored, **four** in the
CSSOM — `.f` was consumed as part of `.e`'s declaration block and is black.

**And nothing was reported.** Not one console message for any of it.

## The only APIs that will tell you

Since the engine will not volunteer anything, you have to ask:

```js
CSS.supports('colour', 'red');        // false — the property does not exist
CSS.supports('color', 'red');         // true
CSS.supports('font-size', 'notasize') // false — the value is invalid

// the round-trip test: set it, read it back
const d = document.createElement('div');
d.style.color = 'notacolor';
d.style.color;                        // "" — the assignment was rejected
```

```console
=== The one API that does tell you: CSS.supports ===
  CSS.supports('colour','red')          false
  CSS.supports('color','red')           true
  CSS.supports('font-size','notasize')  false
  el.style.color = "notacolor" leaves   ""
```

**The round-trip is the general technique.** Assign a value; if reading it back
gives an empty string, the engine rejected it. It works for any property and any
value, including ones `CSS.supports` cannot express.

## Why the language is designed this way

Forward compatibility. A stylesheet written in 2026 has to survive a browser
from 2020 that has never heard of `@container`, and a browser from 2030 that
has features nobody has named yet. If unknown syntax were an error, every new
CSS feature would break every old browser, and nothing new could ever ship.

Dropping what you do not understand is what makes progressive enhancement
possible at all — see [`@supports`](./09-supports-feature-queries.md). The price
is that a typo and a future feature are indistinguishable to the engine, so it
treats your typo with the same generosity.

## How to get the errors back

The language will not help you, so the toolchain has to:

| Tool | Catches |
|---|---|
| **Editor CSS support** | unknown properties and bad values as you type — the cheapest win available |
| **stylelint** | invalid syntax, unknown properties, duplicate selectors, in CI |
| **DevTools** | a warning triangle beside invalid declarations in the Styles pane |
| **A build step** | Lightning CSS / PostCSS parse errors on malformed syntax |

Real projects treat "CSS has no errors" as a tooling requirement, not a
personality trait of the language.

## Gotchas

**Symptom:** one property in a rule has no effect while the others work.
**Cause:** that declaration was invalid and dropped — a misspelled property, a
missing unit, a value the property does not accept.
**Fix:** check it in DevTools (invalid declarations are flagged), or
`CSS.supports('the-property', 'the value')` in the console.

**Symptom:** an entire rule stopped applying after you added a selector to it.
**Cause:** the new selector is invalid, and an invalid selector in a plain comma
list discards the whole rule — every other selector in the list included.
**Fix:** wrap uncertain selectors in `:is()`, which forgives invalid members, or
give the new selector its own rule so a mistake cannot take the others with it.

**Symptom:** everything below a certain line in the stylesheet stopped working.
**Cause:** an unclosed brace. The parser consumed the following rules as part of
the unterminated block — measured, five rules became four.
**Fix:** look *above* the first broken rule, not at it. Auto-formatting the file
makes the mismatch obvious immediately.

**Symptom:** a new CSS feature works locally and does nothing for some users.
**Cause:** their engine does not support it, dropped the declaration, and said
nothing — exactly as it would for a typo.
**Fix:** guard it with `@supports` and provide a fallback. Check Baseline before
shipping ([page 10](./10-baseline-and-shipping.md)).

## Interview questions

**★ What happens when a browser meets a CSS property it doesn't understand?**
It drops that declaration and keeps the rest of the rule. There is no error, no
console message and no exception — measured, a stylesheet with a misspelled
property, an invalid value, a bad selector and an unclosed brace produced zero
console output. The behaviour is deliberate: it is what lets old browsers survive
new CSS.

**★ What is the difference between an invalid declaration and an invalid
selector?**
Blast radius. An invalid declaration is dropped on its own and its neighbours in
the rule survive. An invalid selector in a plain comma-separated list discards
the **entire rule**, so every other selector in that list stops working too.

**How do you make a selector list survive an unsupported selector?**
Wrap it in `:is()` or `:where()`, whose argument lists are forgiving — invalid
members are dropped and the valid ones still match. Measured,
`.c, ::nonsense` left `.c` unstyled while `:is(.d, ::nonsense)` kept `.d` styled.

**How can you detect from JavaScript whether a value is valid?**
`CSS.supports(property, value)`, or the round-trip: assign to `element.style` and
read it back — an empty string means the assignment was rejected.

**Why doesn't CSS just throw errors like JavaScript?**
Because stylesheets must be forward- and backward-compatible. If unknown syntax
were fatal, no new CSS feature could ship without breaking every older browser.
Silent discarding is the mechanism that makes progressive enhancement possible;
the cost is that typos are treated as generously as future features.

**Your rule is correct and still isn't applying. What are the three things to
check, in order?**
Did it parse (is it in the CSSOM / not struck through in DevTools), did it match
(is the element actually selected), and did it win (is another declaration
overriding it). Those three questions, in that order, cover almost every case.

---

← [04 · Render-blocking CSS](./04-render-blocking-css.md) · Next: [06 · User-agent stylesheets](./06-user-agent-stylesheets.md) →
