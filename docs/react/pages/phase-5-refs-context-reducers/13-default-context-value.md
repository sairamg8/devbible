---
title: "The default context value"
sidebar_label: "13 · The default context value"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`createContext`](https://react.dev/reference/react/createContext) and
> [`useContext`](https://react.dev/reference/react/useContext) (Troubleshooting).
> The custom-hook guard is a community convention built on documented behaviour,
> and this page says so. No sandbox script backs this page.

**The argument to `createContext` is used in exactly one situation — no provider
above — and that situation is almost always a bug. A default value's real job is
deciding how loudly that bug announces itself.**

## When it is used

> The value that you want the context to have **when there is no matching context
> provider in the tree above** the component that reads context.

> If you don't have any meaningful default value, specify `null`. The default value
> is meant as a **"last resort" fallback. It is static and never changes over time.**

Two things follow, and both get misread.

**It is not an initial value.** A provider does not "replace" it later. If a
provider exists, the default is never consulted; if none exists, the default is all
you ever get. Nothing transitions from one to the other.

**It is static.** *Never changes over time* — so a default cannot be a piece of
state, and there is no version of this where the default updates.

## Why the silent fallback is dangerous

Reaching the default means the component is outside its provider, which is one of
the three documented causes of "my component doesn't see the value from my
provider" ([topic 04](04-createcontext-usecontext.md)): a missing provider, a
provider in the same component rather than above, or duplicate context modules.

All three are bugs. And with a plausible default, none of them throws:

```jsx
const ThemeContext = createContext('light');

function Button() {
  const theme = useContext(ThemeContext);   // 'light' — but is that real?
  // ...
}
```

The button renders. It renders *wrongly*, in light theme, inside a dark-themed app
— and it will keep doing so until someone notices visually. A default that looks
like a legitimate value converts a structural error into a cosmetic one, which is
the worst possible trade because cosmetic errors are the ones that ship.

It is worse for non-visual data. A `createContext({user: null})` default makes every
component below behave as if the user is logged out, which looks exactly like a
logged-out user rather than like a missing provider.

## `null`, and the guard

The docs' own advice — *"If you don't have any meaningful default value, specify
`null`"* — is the first half. `null` makes the failure immediate rather than
plausible: the next property access throws, and the stack trace points at the
consumer.

But `Cannot read properties of null (reading 'user')` names the symptom, not the
cause. The convention that fixes that is a custom hook which checks:

```jsx
const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return value;
}
```

⚠️ **This guard is a community convention, not a documented React API.** What is
documented is the behaviour it relies on — the default is returned when no provider
is found, and `null` is the recommended default when there is no meaningful one.
The hook is just the natural place to turn that into a good message.

It composes exactly with [topic 12](12-context-plus-reducer.md)'s arrangement: the
module already exports `useTasks` and `useTasksDispatch`, so the check costs three
lines and every consumer gets it for free. In TypeScript it also narrows the type,
so consumers stop dealing with `T | null` — which is often what finally motivates
teams to add it.

## When a real default *is* right

Not never. A meaningful default is correct when **rendering without a provider is a
supported use**, not an error:

- **A themed component published as a library** — it should look reasonable in an
  app that never sets a theme.
- **A locale or formatting context** where a sensible fallback exists and is
  genuinely intended.
- **A no-op implementation** — a logging or analytics context whose default does
  nothing, so consumers need no provider in tests.

The distinguishing question: *if I found this component rendering without a
provider, would I call it a bug?* If yes, `null` plus a guard. If no, a real default
and no guard.

## Gotchas

**Symptom:** a component renders with plausible but wrong values.
**Cause:** it is outside its provider and got the default.
**Fix:** `null` plus a guard, so the failure is loud rather than cosmetic.

**Symptom:** `Cannot read properties of null` from deep inside a component.
**Cause:** `null` default reached, with no guard to name it.
**Fix:** throw a named error in the custom hook that reads the context.

**Symptom:** the default is treated as an initial value a provider will replace.
**Cause:** misreading it as a starting state.
**Fix:** it is static, and used only when no provider exists — the two paths never
meet.

**Symptom:** TypeScript forces `| null` checks at every consumer.
**Cause:** the context type includes the `null` default.
**Fix:** the guard hook narrows it once, so consumers get a non-nullable type.

**Symptom:** a test renders a component and gets confusing behaviour rather than an
error.
**Cause:** a plausible default absorbed the missing provider.
**Fix:** the guard turns it into a clear failure — often the fastest test-writing
improvement available.

**Symptom:** a library component throws when used without a provider.
**Cause:** a guard applied where rendering without a provider is legitimate.
**Fix:** a real default belongs here; not every context wants a guard.

## Interview questions

**★ When is a context's default value used?**
Only when there is no matching provider above the component reading it. It is
documented as static and never changing — a last-resort fallback, not an initial
value that a provider later replaces. If a provider exists the default is never
consulted, and if none exists it is all you will ever get.

**★ Why is a plausible default dangerous?**
Because reaching the default means the provider is missing, in the same component
rather than above it, or duplicated by the build — all bugs. A default that looks
like a real value turns that structural error into a cosmetic one: the component
renders, wrongly, and nobody finds out until someone notices visually. With auth
data it is worse, because "no provider" becomes indistinguishable from "logged
out".

**★ What is the guard pattern, and is it a React API?**
A custom hook that reads the context, throws a named error if the value is `null`,
and returns it otherwise. It is a **community convention**, not documented API —
what React documents is the behaviour it depends on: the default is returned when no
provider is found, and `null` is the recommended default when nothing meaningful
exists. The hook converts `Cannot read properties of null` into "useAuth must be
used within an AuthProvider", and in TypeScript narrows away the `| null`.

**When should a context have a real default instead?**
When rendering without a provider is a supported use rather than an error — a
themed component published as a library that should look reasonable unthemed, a
locale fallback that is genuinely intended, or a no-op analytics implementation so
tests need no provider. The test is whether you would call an unprovided render a
bug.

**Where does the guard naturally live?**
In the custom hook the context module already exports. Once the wiring is in one
file exporting a provider and `useThing` hooks, the check is three lines in one
place and every consumer inherits it — which is another reason that arrangement is
worth adopting before the app grows.

---

← Prev: [Context plus reducer](12-context-plus-reducer.md) · Index: [Phase 5](README.md) · Next → [`useId`](14-useid.md)
