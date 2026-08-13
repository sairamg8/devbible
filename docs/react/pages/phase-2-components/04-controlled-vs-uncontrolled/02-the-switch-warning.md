---
title: "The switch warning, and supporting both"
sidebar_label: "02 · The switch warning"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`<input>`](https://react.dev/reference/react-dom/components/input),
> including its troubleshooting entry *"I'm getting an error: 'A component is
> changing an uncontrolled input to be controlled'"*. No sandbox script backs
> this page; claims are cited, not measured.

**React decides whether an input is controlled by looking at whether `value` is
`undefined`. Once decided, it may not change — and the most common way to
violate that is to not realise you have a `value` at all.**

## The rule React enforces

react.dev states it directly:

> If a text input receives a string `value` prop, it will be treated as
> controlled. An input can't be both controlled and uncontrolled at the same
> time. **An input cannot switch between being controlled or uncontrolled over
> its lifetime.**

and gives the mechanism:

> If you provide a `value` to the component, it must remain a string throughout
> its lifetime. You cannot pass `value={undefined}` first and later pass
> `value="some string"` because React won't know whether you want the component
> to be uncontrolled or controlled.

The test is `value === undefined`, and it is evaluated on the **first** render.
Note what that implies and what it does not:

- `value={undefined}` → uncontrolled. The prop being *absent* is the same thing,
  since a missing prop reads as `undefined`.
- `value={null}` → also treated as no value, and React warns about it.
- `value=""` → **controlled.** An empty string is a value.
- `value={0}` → controlled. A falsy value is still a value.

The `""` and `0` rows are why the fix in the next section works.

## The four ways it happens

**1. State initialised from data that has not arrived**

```jsx
const [name, setName] = useState(user?.name);    // undefined on first render
return <input value={name} onChange={e => setName(e.target.value)} />;
```

`user` is `undefined` until the fetch resolves. First render: uncontrolled.
After the fetch: controlled. Warning.

**2. A field that is absent from an object**

```jsx
<input value={form.middleName} onChange={…} />   // key not present yet
```

`form.middleName` is `undefined` until the user types, at which point the
handler adds the key. Same shape, harder to spot, because the code looks
symmetric.

**3. `null` from an API**

```jsx
const {data} = useQuery(…);                       // data.note === null
<input value={data.note} onChange={…} />
```

JSON `null` is the standard "no value", and React does not treat it as a string.
This is the most common source in practice: the database column is nullable.

**4. Deliberately toggling**

```jsx
<input value={isEditing ? draft : undefined} defaultValue={saved} />
```

Written on purpose, usually to get a read-only display and an editable field out
of one element. React cannot support it.

## The fix

react.dev gives it:

> If your `value` is coming from an API or a state variable, it might be
> initialized to `null` or `undefined`. In that case, either set it to an empty
> string (`''`) initially, or pass `value={someValue ?? ''}` to ensure `value`
> is a string.

```jsx
const [name, setName] = useState('');            // ✅ never undefined
<input value={name} onChange={…} />

<input value={form.middleName ?? ''} onChange={…} />   // ✅ at the boundary
<input value={data.note ?? ''} onChange={…} />         // ✅ handles null too
```

`??` rather than `||` matters here: `value={count || ''}` turns a legitimate `0`
into an empty string. `??` only replaces `null` and `undefined`, which is
exactly the set React objects to.

For the deliberate-toggle case, the fix is two elements rather than one:

```jsx
{isEditing
  ? <input value={draft} onChange={e => setDraft(e.target.value)} />
  : <output>{saved}</output>}
```

Different element types at the same position, so React replaces rather than
mutates — and there is no lifetime during which one element changed mode.

## The reverse direction

The warning also fires the other way — controlled becoming uncontrolled — and it
has its own causes, all of which are a `value` that went `undefined`:

```jsx
setForm(f => ({...f, name: undefined}));      // 🔴 clearing by deleting the key
<input value={items[i]?.label} … />           // 🔴 the row disappeared
<input value={draft} … />                     // 🔴 setDraft(undefined) somewhere
```

The rule for the fix is the same and simpler to state as a habit: **clear a
field to `''`, never to `undefined`.** An empty string is a value; `undefined`
is the absence of one, and React reads it as a change of mode.

## Supporting both — the pattern behind the phase gate

Library components frequently need to work either way: uncontrolled by default
so simple callers pass nothing, controlled when a caller needs the value. This
is what `<Dialog>` in the phase gate requires, and it is worth learning as a
shape.

```jsx
function Dialog({open: openProp, defaultOpen = false, onOpenChange, children}) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const open = isControlled ? openProp : uncontrolledOpen;

  function setOpen(next) {
    if (!isControlled) setUncontrolledOpen(next);   // only own it if we own it
    onOpenChange?.(next);                            // always notify
  }

  return open ? <div role="dialog">{children}</div> : null;
}
```

Four rules make this correct, and each of them is a bug if skipped:

1. **Decide with `!== undefined`**, matching what React itself does. Not
   truthiness — `open={false}` is controlled.
2. **Always call the callback**, controlled or not. A caller may want to observe
   changes without owning the value; `onOpenChange` is how they do it.
3. **Only set internal state when uncontrolled.** Setting it while controlled
   creates a second copy of the value that will drift.
4. **Never sync the prop into state with an effect.** `useEffect(() =>
   setOpen(openProp), [openProp])` is the antipattern this whole pattern exists
   to avoid: it renders once with the wrong value, then again with the right one.

The remaining question is what to do when a caller switches modes mid-life —
passing `open` on one render and not the next. There is no good answer, which is
why React does not try to have one. Warn in development and pick a lane:

```jsx
if (process.env.NODE_ENV !== 'production') {
  const wasControlled = useRef(isControlled);
  if (wasControlled.current !== isControlled) {
    console.error('Dialog is changing between controlled and uncontrolled.');
  }
}
```

## The state-in-two-places test

Most controlled-component bugs reduce to one thing: the value exists twice and
something must keep the copies equal. The test for whether you have that problem:

> Can I delete one of these and compute it from the other?

If yes, delete it. A component holding `props.value` in its own state and
syncing with an effect has two copies and a race between them. A component that
reads `props.value` directly has one.

The narrow legitimate case is a **draft**: an editable copy the user is changing,
which is deliberately allowed to differ from the committed value until they save
or cancel. That is not duplication — the two values mean genuinely different
things, and the second one has a defined lifetime.

## Gotchas

**Symptom:** `A component is changing an uncontrolled input to be controlled.`
**Cause:** `value` was `undefined` or `null` on the first render and became a
string later — usually async data, a missing object key, or a nullable column.
**Fix:** `value={x ?? ''}`, or initialise the state to `''`. Use `??`, not `||`,
so `0` survives.

**Symptom:** the same warning in reverse, on clear or on delete.
**Cause:** the field was set to `undefined`, or the row it read from vanished.
**Fix:** clear to `''`. Treat `undefined` as reserved for "this input is
uncontrolled".

**Symptom:** a controlled input ignores typing entirely.
**Cause:** `value` is passed with no `onChange`, so React re-renders the same
value after every keystroke.
**Fix:** add `onChange`, or `readOnly` if that was the intent. Phase 1's
[form elements](../../phase-1-jsx/13-form-elements/01-controlled-and-uncontrolled.md)
page has the measured markup for each case.

**Symptom:** a "both modes" component drifts out of sync with its parent.
**Cause:** it copies the prop into state, or sets internal state while
controlled.
**Fix:** derive `value` from the prop when controlled and never store a second
copy.

**Symptom:** the value shows correctly for one render and then reverts.
**Cause:** an effect syncing prop → state fighting a handler setting state →
prop.
**Fix:** remove the effect. One owner, one direction.

## Interview questions

**★ What causes "A component is changing an uncontrolled input to be
controlled"?**
React decides the mode on the first render by checking whether `value` is
`undefined`, and the mode cannot change afterwards. The warning means `value`
started as `undefined` or `null` and later became a string — typically state
initialised from data that had not arrived, an object key that did not exist
yet, or a nullable API field. The fix is `value={x ?? ''}` or initialising to an
empty string.

**★ Why `??` rather than `||` in that fix?**
`||` also replaces `0` and `''`, so a numeric input showing zero would silently
become blank. `??` only replaces `null` and `undefined` — precisely the two
values React treats as "no value".

**★ How do you write a component that works both controlled and uncontrolled?**
Decide with `prop !== undefined`, keep internal state for the uncontrolled case,
read the effective value from the prop when controlled, only write internal
state when uncontrolled, and always call the change callback either way. Never
copy the prop into state with an effect — that creates a second copy that has to
be kept in sync and renders the wrong value first.

**Is `value=""` controlled or uncontrolled?**
Controlled. The test is `undefined`, not falsiness. `value={0}` and
`value={false}` are likewise controlled — which is why the `??` fix works at
all.

**Why does React refuse to let an input switch modes?**
Because it has no way to know which behaviour you want. Once uncontrolled, the
DOM holds the value and React does not overwrite it; once controlled, React
writes the value on every render. Switching would mean either discarding what
the user typed or ignoring what the parent passed, and neither is safe to
guess.

**What is wrong with copying a prop into state?**
It creates two sources of truth that must be kept equal by hand, and the effect
that does the copying always renders the stale value once before correcting it.
The exception is a deliberate draft — an editable copy that is *supposed* to
differ until saved or cancelled — which is a different value, not a duplicate.

---

← Prev: [Who owns the value](01-who-owns-the-value.md) ·
Index: [Controlled vs uncontrolled](README.md) ·
Next → [Lifting state up](../05-lifting-state-up/README.md)
