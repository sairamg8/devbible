---
title: "01.1 · The console API in full"
sidebar_label: "01 · The console API"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console), [`console.table()`](https://developer.mozilla.org/en-US/docs/Web/API/console/table_static), [`console.time()`](https://developer.mozilla.org/en-US/docs/Web/API/console/time_static), [`console.group()`](https://developer.mozilla.org/en-US/docs/Web/API/console/group_static), [`console.dir()`](https://developer.mozilla.org/en-US/docs/Web/API/console/dir_static), [`console.assert()`](https://developer.mozilla.org/en-US/docs/Web/API/console/assert_static), and the [WHATWG Console specification](https://console.spec.whatwg.org/). Documentation-validated — no console blocks, because output here is browser-rendered and no run produced it.

**`console.log` is one method out of about twenty**, and the other nineteen exist because
`console.log` answers the wrong question surprisingly often. This chunk is the working set.

## The methods worth knowing, and what each is for

| Method | MDN | Use it when |
|---|---|---|
| `table()` | "Displays tabular data as a table." | any array of objects — API rows, parsed CSV |
| `dir()` | "Displays an **interactive listing of the properties** of a specified JavaScript object." | you need the object's properties, not its rendering |
| `dirxml()` | "Displays an XML/HTML Element representation of the specified object" | the DOM view of a node |
| `group()` / `groupCollapsed()` / `groupEnd()` | "Creates a new inline group, **indenting all following output**" — collapsed variant "starts with the inline group collapsed" | a loop or a request that logs several lines |
| `time()` / `timeLog()` / `timeEnd()` | "Starts a timer…" / "Logs the value of the specified timer" / "Stops the specified timer and logs the elapsed time in milliseconds" | rough timing without writing `performance.now()` twice |
| `count()` / `countReset()` | "Log the number of times this line has been called with the given label." | "is this running more than once?" |
| `assert()` | "Log an error message to console **if the first argument is `false`**." | an invariant you do not want to `throw` on |
| `trace()` | "Outputs a stack trace." | "who called this?" |
| `timeStamp()` | "Adds a marker to the browser **performance tool's timeline**." | correlating code with the performance panel |
| `warn()` / `error()` | log at those levels | anything you want to survive a filter |

🔴 **`console.table` is the one that changes how you work.** For an array of objects it renders
columns per key, sortable in the browser, instead of forty collapsed `{…}` lines you must expand
one by one. It takes a second argument selecting columns:

```js
console.table(users, ["id", "email", "role"]);
```

🔴 **`console.dir(el)` versus `console.log(el)` on a DOM node** is the distinction people miss.
`log` renders the element as markup — helpful for finding it on the page, useless for inspecting
it. `dir` gives the *"interactive listing of the properties"*, which is where `dataset`,
`value`, event handler properties and the rest actually live. When you need `el.value` and see
`<input>` instead, that is the one to reach for.

**`console.count()` answers a specific and common question**: is this handler bound twice? Is
this component rendering more than I think? A `console.log("here")` cannot tell you; a labelled
counter can.

**`console.assert(cond, msg)` logs only on failure** — an invariant that costs nothing when
satisfied and does not disturb control flow when it is not, unlike a `throw`.

## Format specifiers

MDN documents six, and they take substitution arguments rather than string concatenation:

| Specifier | MDN |
|---|---|
| `%s` | "Outputs a string." |
| `%d` / `%i` | "Outputs an integer." |
| `%f` | "Outputs a floating-point value." |
| `%o` | "Outputs a JavaScript object in the **'optimally useful formatting'** style, for example DOM elements may be displayed the same way as they would appear in the element inspector." |
| `%O` | "Outputs a JavaScript object in the **'generic JavaScript object formatting'** style, usually in the form of an expandable tree. This is similar to `console.dir()`." |
| `%c` | "**Applies CSS style rules** to all following text." |

```js
console.log("Hello, %s. You've called me %d times.", "Bob", i + 1);
console.log("%cLoaded", "color: green; font-weight: bold", config);
```

`%o` versus `%O` is the same distinction as `log` versus `dir`, at the specifier level: the
element view or the property view.

⚠️ **`%c` is why a page can print a giant "STOP!" warning in the console** — and also why a
malicious snippet can hide its output by styling it into invisibility. Treat a console you did
not write as untrusted output.

## The trap in logging objects

🔴 **The console usually shows a *live* view of an object, not a snapshot of what it was when
you logged it.** Expand a logged object a second later and you may be looking at its current
state, not its state at the log call. Two things follow:

- A logged object that "changed after I logged it" did not change retroactively — you are
  reading a reference. This is the single most confusing console behaviour, and it is why a
  mutation bug can look impossible.
- To capture a snapshot, log a copy: `console.log(structuredClone(obj))` or
  `console.log(JSON.parse(JSON.stringify(obj)))` for plain data.

Primitives are unaffected — they are copied by value — which is why `console.log(count)` never
surprises anyone and `console.log(state)` does.

## Logging in production

**`console` output is not free**, and it is not private:

- Every log **retains its arguments**, so an object logged inside a long-lived closure or a
  recurring interval keeps that object alive. A "leak" that appears only with DevTools open, or
  only in a build with logging enabled, is often exactly this
  ([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).
- Anything logged is **visible to anyone who opens DevTools** — tokens, PII, whole API responses.
- Formatting cost is paid even when nobody is looking, especially with `%O` on large objects.

The standard answer is a logging wrapper with a level, stripped or disabled in production
builds — not `console.log` scattered and hopefully removed. And note that MDN cautions
implementations differ:

> "Implementations of the console API may differ between runtimes. In particular, some console
> methods may work differently or not work at all in some online editors and IDEs."

So Node, a browser, and an online sandbox will not agree on `table`, `dir` or `group` rendering.
The API is now specified (WHATWG Console), but the *rendering* is deliberately not.

## Gotchas

**Symptom:** A logged object shows values it did not have when logged
**Cause:** The console holds a live reference; expanding it later reads current state.
**Fix:** Log a clone — `structuredClone(obj)` — when you need a snapshot.

**Symptom:** `console.log(el)` shows markup when you wanted properties
**Cause:** `log` renders elements; `dir` lists properties.
**Fix:** `console.dir(el)`, or the `%O` specifier.

**Symptom:** Forty collapsed objects, unreadable
**Cause:** `console.log` on an array of objects.
**Fix:** `console.table(rows, ["id", "name"])`.

**Symptom:** Memory grows only when logging is enabled
**Cause:** Console arguments are retained, keeping logged objects alive.
**Fix:** Do not log large objects from long-lived scopes; strip logs in production.

**Symptom:** A token appears in a customer's screenshot
**Cause:** A response object was logged; DevTools is available to everyone.
**Fix:** A level-aware logger, disabled in production.

**Symptom:** "Is this running twice?" is hard to answer from logs
**Cause:** Identical log lines are collapsed with a repeat count that is easy to misread.
**Fix:** `console.count(label)`.

**Symptom:** `console.table` renders nothing useful in Node or an online editor
**Cause:** MDN: *"Implementations of the console API may differ between runtimes."*
**Fix:** Test console ergonomics in the browser you are debugging in.

**Symptom:** Console output is styled into invisibility on a page you are inspecting
**Cause:** `%c` applies arbitrary CSS to subsequent output.
**Fix:** Treat foreign console output as untrusted; use the network and sources panels instead.

## Interview questions

**★ When would you use `console.dir` instead of `console.log`?**
On a DOM node. `log` renders it as markup; `dir` gives *"an interactive listing of the properties
of a specified JavaScript object"* — which is where `value`, `dataset` and handler properties
live. The `%o`/`%O` specifiers are the same distinction inline.

**★ You suspect a handler is bound twice. Which console method answers that fastest?**
`console.count(label)` — *"Log the number of times this line has been called with the given
label."* Identical `console.log` lines are collapsed with a repeat badge that is easy to
misread.

**★ Why does a logged object sometimes show values it did not have at log time?**
The console holds a live reference and renders current state when you expand it. Log a clone
(`structuredClone`) when you need a snapshot. This is why mutation bugs can look impossible.

**★ Is `console.log` free in production?**
No. Arguments are retained, so logging a large object from a long-lived scope keeps it alive;
formatting costs are paid whether or not anyone is watching; and everything logged is visible in
DevTools to any user — tokens included. Use a level-aware logger that is disabled in production.

**★ What does `console.assert` do that `if (!cond) console.error(...)` does not?**
Nothing functionally — it is the same check expressed as an invariant, logging *"an error message
to console if the first argument is `false`"*, without a `throw` and without disturbing control
flow. The value is that it reads as an assertion.

**★ What is `%c` for, and why is it a minor security consideration?**
It *"applies CSS style rules to all following text"* — used for banners and log prefixes. It also
lets a page style output to be invisible, so console output on a site you do not control is not
trustworthy evidence.

**Why do `console.table` and `console.group` look different in Node?**
The console API is specified (WHATWG Console) but rendering is not, and MDN notes
implementations *"may differ between runtimes."*

---

[Topic index](./README.md) · Next → [02 · The panels](./02-the-panels.md)
