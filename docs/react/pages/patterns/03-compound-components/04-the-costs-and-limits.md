---
title: "The costs and the limits"
sidebar_label: "04 · The costs and the limits"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useContext`](https://react.dev/reference/react/useContext),
> [`memo`](https://react.dev/reference/react/memo),
> [`use client`](https://react.dev/reference/rsc/use-client),
> [Server Components](https://react.dev/reference/rsc/server-components), and the
> [React 19 release notes](https://react.dev/blog/2024/12/05/react-19).
> ⚠️ The performance reasoning here is derived from documented semantics, **not
> measured** — there is no sandbox and no numbers on this page. Design judgements
> are marked.
> No sandbox script backs this page; claims are cited, not measured.

**Four chunks' worth of pattern, and the bill.**

## Every part re-renders on every change

This is the defining cost, and it follows directly from how context works: **when
the provider's value changes, every consumer re-renders**, because `useContext`
has no selector. Ten tabs, one click, ten re-renders — nine of which render
identical output.

`memo` does not help. A memoized part still re-renders when a context it consumes
changes; `memo` compares props, and context is not a prop.

Three real mitigations, in the order you should try them:

**1 — Split the context.** State and setters change on different schedules.

```jsx
const TabsStateContext   = createContext(null);   // { value }        — changes often
const TabsActionsContext = createContext(null);   // { setValue }     — never changes
```

A `Tabs.List` that only dispatches now consumes `TabsActionsContext` and stops
re-rendering entirely. This is React's own recommended shape for state plus
dispatch —
[context plus reducer](../../phase-5-refs-context-reducers/12-context-plus-reducer.md).

**2 — Split further, by what actually changes.** A `baseId` that never changes
does not belong in the same context as `value`.

**3 — Push the comparison down.** Instead of every `Tab` reading `value`, give
each `Tab` a boolean it computes from context and let its expensive *child* be
memoized on that boolean. The `Tab` re-renders; its subtree does not.

⚠️ **None of this makes context selective.** If you genuinely need
subscribe-to-a-slice semantics, the tool is an external store with
[`useSyncExternalStore`](../../phase-5-refs-context-reducers/15-usesyncexternalstore.md),
not more context splitting. *(Judgement: that is a big step, and for a tab widget
it is over-engineering. For a data grid with 5,000 cells it is not.)*

**And note what the React Compiler does and does not change:** it can memoize the
provider's value object for you, removing identity churn. It does not make
`useContext` selective, so the re-render on a real change remains —
[Phase 6](../../phase-6-performance/README.md).

## Structure is fixed, and that is the trade

Chunk 02 covered the escapes. The honest framing is that **compound components
buy the caller arrangement freedom and charge them element freedom.** They can
put a `<Divider/>` between two tabs; they cannot make a tab an `<li>` without
`as` or `asChild`.

That is why [headless § delivery shapes](../06-headless-components/05-the-delivery-shapes.md)
calls this the *least* headless of the four shapes despite being the nicest to
use.

## Server Components

**The parent is a Client Component.** It holds state and provides context, so it
needs `'use client'`, and so does every part that reads the context.

What does *not* become client-side is the content:

```jsx
// app/settings/page.jsx — a Server Component
<Tabs defaultValue="billing">
  <Tabs.List>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="billing">
    <BillingReport />        {/* stays a Server Component */}
  </Tabs.Panel>
