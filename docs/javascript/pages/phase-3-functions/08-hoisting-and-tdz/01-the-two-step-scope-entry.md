---
title: "08.1 · The two-step scope entry"
sidebar_label: "01 · The two-step scope entry"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Glossary: Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting). Documentation-validated.

**Nothing moves.** The single most repeated sentence about hoisting — "declarations
are moved to the top of their scope" — describes what the behaviour *looks like*,
not what happens. No code is relocated, no lines are reordered, and the source file
the engine parses is the file you wrote.

What actually happens is that entering a scope is a **two-step** operation, and the
steps are separated in time:

1. **The scope is set up.** Before a single statement of that scope runs, the engine
   walks its declarations and creates a binding — a named slot — for each one. Some
   slots are given a value now; some are deliberately left empty.
2. **The scope's code runs.** Assignments happen in the order you wrote them.

Every hoisting behaviour in the language falls out of one question about step 1:
**what, if anything, went into the slot.** The declaration is always hoisted. The
*initialisation* is what differs.

## The one table this topic reduces to

MDN's hoisting glossary names four distinct behaviours people call "hoisting", and
assigns each declaration form to one of them:

| Declaration | Slot created at scope entry? | Initialised to | Usable before its line? |
|---|---|---|---|
| `function` (and `function*`, `async function`) | yes | **the finished function** | **yes** — calls work |
| `var` | yes | **`undefined`** | yes, but the value is `undefined` |
| `let`, `const`, `class` | yes | **nothing** — left uninitialised | **no** — `ReferenceError` |
| `import` | yes | the exported binding | yes, and side effects run first |

MDN's own names for those rows: **value hoisting** for functions, **declaration
hoisting** for `var`, **behavioural hoisting** for `let`/`const`/`class` (the
declaration changes behaviour above its own line by creating the dead zone), and
value **plus side-effect hoisting** for `import`.

MDN's definitions of the four, worth having in full because the distinctions are
what the rest of the topic hangs on:

1. *"Value hoisting — Being able to use a variable's value in its scope before the
   line it is declared."*
2. *"Declaration hoisting — Being able to reference a variable in its scope before
   the line it is declared, without throwing a `ReferenceError`, but the value is
   always `undefined`."*
3. *"Behavioral hoisting — The declaration of the variable causes behavior changes
   in its scope before the line in which it is declared."*
4. *"Side effects hoisting — The side effects of a declaration are produced before
   evaluating the rest of the code that contains it."*

## Two things to extract before anything else

**`let` and `const` are hoisted.** The slot exists from the top of the block. This
is the claim people get wrong in both directions — either "they aren't hoisted at
all" or "hoisting is just a `var` thing". MDN hedges deliberately: `let`
declarations are *"commonly regarded as non-hoisted"*, because from a utilitarian
point of view the hoisting buys you nothing. But the slot is demonstrably there,
and [chunk 3](./03-the-temporal-dead-zone.md) shows exactly how you can observe it.

**Hoisting is not in the specification.** There is no *Hoist* algorithm. MDN notes
the term is not normatively defined; the spec defines *HoistableDeclaration*, and
that covers **function declarations only**. Everything else is the observable
consequence of how environment records are populated. This matters when you are
reading the spec to settle an argument — searching for "hoisting" will not find the
answer, and someone confidently citing "the hoisting section" has not read it.

## Where the bindings actually live

The slots are not floating in the abstract. They are entries in an **environment
record**, one per scope, chained to its parent. That chain is the scope chain from
[07 · The scope chain](../07-lexical-scope/01-the-scope-chain.md); hoisting is
simply the rule for *how that record is populated before its code runs*.

Holding those two pictures together is the whole model:

- **The scope chain** answers *where* a name is found — walk outward until a record
  has it.
- **Hoisting** answers *when* that name became usable — was its slot filled at scope
  entry, filled with `undefined`, or left empty?

Almost every confusing variable bug in JavaScript is one of those two questions
being answered wrongly in someone's head. The rest of this topic is the second one,
form by form.

## Reading the three error types

Before the detail, the payoff. These three errors mean different things and have
different fixes, and telling them apart on sight is most of the practical value of
understanding hoisting:

| You see | It means |
|---|---|
| `ReferenceError: x is not defined` | **no binding exists** anywhere in the scope chain — a typo, a missing import, or the wrong scope |
| `TypeError: x is not a function` | the binding exists and holds something **not callable** — usually a hoisted `var` still holding `undefined` |
| `ReferenceError: Cannot access 'x' before initialization` | the binding exists but is **uninitialised** — a `let`/`const`/`class` used above its line, or a circular import |

One means "never", one means "not yet a function", one means "too early". Each is
covered in its own chunk below.

## Gotchas

**Symptom:** You searched the ECMAScript specification for "hoisting" and found
nothing useful
**Cause:** The term is not normatively defined. MDN notes the spec defines only
*HoistableDeclaration*, covering function declarations.
**Fix:** Look at how the relevant environment record is populated
(*FunctionDeclarationInstantiation*, *GlobalDeclarationInstantiation*,
*BlockDeclarationInstantiation*) rather than searching for the folk term.

**Symptom:** Someone insists `let` is "not hoisted" and someone else insists it is,
and both cite MDN
**Cause:** Both are quoting real MDN text. The binding **is** created at scope
entry; MDN also says lexical declarations are *"commonly regarded as non-hoisted"*
because that hoisting gives you nothing usable.
**Fix:** Separate the two claims: the *binding* is hoisted, the *usability* is not.
The TDZ is the observable proof the binding exists.

**Symptom:** A variable bug that seems to depend on where the code is written
**Cause:** Two different mechanisms get confused — the scope chain (*where* a name
is found) and hoisting (*when* it became usable).
**Fix:** Ask the two questions separately. Which record holds this name? Was its
slot filled at scope entry?

## Interview questions

**★ What is hoisting?**
Entering a scope happens in two steps: bindings for every declaration in that scope
are created before any of its code runs, then the code runs. **Nothing is physically
moved.** What differs per declaration form is whether the binding is *initialised*
at creation — functions get the finished function, `var` gets `undefined`, and
`let`/`const`/`class` get nothing at all and throw until their line executes.

**★ Are `let` and `const` hoisted?**
Yes — the binding is created at the top of the block. It is just left
uninitialised, so any access before the declaration throws `ReferenceError` rather
than yielding `undefined`. MDN notes they are *"commonly regarded as non-hoisted"*
because the hoisting gains you nothing, but the binding demonstrably exists — the
temporal dead zone is the proof.

**★ Is hoisting defined in the ECMAScript specification?**
Not as such. MDN notes the term is not normatively defined; the spec defines
*HoistableDeclaration*, which covers function declarations only. Everything else is
the observable result of how each scope's environment record is populated before
its code runs.

**What are MDN's four kinds of hoisting?**
Value hoisting (functions — the value is usable early), declaration hoisting (`var`
— referenceable early but always `undefined`), behavioural hoisting
(`let`/`const`/`class` — the declaration changes behaviour above its own line by
creating the TDZ), and side-effect hoisting (`import` — the imported module runs
before the rest of your code).

**What is the difference between the scope chain and hoisting?**
The scope chain answers *where* a name resolves — which environment record holds
it, walking outward. Hoisting answers *when* that binding became usable within its
own scope. They are separate questions and most variable confusion is one of them
answered wrongly.

---

[Topic index](./README.md) · Next → [`var` and function declarations](./02-var-and-function-declarations.md)
