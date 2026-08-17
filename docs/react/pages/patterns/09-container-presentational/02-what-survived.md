---
title: "What survived"
sidebar_label: "02 · What survived"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components),
> [`'use client'`](https://react.dev/reference/rsc/use-client),
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> and [`memo`](https://react.dev/reference/react/memo).
> ⚠️ The comparison between RSC and the 2015 pattern is an **observation**, not
> something React's documentation draws. Judgements about when to split are
> marked as such.
> No sandbox script backs this page; claims are cited, not measured.

**The mechanism is gone. The division came back with a compiler behind it.**

## The version that came back

Server Components reintroduce exactly the same split — but as a **real boundary
enforced by the bundler**, not a convention people agree to follow:

```jsx
// Server Component: fetches. Never ships to the browser.
async function UserListPage() {
  const users = await db.user.findMany();
  return <UserList users={users} />;
}

// Client Component: renders and handles interaction.
'use client';
function UserList({ users }) { /* … */ }
```

That is container and presentational, with the property the 2015 version could
never have:

| | 2015 pattern | Server / Client split |
|---|---|---|
| Enforced by | convention, code review | **the bundler** |
| Getting it wrong | renders fine, nobody notices | **build error** |
| What the "container" saves you | a rerender or two | **shipping the data layer to the browser** |
| Cost of a mistake | mild confusion | a `'use client'` in the wrong place pulls a subtree to the client |

*(The comparison is an observation, not something React's docs make.)* But it
explains why the shape feels familiar to anyone who wrote React in 2016, and why
"fetch above, render below" is good advice again for a completely different
reason.

[Where interactivity goes](../../phase-10-server-components/11-where-interactivity-goes.md)
and [composition rules](../../phase-10-server-components/10-composition-rules.md)
are the pages on that boundary.

## When the split is still the right call

Not never — the 2019 note says as much. Four cases, and they share a property:
**the presentational half has more than one caller, or a caller you do not
control.**

- **Several real data sources.** The same `<DataTable>` fed by a query in one
  place, a WebSocket in another and fixtures in Storybook. Keeping it prop-only
  is what makes that possible at all.
- **A published component.** Anything other teams import should not fetch. That
  is an API decision more than the container pattern, and it produces the same
  shape.
- **A component that is genuinely hard to render in a test.** A pure props-in
  component needs no mocking, no provider stack, no network interception — see
  [wrappers and providers](../../phase-14-correctness/10-wrappers-and-providers.md)
  for what the alternative costs.
- **A design review surface.** A presentational component can be rendered in
  every state — loading, empty, error, overflowing — from a fixtures file,
  without any of those states being reachable in the running app.

🔴 **The test: is the presentational half used more than once, or by someone
else?** If it has exactly one caller and always will, the split has bought an
extra file and a prop-drilling hop.

## Why it went wrong in practice

*(Judgement, and it is the common experience rather than a documented fact.)*

The pattern was usually enforced **by folder** — `containers/` beside
`components/`. That is the whole failure in one decision: it turns a design
judgement into a filing rule, so every new feature gets a container whether or
not it needs one.

What accumulates is components whose entire body is:

```jsx
function ThingContainer(props) {
  const { data } = useThing();
  return <Thing {...props} data={data} />;
}
```

A level in the tree, a file in the project, and a hop for every prop, in exchange
for nothing.

Three compounding effects, in the order they show up:

1. **Prop explosion.** The presentational half needs every value *and* every
   callback, so a form with twelve fields grows a twenty-four-prop interface.
2. **The split stops matching the feature.** One container ends up feeding three
   presentational components, or two containers feed one, and the one-to-one
   story nobody wrote down quietly stops being true.
3. **Nobody can delete anything.** A presentational component with one caller
   looks reusable, so it survives every cleanup.

Naming by *mechanism* rather than by *responsibility* is the underlying error, and
[component boundaries](../../phase-2-components/10-component-boundaries.md) is the
page on doing it properly.

The imported frontend-architecture corpus reaches the same conclusion from a
system angle in
[Component Architecture](../../../../frontend-architecture/pages/02-component-architecture/01-composition-patterns.md),
where it is listed as an anti-pattern. ⚠️ That page carries no tier badge and no
`> Verified:` line — it has not been validated to this reference's standard.

## Reading a codebase that uses it

*(Judgement — a practical guide, since this is mostly a reading skill.)*

- **`*Container.jsx` / `containers/`** — the literal convention.
- **`connect(mapStateToProps, mapDispatchToProps)(X)`** — Redux's generated
  container.
- **A component whose entire return is another component with a spread.**
- **A file with `useEffect` + `useState` and no JSX beyond one element.**

**To modernise one:** move the container's body into a hook, call the hook from
the presentational component, delete the container — **unless** the
presentational half has another caller, in which case keep it and let the hook be
called by a thin wrapper for the common case. That is the same recipe as
[retiring a HOC](../../phase-2-components/13-higher-order-components/03-writing-typing-retiring.md),
and it has the same exception.

⚠️ **Do not do this as a sweep.** The containers in an old codebase usually
accumulated routing, permissions and analytics alongside the data, and a
mechanical extraction moves those somewhere worse.

## Gotchas

**A pass-through container defeats `memo`.** Spreading `{...props}` into the
child creates fresh object props every render, so memoizing the presentational
component achieves nothing.

**A twenty-four-prop presentational component is not a factoring problem.** It is
evidence the split was not worth making. Adding a `props` object to tidy it up
hides the signal.

**"Presentational" does not mean "no hooks."** A presentational component may
perfectly well use `useId`, `useRef` or `useState` for something purely visual —
an open/closed toggle, a measured width. The distinction is about *data
ownership*, not about hook usage.

**The RSC split is not the same pattern wearing a hat.** It looks identical and
is motivated entirely differently: the 2015 version saved re-renders and
duplication, the RSC version keeps your data layer out of the browser bundle.
Treating them as the same thing leads to putting `'use client'` in the wrong
place.

**A Server Component is not a "container" you can put anything in.** It cannot
use state, effects or context, so behaviour that used to live in a container
does not simply move there.

**Storybook is not a second caller.** *(Judgement.)* If the only reason a
presentational component exists is that Storybook needs it, that is sometimes
worth it and often a sign the story should render the real component with mocked
data instead.

**The folder convention outlives the decision.** A `containers/` directory in a
2026 codebase usually means somebody set it up in 2017 and nobody has had a
reason to argue with it since.

## Interview questions

**What survived from the pattern?**
The goal — separating data concerns from rendering — and the cases where the
presentational half genuinely has more than one caller. The mechanism, splitting
every feature into two components, did not.

**Where does the split reappear in modern React?**
In Server Components: a server component fetches and a client component renders.
It is the same division, except the boundary is enforced by the bundler and
getting it wrong is a build error rather than a style disagreement.

**Is the RSC split the same pattern?**
It has the same shape and a completely different motivation. The 2015 version was
about re-renders and reuse; the RSC version is about keeping the data layer out
of the browser bundle. Conflating them leads to `'use client'` in the wrong
place.

**When is the split still right?**
When the presentational half has more than one data source, is published for
other teams, is hard to render in a test, or needs every visual state reachable
from fixtures. The common thread is more than one caller.

**Why did the pattern go wrong in practice?**
It was enforced by folder structure, which converts a design judgement into a
filing rule. Every feature then gets a container whether or not it needs one, and
the codebase fills with components whose whole body is a spread into another
component.

**What are the symptoms of a split that was not worth making?**
Prop explosion in the presentational half, a container that no longer maps
one-to-one to it, and components that survive every cleanup because they look
reusable while having one caller.

**Does "presentational" mean "uses no hooks"?**
No. It may use hooks for purely visual state — an open/closed flag, a measured
width. The distinction is about who owns the *data*.

**How do you modernise one?**
Move the container's body into a hook, call it from the presentational component,
delete the container — unless the presentational half has another caller. Do not
do it as a sweep: old containers usually also hold routing, permissions and
analytics.

**How do you spot one in unfamiliar code?**
A `containers/` folder, a `*Container` suffix, a `connect()` call, or any
component whose entire return is another component with a props spread.

---

← Prev: [01 · What it was](01-what-it-was.md) · Index: [Container / presentational](README.md)