</Tabs>
```

`<BillingReport/>` is passed as `children` from a server component, so it renders
on the server and its result is handed to the client part —
[Server Components as `children`](../../phase-10-server-components/07-server-components-as-children.md).

⚠️ **Two consequences worth stating plainly.** First, a panel that returns `null`
when inactive still had its server content rendered and shipped — you paid for it
whether or not it displays. Second, `Tabs.Tab` receiving a server-rendered
`children` is fine, but `Tabs.Tab` **importing** a server component is not; the
[composition rules](../../phase-10-server-components/10-composition-rules.md) are
the page on that boundary.

## Typing it

The parts and the context type together, and the guard hook is where it pays:

```tsx
type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(part: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (context === null) throw new Error(`<Tabs.${part}> must be inside <Tabs>`);
  return context;                       // narrowed — no null checks downstream
}
```

The `| null` plus the throw is what lets every part treat the context as
non-nullable without a check, which is the practical reason to prefer it over a
default object.

⚠️ **Dot notation types awkwardly.** `Tabs.Tab` needs the parent's type augmented
with the parts, and consumers writing `React.ComponentProps<typeof Tabs.Tab>`
work fine while `import type { TabsTabProps }` does not exist unless you export
it separately. Export the prop types explicitly whichever export style you chose.

## Testing

*(Judgement, grounded in what the pattern makes observable.)*

- **Never test a part in isolation.** Rendering `<Tabs.Tab>` alone hits the guard
  and throws — correctly. The unit under test is the widget.
- **Test through roles, not implementation.** `getByRole('tab')` and
  `getByRole('tabpanel')` exercise the same contract the parts exist to satisfy —
  [roles as the query surface](../../phase-14-correctness/11-roles-as-the-query-surface.md).
- **Assert the relationships, not just the state.** That the active tab has
  `aria-selected="true"` is weaker than asserting its `aria-controls` resolves to
  the visible panel's id, which is what actually breaks.
- **Test the arrangements you claim to support** — a part inside a wrapper, a
  part from a `.map()`, a conditionally rendered part. Those are the cases
  `cloneElement` would have broken, and a test proves you did not regress into it.

## Discoverability, which is a real cost

A configuration API advertises itself: the props are in one type and autocomplete
lists them. A compound API does not — nothing tells a caller that
`<Tabs.Panel>` exists, or that it needs a `value`, or that `<Tabs.List>` is
optional.

*(Judgement:)* dot notation is the cheapest partial fix, because `Tabs.`
autocompletes. Beyond that it is documentation's problem, and a compound
component with no usage example is genuinely harder to adopt than the
prop-explosion version it replaced.

## When not to reach for it

- **Two parts and no shared state.** That is
  [composition](../../phase-2-components/03-composition/README.md) — pass the
  elements as props or children and stop.
- **One consumer.** The flexibility is unused and the indirection is real.
- **The arrangement never varies.** If every use looks identical, the compound
  API is ceremony around a component that could have taken three props.
- **The parts do not actually coordinate.** If `Tabs.Panel` never reads anything
  the parent owns, it is a `<div>` with extra steps.
- **You need the caller to be unable to get it wrong.** Compound APIs let a
  caller omit a required part, duplicate an identity, or nest something
  nonsensical. A configuration API cannot be misassembled.

## Gotchas

**`memo` on a part does not stop context re-renders.** It compares props;
context is not a prop. This surprises people who memoize and see no change.

**Splitting the context multiplies providers**, and that is fine — provider
*count* is not the metric, as
[provider composition](../supporting/provider-composition.md) argues. What
matters is what each one changes and how often.

**A context value assembled inline defeats every split you just made.**
`<Ctx value={{ ...state, ...actions }}>` re-merges them into one changing object.

**The Compiler removes identity churn, not the re-render on real change.**
Do not read "the Compiler handles memoization" as "context is now selective".

**Inactive panels still cost server work in RSC.** Their server children rendered
and shipped even though the panel returns `null`.

**A part that reads context but is rendered by a Server Component is a build
error**, not a runtime one — and the message points at the import boundary rather
than at your widget.

**Testing a part alone throws**, and that is the guard working. Do not "fix" it
by weakening the guard to make a test pass.

**Asserting `aria-selected` alone is a weak test.** The relationship — that
`aria-controls` resolves to the visible panel — is what actually breaks and what
a screen reader depends on.

**Nothing tells a caller which parts exist.** The API is invisible until they
read your documentation, which is a real adoption cost the prop-based version
did not have.

**A duplicated `value` across two parts breaks ids silently**, with no React
warning. If you can detect it in development, warn.

## Interview questions

**What is the defining cost of compound components?**
Every part re-renders when the shared context value changes, because `useContext`
has no selector. Ten tabs, one click, ten re-renders.

**Does `memo` fix that?**
No. `memo` compares props, and context is not a prop — a memoized consumer still
re-renders when its context changes.

**What actually reduces it?**
Splitting the context by change frequency — state separate from setters, and
never-changing values like ids separate from both — then pushing memoization down
so an expensive subtree depends on a boolean rather than the whole value.

**When is context genuinely the wrong tool?**
When you need subscribe-to-a-slice semantics at scale. Then an external store
with `useSyncExternalStore` is the right answer; more context splitting is not.

**What does the React Compiler change here?**
It memoizes the provider's value for you, removing identity churn. It does not
make context selective, so the re-render on a genuine change stays.

**How do compound components interact with Server Components?**
The parent and every context-reading part are Client Components and need
`'use client'`. Content passed as `children` from a server component still
renders on the server — but an inactive panel's server content was rendered and
shipped anyway.

**Why type the context as `T | null` rather than giving it a default?**
Because the guard hook then narrows it, so every part uses the context without a
null check — and a part used outside its parent fails loudly instead of
half-working.

**How should the widget be tested?**
As a widget, never part-by-part — a part alone throws by design. Query by role,
assert the ARIA *relationships* rather than just state, and cover the
arrangements you claim to support: wrapped, mapped and conditional parts.

**What is the adoption cost nobody counts?**
Discoverability. A props API autocompletes; a compound API does not advertise
which parts exist or which are required, so it depends on documentation in a way
the version it replaced did not.

**When would you not use the pattern at all?**
Two parts with no shared state, a single consumer, an arrangement that never
varies, parts that do not actually coordinate, or a case where the caller must be
prevented from assembling it wrongly.

---

← Prev: [03 · Designing the parts](03-designing-the-parts.md) · Index: [Compound components](README.md)
