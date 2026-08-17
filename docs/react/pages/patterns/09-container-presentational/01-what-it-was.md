---
title: "What it was, and why its author withdrew it"
sidebar_label: "01 · What it was"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation and source —
> Dan Abramov, *Presentational and Container Components* (originally *Smart and
> Dumb Components*), published **23 March 2015**, with the author's **2019
> update** retracting the recommendation, **fetched from the original article on
> 2026-08-17** and quoted verbatim below. Modern guidance from react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> Historical context from the legacy
> [HOC](https://legacy.reactjs.org/docs/higher-order-components.html) and
> [Render Props](https://legacy.reactjs.org/docs/render-props.html) guides.
> No sandbox script backs this page; claims are cited, not measured.

**The pattern hooks retired. Worth knowing because you will read code shaped by
it — and because the instinct behind it was right even though the mechanism was
not.**

## The split

Every feature became two components.

```jsx
// Container — knows where data comes from, renders no markup of its own
function UserListContainer() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  return <UserList users={users} loading={loading} />;
}

// Presentational — knows how things look, no state, no idea where data comes from
function UserList({ users, loading }) {
  if (loading) return <Spinner />;
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

The rule was: **containers know *how things work*, presentational components know
*how things look*.** Containers held state and data sources; presentational
components took props and returned JSX, nothing else.

Two properties followed, and they are the reason the pattern spread:

- **The presentational component was trivially testable** — props in, markup out,
  nothing to mock.
- **It was trivially reusable** — anything that could produce `users` and
  `loading` could render it.

## Why it made sense in 2015, specifically

*(This is the part usually left out, and without it the pattern looks
arbitrary.)*

In 2015 there were exactly two ways to share stateful logic between components:
[higher-order components](../../phase-2-components/13-higher-order-components/README.md)
and [render props](../../phase-2-components/12-render-props/README.md).

**Both force an extra component into the tree anyway.** `connect()(UserList)`
produces a wrapper; `<DataProvider>{…}</DataProvider>` produces a wrapper. Given
that you were paying for a wrapper component no matter what, making that wrapper
the *data layer* was not overhead — it was using something you already had.

That is the whole economic argument, and it evaporated the moment a hook could
add stateful logic to a component without adding a component.

Redux's `connect()` was the industrial version of the same idea: it generated the
container for you, so a codebase could have hundreds of them without anyone
writing one by hand.

## The retraction

The 2015 article carries an update from 2019 at the top:

> **Update from 2019: I wrote this article a long time ago and my views have
> since evolved. In particular, I don't *suggest* splitting your components like
> this anymore.**

He is careful about what he is and is not saying. The pattern "can be handy" if
it feels natural in a codebase; what he objects to is having "seen it enforced
without any necessity and with almost dogmatic fervor far too many times." His
diagnosis of *why* it worked is the important part — the value was **separating
complex stateful logic from the rest of the component**, and hooks do that
"without an arbitrary division."

The article closes:

> *"This text is left intact for historical reasons but don't take it too
> seriously."*

🔴 **Read that as a retraction of the mechanism, not of the goal.** Separating
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

One component instead of two, one file instead of two — and **the seam is still
there.** `useUsers` can be tested, reused and replaced independently of the
markup. What was lost is a component in the tree that existed only to pass props
down.

[Writing a custom hook](../../phase-7-custom-hooks/02-writing-a-custom-hook.md)
is the page, and
[designing a hook's API](../../phase-7-custom-hooks/06-designing-a-hooks-api/README.md)
is where that seam gets designed deliberately rather than by accident.

## Gotchas

**"Container" does not mean "the component that uses hooks."** Every component
uses hooks now. Applying the label by whether `useState` appears draws the line
at random and reproduces the pattern's worst version.

**The retraction is not "the idea was wrong."** People quote the 2019 update as
though it condemned separating data from rendering. It condemned the *arbitrary
division into two components*, and explicitly allowed the pattern where it feels
natural.

**A presentational component with twenty-four props is not a well-factored
presentational component.** It is a sign the split was not worth making — see
[chunk 02](02-what-survived.md).

**`connect(mapStateToProps)(Component)` is this pattern as a HOC**, and inherits
every HOC caveat: silent prop collisions, an unreadable wrapper stack, and
statics that do not survive. You will meet it in any codebase older than hooks —
[HOCs](../../phase-2-components/13-higher-order-components/README.md).

**The container in old code often holds more than data.** Routing decisions,
analytics, feature flags and permission checks accumulated there because it was
the only non-visual component available. Extracting "the data" from one is
usually not a one-step change.

**A container that renders `<View {...props} />` defeats memoization.** The
spread produces fresh props every render, so memoizing the presentational half
achieves nothing.

## Interview questions

**What is the container/presentational pattern?**
Splitting each feature into a container that owns state and data fetching and
renders no markup, and a presentational component that takes props and returns
JSX with no state of its own.

**Why did it make sense in 2015 specifically?**
Because the only ways to share stateful logic — HOCs and render props — added a
wrapper component regardless. Given that you were paying for a wrapper anyway,
making it the data layer cost nothing extra.

**Is it still recommended?**
No. Its author added a 2019 update saying he no longer suggests splitting
components this way, that he had seen it enforced dogmatically without necessity,
and that hooks achieve the original goal — separating complex stateful logic —
without an arbitrary division.

**So was the idea wrong?**
The mechanism was superseded, not the goal. Separating data concerns from
rendering is still correct; a custom hook is now the seam, so you get the
separation without a second component whose only job is passing props down.

**What exactly did hooks change?**
They let stateful logic be added to a component without adding a component. That
removed the economic argument the pattern rested on.

**What was `connect()`?**
Redux's generated container — the industrial version of the same split, which is
why the pattern is everywhere in pre-hooks codebases. It is a HOC and carries all
the HOC caveats.

**What is the wrong way to apply the label today?**
By asking whether a component uses hooks. Every component does; that test draws
the line at random.

---

Index: [Container / presentational](README.md) · Next → [02 · What survived](02-what-survived.md)
