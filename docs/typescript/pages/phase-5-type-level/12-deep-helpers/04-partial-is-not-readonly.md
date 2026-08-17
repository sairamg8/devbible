---
title: "`DeepPartial` is not `DeepReadonly`"
sidebar_label: "04 · Partial is not Readonly"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types*, *Mapped Types*).
> The `exactOptionalPropertyTypes` behaviour is
> [phase 10 · topic 05](../../phase-10-strictness/05-exactoptionalpropertytypes/README.md)'s,
> linked rather than restated. **No sandbox, no console block, no timings.**

[Chunk 03](./03-the-version-that-holds-up.md) found a mechanical difference between the two
helpers — one wants an array guard and the other does not. That difference is a symptom.
The real difference is what each one *claims*, and it is the reason one of them is safe to
reach for and the other is a design decision.

## One removes capability; the other admits values

**`DeepReadonly` is a restriction.** Every value of `DeepReadonly<T>` is a value of `T`; the
type just refuses to let you write to it. Applying it cannot make a program describe
something that does not exist, which is why it is safe to apply liberally and why "make this
whole config tree readonly" is a sentence with no follow-up questions.

**`DeepPartial` is a widening.** `DeepPartial<T>` admits values that are **not** `T` — that
is its entire purpose. And in doing so it asserts something about your domain:

> **Every subset of this structure, at every depth, is a meaningful thing.**

For most domains that is false. A `User` with no `id`, an `Address` with only a postcode, an
`Order` with a `total` and no `items` — these are not partially-specified users and orders,
they are nonsense that now type-checks. `DeepPartial` does not describe your data; it
describes *edits* to your data, and those are different types with different rules.

📌 **This is the test to apply before writing it:** can you name a real value of
`DeepPartial<T>` that is not a patch, a fixture or a merge input? If not, the type belongs
at those three boundaries and nowhere else.

## The three places it is actually right

### 1. A patch body

The shape of a `PATCH` request: a description of what to change, where absence means "leave
it alone". The type is genuinely `DeepPartial`-ish, with one correction:

```ts
type Patch<T> = /* the guarded DeepPartial */;

// but an array is REPLACED, not patched
type PatchUser = Patch<{ name: string; tags: string[] }>;
// { name?: string; tags?: string[] }   ← tags whole-or-absent, never (string | undefined)[]
```

That is [chunk 03](./03-the-version-that-holds-up.md)'s array branch, and this is the reason
for it: **there is no such thing as patching element 3 of an array by position** in any API
worth designing. Absence means "unchanged"; presence means "replace the whole list".

### 2. A test fixture builder

```ts
function makeUser(overrides: DeepPartial<User> = {}): User { … }
```

Here `DeepPartial` never escapes: it is a parameter, and the **return type is `User`**. The
helper's job is to let a test say what it cares about, and the builder's job is to produce a
complete value. Nothing downstream ever holds a `DeepPartial<User>`.

### 3. A config merged with defaults

```ts
function resolveConfig(user: DeepPartial<Config>): Config { … }
```

Same shape as the fixture: partial in, complete out, and the merge is the only place that
knows what the defaults are.

🔴 **All three have the same structure — `DeepPartial` on the way in, `T` on the way out.**
That is the pattern. If a `DeepPartial<T>` is being **returned**, stored in state, or passed
between modules, it has stopped being an edit and become a domain type, and every consumer
from there on has to handle a shape nobody designed.

## What escapes look like

The failure is not an error; it is a slow spread of checks:

```ts
// it started as a patch and got stored
const [draft, setDraft] = useState<DeepPartial<Order>>({});

// … and now every read is a question
draft.customer?.address?.postcode          // three optional hops
draft.items?.[0]?.price ?? 0               // a default invented at the point of use
```

**Each `??` here is a domain decision being made by whoever happened to write the line**,
because the type stopped carrying the answer. That is the cost, and it is paid in a
different file from the one where `DeepPartial` was chosen.

