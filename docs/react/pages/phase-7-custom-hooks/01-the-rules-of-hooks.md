---
title: "The Rules of Hooks"
sidebar_label: "01 · The Rules of Hooks"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks),
> [Rules of React](https://react.dev/reference/rules),
> [React calls Components and Hooks](https://react.dev/reference/rules/react-calls-components-and-hooks).
> No sandbox script backs this page; claims are cited, not measured.

**Two rules, and everything in the previous seven phases depends on them. They are
not style guidance and they are not the linter being fussy — break either one and
React hands your component someone else's state.**

The rules are short enough to memorise, and you should:

1. **Only call Hooks at the top level.**
2. **Only call Hooks from React functions.**

The rest of this page is what each one actually forbids, because "at the top level"
excludes more things than most people expect — `try`/`catch` among them.

## Rule 1 — only call Hooks at the top level

> **Don't call Hooks inside loops, conditions, nested functions, or
> `try`/`catch`/`finally` blocks. Instead, always use Hooks at the top level of your
> React function, before any early returns.**

Two places are allowed, and only two:

> * Call them at the top level in the body of a function component.
> * Call them at the top level in the body of a custom Hook.

```js
function Counter() {
  // ✅ Good: top-level in a function component
  const [count, setCount] = useState(0);
  // ...
}

function useWindowWidth() {
  // ✅ Good: top-level in a custom Hook
  const [width, setWidth] = useState(window.innerWidth);
  // ...
}
```

### The full disallowed list

This is the part worth knowing exactly, because four of the six surprise people:

> * Do not call Hooks inside conditions or loops.
> * Do not call Hooks after a conditional `return` statement.
> * Do not call Hooks in event handlers.
> * Do not call Hooks in class components.
> * Do not call Hooks inside functions passed to `useMemo`, `useReducer`, or
>   `useEffect`.
> * Do not call Hooks inside `try`/`catch`/`finally` blocks.

Walk them:

```jsx
function Bad({ id, items, cond }) {
  if (cond) {
    const [a, setA] = useState(0);          // 🔴 inside a condition
  }

  for (const item of items) {
    const ref = useRef(null);               // 🔴 inside a loop
  }

  if (!id) return null;
  const [b, setB] = useState(0);            // 🔴 after a conditional return

  function handleClick() {
    const [c, setC] = useState(0);          // 🔴 in an event handler
  }

  const value = useMemo(() => {
    return useContext(ThemeContext);        // 🔴 inside a useMemo callback
  }, []);

  try {
    const [d, setD] = useState(0);          // 🔴 inside try/catch/finally
  } catch {}
}
```

**"Before any early returns" is the phrase to hold on to.** The third bullet is the
one that catches working code: a component that guards with `if (!user) return null;`
and then calls `useEffect` below the guard is already broken, even though nothing is
wrapped in a block. The guard makes the hook conditional on `user` being truthy —
which is exactly what rule 1 forbids, just written without an `if` block around the
hook itself.

### 🔴 Why `try`/`catch` is on the list

This is the least-known entry, and it is not arbitrary. A hook call inside `try`
means the hooks *after* it may or may not run depending on whether it threw. That
is a conditional hook wearing a different syntax. The consequence is the same one
[Phase 7 · 05](05-why-the-rules-exist/README.md) works through from the implementation: the
positional list shifts, and every hook after the throw point reads the wrong slot.

If you need error handling around something a hook does, the boundary goes *outside*
the component — an error boundary — not around the hook call.

### Event handlers are not a grey area

The rule lists them explicitly, and it is worth understanding why the temptation
exists at all. Handlers run *after* render, so it feels as though calling `useState`
there could not disturb the render-time ordering. But hooks are attached to a
component's position in the render, not to a moment in time; there is no slot to
attach to once render is over. What you actually want in a handler is the setter or
the ref you already obtained at the top level.

## Rule 2 — only call Hooks from React functions

> **Don't call Hooks from regular JavaScript functions.** Instead, you can:
>
> ✅ Call Hooks from React function components.
> ✅ Call Hooks from custom Hooks.

```js
function FriendList() {
  const [onlineStatus, setOnlineStatus] = useOnlineStatus(); // ✅
}

function setOnlineStatus() { // ❌ Not a component or custom Hook!
  const [onlineStatus, setOnlineStatus] = useOnlineStatus();
}
```

The payoff is stated directly, and it is the real argument for the rule:

> By following this rule, you ensure that **all stateful logic in a component is
> clearly visible from its source code.**

That is what the `use` prefix buys — a naming convention the linter enforces so
that reading a call site tells you whether React state can be hiding inside it.
[Phase 7 · 02](02-writing-a-custom-hook.md) covers what the prefix does and does not
guarantee.

## The two rules React attaches to this one

The Rules of Hooks live inside a larger set, and two of them are really "rule 2,
stated from the other direction".

**Never call component functions directly.**

> React must decide when your component function is called during rendering. In
> React, you do this using JSX.

```js
function BlogPost() {
  return <Layout><Article /></Layout>;   // ✅ Good: only use components in JSX
}

function BlogPost() {
  return <Layout>{Article()}</Layout>;   // 🔴 Bad: never call them directly
}
```

`{Article()}` is not a component render — it is a function call that splices
`Article`'s hooks into `BlogPost`'s hook list. If that call is inside a condition or
a loop, you have violated rule 1 without a hook appearing anywhere near an `if`. It
also costs everything React does *between* component calls: reconciliation by
component type, bail-outs for subtrees that did not change, and the DevTools tree.

**Never pass Hooks around as regular values.**

> Hooks allow you to augment a component with React features. They should always be
> called as a function, and never passed around as a regular value. This enables
> local reasoning.

```js
function ChatInput() {
  const useDataWithLogging = withLogging(useData); // 🔴 don't write higher-order Hooks
  const data = useDataWithLogging();
}

function ChatInput() {
  return <Button useData={useDataWithLogging} />   // 🔴 don't pass Hooks as props
}
```

The fix in both cases is the same shape: write a new hook that inlines the logic,
and call it directly where it is needed.

> When Hooks are used in dynamic ways, it **increases the complexity of your app
> greatly and inhibits local reasoning**, making your team less productive in the
> long term.

## What enforces this

`eslint-plugin-react-hooks` — `rules-of-hooks` catches the violations above, and
`exhaustive-deps` handles the dependency half covered in
[Phase 4 · 03](../phase-4-effects/03-the-dependency-array.md). Phase 6 covers the
plugin's Compiler-powered rules in
[Phase 6 · 10](../phase-6-performance/10-eslint-plugin-react-hooks.md).

**The lint rule is not the reason to obey.** It is a detector for a class of bug
that produces no error message in the common case — the component renders, reads a
neighbouring hook's value, and is simply wrong. When the shape *does* error, the
message is `Rendered fewer hooks than expected. This may be caused by an accidental
early return statement.`

The React Compiler leans on these rules harder than the linter does: it can only
memoize code whose hook order it can prove is stable
([Phase 6 · 09](../phase-6-performance/09-how-the-compiler-bails-out.md)). Code that
breaks the rules does not get slower — it gets silently skipped.

## Gotchas

**Symptom:** `Rendered fewer hooks than expected. This may be caused by an accidental
early return statement.`
**Cause:** a `return` above one or more hook calls took a path it did not take on the
previous render.
**Fix:** move every hook above every conditional return. Compute first, return late.

**Symptom:** a component works until a prop flips, then shows another value's state.
**Cause:** a conditional hook. The list shifted and later hooks read the wrong slot.
**Fix:** call the hook unconditionally and make the *value* conditional instead.

**Symptom:** lint error on a hook inside `try`, in code that appears to work.
**Cause:** hooks after the `try` are conditional on nothing having thrown.
**Fix:** take the hook out of the block; put an error boundary around the component.

**Symptom:** hooks "leak" between components — one component's state changes when a
sibling renders.
**Cause:** a component called as a plain function, `{Article()}`, splicing its hooks
into the caller's list.
**Fix:** render it as JSX, `<Article />`.

**Symptom:** a hook wrapped by a helper behaves unpredictably per call site.
**Cause:** a higher-order hook, or a hook passed as a prop.
**Fix:** write a new hook that inlines the variant logic and call it directly.

**Symptom:** the Compiler optimises everything except one component.
**Cause:** that component breaks a rule, so the Compiler cannot prove hook order and
bails out.
**Fix:** fix the violation; the bail-out is silent by design.

## Interview questions

**★ State the Rules of Hooks, and name something surprising that rule 1 forbids.**
Only call Hooks at the top level, and only from React functions — components or
other Hooks. The surprising entries are `try`/`catch`/`finally` blocks and **after a
conditional `return`**: the docs say "always use Hooks at the top level of your React
function, *before any early returns*". Also on the list: event handlers, class
components, and functions passed to `useMemo`, `useReducer` or `useEffect`.

**★ Why is a hook inside `try` a problem when nothing has thrown yet?**
Because whether the hooks after it run depends on whether it throws — that makes them
conditional, which is the thing rule 1 exists to prevent. Hooks are matched
positionally per component instance, so a list that can change length between renders
hands later hooks the wrong slots. Error handling belongs in an error boundary
outside the component, not around a hook call.

**★ What breaks when you write `{Article()}` instead of `<Article />`?**
`Article`'s hooks get spliced into the calling component's hook list rather than
belonging to their own instance, so if the call is conditional or in a loop you have
broken rule 1 without writing an `if` near a hook. You also lose what React does
between component calls: reconciliation by component type, skipping subtrees that
don't need re-rendering, and the component showing up properly in DevTools. The docs
put it as "React must decide when your component function is called during
rendering."

**Why does rule 2 exist, given that a plain function calling `useState` would
"work" if it were only ever called from a component?**
The stated reason is visibility: following it "ensures that all stateful logic in a
component is clearly visible from its source code". A `getColor()` call cannot be
hiding React state; a `useOnlineStatus()` call might. That guarantee only holds if
non-`use` functions never call hooks — and the linter enforces the convention on
that basis.

**What is wrong with a higher-order hook like `withLogging(useData)`?**
It passes a Hook around as a value. The docs are explicit that Hooks "should always
be called as a function, and never passed around as a regular value", because dynamic
Hook use "increases the complexity of your app greatly and inhibits local reasoning".
The fix is to write a new `useDataWithLogging` that inlines the logic and call it
directly — same for passing a hook as a prop.

**If the linter already catches these, why learn them?**
Because the failure mode has no error message in the common case — the component
renders and reads a neighbouring hook's state, silently wrong. And the React Compiler
depends on the rules more strictly than the linter does: it can only memoize what it
can prove, so a rule-breaking component is silently skipped rather than reported.

---

← Index: [Phase 7](README.md) · Next → [Writing a custom hook](02-writing-a-custom-hook.md)
