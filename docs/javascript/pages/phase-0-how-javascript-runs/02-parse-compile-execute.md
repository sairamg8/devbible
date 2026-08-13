---
title: "02 · Parse, compile, execute"
sidebar_label: "02 · Parse, compile, execute"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p0/ex6-parse-first.mjs`,
> `ex3-hoisting.mjs`.

**The engine reads your entire file before it runs a single line of it.** That
one fact explains hoisting, the temporal dead zone, and why a typo on line 90
can stop line 1 from printing. Most people learn hoisting as a list of rules to
memorise. It is not a rule — it is a *side effect* of this.

## The three passes

| Pass | What happens | What can fail here |
|---|---|---|
| **1 · Parse** | Source text → AST. Syntax is checked. Declarations are found. | `SyntaxError` — **before any code runs** |
| **2 · Compile** | AST → bytecode. Scopes are created and bindings are registered in them. | Nothing you write causes a failure here |
| **3 · Execute** | Bytecode runs, top to bottom. Bindings get values. | `ReferenceError`, `TypeError` — everything else |

The gap between pass 2 and pass 3 is the whole story. **A binding is created in
pass 2 but only gets its value in pass 3.** Everything below follows.

## Proof: a syntax error stops the first line

```js
// sandbox/js-p0/ex6-parse-first.mjs
console.log('this line never prints');
let x = ;
```

```
exit code: 1
file:///…/sandbox/js-p0/ex6-parse-first.mjs:2
let x = ;
        ^

SyntaxError: Unexpected token ';'
    at compileSourceTextModule (node:internal/modules/esm/utils:318:16)
```

Line 1 is a perfectly valid statement and it produced **no output**. The file
never reached the execute pass, because parsing failed. Compare a *runtime*
error in the same shape:

```js
// sandbox/js-p0/ex6b-runtime.mjs
console.log('this line DOES print');
nope();
```

```
exit code: 1
this line DOES print
ReferenceError: nope is not defined
```

Both exit `1`. Only one of them ran anything.

> **The diagnostic this gives you:** if *nothing at all* printed — not even your
> first `console.log` — you have a syntax error, not a logic bug. Stop reading
> the logic. `node --check file.js` will find it without executing anything.

## Hoisting is the creation pass, observed

```js
// sandbox/js-p0/ex3-hoisting.mjs
console.log('1 fn decl before definition:', typeof hoistedFn, hoistedFn());
function hoistedFn() { return 'callable'; }

console.log('2 var before assignment:', typeof varX, varX);
var varX = 'assigned';

try { console.log(letY); } catch (e) { console.log('3 let before init:', e.constructor.name + ':', e.message); }
let letY = 'assigned';

try { console.log(typeof letZ); } catch (e) { console.log('4 typeof on TDZ binding:', e.constructor.name + ':', e.message); }
let letZ = 1;

console.log('5 typeof on never-declared:', typeof neverDeclared);

function scopes() {
  if (true) { var v = 'var'; let l = 'let'; }
  console.log('6 var escapes the block:', v);
  try { console.log(l); } catch (e) { console.log('7 let does not:', e.constructor.name + ':', e.message); }
}
scopes();
```

```
1 fn decl before definition: function callable
2 var before assignment: undefined undefined
3 let before init: ReferenceError: Cannot access 'letY' before initialization
4 typeof on TDZ binding: ReferenceError: Cannot access 'letZ' before initialization
5 typeof on never-declared: undefined
6 var escapes the block: var
7 let does not: ReferenceError: l is not defined
```

Read that against the three passes and every line is predictable:

| Declaration | Created in pass 2 as | Value available |
|---|---|---|
| `function f() {}` | the **fully built function** | immediately — line 1 calls it before its definition |
| `var x` | a binding initialised to `undefined` | at the assignment; reading earlier gives `undefined` |
| `let` / `const` / `class` | a binding **with no value at all** | at the declaration line; reading earlier **throws** |

The third state is the **temporal dead zone**: the binding *exists* — the engine
found it in pass 2 — but reading it before its declaration line is an error
rather than `undefined`.

## The two error messages are different on purpose

Lines 4 and 5 above are the pair worth memorising:

```
4 typeof on TDZ binding:    ReferenceError: Cannot access 'letZ' before initialization
5 typeof on never-declared: undefined
```

`typeof` is the one operator that safely tolerates a name that does not exist —
that is its historical job. But it does **not** rescue a TDZ binding, because
that name *does* exist; it just has no value yet. And the messages tell you
which case you are in:

- **`Cannot access 'x' before initialization`** → the declaration exists, below
  where you used it. Move the use down, or the declaration up.
- **`x is not defined`** → there is no declaration anywhere in scope. Typo, bad
  import, or wrong scope entirely.

Reading the message rather than pattern-matching on `ReferenceError` saves real
time.

## Why the TDZ is a feature, not a nuisance

`var` returning `undefined` for a variable you have not reached yet is a silent
wrong answer. It flows onward and fails somewhere else:

```js
function priceWithTax(base) {
  const total = base * (1 + taxRate);   // taxRate is in the TDZ
  const taxRate = 0.18;
  return total;
}
```

With `var`, `taxRate` would be `undefined`, `base * NaN` is `NaN`, and you
discover it when a customer sees `₹NaN` at checkout. With `const`, you get
`ReferenceError: Cannot access 'taxRate' before initialization` on the exact
line — at the moment the mistake was made.

**This is why `const` is the default and `var` is not used in new code.**

## Function declarations are hoisted whole. Function *expressions* are not.

```js
hoisted();              // works
function hoisted() {}

