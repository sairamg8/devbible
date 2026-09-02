---
title: "An inline JSX handler is contextually typed and the same arrow hoisted one line up is not, e.target is a bare EventTarget everywhere except the one event that overrides it, and async handlers are legal for a reason async effects are not"
sidebar_label: "08b · Events and contextual typing"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **`@types/react` 19.2.18** declarations read in
> this repo — `interface BaseSyntheticEvent<E = object, C = any, T = any>`,
> `interface SyntheticEvent<T = Element, E = Event> extends
> BaseSyntheticEvent<E, EventTarget & T, EventTarget> {}`,
> `interface ChangeEvent<CurrentTarget = Element, Target = Element> extends
> SyntheticEvent<CurrentTarget> { target: EventTarget & CurrentTarget }` with
> its `// TODO` comment, `interface FormEvent<T = Element> extends
> SyntheticEvent<T> {}`, and
> `type EventHandler<E extends SyntheticEvent<any>> = { bivarianceHack(event:
> E): void }["bivarianceHack"];` — and the TypeScript handbook on
> [contextual typing and `void`-returning assignability](https://www.typescriptlang.org/docs/handbook/2/functions.html).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**"Why does this arrow need a type annotation when the identical arrow inline
in the JSX does not?" is contextual typing working correctly, and it is worth
being able to explain rather than routing around.** The same question underlies
three other React-and-TypeScript irritations: why `e.target.value` compiles in
one handler and not another, why `useCallback` breaks a handler that worked,
and why an `async` submit handler is fine when an `async` effect is an error.
All four answers are in three declarations.

## Contextual typing: inline yes, hoisted no

```tsx
// ✓ no annotation needed — the prop's type flows into the arrow
<input onChange={(e) => setQuery(e.target.value)} />

// ✗ implicit any — nothing is contextually typing this declaration
function handleChange(e) { setQuery(e.target.value); }
<input onChange={handleChange} />

// ✓ annotate when you hoist
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  setQuery(e.target.value);
}
```

The inline arrow is checked against the prop's declared type
(`ChangeEventHandler<HTMLInputElement>`), so its parameter gets that type for
free. A standalone declaration is checked against nothing, so its parameter is
implicitly `any` — an error under `noImplicitAny` and a silent hole without it.
**The same thing happens the moment you wrap the arrow in `useCallback`**,
because `useCallback<T extends Function>` supplies no parameter types either
([chunk 02b](02b-the-dependency-array-the-compiler-cannot-check.md)). Moving a
working handler is what breaks it, which is why it feels arbitrary the first
time.

The alternative to annotating the parameter is annotating the *variable*, which
is usually nicer because it types the whole signature at once:

```ts
const handleChange: React.ChangeEventHandler<HTMLInputElement> =
  (e) => setQuery(e.target.value);
```

## `e.target` and `e.currentTarget` are not interchangeable

```ts
interface SyntheticEvent<T = Element, E = Event>
  extends BaseSyntheticEvent<E, EventTarget & T, EventTarget> {}
//                              ^ currentTarget    ^ target
```

On the base event, **`currentTarget` is `EventTarget & T` and `target` is a
bare `EventTarget`** — so `e.target.value` in a `FormEvent` handler does not
compile, and `e.currentTarget.value` does. That is not an oversight: the click
may have landed on a child element, so the type of `target` genuinely is not
known. `ChangeEvent` overrides the field, with a comment worth reading
verbatim:

```ts
interface ChangeEvent<CurrentTarget = Element, Target = Element> extends SyntheticEvent<CurrentTarget> {
    // TODO: This is wrong for change event handlers on arbitrary. Should
    // be EventTarget & Target, but kept for backward compatibility until React 20.
    target: EventTarget & CurrentTarget;
}
```

So `e.target.value` works in a change handler and only there, by an explicit
backward-compatibility decision the types themselves flag as wrong. **Prefer
`e.currentTarget`**: correct on every event type, it is the element the handler
is attached to, and it does not depend on a shim with a scheduled removal.

## `EventHandler` returns `void` — so `async` handlers are fine here

```ts
type EventHandler<E extends SyntheticEvent<any>> = { bivarianceHack(event: E): void }["bivarianceHack"];
type FormEventHandler<T = Element> = EventHandler<FormEvent<T>>;
type ChangeEventHandler<CurrentTarget = Element, Target = Element> =
  EventHandler<ChangeEvent<CurrentTarget, Target>>;
```

The return type is exactly `void`, not `void | Destructor`, so the handbook's
assignability rule from [chunk 06](06-effects-cleanup-and-abort.md) applies and
`onSubmit={async (e) => { … }}` is accepted. **That is the deliberate contrast
with `useEffect`**: React ignores an event handler's return value and *calls*
an effect's, so the two declarations are written differently on purpose. If you
can explain that difference you can explain most of React's typings.

📌 **`bivarianceHack` is the React types' way of making handler parameters
bivariant** under `strictFunctionTypes` — declaring the signature as a method
inside an object type and then indexing it out. The effect is that a
`MouseEventHandler<HTMLElement>` can be passed where a
`MouseEventHandler<HTMLButtonElement>` is expected. It is a deliberate
unsoundness, taken because handlers being assignable in the direction React
users expect is worth more than the soundness it costs.

## Gotchas

**★ A hoisted handler has no contextual type and its parameter is implicitly
`any`.** Inline in JSX it is checked against the prop; declared separately it
is checked against nothing. Annotate the parameter
(`e: React.ChangeEvent<HTMLInputElement>`) or annotate the variable
(`const h: React.ChangeEventHandler<HTMLInputElement> = (e) => …`); the second
scales better and is the same type the prop declares.

**★ Wrapping a working inline handler in `useCallback` removes its contextual
type.** `useCallback<T extends Function>(callback: T, deps)` gives `Function`
as the constraint, which carries no parameter information at all. The handler
that compiled inline now has an implicit `any` parameter, and the diff looks
like it changed nothing about types.

**★ `e.target.value` compiles in a `ChangeEvent` handler and not in a
`FormEvent` one.** `SyntheticEvent` declares `target: EventTarget`;
`ChangeEvent` overrides it to `EventTarget & CurrentTarget` — and its own
comment says that override is *"wrong for change event handlers on arbitrary
[elements]"* and kept *"for backward compatibility until React 20"*. Use
`e.currentTarget`, which is correct everywhere and is not scheduled to change.

**★ `e.target` is the element that was clicked; `e.currentTarget` is the
element the handler is on.** For a click on a `<button>` containing an `<svg>`,
`e.target` may be the `svg`. The types encode this correctly — `target` is a
bare `EventTarget` precisely because it could be anything inside — and code
that reads `e.target.dataset.id` in a delegated handler is relying on a cast to
get there. If delegation is the design, narrow explicitly:

```ts
function onListClick(e: React.MouseEvent<HTMLUListElement>) {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  const id = el.closest('li')?.dataset.id;
  …
}
```

**★ `async` event handlers are accepted and `async` effects are not, and that
inconsistency is intentional.** `EventHandler`'s return type is exactly
`void`, so the handbook's void-assignability rule lets a `Promise<void>`
through; `EffectCallback`'s is `void | Destructor`, which blocks it. React
ignores a handler's return value and calls an effect's. Knowing which
declaration you are satisfying is the whole explanation.

**★ An `async` submit handler still needs `e.preventDefault()` before its first
`await`.** After an `await`, the browser has already handled the event and
calling `preventDefault` does nothing. No type expresses "must be called
synchronously"; the form just navigates and the page reloads mid-checkout.

**★ An unhandled rejection in an `async` handler goes nowhere.** Because the
returned promise is ignored, a `throw` inside an async handler produces an
unhandled rejection rather than an error boundary or a visible failure. The
`void` return type is precisely what allows that, so `try`/`catch` inside the
handler is not optional — it is the only place the error can be caught.

**★ `React.MouseEvent` and the DOM's `MouseEvent` are different types with the
same name.** Inside a `.tsx` file with `import type {MouseEvent} from 'react'`
in scope, a handler annotated `MouseEvent` is React's synthetic one; without
the import it is the DOM's, and `e.currentTarget` then has the wrong type.
Prefer the qualified `React.MouseEvent<HTMLButtonElement>` in annotations so
the reader can see which one is meant. The same collision applies to
`KeyboardEvent`, `FocusEvent`, `DragEvent` and `ChangeEvent`.

**★ A handler passed to a child component needs the handler type, not the event
type.** `onSelect: (e: React.MouseEvent<HTMLLIElement>) => void` in a child's
props leaks a DOM detail upward and forces the parent to know what element the
child renders. `onSelect: (id: ProductId) => void` is the prop the parent
should see; translating the event into a domain value is the child's job.

## Interview questions

**★ Why does an inline JSX event handler need no annotation while the same
arrow hoisted to a `const` does?**
Contextual typing. Inline, the arrow is checked against the prop's declared
type — `ChangeEventHandler<HTMLInputElement>` — so its parameter gets that type
for free. A standalone declaration is checked against nothing, so the parameter
is implicitly `any`, which `noImplicitAny` reports. Either annotate the
parameter or annotate the variable with the handler type; the second is
preferable because it types the whole signature at once and matches what the
prop declares.

**★ `e.target.value` or `e.currentTarget.value`?**
`currentTarget`, in general. `SyntheticEvent` declares `currentTarget` as
`EventTarget & T` and `target` as a bare `EventTarget`, which is correct — the
event may have originated on a child element. `ChangeEvent` overrides `target`
to include the element type, so `e.target.value` compiles in change handlers
only, and the React types' own comment calls that override wrong and marks it
as kept for backward compatibility until React 20. Writing `currentTarget`
everywhere means one habit instead of a per-event rule.

**★ Why is `async` allowed on a submit handler but not on an effect?**
Because the two declarations differ deliberately. `EventHandler` is a function
type returning exactly `void`, and TypeScript lets a function returning
anything satisfy a `void` return type, so an `async` handler is accepted and
its promise is ignored — which is what React does with it. `EffectCallback`
returns `void | Destructor`, a union, which defeats that rule, because React
*calls* whatever an effect returns and needs to know it is a cleanup function.

**★ What is `bivarianceHack` doing in `EventHandler`?**
Making the handler's parameter bivariant. Declaring the signature as a method
inside an object type and indexing it back out opts the parameter into
method-style bivariance, which `strictFunctionTypes` would otherwise turn off
for a plain function type. The practical effect is that a handler typed for a
more general element is assignable where a more specific one is expected — a
deliberate unsoundness, taken because the alternative would reject assignments
React users write constantly.

**★ Your `async` handler throws and nothing appears in the UI. Why?**
Because the handler's return value is ignored: the `void` return type is what
permits an `async` handler in the first place, so the promise it returns is
dropped and the rejection is unhandled. An error boundary will not see it —
boundaries catch errors thrown during render, not rejected promises from event
handlers. The `try`/`catch` inside the handler is the only place that error can
be turned into state the UI renders.

**★ A child component needs to tell its parent that a row was selected. What
type should the prop have?**
The domain type, not the event type — `onSelect: (id: ProductId) => void`
rather than `(e: React.MouseEvent<HTMLLIElement>) => void`. The event type
tells the parent which element the child renders, which is exactly the detail
the child exists to hide, and it means changing the row from an `li` to a
`button` is a breaking change to the parent's props.

---

← Prev: [`useState` initialisers](08-usestate-initialisers.md) ·
[Overview](README.md) ·
Next → [`useForm`, typed from the schema on both sides](08c-useform-typed-from-the-schema.md)