⚠️ **The `!` version is worse and more common.** `draft.customer!.address!` type-checks,
asserts nothing, and moves the failure to runtime —
[phase 4 · topic 08](../../phase-4-classes-declarations/08-readonly-and-definite-assignment.md)
makes that argument in full.

## `exactOptionalPropertyTypes` changes what a deep-optional property means

An optional property has two possible readings — *absent* and *present-but-`undefined`* —
and the flag decides whether they are the same thing. That matters more for a deep helper
than for a shallow one, because a patch is usually built by spreading:

```ts
const patch = { ...form };   // may carry explicit undefined for untouched fields
```

Under `exactOptionalPropertyTypes`, `{ name?: string }` does **not** accept
`{ name: undefined }` — so a patch assembled by spreading a form object stops fitting the
patch type, which is the flag doing its job: an explicit `undefined` and an absent key mean
different things to a merge function, and the flag is what forces you to say which you meant.

[Phase 10 · topic 05](../../phase-10-strictness/05-exactoptionalpropertytypes/README.md) has
the full argument, the three diagnostics and the migration cost. What belongs here is the
consequence: **`DeepPartial` and `exactOptionalPropertyTypes` interact, and a patch type
written without deciding the absent-versus-`undefined` question is under-specified whichever
way the flag is set.**

## What no version of the type can express

A patch type says a patch is **well-formed**. It cannot say the merge produced a **valid**
`T`:

```ts
type Patch = DeepPartial<Order>;

const p: Patch = { status: "shipped" };       // well-formed
merge(order, p);                              // …onto an order with no items?
```

Nothing in the type system connects "this field is present" to "this combination is legal".
That is a **validation** question, and
[topic 08 · chunk 09](../08-knowing-when-to-stop/09-the-boundary-and-the-generator.md)'s rule
applies: validate at the boundary and let the validator's output type be the source of
truth, rather than trying to compute legality in the type.

📌 **The same rule kills the most common misuse.** `DeepPartial<T>` is not the type of parsed
JSON. Parsed JSON is `unknown` until something checks it; typing it as a deep-partial makes
every field optional *and* asserts the shape is otherwise correct, which is the worst of both.

## `DeepRequired` is the inverse and is rarer for a reason

Making everything required at every level asserts presence the compiler cannot verify. It is
occasionally right — immediately after a validator that guarantees completeness — and in that
position the validator's return type is a better answer than a mapped type over the input.
If you find yourself writing `DeepRequired`, check whether what you want is a type the
validator already produces.

## Gotchas

**Symptom:** `DeepPartial<T>` appears in a component's props or a function's return type.
**Cause:** It escaped the boundary it was written for.
**Fix:** Partial in, complete out. If a caller needs the incomplete shape, that shape
deserves its own name and its own rules — a `Draft` type is not a `DeepPartial`.

**Symptom:** Every read is three optional hops and a `??` with an invented default.
**Cause:** The type stopped carrying the domain's answers, so each call site invents one.
**Fix:** Resolve once, at the boundary, into the complete type. The defaults belong in one
merge function, not at every use.

**Symptom:** A patch built by spreading a form object stops compiling after
`exactOptionalPropertyTypes` is enabled.
**Cause:** The spread carries explicit `undefined`s, and the flag distinguishes those from
absent keys.
**Fix:** Decide what your merge does with an explicit `undefined` — clear the field, or
ignore it — and encode that. The flag exposed an ambiguity that was always there.

**Symptom:** `DeepPartial` on an array made every element possibly `undefined`.
**Cause:** The homomorphic path applies the optional modifier to the numeric element
([chunk 02](./02-what-it-breaks.md)).
**Fix:** The array branch from [chunk 03](./03-the-version-that-holds-up.md) — and note the
domain reason it is correct: arrays are replaced, not patched by position.

