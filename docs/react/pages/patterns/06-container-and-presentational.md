---
title: "Container and presentational components"
sidebar_label: "06 · Container and presentational"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation and source —
> Dan Abramov, *Presentational and Container Components* (originally *Smart and
> Dumb Components*), published **23 March 2015**, with the author's **2019
> update** retracting the recommendation, quoted below and
> [fetched from the original article](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)
> on 2026-08-17. Modern guidance from react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> and [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer).
> No sandbox script backs this page; claims are cited, not measured.

**The pattern hooks retired. Worth knowing because you will read code shaped by
it, and because the instinct behind it was right even though the mechanism was
not.**

## What it was

Every feature became two components.

```jsx
// Container — knows where data comes from, renders no markup
function UserListContainer() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  return <UserList users={users} loading={loading} />;
}

// Presentational — knows how things look, has no state and no idea where data comes from
function UserList({ users, loading }) {
  if (loading) return <Spinner />;
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

The division was: **containers know *how things work*, presentational components
know *how things look*.** Containers had state and data sources; presentational
components took props and returned JSX, nothing else.

In 2015 this was genuinely useful, and the reason is specific. The only ways to
share stateful logic were [render props](../phase-2-components/12-render-props.md)
and [higher-order components](../phase-2-components/13-higher-order-components.md),
both of which force an extra component into the tree anyway. Given that you were
paying for a wrapper regardless, making the wrapper the data layer was a sound
trade.

## The author withdrew it

The 2015 article carries an update from 2019 at the top:

> **Update from 2019: I wrote this article a long time ago and my views have
> since evolved. In particular, I don't *suggest* splitting your components like
> this anymore.**

He is careful about what he is and is not saying. The pattern "can be handy" if
it feels natural in a codebase; what he objects to is having "seen it enforced
without any necessity and with almost dogmatic fervor far too many times." His
diagnosis of why it worked is the important part — the value was **separating
complex stateful logic from the rest of the component**, and hooks do that
"without an arbitrary division."

The article closes: *"This text is left intact for historical reasons but don't
take it too seriously."*

Read that as a retraction of the **mechanism**, not of the **goal**. Separating
data concerns from rendering is still right. Doing it by splitting every feature
into two components is what stopped being necessary.

## What replaced it

The same separation, with a hook instead of a wrapper component:

```jsx
function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  return { users, loading };
}

function UserList() {
  const { users, loading } = useUsers();
  if (loading) return <Spinner />;
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

One component instead of two, one file instead of two, and the seam is still
there — `useUsers` can be tested, reused and replaced independently. What you
lost is a component in the tree that existed only to pass props down.

[Writing a custom hook](../phase-7-custom-hooks/02-writing-a-custom-hook.md) is
the page, and
[designing a hook's API](../phase-7-custom-hooks/06-designing-a-hooks-api/README.md)
is where the seam gets designed deliberately.

## The version that came back

Server Components reintroduce the same division — but as a **real boundary
enforced by the bundler**, not a convention:

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

That is container and presentational, with the part the 2015 version could not
provide: the split is checked, and getting it wrong is a build error rather than
a style disagreement. *(The comparison is an observation, not something React's
documentation draws.)*
[Where interactivity goes](../phase-10-server-components/11-where-interactivity-goes.md)
and [composition rules](../phase-10-server-components/10-composition-rules.md)
are the pages on that boundary.

## When the split is still the right call

Not never — the 2019 note says as much.

- **A presentational component with several real data sources.** If the same
  `<DataTable>` is fed by a query in one place, a WebSocket in another and
  fixtures in Storybook, keeping it prop-only is what makes that possible.
- **A design system boundary.** Components published for others to use should not
  fetch. That is not the container pattern so much as an API decision, but it
  produces the same shape.
- **A component that is genuinely hard to render in a test.** A pure props-in
  component needs no mocking at all — see
  [wrappers and providers](../phase-14-correctness/10-wrappers-and-providers.md)
  for what the alternative costs.

The test is whether the presentational half is **used more than once, or by
someone else**. If it has exactly one caller and always will, the split has
bought an extra file and a prop-drilling hop.

## Why it went wrong in practice

*(Judgement, and it is the common experience rather than a documented fact.)*

The pattern was usually enforced **by folder** — `containers/` beside
`components/` — which turns a design decision into a filing decision. Every new
feature then gets a container whether or not it needs one, and the codebase fills
with components whose entire body is:

```jsx
function ThingContainer(props) {
  const { data } = useThing();
  return <Thing {...props} data={data} />;
}
```

That component adds a level to the tree, a file to the project, and a hop to
every prop, in exchange for nothing. Naming by mechanism rather than by
responsibility is the underlying error, and
[component boundaries](../phase-2-components/10-component-boundaries.md) is the
page on doing it properly.

The imported frontend-architecture corpus reaches the same conclusion from a
system angle in
[Component Architecture](../../../frontend-architecture/pages/02-component-architecture/01-composition-patterns.md),
where it is listed as an anti-pattern. ⚠️ That page carries no tier badge and no
`> Verified:` line — it has not been validated to this reference's standard.

## Gotchas

**"Container" does not mean "the component that uses hooks".** Every component
uses hooks now. If you are applying the label by whether `useState` appears, you
are drawing the line at random.

**Splitting causes prop explosion.** The presentational half needs every value
*and* every callback, so a form with twelve fields grows a twenty-four-prop
interface. That is not a sign you split badly; it is a sign the split was not
worth making.

**A pass-through container defeats `memo`.** Spreading `{...props}` into the
child creates fresh object props each render, so memoizing the presentational
component achieves nothing.

**Reading old code:** `connect(mapStateToProps)(Component)` from Redux is this
pattern as an HOC. You will meet it in any codebase older than hooks, and the
three HOC caveats apply to it —
[higher-order components](../phase-2-components/13-higher-order-components.md).

## Interview questions

**What is the container/presentational pattern?**
Splitting each feature into a container that owns state and data fetching and
renders no markup, and a presentational component that takes props and returns
JSX with no state of its own.

**Is it still recommended?**
No. Its author added a 2019 update to the 2015 article saying he no longer
suggests splitting components this way, that he had seen it enforced dogmatically
without necessity, and that hooks achieve the original goal — separating complex
stateful logic — without an arbitrary division.

**So the idea was wrong?**
The mechanism was superseded, not the goal. Separating data concerns from
rendering is still correct; a custom hook is now the seam, so you get the
separation without a second component whose only job is passing props.

**When would you still do it?**
When the presentational component has more than one data source or is consumed by
someone else — a design-system component, a table fed by a query in one place and
fixtures in Storybook in another, or a component you want to test with no mocking.

**Where does the split reappear in modern React?**
In Server Components: a server component fetches and a client component renders.
It is the same division, except the boundary is enforced by the bundler rather
than by convention.

---

← Prev: [Provider composition](05-provider-composition.md) · Index: [React patterns](README.md)
