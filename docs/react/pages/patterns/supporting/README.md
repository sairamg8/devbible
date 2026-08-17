---
title: "Supporting techniques"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 and react-dom 19.2.8.** No console blocks — every claim
> is validated against react.dev, the React 19 release notes and the relevant
> platform specs, with each page's `> Verified:` line naming its sources.

**Three techniques that are not patterns in their own right. They are the
machinery the patterns are built from.**

They sit here rather than in [the ten](../README.md) deliberately: nobody says
"we used the prop getter pattern" the way they say "we used compound
components". These are how you *implement* the ten — most often
[compound components](../03-compound-components/README.md) and
[headless](../06-headless-components/README.md).

| Technique | Tier | What it solves | Where the ten use it |
|---|---|---|---|
| **[Polymorphic components](polymorphic-components.md)** | <span className="db-tier t-know">Know</span> | The `as` prop — a "button" that navigates must really be an `<a>`, and that is a correctness issue, not a styling one | Gives back the structural freedom [compound components](../03-compound-components/03-designing-the-parts.md) take away |
| **[Prop getters](prop-getters.md)** | <span className="db-tier t-know">Know</span> | A spread cannot merge event handlers — the caller's `onClick` replaces yours or yours replaces theirs, silently | How a [headless](../06-headless-components/04-wiring-it-up.md) hook hands over props the caller cannot break |
| **[Provider composition](provider-composition.md)** | <span className="db-tier t-understand">Understand</span> | Nine nested `<Provider>` tags — one fix is cosmetic and one is real | The assembly problem [context + provider](../../phase-5-refs-context-reducers/04-createcontext-usecontext.md) runs into at application scale |

## The one line from each

**Polymorphic** — `<button>` and `<a href>` differ in keyboard activation,
announced role, middle-click and the browser's link list. Rendering the wrong one
is a defect CSS cannot fix.

**Prop getters** — there is *no* spread order that keeps both the caller's
handler and yours. That is the entire motivation, and it is why a getter takes
the caller's props as an argument instead of being a plain object.

**Provider composition** — the `reduceRight` fold is a readability change and
nothing else; identical tree, identical re-renders. The real fix is that most of
those providers should not be at the root. And **provider count is not the
metric** — splitting state from dispatch raises it and lowers the work.

---

Index: [React patterns](../README.md)
