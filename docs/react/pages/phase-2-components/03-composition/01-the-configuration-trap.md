---
title: "The configuration trap"
sidebar_label: "01 · The configuration trap"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
> and [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context).
> No sandbox script backs this page; claims are cited, not measured. The
> naming conventions described here are community practice and are labelled as
> such.

**Every component starts with three props and ends with twenty-three. The
question is not how to avoid that — it is which of the twenty-three should have
been JSX instead.**

## How the trap closes

Nobody designs a twelve-boolean component. It accretes, and each step is
individually reasonable.

```jsx
// Monday
<Card title="Orders" />

// Tuesday — "we need a subtitle"
<Card title="Orders" subtitle="Last 30 days" />

// Wednesday — "the dashboard one needs an icon"
<Card title="Orders" subtitle="Last 30 days" icon="chart" />

// Thursday — "and a button on the right"
<Card title="Orders" icon="chart"
      actionLabel="Export" onAction={exportCsv} actionVariant="secondary" />

// Friday — "the settings page needs two buttons and a badge"
<Card title="Orders" icon="chart"
      actionLabel="Export" onAction={exportCsv} actionVariant="secondary"
      secondaryActionLabel="Refresh" onSecondaryAction={refresh}
      badgeText="Beta" badgeColor="purple" showDivider hideHeaderPadding />
```

By Friday the component has a problem that is not about aesthetics. Look at what
`Card` now contains internally:

```jsx
function Card({title, subtitle, icon, actionLabel, onAction, actionVariant,
               secondaryActionLabel, onSecondaryAction, badgeText, badgeColor,
               showDivider, hideHeaderPadding, children}) {
  return (
    <div className={hideHeaderPadding ? 'card card--tight' : 'card'}>
      {(title || icon || badgeText) && (
        <header>
          {icon && <Icon name={icon} />}
          {title && <h3>{title}</h3>}
          {badgeText && <Badge color={badgeColor}>{badgeText}</Badge>}
          {(actionLabel || secondaryActionLabel) && (
            <div className="actions">
              {secondaryActionLabel && <Button variant="ghost" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>}
              {actionLabel && <Button variant={actionVariant} onClick={onAction}>{actionLabel}</Button>}
            </div>
          )}
        </header>
      )}
      {subtitle && <p className="sub">{subtitle}</p>}
      {showDivider && <hr />}
      {children}
    </div>
  );
}
```

**The component is now a rendering engine for a small configuration language it
invented.** Every prop is a term in that language, and the body is the
interpreter. That has four costs, and none of them is style.

**1. The API grows without bound.** The next requirement — a link instead of a
button, an icon on the right, a tooltip on the badge — cannot be met by the
caller. It requires editing `Card`. A component that must be edited to be used
is not reusable; it is a shared bottleneck with a queue.

**2. Combinations multiply untested.** Twelve booleans is 4096 states. The three
you use are tested and the rest are theoretical. Bugs live in the combinations
nobody tried — `badgeText` with no `title`, `showDivider` with no `children`.

**3. It bundles everything for everyone.** `Card` imports `Icon`, `Badge` and
`Button` because *some* caller might need them. Every caller pays for all
three. In a Server Components app the cost is sharper still, since a `Card` that
imports a client-only `Button` drags the whole subtree client-side.

**4. It hides the markup from the person who needs to change it.** The caller
can see `actionVariant="secondary"` but cannot see, or influence, the `<div
className="actions">` that wraps it.

## The inversion

Composition asks a different question. Not *"what options does this component
need?"* but *"what part of this is genuinely the component's job?"*

For `Card`, the answer is: a box, some padding, a border, and slots for other
people's markup. Everything else was the caller's to begin with.

```jsx
function Card({header, children, footer}) {
  return (
    <div className="card">
      {header && <header className="card__header">{header}</header>}
      <div className="card__body">{children}</div>
      {footer && <footer className="card__footer">{footer}</footer>}
    </div>
  );
}
```

Three props. The Friday requirement becomes:

```jsx
<Card
  header={
    <>
      <Icon name="chart" />
      <h3>Orders</h3>
      <Badge color="purple">Beta</Badge>
      <div className="actions">
        <Button variant="ghost" onClick={refresh}>Refresh</Button>
        <Button variant="secondary" onClick={exportCsv}>Export</Button>
      </div>
    </>
  }
>
  <OrdersTable />
</Card>
```

Longer at the call site — and that is the trade, stated honestly. What you buy:

- **`Card` never changes again.** A link instead of a button, a second badge, a
  tooltip: all caller-side.
- **No untested combinations**, because there are no combinations. There is
  markup, and the caller wrote it.
- **`Card` imports nothing** but its own CSS. `Icon`, `Badge` and `Button` are
  imported by the callers that actually use them.
- **The markup is visible where it is used.** Nobody opens `Card.jsx` to find
  out why the icon is on the left.

The general form of the rule: **a prop that exists only to be rendered should
have been the rendered thing.** `actionLabel` + `onAction` + `actionVariant`
were three props encoding one `<Button>`. Pass the `<Button>`.