**Symptom:** The patch type accepts a combination the API rejects.
**Cause:** Well-formedness and validity are different questions, and only the first is
expressible.
**Fix:** Validate at the boundary and take the type from the validator. Do not try to encode
the rules in the patch type; that is where deep helpers turn into
[topic 08](../08-knowing-when-to-stop/README.md)'s cautionary tale.

**Symptom:** Parsed JSON was typed as `DeepPartial<T>` and wrong data got deep into the app.
**Cause:** That type asserts the shape is otherwise correct while making everything
optional.
**Fix:** `unknown` plus a guard or a schema validator. The optionality was never the
interesting part.

**Symptom:** `DeepRequired<T>` is being used to silence optionality after a check.
**Cause:** The check's guarantee is not visible in its type.
**Fix:** Give the validator a return type that says what it guarantees. A mapped type over
the input is a restatement of the assumption, not evidence for it.

**Symptom:** `DeepReadonly` was applied everywhere with no discussion and `DeepPartial` in
one place caused an argument.
**Cause:** Correct instinct. One is a restriction and cannot describe values that do not
exist; the other is a widening and always claims something about the domain.
**Fix:** Nothing — but say the reason out loud, because the two are usually presented as a
matched pair.

## Interview questions

**★ Why is `DeepReadonly` safe to apply liberally and `DeepPartial` not?**
Because `DeepReadonly` is a restriction: every value of `DeepReadonly<T>` is a value of `T`,
so applying it cannot make the program describe something that does not exist. `DeepPartial`
is a widening — it deliberately admits values that are not `T`, and in doing so asserts that
every subset of the structure at every depth is meaningful. For most domains that is false,
so it is a design decision rather than a convenience.

**★ Where does `DeepPartial` genuinely belong?**
Three places, all with the same shape: a patch body, a test fixture builder, and a config
merged with defaults. In every one of them it is an **input** and the output is the complete
type. The rule that follows is the useful one: if a `DeepPartial<T>` is being returned,
stored in state, or passed between modules, it has become a domain type nobody designed.

**★ What is the domain argument for not making arrays deep-partial?**
There is no meaningful way to patch element three of a list by position — an API either
replaces the whole array or has explicit add/remove operations. So a patch type wants
`tags?: string[]`, whole-or-absent, rather than `(string | undefined)[]`. That is the same
array branch the mechanics forced in the previous chunk, arrived at from the other
direction, which is a good sign it is right.

**★ How does `exactOptionalPropertyTypes` interact with a deep-partial type?**
It decides whether an absent key and an explicitly `undefined` key are the same thing. That
matters most for patch types, because patches are usually built by spreading an object that
carries `undefined` for untouched fields — so the flag makes such a patch stop fitting. The
right response is not to widen the type but to decide what the merge does with an explicit
`undefined`, which is an ambiguity the flag exposed rather than created.

**★ What can a patch type never express?**
Validity. It can say a patch is well-formed — the keys exist and the value types match — but
not that applying it produces a legal `T`. Field-presence and domain-legality are different
questions, and only the first is structural. The answer is to validate at the boundary and
let the validator's output type be authoritative, not to keep enriching the patch type.

**Is `DeepPartial<T>` a good type for parsed JSON?**
No, and it is a common misuse. It makes every field optional while still asserting the shape
is otherwise correct, so it is simultaneously too weak and too strong. Parsed JSON is
`unknown` until something has checked it; the type should come from the check.

**Why is `DeepRequired` rarer, and when is it right?**
Because it asserts presence the compiler cannot verify — the mirror image of `DeepPartial`'s
widening. It is defensible immediately after something guaranteed completeness, but in that
position the validator's return type is a better source of the guarantee than a mapped type
over its input. Reaching for `DeepRequired` is usually a sign a function's signature is
under-describing what it promises.

---

← [03 · The version that holds up](./03-the-version-that-holds-up.md) ·
[Topic index](./README.md) · Next → **05 · The cost, and the alternatives**
*(not written yet)*
