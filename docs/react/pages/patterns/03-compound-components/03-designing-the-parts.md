---
title: "Designing the parts"
sidebar_label: "03 · Designing the parts"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useContext`](https://react.dev/reference/react/useContext),
> [`useId`](https://react.dev/reference/react/useId),
> [`useRef`](https://react.dev/reference/react/useRef),
> [`useEffect`](https://react.dev/reference/react/useEffect),
> [Controlled and uncontrolled components](https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components),
> and [StrictMode](https://react.dev/reference/react/StrictMode) for the
> double-invocation behaviour the registration approach has to survive.
> ⚠️ Most of this page is **API design judgement**, marked as such. React does
> not document this pattern or prescribe any of these choices.
> No sandbox script backs this page; claims are cited, not measured.

**The mechanism is one page. The decisions that make it usable are this one.**

## Dot notation or named exports

Both work. They are not equivalent.

```jsx
// A — dot notation
Tabs.List = List; Tabs.Tab = Tab; Tabs.Panel = Panel;
import { Tabs } from './tabs';
<Tabs><Tabs.List><Tabs.Tab/></Tabs.List></Tabs>

// B — named exports
export { Tabs, TabsList, TabsTab, TabsPanel };
import { Tabs, TabsList, TabsTab } from './tabs';
<Tabs><TabsList><TabsTab/></TabsList></Tabs>
```

| | Dot notation | Named exports |
|---|---|---|
| Discoverability | **excellent** — `Tabs.` autocompletes the whole API | you have to know the names |
| Relationship is visible in the markup | **yes** | only by convention |
| Tree-shaking | ⚠️ **poor** — the assignments are side effects on the imported object, so a bundler generally cannot drop unused parts | **good** — unused exports drop |
| Import cost | one import | one per part |
| `import type` in TS | awkward — types hang off the namespace | straightforward |
| DevTools display | shows the inner component's name unless you set `displayName` | shows the real name |

*(Judgement:)* dot notation for a small widget whose parts are nearly always all
used — tabs, accordion, dialog. Named exports when the parts are large and often
unused, or when bundle size is under active scrutiny. **Shipping both** is common
and costs one line each; it also means two names for one thing in your docs, so
pick a primary and mention the other.

⚠️ Set `displayName` on parts either way, or a React DevTools tree of
`List`/`Tab`/`Panel` gives no hint which widget they belong to.

## How a part learns which one it is

This is the decision people get wrong, and it does not appear until the second
widget you build. `Tabs` above dodged it: every part carries an explicit
`value`. Widgets where **order matters** — a listbox, a menu, a roving-focus
toolbar — cannot dodge it, because the part needs its index.

### Option 1 — the caller passes it

```jsx
{items.map((item, i) => <Menu.Item key={item.id} index={i}>{item.label}</Menu.Item>)}
```

✅ Trivial to implement, completely predictable, no ordering subtleties.
⚠️ Noisy, and wrong the moment the caller renders items from two sources, filters
one out, or interleaves a `<Menu.Separator/>` that should not consume an index.

### Option 2 — parts register themselves

Each part reports itself to the parent on mount, and the parent hands back a
position.

```jsx
function useRegisterItem() {
  const { register } = useMenuContext('Item');
  const ref = useRef(null);
  useEffect(() => register(ref.current), [register]);
  return ref;
}
```

✅ The caller writes nothing.
⚠️ **Registration order is mount order, which is not reliably document order** —
and StrictMode's development double-invocation means every registration must be
idempotent and paired with an unregister. Getting a stable index out of this
requires sorting the registered nodes by document position
(`compareDocumentPosition`), at which point option 3 is simpler.

### Option 3 — read the DOM when you need it

Keep a ref to the container; query the parts at the moment you need an ordering.

```jsx
const getItems = useCallback(
  () => Array.from(containerRef.current?.querySelectorAll('[role="menuitem"]') ?? []),
  [],
);
```

✅ Always in true document order, whatever the caller did — filters, wrappers,
portals within the container, conditional parts.
⚠️ Reads the DOM, so it is client-only and useless during the first server
render; and it couples the parent to a selector, which the caller can break by
overriding `role`.

*(Judgement:)* **option 1 for anything with a natural identity** — a tab has a
`value`, a form field has a `name` — and **option 3 when true visual order is the
identity**, which is most keyboard-navigation widgets. Option 2 is the one that
looks cleanest and causes the most bugs.

## Controlled and uncontrolled parents

A compound parent holds state, so it faces the same question as an `<input>` —
and callers will expect both modes.

```jsx
export function Tabs({ value: controlled, defaultValue, onValueChange, children }) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : uncontrolled;

  const setValue = useCallback((next) => {
    if (!isControlled) setUncontrolled(next);
    onValueChange?.(next);          // fires in BOTH modes
  }, [isControlled, onValueChange]);
  // …
}
```

Three rules that come straight from
[controlled vs uncontrolled](../../phase-2-components/04-controlled-vs-uncontrolled/README.md):

- **`undefined` decides the mode, and it decides it permanently.** A caller who
  passes `value={maybeUndefined}` flips modes mid-life and gets React's
  switch warning.
- **`onValueChange` fires in both modes.** An uncontrolled caller still wants to
  know; making the callback controlled-only is a common and annoying bug.
- **In controlled mode the parent must not update its own state.** The caller is
  the source of truth, including when they ignore the change.

⚠️ **The parts do not need to know which mode is active.** They call `setValue`
and read `value`; the branching lives in the parent. If a part is checking
`isControlled`, the abstraction has leaked.

## What each part should own

*(Judgement, but it is the line that keeps a compound API coherent.)*

| The part owns | The parent owns |
|---|---|
| its own element and attributes | the shared state |
| its own `children` | the ids that relate parts to each other |
| presentation props (`className`, `style`) | keyboard handling that spans parts |
| its identity (`value`/`index`) | which part is active |

The test: **if two parts need to agree about it, it belongs to the parent.**
Roving `tabindex` is parent-owned because exactly one part may have it; a
`className` is part-owned because no other part cares.

## Required, optional, and missing parts

Decide explicitly, because the caller will find out either way:

- **A missing optional part is silence.** `<Tabs>` without `<Tabs.List>` renders
  panels with no way to switch — valid, occasionally intended.
- **A missing required part should be loud.** If your `Dialog` needs a
  `Dialog.Title` for `aria-labelledby`, a development-only warning when none
  registered is worth more than a correct-looking dialog no screen reader can
  name.
- **A duplicated part is usually a bug.** Two `<Tabs.Panel value="team">` produce
  duplicate ids and break `aria-controls`. Warn in development.

⚠️ You cannot check any of this by inspecting `children` — same direct-children
limitation as chunk 01. It has to be registration or a `useEffect` count in the
parent.

## Recovering the structural freedom

The pattern's cost is that `Tabs.Tab` renders a `<button>` and `Tabs.Panel`
renders a `<div>`. Two escapes, both covered in the supporting techniques:

```jsx
<Tabs.Tab as="a" href="/billing">Billing</Tabs.Tab>       {/* polymorphic */}

