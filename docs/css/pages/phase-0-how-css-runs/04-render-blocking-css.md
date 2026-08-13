---
title: "Render-blocking CSS"
sidebar_label: "04 · Render-blocking CSS"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex06-does-print-block.mjs`
> and `ex05-render-blocking-and-import.mjs`.

**The browser will not paint anything until it has your CSS.** That is
deliberate — painting unstyled text and then restyling it would be a flash of
garbage. It also means every stylesheet in `<head>` is on the critical path, and
one slow one holds the whole page blank.

## Measuring the block

A page whose only stylesheet is delayed 600 ms by the server, against a control
with no stylesheet at all:

```js
// sandbox/css/ex06-does-print-block.mjs
'/none.html':   '<p>text</p>',                                   // no CSS
'/screen.html': '<link rel="stylesheet" href="/s.css"><p>text</p>',
'/s.css': {body: 'body { background: #eee; }', delay: 600},
```

```console
$ node ex06-does-print-block.mjs
engine: Firefox/153.0
stylesheet delayed 600ms server-side; FCP is median of 5 after warm-up

=== Does a non-matching stylesheet block the first paint? — Firefox/153.0 ===
  no stylesheet (floor)  FCP    47ms   runs [48,47,44,40,47]
  media="print"          FCP    38ms   runs [47,36,46,36,38]
  media not matching     FCP    53ms   runs [53,36,49,59,53]
  normal stylesheet      FCP   671ms   runs [667,674,671,671,674]
```

**47 ms with no CSS, 671 ms with one delayed stylesheet.** The paint waited for
the entire 600 ms, then painted immediately. The page had content ready the whole
time and showed nothing.

## `media` takes a stylesheet off the critical path

A stylesheet whose `media` does not match the current environment is still
downloaded — but at low priority, and **it does not block the first paint**:

```html
<link rel="stylesheet" href="/print.css" media="print">
<link rel="stylesheet" href="/wide.css" media="(min-width: 1200px)">
```

Measured above: `media="print"` painted at **38 ms** and a non-matching width
query at **53 ms**, both indistinguishable from the 47 ms no-CSS floor, while the
matching stylesheet took 671 ms. Firefox 153 fetched them and did not wait.

This is the mechanism behind the "load non-critical CSS without blocking" trick:

```html
<!-- blocks nothing; the onload flips it back to a real stylesheet -->
<link rel="stylesheet" href="/below-the-fold.css" media="print"
      onload="this.media='all'">
```

Name the trade-off: the styles arrive **after** the first paint, so anything they
affect visibly changes when they land. That is correct for below-the-fold
styling and wrong for anything on the first screen.

:::caution This one contradicted its own first measurement
An earlier version measured `media="print"` at 971 ms — *slower* than two
parallel stylesheets — and the conclusion "print does not block" would have been
written on top of a number that said the opposite. The cause was measuring four
different page shapes in one sequential loop without a floor to compare against.
Isolating the question with a no-CSS control produced the clean result above.
:::

## The critical path, in order

1. HTML arrives, parsing starts.
2. A `<link rel="stylesheet">` is found → request starts, **paint is blocked**.
3. Parsing continues (the preload scanner keeps finding resources).
4. Stylesheet arrives, CSSOM is built, style resolution runs.
5. Layout, paint — the first pixel.

Two consequences worth internalising:

- **Stylesheets belong in `<head>`.** A stylesheet found late still blocks the
  paint, and now it was discovered late as well.
- **Fewer bytes on the critical path beats fewer requests.** Two parallel
  stylesheets cost about one round trip; one stylesheet twice the size costs
  twice the transfer.

## What actually helps

| Technique | What it buys | What it costs |
|---|---|---|
| Put stylesheets in `<head>` | earliest possible discovery | nothing — do it |
| `<link rel="preload" as="style">` | starts the fetch before the parser reaches it | wasted bytes if unused |
| `media` on non-critical sheets | removes them from the critical path | visible restyle when they land |
| Inline critical CSS | zero requests for the first screen | duplicated bytes, build complexity |
| Split per route | smaller critical path per page | more requests overall |
| Delete unused CSS | strictly less of everything | risk of removing dynamic classes |

The first and the last are free wins. The middle three are trades, and on a
small stylesheet none of them are worth the machinery — a 20 KB compressed
stylesheet on a warm connection is not your problem.

## Gotchas

**Symptom:** the page is blank for a second, then everything appears at once.
**Cause:** a render-blocking stylesheet on a slow connection. The content was
parsed and waiting the entire time.
**Fix:** find the slow request in DevTools' Network panel. Then either shrink
it, split it per route, or inline the part the first screen needs.

**Symptom:** moving a stylesheet to the end of `<body>` "to unblock rendering"
produced a flash of unstyled content.
**Cause:** the browser painted the unstyled DOM it had, then restyled when the
CSS arrived. The block is what prevents that flash.
**Fix:** put it back in `<head>`. If you want non-blocking, use the
`media="print"` + `onload` pattern, which is deliberate about *which* styles
arrive late.

**Symptom:** a `media="print"` stylesheet still shows up in the network waterfall
and someone concludes it is blocking.
**Cause:** non-matching stylesheets are still downloaded — just not waited for.
**Fix:** measure the paint, not the request. Measured here, print-media CSS
painted at 38 ms against a 47 ms no-CSS floor.

## Interview questions

**★ Why does CSS block rendering when JavaScript can be made not to?**
Because painting before styles arrive would show unstyled content and then
visibly restyle it. The browser chooses a blank frame over a wrong frame. Scripts
have `defer`/`async` because delaying execution is usually harmless; delaying
styles is not, since it is the styles that decide what the first frame looks
like.

**★ How do you load a stylesheet without blocking the first paint?**
Give it a `media` value that does not currently match — commonly
`media="print"` — and flip it in `onload`. Measured, a `media="print"` sheet
painted at 38 ms versus 671 ms for the same sheet as a normal stylesheet. The
cost is that those styles land after the first paint, so use it only for
below-the-fold styling.

**Does a non-matching stylesheet get downloaded at all?**
Yes, at a lower priority. It is fetched but not waited for, which is exactly the
property the trick above exploits.

**Where should stylesheets go, and why does it still matter with a preload
scanner?**
In `<head>`. The preload scanner mitigates late discovery but does not eliminate
it, and a stylesheet found late still blocks the paint from that point. There is
no upside to putting it later.

**Is it better to have one big stylesheet or several small ones?**
For the critical path, the number of files matters less than the bytes — parallel
requests overlap, measured at a 1 ms start gap. Splitting helps when it lets you
send *less* on a given route; it does not help if every route loads all of them.

---

← [03 · Getting CSS to the page](./03-how-stylesheets-reach-the-page.md) · Next: [05 · CSS fails silently](./05-css-fails-silently.md) →
