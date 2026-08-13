---
title: "08 · Running and inspecting code"
sidebar_label: "08 · Running and inspecting"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p0/ex10-console.mjs`.
> DevTools behaviour described here is browser host and not measured.

**`console.log` is the least capable tool in the box, and most people use only
it.** This page is the rest of the box — the CLI flags for a quick answer, the
console API beyond `log`, and the debugger that makes half of your logging
unnecessary.

## Getting an answer in one line

```bash
node --eval "console.log('eval runs a script:', 1 + 1)"
node --print "40 + 2"
```

```
eval runs a script: 2
42
```

`--eval` (`-e`) runs a script. `--print` (`-p`) runs an expression **and prints
its value**, so you skip the `console.log`. `-p` is the one you want for a quick
check:

```bash
node -p "new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(1234.5)"
node -p "[...new Set([1,1,2,3])]"
node -p "process.versions.v8"
```

## Checking syntax without running anything

```bash
node --check some-file.js
```

Parses and reports `SyntaxError`s **without executing a line**. This is the
direct application of [02 · Parse, compile,
execute](./02-parse-compile-execute.md): when nothing at all printed, `--check`
tells you whether the file even parses, in milliseconds and with no side
effects.

## The console API you are not using

```js
// sandbox/js-p0/ex10-console.mjs
const cart = [
  { sku: 'TSHIRT-M', qty: 2, priceMinor: 49900 },
  { sku: 'MUG-01',   qty: 1, priceMinor: 24900 },
];
console.table(cart);
console.group('checkout');
console.log('items:', cart.length);
console.groupEnd();
console.time('total');
const total = cart.reduce((s, i) => s + i.qty * i.priceMinor, 0);
console.timeEnd('total');
console.log('total minor units:', total);
console.count('render'); console.count('render');
console.assert(total > 0, 'total must be positive');
console.dir({ a: { b: { c: { d: 1 } } } }, { depth: null });
console.error('this goes to stderr');
```

```
┌─────────┬────────────┬─────┬────────────┐
│ (index) │ sku        │ qty │ priceMinor │
├─────────┼────────────┼─────┼────────────┤
│ 0       │ 'TSHIRT-M' │ 2   │ 49900      │
│ 1       │ 'MUG-01'   │ 1   │ 24900      │
└─────────┴────────────┴─────┴────────────┘
checkout
  items: 2
total: 0.043ms
total minor units: 124700
render: 1
render: 2
{
  a: { b: { c: { d: 1 } } }
}
this goes to stderr
```

| Method | Use it when |
|---|---|
| `console.table(arr)` | Inspecting an array of objects — cart lines, API rows. Vastly more readable than `log`. |
| `console.group` / `groupEnd` | Nesting related output; collapsible in DevTools |
| `console.time` / `timeEnd` | A rough duration with no manual arithmetic |
| `console.count(label)` | "How many times did this render?" without a counter variable |
| `console.assert(cond, msg)` | Log **only** when something is wrong |
| `console.dir(obj, {depth: null})` | Deep objects Node would otherwise truncate to `[Object]` |
| `console.error` / `warn` | **stderr**, so `node app.js > out.log` keeps them on your terminal |
| `console.trace()` | Print a stack trace at a point without throwing |

Two of these earn their place daily. `console.table` on an array of objects
replaces reading a wall of JSON. And `console.dir(obj, { depth: null })` is the
fix for the constant Node annoyance where nested objects print as `[Object]` —
`console.log` truncates at depth 2, `dir` with `depth: null` does not.

## The debugger

Logging tells you what you thought to print. A breakpoint lets you ask anything.

**In the browser:** open DevTools → Sources, click a line number. Or put
`debugger;` in the code — it pauses only when DevTools is open, and is inert
otherwise.

**In Node:**

```bash
node --inspect-brk app.js
```

Then open `chrome://inspect` in Chrome and attach. `--inspect-brk` breaks on the
first line so you can set breakpoints before anything runs; `--inspect` alone
attaches without pausing. Every editor with a Node debug configuration does the
same thing behind a button.

The four controls that cover most sessions:

| Control | Does |
|---|---|
| **Step over** | Run this line, do not descend into calls |
| **Step into** | Descend into the call on this line |
| **Step out** | Finish the current function, pause at the caller |
| **Resume** | Continue to the next breakpoint |

And the two features people miss:

- **Conditional breakpoints** — right-click a line number, add `item.sku === 'MUG-01'`.
  This replaces the `if (x) console.log(...)` you were about to write.
- **The Scope panel** — shows every variable in every enclosing scope, including
  closure variables. It is the fastest way to see what a closure actually
  captured, which Phase 3 makes heavy use of.

## Gotchas

**Symptom:** `console.log` of a nested object prints `[Object]` or `[Array]`.
**Cause:** Node's inspector truncates below depth 2.
**Fix:** `console.dir(obj, { depth: null })`, or `console.log(JSON.stringify(obj, null, 2))`
— the latter drops `undefined`, functions and `Symbol`s, so it is not equivalent.

**Symptom:** you logged an object, and the value shown does not match what it
held at that moment.
**Cause:** in browser DevTools, an object logged by reference is expanded
**lazily** — you see its state when you click, not when you logged.
**Fix:** log a snapshot: `console.log(structuredClone(obj))` or
`console.log(JSON.parse(JSON.stringify(obj)))`.

**Symptom:** `debugger;` never pauses.
**Cause:** it is a no-op unless a debugger is attached.
**Fix:** open DevTools before loading the page, or run Node with `--inspect-brk`
and attach.

**Symptom:** logs vanish when you redirect output to a file.
**Cause:** `console.error` and `console.warn` write to stderr, not stdout.
**Fix:** `node app.js > out.log 2>&1` to capture both.

**Symptom:** a `console.time` label reports a wildly wrong duration.
**Cause:** the label was reused, or `timeEnd` ran on a different code path.
**Fix:** use unique labels. For real measurement use `performance.now()` with
warm-up — see [11 · The JIT](./11-the-jit.md) for why a single timing lies.

## Interview questions

**★ How do you debug JavaScript beyond `console.log`?**
Breakpoints in DevTools or `node --inspect-brk`, with step over/into/out and the
Scope panel to inspect closures. Conditional breakpoints replace guarded logging.
`console.table`, `console.dir(obj, {depth:null})`, `console.count` and
`console.assert` cover most of what remains, and `--check` answers "does this
even parse" without running it.

**★ Why does an object logged in the browser sometimes show the wrong value?**
DevTools stores a reference and expands it lazily when you click. If the object
mutated between the log and the click, you see the later state. Log a clone —
`structuredClone(obj)` — to capture the value at that instant.

**What is the difference between `node -e` and `node -p`?**
`-e` runs a script and prints nothing on its own. `-p` runs an expression and
prints its result. `-p` is the one-liner form for checking a value.

**How would you find out whether a file has a syntax error without running it?**
`node --check file.js`. It parses and reports `SyntaxError`s with no execution
and no side effects — the diagnostic for "nothing printed at all".

**Why do `console.error` and `console.warn` exist separately from `log`?**
They write to stderr rather than stdout, so they survive stdout redirection and
can be routed separately in production. DevTools also styles and filters by
level.

---

← [07 · Loading scripts](./07-loading-scripts.md) · [Phase index](./) · Next: [09 · Transpilation and polyfills](./09-transpilation-polyfills.md) →
