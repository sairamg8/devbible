---
title: "Component boundaries"
sidebar_label: "10 · Component boundaries"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Thinking in React](https://react.dev/learn/thinking-in-react) step 1 and
> [Your First Component](https://react.dev/learn/your-first-component). No
> sandbox script backs this page; claims are cited, not measured. The colocation
> guidance is community practice and is labelled as such.

**"Split it into smaller components" is advice with no stopping rule. A
component that exists for no reason costs an import, a name, a props contract,
and a file — and hides the flow it was supposed to clarify.**

## What the documentation actually says

*Thinking in React* gives three criteria and, usefully, three *different*
disciplines to borrow them from:

> 1. **Programming** — Use the same techniques for deciding if you should create
>    a new function or object. One such technique is the separation of concerns,
>    that is, a component should ideally only be concerned with one thing. If it
>    ends up growing, it should be decomposed into smaller subcomponents.
> 2. **CSS** — Consider what you would make class selectors for. (However,
>    components are a bit less granular.)
> 3. **Design** — Consider how you would organize the design's layers.

The parenthesis in criterion 2 is the useful part and is almost always skipped:
**components are less granular than CSS classes.** A design with forty class
selectors does not want forty components. Taking the CSS analogy literally is
one of the two ways people over-split.

On file organisation the docs are permissive:

> A file can only have one *default* export, but it can have numerous *named*
> exports.

Several components in one file is normal and sanctioned. The mandatory rule is
only that each is declared at **module top level**, never nested inside another
component — and that one is about correctness, not organisation
([topic 01](01-function-components/02-identity-and-nesting.md)).

## Five reasons that justify a split

Each of these is a *reason*, not a heuristic about size. If none applies, the
code is fine where it is.

**1. It is used in more than one place.** The clearest case, and the only one
that is unambiguous. Two callers means the thing has an interface whether you
name it or not.

**2. It owns state that nothing above needs.** Pushing state down is a genuine
structural improvement: the parent stops re-rendering, and the state's scope
matches its meaning. A row's hover state belongs in the row.

**3. It has a different update frequency.** A component re-rendering on every
keystroke should not contain a component that renders once. Splitting is what
makes the boundary between them exist at all.

**4. It has a different data source.** A section that suspends on its own
request, or reads from a different context, wants its own boundary — that is
what makes independent loading states and independent error boundaries
possible.

**5. It is a server/client boundary.** In an RSC app the `'use client'`
directive applies to a module, so the boundary between server and client code
*is* a file boundary. Splitting is not optional there.

Notice what is not on the list: **length**. A 200-line component that does one
thing, with no repetition and no independent state, is not improved by being
five 40-line components. It is made worse by four indirections.

## Three reasons a split hurts

**It hides the flow.** Reading one component that renders a form, versus reading
seven files to find where the submit handler lives. The cost is real and it is
paid by every future reader, including you.

**It creates a props contract that did not need to exist.** Extracting a piece
that uses eight local variables means eight props — which is worse than the
inline version in every way: more to type, more to keep in sync, and a name for
something that was not a concept.

**It invites premature generality.** A newly extracted component attracts
options. The one-caller component acquires a `variant` prop for a hypothetical
second caller, and the [configuration trap](03-composition/01-the-configuration-trap.md)
closes.

A useful test before extracting: **count the props it would take.** More than
about five, all of them local variables from the parent, and the extraction is
probably splitting one concern rather than separating two.

## Colocation

The convention: **keep a component next to the only thing that uses it.**

```
features/
  checkout/
    Checkout.jsx          ← the only caller
    OrderSummary.jsx      ← used only by Checkout, so it lives here
    useCheckoutTotals.js
components/
  Button.jsx              ← used by twelve features, so it is shared
```

rather than:

```
components/
  Checkout.jsx
  OrderSummary.jsx        ← now looks shared. It is not.
  Button.jsx
```

This is community practice rather than documented React guidance, and it earns
its keep for two reasons:

- **Location communicates scope.** A file in `components/` reads as shared, so
  the next person adds a second caller and a prop to support it. A file next to
  its only caller reads as private and gets deleted with it.
- **Deleting a feature deletes its parts.** Colocated code disappears with the
  directory. Code in a shared folder survives forever, because nobody can prove
  nothing uses it.

Promote to a shared location when there is a second caller — not in
anticipation of one. Moving a file later is a cheap, mechanical change; the
premature abstraction it prevents is not.

## Naming as a design check

If a name is hard to find, the boundary is usually wrong. Three signals:

- **A name with "and" in it** — `HeaderAndNav` — is two components.
- **A name that is a container word** — `Wrapper`, `Container`, `Section`,
  `Inner` — usually means the component has no responsibility of its own. It may
  still be right as a layout wrapper; it is worth a second look.
- **A name that describes where it appears rather than what it is** —
  `DashboardTopRightBox` — will be wrong the moment the design moves it. Name it
  for what it *is*.

The mirror check: if a component genuinely does one thing, the name is usually
obvious and short. Struggling for a name is evidence, not writer's block.

## Gotchas

**Symptom:** a component takes fifteen props and every one comes from the
parent's local scope.
**Cause:** an extraction that split one concern instead of separating two.
**Fix:** inline it back, or move the state down with it so it owns what it
needs.

**Symptom:** finding where a value comes from requires opening six files.
**Cause:** splitting by size rather than by responsibility.
**Fix:** merge components that are only ever used together and never used
alone.

**Symptom:** a component in a shared folder has exactly one caller and three
props supporting hypothetical ones.
**Cause:** promoted before it was shared.
**Fix:** move it next to its caller and delete the speculative props.

**Symptom:** state resets whenever the parent updates.
**Cause:** the "component" was defined inside another component — the identity
rule, not a boundary question.
**Fix:** module top level. See
[topic 01](01-function-components/02-identity-and-nesting.md).

**Symptom:** an RSC app pulls far more into the client bundle than expected.
**Cause:** `'use client'` is placed too high, so the boundary includes the whole
subtree.
**Fix:** push the directive down to the components that need interactivity, and
pass server content in as `children` ([topic 03](03-composition/02-slots-and-children.md)).

## Interview questions

**★ How do you decide where to split a component?**
By responsibility, not length. React's own criteria are the ones you would use
for a function — one component, one concern — plus the CSS and design-layer
analogies, with the caveat that components are less granular than CSS classes.
In practice the justifications are: it has a second caller, it owns state
nothing above needs, it updates at a different frequency, it has a different
data source, or it is a server/client boundary.

**★ When does splitting make things worse?**
When it hides the flow, when it manufactures a props contract for something that
was not a concept — the eight-props-from-local-variables extraction — and when
the new component attracts speculative options for callers that do not exist.
Length alone is not a reason; a long component doing one thing is fine.

**★ What is colocation and why does it matter?**
Keeping a component next to its only caller rather than in a shared folder.
Location communicates scope: a file in `components/` invites a second caller and
the props to support it, while a file beside its caller reads as private and
gets deleted along with it. Promote when a second caller actually appears.

**How many components should be in a file?**
As many as make sense. React explicitly allows multiple components per file —
one default export and any number of named ones. The hard rule is unrelated:
every component must be declared at module top level, never nested inside
another component's body.

**What does a bad component name tell you?**
That the boundary is wrong. "And" in the name means two components. A container
word — `Wrapper`, `Inner` — usually means no responsibility of its own. A name
describing a position in the layout will be wrong as soon as the design moves
it. When a component does one thing, naming it is easy.

**Does splitting components improve performance?**
Sometimes, and for a specific reason: it lets state live lower, so a state
change re-renders less of the tree. That is a real effect and it is the argument
behind pushing state down. Splitting without moving state changes nothing —
React re-renders the whole subtree either way.

---

← Prev: [`ref` as a prop](09-ref-as-a-prop.md) · Index: [Phase 2](README.md) · Next → [Portals](11-portals.md)
