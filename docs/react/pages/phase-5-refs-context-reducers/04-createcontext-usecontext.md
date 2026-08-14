---
title: "createContext and useContext"
sidebar_label: "04 · createContext and useContext"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`createContext`](https://react.dev/reference/react/createContext) and
> [`useContext`](https://react.dev/reference/react/useContext).
> No sandbox script backs this page; claims are cited, not measured.

**Passing a value to a subtree without threading it through every component in
between. Context is dependency injection scoped to a part of the tree — and
almost every problem with it comes from expecting it to be something else.**

## Creating one

```jsx
const ThemeContext = createContext(defaultValue);
```

> **The context object itself does not hold any information.** It represents
> *which* context other components read or provide.

That sentence is worth reading twice. `ThemeContext` is a **key**, not a store.
Nothing is in it. It exists so a provider and a consumer can agree on what they
are talking about.

The `defaultValue`:

> The value that you want the context to have **when there is no matching context
> provider in the tree above** the component that reads context.

> If you don't have any meaningful default value, specify `null`. The default
> value is meant as a **"last resort" fallback. It is static and never changes over
> time.**

*Static and never changes* — it is not a starting value that a provider later
updates. It is what you get when there is no provider at all, which is a situation
you usually want to hear about rather than paper over
([topic 13](13-default-context-value.md)).

## 🔴 Providing in React 19

```jsx
<ThemeContext value={theme}>
  <Form />
</ThemeContext>
```

> Starting in React 19, you can render `<SomeContext>` as a provider.
>
> In older versions of React, use `<SomeContext.Provider>`.

And the reference is explicit about the status of the old form:

> `SomeContext.Provider` is a **legacy** way to provide the context value before
> React 19.

So `<ThemeContext.Provider>` still works and every tutorial written before 2024
uses it, but new code should render the context directly.

`SomeContext.Consumer` also still exists and is described as *"an alternative and
rarely used way to read the context value"* — a render-prop API that predates
hooks. `useContext` is the answer.

## Reading it

```jsx
const theme = useContext(ThemeContext);
```

> `useContext` returns the context value for the calling component, determined as
> the `value` passed to **the closest `SomeContext` provider above** the calling
> component in the tree. If no provider exists, returns the `defaultValue`.

Two properties follow, and they are what makes context useful:

**Closest wins.** Providers nest, and a component reads the nearest one above it.
That is what makes context work for theming a section, or overriding a locale for
one subtree.

**Distance does not matter.** A consumer twelve levels down reads it exactly as
cheaply as a direct child. There is no prop threading and no intermediate
component needs to know the value exists.

## 🔴 The provider must be *above*, not in the same component

The caveat that produces the most "context isn't working" reports:

> `useContext()` call in a component is **not affected by providers returned from
> the *same* component.** The corresponding `<Context>` **needs to be *above*** the
> component doing the `useContext()` call.

```jsx
function App() {
  const theme = useContext(ThemeContext);   // 🔴 reads the default, not "dark"
  return (
    <ThemeContext value="dark">
      <Page />
    </ThemeContext>
  );
}
```

This is not a quirk — it follows from context being resolved by tree position. The
`useContext` call runs while `App` is rendering; the provider `App` *returns* is
below it. `App` is not inside its own output.

The fix is always structural: move the provider up into a parent, or split the
component so the reader is a child of the provider.

The troubleshooting entry lists three causes in total, and the third is worth
knowing because it looks impossible:

> Context only works if `SomeContext` used to provide context and `SomeContext`
> used to read it are ***exactly* the same object**, as determined by `===`
> comparison.

A build that produces duplicate modules — via symlinks, a monorepo with two copies
of a package, or a mixed ESM/CJS resolution — gives the provider and the consumer
two different context objects, and the consumer silently falls back to the default.
The documented diagnostic is to assign both to globals and compare them:

```jsx
window.SomeContext1 = SomeContext; // from the provider's module
window.SomeContext2 = SomeContext; // from the consumer's module
console.log(window.SomeContext1 === window.SomeContext2); // must be true
```

## Updating the value

Context does not store anything, so an updatable context is just state held above
the provider:

```jsx
function MyPage() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext value={theme}>
      <Form />
      <Button onClick={() => setTheme('light')}>
        Switch to light theme
      </Button>
    </ThemeContext>
  );
}
```

`setTheme` re-renders `MyPage`, which renders the provider with a new `value`, and
every consumer below sees it. **The state is doing the work; context is only
delivery.**

## What a value change costs

> React **automatically re-renders all children that use a particular context**
> starting from the provider that receives a different `value`. The previous and
> next values are compared with `Object.is`.

And the line that catches people optimising:

> **Skipping re-renders with `memo` does not prevent the children from receiving
> fresh context values.**

`memo` stops a component re-rendering because of *props*. A context change reaches
consumers regardless — which is correct (a memoized component must not show a stale
theme) and is also why `memo` is not a fix for context re-renders.

Because the comparison is `Object.is`, an inline object as the value is a new
identity every render and re-renders every consumer every time. The documented
mitigation:

```jsx
const login = useCallback((response) => {
  storeCredentials(response.credentials);
  setCurrentUser(response.user);
}, []);

const contextValue = useMemo(() => ({
  currentUser,
  login
}), [currentUser, login]);

return (
  <AuthContext value={contextValue}>
    <Page />
  </AuthContext>
);
```

That is the minimum. It is not the whole story, and the rest —
including why `useContext` has no selector — is
[topic 05](05-context-re-render-problem.md).

## Gotchas

**Symptom:** a component reads the default value even though a provider exists.
**Cause:** the provider is returned by the *same* component that reads it, so it
is below the `useContext` call.
**Fix:** move the provider into a parent, or split the component.

**Symptom:** context returns the default in one part of the app and works
elsewhere, with no obvious difference.
**Cause:** two copies of the context module — symlinks, a duplicated dependency, or
mixed module formats — so provider and consumer hold different objects.
**Fix:** compare them via globals with `===`; fix it at the build tool.

**Symptom:** a `memo`'d component still re-renders when context changes.
**Cause:** `memo` compares props; context updates bypass it by design.
**Fix:** nothing to fix — that is required for correctness. If the re-renders are
the problem, that is [topic 05](05-context-re-render-problem.md).

**Symptom:** every consumer re-renders on every parent render.
**Cause:** an inline object or function as `value`, so `Object.is` sees a new
identity each time.
**Fix:** `useMemo` the value and `useCallback` the functions in it.

**Symptom:** `<ThemeContext.Provider>` in a code review of new code.
**Cause:** the pre-19 form. Still works, now legacy.
**Fix:** render `<ThemeContext>` directly.

**Symptom:** the default value is being used as an initial value that a provider
later replaces.
**Cause:** it is documented as static, a last-resort fallback for *no provider*.
**Fix:** treat a hit on the default as a missing provider
([topic 13](13-default-context-value.md)).

## Interview questions

**★ What does `createContext` actually create?**
A key, not a store. The reference is explicit that the context object holds no
information — it represents *which* context components read or provide. All the
data lives in whatever the provider passes as `value`, which is usually state held
above it. Context is delivery, not storage.

**★ Why might a component read the default value when a provider exists?**
Most often because the provider is returned by the same component doing the
`useContext` call, so it is below rather than above it — the reference states that
providers returned from the same component have no effect on it. The second cause
is a duplicated context module from symlinks or a monorepo, where provider and
consumer hold two different objects; context only works when they are `===`.

**★ What is the React 19 change to providing context?**
You render `<SomeContext>` directly instead of `<SomeContext.Provider>`, which the
reference now calls a legacy way to provide the value. `SomeContext.Consumer` also
remains as a rarely used render-prop alternative to `useContext`. Both old forms
still work, so this is mainly about reading pre-19 code correctly.

**Does `memo` stop context updates from re-rendering a component?**
No, and the docs say so directly — skipping re-renders with `memo` does not prevent
children from receiving fresh context values. `memo` compares props; a context
change reaches consumers regardless. That is necessary for correctness, since a
memoized component must not display a stale theme, and it is why `memo` is not the
answer to context re-render problems.

**When is a context's default value used?**
Only when there is no matching provider above the reader. It is documented as
static, never changing over time, and meant as a last-resort fallback — not as an
initial value that a provider later updates. In practice, hitting it usually means
a provider is missing, which is a bug you want surfaced rather than silently
absorbed.

**What is the minimum you must do when passing an object through context?**
Memoize it. The provider's value is compared with `Object.is`, so an inline object
is a new identity every render and re-renders every consumer. Wrap the object in
`useMemo` and any functions inside it in `useCallback`, as the reference's `AuthContext`
example does — and treat that as the floor rather than the complete solution.

---

← Prev: [`useReducer`](03-usereducer.md) · Index: [Phase 5](README.md) · Next → [The context re-render problem](05-context-re-render-problem.md)