## Elements are ordinary values

This works because a React element is a plain object, and props take any value.
There is no special "slot" mechanism — Phase 1's
[JSX is a function call](../../phase-1-jsx/01-jsx-is-a-function-call.md)
established that `<Icon />` evaluates to an object, and objects go in props like
anything else.

```jsx
const header = <h3>Orders</h3>;   // just a value
<Card header={header} />          // just a prop
```

Which means everything you already know about values applies: elements can be
stored in variables, put in arrays, returned from functions, passed through
several layers, and chosen with a ternary. Nothing new is being learned here —
the insight is only that you are *allowed* to.

Two properties worth stating because they surprise people:

**Creating an element does not render it.** `<ExpensiveThing />` as a prop value
builds a small descriptor object; the component is not called until React
reaches that element in the tree. Passing an element you might not render costs
almost nothing.

**Where it is created decides what it can see.** An element passed as a prop
closes over the *caller's* scope. This is the mechanism behind the "context
hole" pattern and the reason composition is the standard fix for prop drilling —
[next chunk](02-slots-and-children.md).

## When configuration is the right answer

Composition is not universally correct, and applying it everywhere produces its
own mess — call sites bloated with markup that was identical in forty places.

Keep it a prop when:

- **The value is data, not markup.** `title="Orders"` is a string. Making the
  caller write `<h3>` in every one of forty call sites so that one of them can
  write `<h2>` is a bad trade.
- **The component owns the decision.** A `<Dialog>` deciding whether it is modal
  is not the caller's markup — it is behaviour, and `modal` is the right prop.
- **The variants are a closed, finite set the design system owns.**
  `variant="primary" | "secondary" | "ghost"` is deliberately not extensible.
  That is a constraint, not a limitation.
- **Consistency is the point.** If every card in the product must have its title
  rendered identically, a `title` string enforces that and a `header` element
  does not.

The distinguishing question: **is this a decision the design owns, or markup the
caller owns?** Design decisions are props. Caller markup is composition.

A practical test with a good hit rate: if a prop's name contains a UI noun —
`icon`, `label`, `button`, `text`, `title` — *and* the component's body renders
it inside a wrapper the caller might want to change, it is a composition
candidate. If it names a state or a mode — `disabled`, `variant`, `size`,
`open` — it is a prop.

## Gotchas

**Symptom:** a shared component has a prop nobody remembers adding and two
callers.
**Cause:** the configuration ratchet — each requirement added a prop rather than
a slot, and props are never removed because removing one is a breaking change.
**Fix:** when adding the third prop for one caller, stop and ask whether that
caller should be passing markup instead.

**Symptom:** a component renders `{icon && …}{title && …}{badge && …}` in a row.
**Cause:** those three props are one slot wearing a disguise.
**Fix:** replace them with a single `header` element prop.

**Symptom:** a leaf component pulls a heavy dependency into every bundle that
touches it.
**Cause:** it imports the thing so callers can select it by name
(`icon="chart"`).
**Fix:** let callers pass `<ChartIcon />` and import it themselves. The
dependency follows the use.

**Symptom:** every call site of a composed component is fifteen lines of
identical JSX.
**Cause:** composition applied where configuration was correct — the markup was
never caller-specific.
**Fix:** wrap the common shape in a second component (`<OrdersCard>` built on
`<Card>`). Composition and configuration coexist; the specific component
configures the general one.

## Interview questions

**★ What does "composition over configuration" mean in React?**
Prefer letting callers pass markup — as `children` or as element props — over
growing an API of options that the component interprets. The test is ownership:
a prop that exists only to be rendered inside a wrapper is markup the caller
should have written. Props stay for genuine decisions — modes, variants,
behaviour — and for data.

**★ Why is a twelve-boolean component actually a problem?**
Four concrete costs. The API can only grow, so every new requirement is an edit
to shared code. The combinations multiply far past what anyone tests. The
component imports everything any caller might need, so every caller pays the
bundle cost. And the markup is hidden from the person who wants to change it.
None of those are aesthetic.

**★ How can you pass an element as a prop, and why does it work?**
Because a React element is a plain object and props accept any value —
`<Card header={<h3>Orders</h3>} />` is passing an object. Creating the element
does not render it; React calls the component only when it reaches that element
in the tree, so passing something you may not render is nearly free.

**When would you keep a configuration prop rather than compose?**
When the value is data (`title="Orders"`), when the decision belongs to the
component (`modal`), when the variant set is deliberately closed
(`variant="primary"`), or when consistency across call sites is the goal. A
design system's job is often to *prevent* callers from writing arbitrary markup.

**Does passing `<Expensive />` as a prop that might not be rendered cost
anything?**
Almost nothing. JSX builds a descriptor object; the component function is not
invoked until React renders that element. The cost is one object allocation, not
a render.

---

← Index: [Composition over configuration](README.md) · Next → [Slots, children and the context hole](02-slots-and-children.md)