<Tabs.Tab asChild>                                          {/* slot */}
  <NavLink to="/billing">Billing</NavLink>
</Tabs.Tab>
```

[Polymorphic components](../supporting/polymorphic-components.md) covers `as`,
including why the rename to a capitalised variable is mandatory; the `asChild`
trade-offs are in
[headless § delivery shapes](../06-headless-components/05-the-delivery-shapes.md).

*(Judgement:)* add one of these before your first caller asks. Retrofitting `as`
onto five parts is easy; retrofitting it after three teams have styled around the
element you chose is not.

## Gotchas

**Dot notation defeats tree-shaking.** `Tabs.Panel = Panel` is a side-effecting
assignment on an imported object, so bundlers keep `Panel` even when nobody
renders one.

**Parts without `displayName` are unreadable in DevTools.** A tree of anonymous
`Tab` components tells you nothing about which widget instance they belong to.

**Registration order is not document order.** Mount order, StrictMode's
double-invocation and conditional parts all perturb it. If you register, sort by
`compareDocumentPosition` or accept that your indices are wrong sometimes.

**A registration effect without a matching unregister leaks.** Every part must
clean up, or a filtered-out item stays in the parent's list forever and keyboard
navigation lands on nothing.

**Querying the DOM for parts breaks if the caller overrides `role`.** Option 3
couples the parent to a selector that the part's `{...rest}` spread lets the
caller change.

**`value={undefined}` flips a controlled parent to uncontrolled**, silently,
mid-life. The usual cause is `value={props.value}` where the prop is optional.

**`onValueChange` that only fires when controlled is a bug**, and a common one —
uncontrolled callers still need to react.

**Passing the whole parent API through one context re-renders every part on every
change.** Splitting state from the setters is the standard fix —
[context plus reducer](../../phase-5-refs-context-reducers/12-context-plus-reducer.md)
does exactly that, and chunk 03 measures the consequence.

**Duplicate identities produce duplicate DOM ids** and silently break
`aria-controls`/`aria-labelledby`, which nothing in React will warn about.

**Spreading `{...rest}` before your own attributes means the caller cannot
override anything; after means they can override everything.** Neither is a
default — decide per attribute, as in
[prop getters](../supporting/prop-getters.md).

**A part that works standalone is a design smell.** If `<Tabs.Tab>` renders
sensibly with no parent, either it should not be a compound part or your guard
is missing.

## Interview questions

**Dot notation or named exports — how do you choose?**
Dot notation gives discoverability and makes the relationship visible in the
markup but defeats tree-shaking, because the assignments are side effects on the
imported object. Named exports shake out cleanly and are better for TypeScript
type imports. Small always-used widgets favour dots; large or rarely-used parts
favour named exports.

**How does a part know which one it is?**
Three ways: the caller passes an identity, the parts register themselves with the
parent, or the parent reads document order from the DOM when it needs an
ordering.

**Which of those is the trap?**
Registration. Mount order is not document order, StrictMode double-invokes
effects in development, and every registration needs a matching unregister.
Making it correct usually means sorting by `compareDocumentPosition`, at which
point querying the DOM directly is simpler.

**When is reading the DOM the right answer?**
When true visual order *is* the identity — keyboard-navigation widgets like
menus, listboxes and toolbars. It is client-only and it couples the parent to a
selector the caller can break.

**How do you support both controlled and uncontrolled parents?**
Treat `value !== undefined` as the mode switch, keep internal state for the
uncontrolled case, read whichever applies, and fire the change callback in both
modes. The parts should never need to know which mode is active.

**What decides whether something belongs to a part or to the parent?**
Whether two parts have to agree about it. Shared state, cross-part keyboard
handling and the ids that relate parts belong to the parent; elements, children
and presentation belong to the part.

**How do you detect a missing required part?**
Not by inspecting `children` — that only sees direct children. Registration or a
count in the parent, with a development-only warning.

**What does the pattern cost structurally, and how do you give it back?**
The parts render fixed elements. A polymorphic `as` prop or an `asChild` slot
returns the choice to the caller, and adding one early is far cheaper than
retrofitting it.

**Why is a compound part that works standalone suspicious?**
Because the pattern exists for parts that must coordinate. If one renders
sensibly alone, either it is not really a part or its guard is missing.

---

← Prev: [02 · Why context, not `cloneElement`](02-why-context.md) · Index: [Compound components](README.md) · Next → [04 · The costs and the limits](04-the-costs-and-limits.md)