expressed();            // TypeError: expressed is not a function
var expressed = function () {};

arrowed();              // ReferenceError: Cannot access 'arrowed' before initialization
const arrowed = () => {};
```

Three different failures for what looks like the same thing, and each names its
cause exactly. `var expressed` exists and holds `undefined` — calling
`undefined` is a **TypeError**. `const arrowed` is in the TDZ — a
**ReferenceError**. Only the declaration form is fully built in pass 2.

## Gotchas

**Symptom:** nothing prints at all, not even the first line, and the process
exits 1.
**Cause:** `SyntaxError` — parsing failed, so nothing executed.
**Fix:** read the caret line in the error; it points at the token. `node --check
file.js` parses without running.

**Symptom:** `Cannot access 'x' before initialization` on a variable you can see
declared right there.
**Cause:** the declaration is *below* the use, and `let`/`const` do not
initialise early.
**Fix:** move the declaration above its first use. Inside a module, check
whether a **circular import** is making the binding read before the other module
finished evaluating.

**Symptom:** a `var` reads as `undefined` and produces `NaN` downstream.
**Cause:** `var` is initialised to `undefined` in pass 2, so the read is legal
and silently wrong.
**Fix:** use `const`/`let` so the same mistake throws at the point of use.

**Symptom:** a helper works when called at the bottom of a module but throws
when called at the top.
**Cause:** it is a function *expression* or arrow assigned to `const`, not a
declaration.
**Fix:** either convert it to `function name() {}`, or move the call after the
assignment. Declaration order matters for expressions and not for declarations.

## Interview questions

**★ What is hoisting, really?**
Not code moving. Before executing, the engine walks the scope and registers
every declaration it finds. Function declarations are created fully built;
`var` is created holding `undefined`; `let`, `const` and `class` are created
with no value, in the temporal dead zone. "Hoisting" is the name for the fact
that the binding exists before its line runs.

**★ Why does `typeof undeclaredThing` return `"undefined"` but
`typeof letInTDZ` throw?**
`typeof` was specified to tolerate names that do not exist, which is why it can
probe for a global safely. A TDZ binding *does* exist — the engine registered it
— it simply has no value yet, and reading an uninitialised binding is an error
regardless of the operator. The two cases are genuinely different, and the error
messages say which is which.

**★ Why does a syntax error stop the file from running at all?**
Parsing is a separate pass that completes before execution begins. If the source
cannot be turned into an AST, there is no program to run. This is also the
fastest way to tell a syntax error from a logic error: with a syntax error, even
your first `console.log` produces nothing.

**Is `const` immutable?**
No — the *binding* is immutable, the value is not. `const cart = []` forbids
reassigning `cart`, but `cart.push(item)` is fine. To protect the value you need
`Object.freeze`, and that is shallow too.

**What breaks if you use `var` everywhere?**
Two things. It is function-scoped, so a `var` inside `if` or `for` leaks to the
whole function — which is the classic loop-closure bug. And it initialises to
`undefined`, so using it too early is silently wrong instead of loudly wrong.

---

← [01 · Engine, runtime, spec](./01-engine-runtime-spec.md) · [Phase index](./) · Next: [03 · Execution contexts and the call stack](./03-call-stack.md) →
