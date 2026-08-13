---
title: "07 · `this` inside methods, and losing it"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this), [`Function.prototype.bind`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes). Documentation-validated.

**A method is not attached to its object.** It is an ordinary function reachable
through one, and `this` is decided by *how it is called* — MDN: *"if the function
call is in the form `obj.f()`, then `this` refers to `obj`."* The binding is created
by the dot, and nothing travels with the function when you take it away.

Every bug in this topic is that one sentence not being believed, and every fix is a
different place to put the binding back.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[How a method loses `this`](./01-how-methods-lose-this.md)** | Call-site binding and method borrowing, the strict/sloppy split (`undefined` vs `globalThis` and why the strict failure is better), the four real-world ways it happens, `thisArg` and which methods lack it, and `this` in class fields |
| 2 | **[The fixes, and which to choose](./02-the-fixes.md)** | `bind` in the constructor, the arrow class field, wrapping at the call site, `call`/`apply` — with the trade-off table, the `removeEventListener` identity trap, and the per-instance cost of the two "own property" options |

## The four fixes at a glance

| | Binding lives | Per-instance cost | Overridable / `super`? | Removable listener? |
|---|---|---|---|---|
| `bind` in constructor | own property | one function each | no | ✅ |
| Arrow class field | own property | one function each | **no** | ✅ |
| **Wrap at call site** | nowhere | **none** | ✅ | ❌ |
| `call`/`apply`/`thisArg` | that one call | none | ✅ | n/a |

**Default to wrapping at the call site.** Use an arrow field for
always-a-callback handlers, and `bind` in the constructor when you need a **stable
function identity** — above all for `addEventListener` / `removeEventListener`
pairs, which match by identity and silently fail with an inline arrow.

## Phase gate

You are done with this topic when you can say why `setTimeout(this.tick, 1000)`
breaks but `setTimeout(() => this.tick(), 1000)` does not, why an inline arrow
cannot be removed as an event listener, and what an arrow class field costs.

## Where this connects

- [Phase 3 · 03 · `this`](../../phase-3-functions/03-this/README.md) — the four binding rules this topic applies to objects
- [Phase 3 · 05 · `call`, `apply` and `bind`](../../phase-3-functions/05-call-apply-bind/README.md) — bind's permanence, measured
- [06 · `class`](../06-class/01-what-class-desugars-to.md) — field initialisers running with `this` already bound, which is why the arrow-field trick works
- [01 · Methods, accessors and spread](../01-object-literals/02-methods-accessors-and-spread.md) — the **opposite** mistake: an arrow in an object literal captures the enclosing scope, not the object

---

Start → [How a method loses `this`](./01-how-methods-lose-this.md)
