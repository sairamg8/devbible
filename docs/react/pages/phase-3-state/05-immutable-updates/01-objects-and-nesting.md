---
title: "Objects and nesting"
sidebar_label: "01 · Objects and nesting"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Updating Objects in State](https://react.dev/learn/updating-objects-in-state).
> No sandbox script backs this page; claims are cited, not measured.

**React compares state with `Object.is`. Mutate the object and the reference is
unchanged, so React concludes nothing happened — and the update disappears with
no error.**

## Treat state as read-only

react.dev states it as a rule rather than a preference:

> In other words, you should **treat any JavaScript object that you put into
> state as read-only.**

Objects in state are technically mutable — JavaScript does not stop you — but
React's model requires that you replace rather than modify. The recap is blunt
about what mutation costs:

> When you store objects in state, mutating them will not trigger renders **and
> will change the state in previous render "snapshots"**.

That second half is the part people miss. A mutation does not merely fail to
update — it retroactively corrupts every closure that captured the object. The
handler from the previous render, the value the memoized child is holding, the
array an effect closed over: they all point at the same object you just changed.
Debugging then becomes impossible, because two renders that should have shown
different data now show identical data.

## The two failures, precisely

```jsx
const [position, setPosition] = useState({x: 0, y: 0});

function onMove(e) {
  position.x = e.clientX;      // 🔴 nothing happens on screen
  position.y = e.clientY;
}
```

**Failure 1 — no render.** Nothing called a setter, so React was never asked to
render.

```jsx
function onMove(e) {
  position.x = e.clientX;
  setPosition(position);       // 🔴 still nothing happens
}
```

**Failure 2 — the bail-out.** A setter *was* called, but `position` is the same
object it always was. React compares with `Object.is`, finds them identical, and
skips the re-render as an optimisation ([topic 11](../11-bailing-out.md)). The
data changed; the screen did not.

Failure 2 is much worse than failure 1, because the code looks correct. It is
also the failure that survives review.

## The fix, and the exception

```jsx
setPosition({...position, x: e.clientX});     // ✅ new object
```

But mutation is not banned outright — only mutation of objects that already
exist. react.dev:

> Code like this is a problem because it modifies an *existing* object in state:
> ```js
> position.x = e.clientX;
> ```
> But code like this is **absolutely fine** because you're mutating a fresh
> object you have *just created*:
> ```js
> const nextPosition = {};
> nextPosition.x = e.clientX;
> nextPosition.y = e.clientY;
> setPosition(nextPosition);
> ```

This is the same **local mutation** exception as
[Phase 2's purity topic](../../phase-2-components/02-purity/02-what-is-allowed.md),
applied to state updates. Build the next object however you like — loops,
conditional assignment, a `Map` you fill in — as long as it is an object nothing
else has a reference to yet. Only the handoff to `setState` has to be a *new*
object.

That matters for readability. Complex updates do not need to be a single
unreadable spread expression:

```jsx
function onSubmit() {
  const next = {...form};              // ✅ my copy
  if (isPro) next.tier = 'pro';        // ✅ mutate it freely
  if (!next.email) next.email = defaultEmail;
  delete next.tempId;
  setForm(next);                       // ✅ hand over a new object
}
```

## Spread is shallow — and this is the main trap

> Note that the `...` spread syntax is "shallow"--it only copies things one level
> deep. This makes it fast, but it also means that if you want to update a nested
> property, you'll have to use it more than once.

```jsx
const [person, setPerson] = useState({
  name: 'Niki',
  artwork: {title: 'Blue Nana', city: 'Hamburg'},
});

setPerson({...person, artwork: {...person.artwork, city: 'New Delhi'}});
```

The critical thing to see: **`{...person}` copies the `artwork` reference, not
the artwork.** So

```jsx
const next = {...person};
next.artwork.city = 'New Delhi';       // 🔴 mutated the ORIGINAL artwork
setPerson(next);
```

is still a mutation bug. The outer object is new — so React will re-render, and
the screen will even look right — but the nested object in the previous
snapshot was changed underneath. This one is genuinely hard to find, because it
half-works.

The rule: **copy all the way up from the thing you are changing.** Every object
on the path from the root to the changed value needs to be new; everything off
that path can be shared.

```jsx
setPerson({
  ...person,                       // copy other fields
  artwork: {                       // but replace the artwork
    ...person.artwork,             // with the same one
    city: 'New Delhi',             // but in New Delhi!
  },
});
```

## Three levels is the signal to stop

```jsx
setState({
  ...state,
  users: {
    ...state.users,
    [id]: {
      ...state.users[id],
      profile: {
        ...state.users[id].profile,
        theme: 'dark',
      },
    },
  },
});
```

This is correct, and it is a warning. Both remedies are documented:

**Flatten the state.** react.dev's own first suggestion, and the better one when
you control the shape:

> If your state is deeply nested, you might want to consider
> [flattening it.](https://react.dev/learn/choosing-the-state-structure#avoid-deeply-nested-state)

[Structuring state](../10-structuring-state.md) covers this — a normalised
`{byId, allIds}` shape turns the update above into a two-level spread.

**Or use Immer**, which the docs recommend by name for when you cannot change
the shape:

> if you don't want to change your state structure, you might prefer a shortcut
> to nested spreads. Immer is a popular library that lets you write using the
> convenient but mutating syntax and takes care of producing the copies for you.

```jsx
updatePerson(draft => {
  draft.artwork.city = 'Lagos';        // looks like mutation, produces a copy
});
```

Immer gives you a proxy draft, records the writes, and produces a new object
with structural sharing — untouched branches keep their identity, which is
exactly what memoized children need. The [next chunk](02-arrays-and-tools.md)
covers where it fits alongside `structuredClone` and the native non-mutating
methods.

## Computed keys and removal

Two operations the spread pattern does not make obvious:

```jsx
setForm({...form, [field]: value});        // dynamic key — one handler, many inputs
```

```jsx
const {[id]: _removed, ...rest} = byId;    // remove a key
setById(rest);
```

The first is worth knowing because it collapses a form's worth of handlers into
one. The second is the object equivalent of `filter`, and it is the readable way
to delete a key without `delete` on a shared object.

## Gotchas

**Symptom:** the state changed but the screen did not.
**Cause:** the object was mutated and passed to the setter, so `Object.is`
reported no change and React skipped the render.
**Fix:** a new object. This is the failure that looks most like a React bug and
is not one.

**Symptom:** it renders correctly, but two renders' worth of data are
mysteriously identical in the debugger.
**Cause:** a nested mutation — the outer object was copied, an inner one was
mutated, so previous snapshots were changed underneath.
**Fix:** copy every level on the path to the value being changed.

**Symptom:** a memoized child does not update.
**Cause:** it received the same nested object reference, because the copy was
shallow and the change was deeper.
**Fix:** the same — copy the whole path. Everything off the path can and should
stay shared.

**Symptom:** the update code is five levels of spread and nobody will edit it
again.
**Cause:** the state shape is too nested.
**Fix:** flatten it, which is react.dev's first suggestion, or adopt Immer if
the shape is fixed.

**Symptom:** `delete state.x` appears to work.
**Cause:** it mutates. It will fail in exactly the ways above.
**Fix:** rest destructuring — `const {x: _, ...rest} = state`.

## Interview questions

**★ Why does mutating state not update the UI?**
Two separate failures. If you only mutate, no setter was called, so React was
never asked to render. If you mutate and then pass the same object to the
setter, React compares with `Object.is`, sees the identical reference, and skips
the re-render as an optimisation. The second is worse, because the code looks
right.

**★ What does the documentation mean by mutation changing previous snapshots?**
Every closure that captured that object — an earlier render's event handler, a
memoized child's props, a value an effect closed over — points at the same
object. Mutating it changes what all of them see, retroactively. So two renders
that should show different data now show the same data, which makes the bug
almost impossible to reason about.

**★ Why is spread syntax a trap for nested state?**
Because it is shallow — one level deep. `{...person}` copies the reference to
`person.artwork`, not the artwork itself, so mutating `next.artwork.city` still
mutates the original. The rule is to create a new object at every level on the
path from the root to the value you are changing; anything off that path should
stay shared.

**Is mutation ever acceptable in a state update?**
Yes — on an object you just created in that handler and nothing else holds a
reference to. The documentation calls building an object field-by-field before
passing it to the setter "absolutely fine". Only the object you hand to
`setState` has to be new.

**When would you reach for Immer?**
When the state shape is genuinely nested and you cannot flatten it. It lets you
write mutating-looking code against a draft and produces an immutable copy with
structural sharing, so untouched branches keep their identity. react.dev
recommends it by name — but it also suggests flattening the state first, which
is the better fix when the shape is yours to change.

**How do you remove a key from an object in state?**
Rest destructuring — `const {[id]: _removed, ...rest} = byId; setById(rest)`.
`delete` mutates the existing object and produces both failure modes above.

---

← Index: [Immutable updates](README.md) · Next → [Arrays, and the tools](02-arrays-and-tools.md)
