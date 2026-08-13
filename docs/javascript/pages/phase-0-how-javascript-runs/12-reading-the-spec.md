---
title: "12 · Reading the specification"
sidebar_label: "12 · Reading the spec"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p0/ex12-spec.mjs`.

**You will read the spec perhaps twice a year, and both times it will settle an
argument nothing else could.** MDN tells you what an API does. The spec tells you
*exactly* what it does, in what order, in the case nobody documented.

Read it when — and only when — you have a behaviour you cannot explain and MDN's
prose is ambiguous.

## Where it lives

| Resource | Use for |
|---|---|
| **[tc39.es/ecma262](https://tc39.es/ecma262/)** | The living standard. Always current — read this, not a PDF of a numbered edition. |
| **[github.com/tc39/proposals](https://github.com/tc39/proposals)** | What is at which stage, and why |
| **MDN** | The answer 95 % of the time. Start here. |
| **[v8.dev/blog](https://v8.dev/blog)** | Implementation detail and performance |

Search the living standard's page directly — it is one enormous HTML document,
so browser find works, and every heading is linkable.

## How to read an algorithm

Spec algorithms are numbered steps operating on **abstract operations** written
in `SmallCaps` — `ToPrimitive`, `ToNumber`, `OrdinaryToPrimitive`, `Get`. They
read like pseudocode because that is what they are.

`ToPrimitive(input, hint)` is the one worth knowing, because it explains a whole
family of confusing results. Roughly:

1. If `input` is not an object, return it.
2. If `input` has a `Symbol.toPrimitive` method, call it with the hint and return
   the result.
3. Otherwise run `OrdinaryToPrimitive` with the hint:
   - hint `"string"` → try `toString` first, then `valueOf`
   - hint `"number"` or `"default"` → try `valueOf` first, then `toString`

And the hint is chosen by the operator: `+` uses `"default"`, template literals
and `String()` use `"string"`, arithmetic operators use `"number"`.

## Observed, exactly as the algorithm says

```js
// sandbox/js-p0/ex12-spec.mjs
const probe = {
  valueOf()  { console.log('  valueOf called');  return 1; },
  toString() { console.log('  toString called'); return 'one'; },
};
console.log('a) obj + 1  (hint default):'); console.log('  result:', probe + 1);
console.log('b) `${obj}` (hint string):');  console.log('  result:', `${probe}`);
console.log('c) obj * 2  (hint number):');  console.log('  result:', probe * 2);

const d = new Date(0);
console.log('d) date + "" is a string:', typeof (d + ''));
console.log('e) date * 1 is a number:', typeof (d * 1));

console.log('f) [10,9,1].sort():', [10, 9, 1].sort());
```

```
a) obj + 1  (hint default):
  valueOf called
  result: 2
b) `${obj}` (hint string):
  toString called
  result: one
c) obj * 2  (hint number):
  valueOf called
  result: 2
d) date + "" is a string: string
e) date * 1 is a number: number
f) [10,9,1].sort(): [ 1, 10, 9 ]
```

Every line matches the algorithm. `+` and `*` took `valueOf`; the template
literal took `toString`. And `Date` is the documented exception — it overrides
`Symbol.toPrimitive` so that hint `"default"` behaves as `"string"`, which is
why `date + ''` gives you a date string while `date * 1` gives a timestamp.

Line **f** is the reason to know this exists at all. `[10, 9, 1].sort()` returns
`[1, 10, 9]` because `sort` with no comparator converts every element to a
**string** and compares those — `"10" < "9"` is true. That is not a bug and not
an implementation quirk; it is step 1 of the spec's `SortCompare`. Phase 5 covers
the fix (`sort((a, b) => a - b)`); this page is why the default is what it is.

## When it is genuinely worth opening

- **An operator behaves strangely with your object.** `ToPrimitive` answers
  nearly all of these.
- **Evaluation order is in question** — which operand runs first, when defaults
  are evaluated, when a getter fires.
- **Two engines disagree.** The spec decides which one has the bug, and that is
  what the bug report needs.
- **An edge case of a method is undocumented** — what `sort` does with `undefined`
  and holes, what `reduce` does on an empty array with no initial value.
- **You are implementing a built-in from scratch**
  ([Phase 17](../../syllabus/04-dsa-and-machine-coding.md)) and want the real
  contract rather than the common case.

## When it is not

For "how do I use `fetch`", "which browsers support this", or "what is the
argument order" — MDN, every time. The spec is precise and slow to read, and it
deliberately says nothing about the host APIs that make up most of your day
([01 · Engine, runtime, spec](./01-engine-runtime-spec.md)). `fetch` and the DOM
are in the WHATWG specs, not ECMA-262.

## Gotchas

**Symptom:** you searched ECMA-262 for `setTimeout`, `fetch` or `document` and
found nothing.
**Cause:** they are host APIs. The language spec contains no I/O at all.
**Fix:** HTML/DOM → WHATWG specs; Node APIs → Node docs.

**Symptom:** the spec text disagrees with the behaviour you see.
**Cause:** usually you are reading a different abstract operation than the one
actually invoked — or an older edition PDF.
**Fix:** read the living standard at tc39.es, and follow the operation the
operator's own algorithm names.

**Symptom:** an object stringifies unexpectedly in a template literal but works
in arithmetic.
**Cause:** different hints select `toString` and `valueOf` in different orders.
**Fix:** define `Symbol.toPrimitive` to control all three cases explicitly.

## Interview questions

**★ Why does `[10, 9, 1].sort()` return `[1, 10, 9]`?**
Because `sort` without a comparator converts each element to a string and
compares the strings — `"10"` sorts before `"9"`. It is specified behaviour, not
a quirk. Pass a comparator: `sort((a, b) => a - b)`.

**★ Why does `date + ''` produce a date string while `date * 1` produces a
number?**
`+` invokes `ToPrimitive` with hint `"default"`, which normally tries `valueOf`
first. `Date` overrides `Symbol.toPrimitive` so that `"default"` behaves as
`"string"` — it is the one built-in that does. `*` uses hint `"number"`, which
still reaches `valueOf` and yields the timestamp.

**When do you actually read the spec?**
When behaviour is unexplained and MDN is ambiguous: operator behaviour with a
custom object, evaluation order, an undocumented edge case, or two engines
disagreeing. Not for API usage or browser support — MDN and caniuse are faster
and sufficient.

**What is an abstract operation?**
An internal, non-callable algorithm the spec defines and reuses — `ToPrimitive`,
`ToNumber`, `Get`. They are how the spec stays consistent: every operator that
coerces refers to the same operation rather than restating the rules.

---

← [11 · The JIT](./11-the-jit.md) · [Phase index](./) · **Phase 0 complete** → [Phase 1 — Values, types and coercion](../../syllabus/01-language-core.md)
