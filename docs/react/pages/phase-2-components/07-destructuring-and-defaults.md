---
title: "Destructuring and default values"
sidebar_label: "07 · Destructuring and defaults"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
> and the
> [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
> §*Removed: `propTypes` and `defaultProps` for functions*. No sandbox script
> backs this page; claims are cited, not measured.

**React 19 deleted two APIs that a decade of React code depends on:
`defaultProps` on function components, and `propTypes` entirely. Both
replacements are plain JavaScript and TypeScript, and one of the removals is
silent.**

## What React 19 removed

The upgrade guide, verbatim:

> In React 19, we're removing the `propType` checks from the React package, and
> using them will be silently ignored. If you're using `propTypes`, we recommend
> migrating to TypeScript or another type-checking solution.

> We're also removing `defaultProps` from function components in place of ES6
> default parameters. **Class components will continue to support
> `defaultProps` since there is no ES6 alternative.**

Three things to take from that:

1. **`propTypes` fails silently.** No error, no warning — the checks simply stop
   running. Code that relied on a development-time warning for a missing
   required prop now has no signal at all. This is the removal that costs
   something in a migration, because nothing tells you it happened.
2. **`defaultProps` is gone for function components only.** Class components
   keep it, explicitly and permanently, because there is no ES6 default
   parameter for a class's props.
3. **The replacement for `defaultProps` is language syntax**, not another React
   API.

```jsx
// Before — React 18 and earlier
function Heading({text}) {
  return <h1>{text}</h1>;
}
Heading.propTypes = {text: PropTypes.string};
Heading.defaultProps = {text: 'Hello, world!'};
```

```tsx
// After — React 19
interface Props {
  text?: string;
}
function Heading({text = 'Hello, world!'}: Props) {
  return <h1>{text}</h1>;
}
```

The `propTypes` half has a codemod:

```bash
npx codemod@latest react/prop-types-typescript
```

There is no codemod for `defaultProps` on function components in that list — the
transformation is mechanical enough to do by hand, but it does mean grepping for
`.defaultProps` before upgrading is a real migration step, not a formality.

## Default parameters: the rule that catches people

react.dev states the semantics precisely, and the precision matters:

> The default value is only used if the prop is missing or if you pass
> `size={undefined}`. But if you pass `size={null}` or `size={0}`, the default
> value will **not** be used.

```jsx
function Avatar({size = 100}) { … }

<Avatar />                 // size = 100
<Avatar size={undefined} />// size = 100
<Avatar size={null} />     // size = null   ← not 100
<Avatar size={0} />        // size = 0      ← not 100
<Avatar size="" />         // size = ""     ← not 100
```

This is ES6 destructuring semantics, not a React rule: the default fires on
`undefined` alone. And it differs from the old `defaultProps`, which used the
same `undefined` test — so the behaviour is unchanged, but the *failure* is now
more visible because the default sits next to the code that uses it.

The `null` row is the one that bites. An API returning `null` for "no avatar
size configured" bypasses the default entirely, and the component renders with
`size={null}`. The fix is the same `??` used for controlled inputs:

```jsx
function Avatar({size}) {
  const px = size ?? 100;      // ✅ handles null and undefined
  …
}
```

Choose deliberately: default parameters for props your callers omit, `??` for
props whose values may legitimately be `null`.

## Destructuring styles, and when each is right

**Destructure in the signature** — the default, and what the React docs use:

```jsx
function Avatar({person, size = 100, className}) { … }
```

It documents the interface where the reader looks first, and it is where
defaults now live. Use it unless one of the next two cases applies.

**Keep `props` whole** when the component forwards them:

```jsx
function Button(props) {
  return <button {...props} className={cx('btn', props.className)} />;
}
```

**Destructure with a rest element** when it forwards *most* of them — the common
shape for a wrapper around a DOM element:

```jsx
function Button({variant = 'primary', children, ...rest}) {
  return <button className={`btn btn--${variant}`} {...rest}>{children}</button>;
}
```

The rest element is what makes this pattern work: `variant` is consumed here and
deliberately not forwarded to the DOM, while `onClick`, `disabled`, `aria-*` and
everything else passes through untouched. Without it you would either drop the
caller's attributes or leak `variant` into the DOM as an unknown attribute —
Phase 1's [spreading props](../phase-1-jsx/10-spreading-props.md) has the
measured behaviour for what actually reaches the DOM.

react.dev's warning about spreading is worth carrying alongside it:

> **Use spread syntax with restraint.** If you're using it in every other
> component, something is wrong. Often, it indicates that you should split your
> components and pass children as JSX.

## Nested destructuring, and where to stop

```jsx
function Row({user: {name, email}}) { … }        // works
function Row({user: {profile: {avatar}}}) { … }  // 💥 if profile is undefined
```

One level is usually fine and reads well. Two levels introduces a crash on a
missing intermediate object, with a message (`Cannot destructure property
'avatar' of 'undefined'`) that names the leaf rather than the missing parent.

Defaults at each level prevent it — `{user: {profile: {avatar} = {}} = {}}` — at
which point the signature is no longer readable, which is the signal to stop:

```jsx
function Row({user}) {
  const avatar = user?.profile?.avatar ?? defaultAvatar;   // ✅ clearer
  …
}
```

Rule of thumb: **destructure the shape of the props; use optional chaining for
the shape of the data.** Props are your API and you control them; data is
someone else's and it will surprise you.

## Renaming, and why it is worth doing

```jsx
function Item({value: itemValue, onChange: onItemChange}) { … }
```

Two cases justify it: a prop whose name collides with something in scope, and a
generic prop name that becomes ambiguous inside a longer component. Otherwise
renaming costs the reader a lookup — they see `itemValue` in the body and have
to check the signature to know what the caller passes.

The dual-mode components in
[controlled vs uncontrolled](04-controlled-vs-uncontrolled/02-the-switch-warning.md)
are where renaming actually earns its place — `{open: openProp}` distinguishes
the prop from the derived local value, and the alternative is two similar names
that are easy to confuse.

## What replaces `propTypes`

**TypeScript**, which is the documented recommendation, and which does the job
at build time rather than as a development-only runtime check. Phase 8 of the
TypeScript syllabus covers typing props properly.

**Runtime validation at the boundary**, for data that arrives from outside the
program — an API response, a URL parameter, a config file. That is not a props
problem: validate with Zod or similar where the data enters, and props stay
plain. TypeScript's guarantees stop at the network boundary, which is exactly
where `propTypes` never helped either.

**Nothing**, for internal components in a TypeScript codebase. This is the
common and correct answer. The type is the contract.

## Gotchas

**Symptom:** after upgrading to React 19, invalid props no longer warn.
**Cause:** `propTypes` is silently ignored. No error tells you.
**Fix:** grep for `propTypes` before upgrading and convert with
`npx codemod@latest react/prop-types-typescript`, or accept the loss knowingly.

**Symptom:** after upgrading, a component renders with `undefined` where a
default used to be.
**Cause:** `Component.defaultProps` on a function component, now ignored.
**Fix:** move each default into the destructuring signature. Grep for
`.defaultProps` — this one is easy to miss because it usually sits at the bottom
of the file.

**Symptom:** the default does not apply and the value is `null`.
**Cause:** default parameters fire only on `undefined`. `null` is a value.
**Fix:** `const x = prop ?? fallback` for props that can be `null`.

**Symptom:** `size={0}` renders as `100`.
**Cause:** `||` used instead of `??` in the fallback.
**Fix:** `??`. `||` swallows every falsy value, and `0` is usually meaningful.

**Symptom:** `Cannot destructure property 'x' of 'undefined'`.
**Cause:** nested destructuring with a missing intermediate object.
**Fix:** optional chaining in the body instead of nesting in the signature.

**Symptom:** an unknown attribute warning in the console for a custom prop.
**Cause:** a prop consumed by the component is being spread onto a DOM element
because it was not pulled out before `...rest`.
**Fix:** name it explicitly in the destructuring so the rest element excludes it.

## Interview questions

**★ What happened to `defaultProps` and `propTypes` in React 19?**
`defaultProps` was removed for function components, replaced by ES6 default
parameters — class components keep it, because there is no ES6 equivalent for
them. `propTypes` was removed entirely and is now silently ignored, with
TypeScript as the recommended replacement. The silence is the migration hazard:
nothing warns you that your checks stopped running.

**★ When does a default parameter actually apply?**
Only when the value is `undefined` — either the prop was omitted or it was
passed as `undefined` explicitly. `null`, `0`, `''` and `false` all suppress the
default, because they are values. For props that can legitimately be `null`, use
`??` in the body rather than a default parameter.

**★ Why `??` rather than `||` for a fallback?**
`||` replaces every falsy value, so `0`, `''` and `false` get overwritten by the
fallback. `??` only replaces `null` and `undefined`. Almost every "the zero
disappeared" bug is a `||` that should have been `??`.

**What does `...rest` do in a component's props destructuring?**
It collects every prop not named explicitly, so a wrapper can consume its own
props and forward the remainder — `onClick`, `disabled`, `aria-*` — to the
underlying element. It is what makes a design-system wrapper transparent, and
naming a prop explicitly is what keeps it out of the DOM.

**Should you destructure props in the signature or the body?**
The signature, normally: it documents the interface and it is where defaults
live. Keep the whole `props` object when the component forwards it wholesale,
and use a rest element when it consumes some and forwards the rest. Nested
destructuring is best kept to one level — deeper, optional chaining in the body
reads better and fails better.

**Is TypeScript a complete replacement for `propTypes`?**
For internal components, yes — the type is the contract, checked at build time.
For data crossing the program boundary it is not, because types are erased at
runtime; that needs schema validation where the data enters. `propTypes` never
covered that case well either, so nothing was lost.

---

← Prev: [Props are read-only](06-props-are-read-only.md) · Index: [Phase 2](README.md) · Next → [Children patterns](08-children-patterns.md)
