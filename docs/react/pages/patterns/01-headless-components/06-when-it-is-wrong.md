---
title: "When it is wrong, and the limits"
sidebar_label: "06 · When it is wrong, and the limits"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect) for the
> server-rendering caveat, [`createPortal`](https://react.dev/reference/react-dom/createPortal)
> for event bubbling through portals, and
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> Widget requirements from the W3C
> [APG](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/), fetched 2026-08-17.
> ⚠️ **Most of this chunk is engineering judgement, not documented fact**, and is
> marked as such. It is the part of the pattern that shows up in production
> rather than in tutorials, and where documentation is silent this page says so
> instead of asserting.
> No sandbox script backs this page; claims are cited, not measured.

**Four chunks argued for headless components. This one is the case against, and
the things that break after the demo works.**

## When it is simply the wrong tool

**One consumer.** A headless layer with a single caller has bought indirection and
nothing else. This is
[extracting too early](../../phase-7-custom-hooks/12-extracting-too-early.md), and
the fact that the abstraction is *good* does not make it *needed*.

**The markup genuinely does not vary.** Headless is a bet that the design will
fork. If every `<Card>` in your product looks the same and always will, a styled
component is simpler, more discoverable, and easier to change — you can read it
in one file.

**Your goal is consistency, not flexibility.** Headless deliberately hands the
caller freedom to produce something off-brand. For a design system whose job is
to *prevent* that, the freedom is the bug. The usual resolution is two layers: a
headless core, and a styled component built on it that most people import — and
the styled one is the default export, not a footnote.

**The widget has no real contract.** A toggle button, a card, a badge — nothing
about them requires focus management or ARIA relationships beyond what HTML
already gives you. Reaching for headless here is cargo cult; a `<button>` is
already accessible.

**You are building it rather than adopting it.** *(Judgement, and the most
practically important line in this topic.)* Writing a correct headless combobox
is a multi-week job that you will then own forever — including the parts
[chunk 02](02-the-contract-you-are-inheriting.md) quoted and the ones it did not.
Adopting a maintained one is an afternoon. **Most teams should adopt.** Build only
when you have a requirement no library meets, and know that you have taken on a
maintenance commitment, not written a component.

## The limits that appear in production

These are the ones that are absent from every introduction to the pattern,
including the four chunks before this one.

**Positioning is a separate problem, and headless does not solve it.** A dropdown
must know where the trigger is, whether there is room below, and what to do when
the viewport scrolls. That is measurement — refs, `getBoundingClientRect`,
observers — and it is a different library from the one managing focus. Headless
kits ship them separately for good reason.

**Exit animations fight state ownership.** If the hook owns `isOpen` and the
caller unmounts on `false`, there is nothing left to animate out. The hook has to
expose something like "still present, but closing", which means it now owns a
third state it never wanted. This is a real design problem with no clean answer,
and it is where most home-grown headless components first break.

**Portals break the assumptions click-outside relies on.** A menu rendered
through [`createPortal`](https://react.dev/reference/react-dom/createPortal) is
elsewhere in the DOM, so a `contains()` check against the trigger's parent says
the click was outside and closes the menu the user just clicked in. React events
still bubble through the React tree, but native listeners on `document` do not.

**Server rendering has no measurements.** Anything depending on element size or
position is unavailable on the first paint, and `useLayoutEffect` does not run on
the server — react.dev warns about exactly this. Widgets that decide their
behaviour from geometry have a first-render state that must be designed, not
discovered.

**Virtualisation and roving `tabindex` actively conflict.** Windowing unmounts
off-screen rows; if the focused option scrolls out of view, the focused element
is destroyed and focus falls back to `<body>`. This is the main reason
long-list widgets use `aria-activedescendant` instead — see
[chunk 02](02-the-contract-you-are-inheriting.md).

**Testing the contract needs more than unit tests.** A headless hook is trivially
unit-testable and that proves almost nothing. What matters is whether arrow keys
move focus in a real DOM and whether the ARIA relationships resolve — integration
territory. [Phase 14](../../phase-14-correctness/README.md) covers the tools, and
[roles as the query surface](../../phase-14-correctness/11-roles-as-the-query-surface.md)
is unusually relevant here: querying by role tests the same contract the widget
is meant to satisfy.

**The shape of your getters' output is public API.** Callers spread it onto
elements. Adding an attribute is safe; renaming or removing one is a breaking
change, and there is no type-level way to warn about it in plain JavaScript.

**RTL and `aria-orientation` change the key bindings.** In a horizontal or
right-to-left widget, "next" is not `ArrowDown` and may not be `ArrowRight`
either. A keyboard handler with hard-coded key names is quietly monolingual.

**Bundle cost is not zero.** A headless kit plus your own markup can exceed a
styled component library for a product using three widgets. Measure before
assuming the unstyled option is the lighter one.

## The two-layer resolution

*(Judgement, but the common resolution.)* Most of the objections above are
answered by not choosing:

```
useListbox()          ← headless core; total freedom, all the contract
    ↓
<Listbox>             ← compound components; structure fixed, still unstyled
    ↓
<FruitPicker>         ← your styled component; what 95% of the app imports
```

The top layer exists for the one screen that needs something different. The
bottom layer is what people actually use, and it is the default export. Nobody
pays for flexibility they do not need, and the escape hatch exists when they do.

## Gotchas

**"We will make it headless later" rarely happens.** Extracting the behaviour
from a styled component after the fact means untangling focus management from
markup that grew around it. Not impossible; just consistently underestimated.

**A headless kit does not make your app accessible.** It makes the *widget*
correct. Labels, heading structure, contrast, focus order between widgets and the
announcement of dynamic changes remain entirely yours.

**Adopting a kit means adopting its opinions.** Its state shape, its naming, its
delivery shape and its release cadence become yours. That is usually a good
trade, and it is still a dependency decision rather than a free win.

**Two headless libraries in one app is a real cost**, not just bytes — two
different mental models for the same problems, and contributors who learn the
wrong one for the file they are in.

**The pattern is worth *reading* even if you never write one.** Every serious
React UI library is built this way now, and their docs assume you recognise prop
getters, compound components and the state reducer. Knowing the shapes is how you
read them.

**Do not let "headless" become the reason nothing ships.** *(Judgement.)* The
pattern rewards libraries and punishes small products. A styled component you
wrote today beats a flexible one you are still designing.

## Interview questions

**When would you not build a headless component?**
With a single consumer, when the markup does not vary, when the goal is brand
consistency rather than flexibility, when the widget has no real accessibility
contract, or — most often — when a maintained library already does it.

**What is the strongest practical argument against building your own?**
A correct headless combobox is weeks of work and a permanent maintenance
commitment covering roughly thirty specified behaviours. Adopting one is an
afternoon. Build only for a requirement nothing meets.

**Why do exit animations conflict with a headless hook?**
Because the hook owns `isOpen` and the caller usually unmounts on `false`, so
there is nothing left to animate. The hook has to expose a "closing" state it did
not originally model.

**What goes wrong with click-outside and portals?**
A portalled menu lives elsewhere in the DOM, so a native `document` listener
doing a `contains()` check on the trigger's subtree reports the click as outside
and closes the menu the user just clicked inside.

**Why do virtualised lists prefer `aria-activedescendant`?**
Because windowing unmounts off-screen rows. With roving `tabindex` the focused
element can be destroyed by scrolling, dropping focus to `<body>`. With
`aria-activedescendant` focus stays on the container and only an attribute
changes.

**What cannot be done during server rendering?**
Anything requiring measurement — sizes and positions do not exist, and
`useLayoutEffect` does not run on the server. Widgets that decide behaviour from
geometry need a designed first-render state.

**How should a headless widget be tested?**
Unit-testing the hook proves very little. The contract is behavioural, so test in
a real DOM: arrow keys moving focus, ARIA relationships resolving, and queries by
role — which exercise the same surface the widget exists to provide.

**What is the versioning risk?**
The object your prop getters return is public API, because callers spread it onto
elements. Renaming or dropping a key is a breaking change with no type-level
warning in plain JavaScript.

**Does a headless library make an application accessible?**
No. It makes individual widgets correct. Labelling, heading structure, contrast,
focus order between widgets and announcing dynamic changes are still the
application's responsibility.

**What is the layered answer most teams end up with?**
A headless hook underneath, compound components on top of it, and a styled
component on top of that as the default export — so the common case is easy and
the rare case is possible.

**Why learn the pattern if you will only ever consume libraries?**
Because every serious React UI library is built this way, and their documentation
assumes you can read prop getters, compound components and state reducers.

---

← Prev: [05 · The delivery shapes](05-the-delivery-shapes.md) · Index: [Headless components](README.md)
