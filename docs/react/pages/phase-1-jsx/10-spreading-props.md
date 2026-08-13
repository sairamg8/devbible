---
title: "Spreading props"
sidebar_label: "10 · Spreading props"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react 19.2.8**, **@babel/preset-react 7.29.7** and
> **Firefox 153.0**. Compiler output, markup and warnings are printed by
> `sandbox/react-p1/ex09-spread.mjs`.

**`{...props}` is JavaScript's object spread inside the props object literal.
That is all it is — which tells you everything about precedence, and explains
both of its costs.**

## What it compiles to

```console
$ node ex09-spread.mjs
=== 1. what a spread compiles to ===
const a = /*#__PURE__*/_jsx("input", {
  ...props
});
const b = /*#__PURE__*/_jsx("input", {
  type: "text",
  ...props
});
const c = /*#__PURE__*/_jsx("input", {
  ...props,
  type: "text"
});
```

Ordinary object literal semantics: **later keys overwrite earlier ones.**

```console
  --- order decides the winner ---
  {...props} then type="text"       <input placeholder="from spread" type="text" name="pw">
  type="text" then {...props}       <input placeholder="from spread" type="password" name="pw">
  two spreads, second wins          <input name="second">
```

Which gives you two deliberate idioms:

```jsx
<Input {...props} type="text" />   // "type is mine, whatever the caller says"
<Input type="text" {...props} />   // "type defaults to text, caller may override"
```

Getting these the wrong way round is a real bug and reads identically at a
glance. When a component takes overridable defaults, put the spread **last**
and say so in a comment if it is not obvious.

## The rest-spread pattern, and its cost

```jsx
function Field({label, ...rest}) {
  return (
    <label>
      {label}
      <input {...rest} />
    </label>
  );
}
```

This is the standard way to write a wrapper that forwards anything the caller
passes. It works, and it leaks:

```console
  --- what a rest spread carries into the DOM ---
  <Field label onSelectRow>          <input name="n">
  <Field label data-testid>          <input data-testid="t" name="n">

  [error] Unknown event handler property `onSelectRow`. It will be ignored.
  [error] React does not recognize the `isActive` prop on a DOM element. If you
          intentionally want it to appear in the DOM as a custom attribute,
          spell it as lowercase `isactive` instead. …
```

Two props the caller passed for the *component* landed on a DOM node.
`onSelectRow` was dropped as an unknown event; `isActive={true}` was dropped
because unknown props with boolean values are dropped — note the markup shows
neither, despite the warning naming only one of them.

The fix is to destructure out everything that is not a DOM prop:

```jsx
function Field({label, isActive, onSelectRow, ...domProps}) {
  return <input className={isActive ? 'on' : ''} {...domProps} />;
}
```

TypeScript makes this enforceable — type `rest` as
`React.InputHTMLAttributes<HTMLInputElement>` and a stray prop is a compile
error rather than a console message. That is Phase 8 of the TypeScript
syllabus, not this one.

## `key` in a spread

```console
  [error] A props object containing a "key" prop is being spread into JSX:
    let props = {key: someKey, name: ...};
    <input {...props} />
  React keys must be passed directly to JSX without using spread:
    let props = {name: ...};
    <input key={someKey} {...props} />
```

React 19 warns, in full, with the fix written out. The reason is
[page 01](01-jsx-is-a-function-call.md): `key` compiles to a separate argument,
so a `key` that arrives through a spread has to be pulled back out of the props
object at runtime — which React does, while telling you not to rely on it.

```jsx
const {key, ...rest} = item;
<Row key={key} {...rest} />
```

## Spreading onto a component is different

```console
  --- spreading onto a component is not the same thing ---
  <Passthrough {...allProps} />     <b>["label","isActive","onSelectRow"]</b>
```

All three arrived, untouched. There is no DOM involved and therefore no naming
rules, no dropping, no warnings. Every rule on this page about unknown
attributes applies at the moment props reach a **host element** — which may be
several components further down.

That is why the warning often names a component you have never edited: the prop
travelled through three wrappers before something spread it onto a `<div>`.

## When to spread, and when not to

**Reasonable:**

```jsx
<Button {...buttonProps} />                     // a wrapper forwarding DOM props
<Route {...route} key={route.path} />           // config objects you own
<Component {...pageProps} />                    // a framework handing you props
```

**Not reasonable:**

```jsx
<UserCard {...user} />        // which of these become props? nobody can tell
<Modal {...this.props} />     // forwards everything, including things that break
```

The cost is not performance — it is that the call site no longer says what the
component receives. `<UserCard {...user} />` gives a reader no way to know
whether `UserCard` uses `user.name` or `user.permissions.admin` without opening
both files, and adding a field to `user` silently changes what the component
gets.

Prefer naming what you pass. Spread when the *set* of props is genuinely the
unit being forwarded — which is true for DOM passthrough and rarely true for
domain objects.

## Gotchas

**Symptom:** a default you set is ignored.
**Cause:** the spread comes after it, so the caller's value wins — or the
reverse, and the caller's value is ignored.
**Fix:** decide which you want and order the literal accordingly; the spread
last means "caller wins".

**Symptom:** "React does not recognize the `X` prop on a DOM element", naming a
component you did not write.
**Cause:** a prop was forwarded down through wrappers and eventually spread onto
a host element.
**Fix:** destructure it out at the boundary that owns it.

**Symptom:** a custom prop does not appear in the DOM even though React warned
about it.
**Cause:** its value is a boolean; unknown props with boolean values are
dropped rather than stringified.
**Fix:** `String(value)` if you really want it as an attribute — but usually,
stop forwarding it.

**Symptom:** "A props object containing a `key` prop is being spread into JSX".
**Cause:** `key` inside the spread object.
**Fix:** destructure it out and pass it directly:
`const {key, ...rest} = item`.

**Symptom:** a handler stops working after a refactor that added a spread.
**Cause:** the spread overwrote it — `onClick={mine} {...props}` where `props`
also has `onClick`.
**Fix:** compose deliberately:
`onClick={(e) => { mine(e); props.onClick?.(e); }}`.

**Symptom:** adding a field to a domain object changes a component's behaviour.
**Cause:** `{...user}` — the component receives whatever the object holds.
**Fix:** name the props you pass.

## Interview questions

**★ What does `{...props}` do in JSX, and what decides precedence?**
It is object spread inside the props object literal, so ordinary JavaScript
rules apply: later keys win. `<Input {...props} type="text" />` forces the type;
`<Input type="text" {...props} />` makes it a default the caller can override.

**★ What is wrong with spreading props onto a DOM element?**
Props meant for your component reach a host element, where React either renders
them as unknown attributes or drops them — unknown `on*` props and unknown props
with boolean values are dropped entirely — and warns in development. Destructure
out what is yours before forwarding the rest.

**Why does React warn about a `key` inside a spread?**
`key` is compiled into a separate argument, not into props, so a spread `key`
must be extracted at runtime. React supports it and tells you not to rely on it;
pass it directly instead.

**Is spreading props slow?**
No, not meaningfully — it is one object literal. The cost is legibility: the
call site stops saying what the component receives, and adding a field to the
source object silently changes the component's input.

**When is spreading the right choice?**
When the set of props is the unit being forwarded — a wrapper passing DOM
attributes through, or a framework handing you a props object. Rarely for
domain objects.

---

← Prev: [children](09-children.md) · Index: [Phase 1](README.md) · Next → [Inline style](11-inline-style.md)
