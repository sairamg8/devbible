---
title: "Write the types out"
sidebar_label: "06 · Write the types out"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — the one-line rule about
> type parameters from *Functions → Guidelines for Writing Good Generic Functions*
> and the flat *"Don't ever have a generic type which doesn't use its type
> parameter."* from *Declaration Files → Do's and Don'ts* are **quoted verbatim** —
> and the **TypeScript wiki, *Performance*** (*Using Type Annotations*), also quoted.
> **No sandbox, no console block.** Everything not attributed is **judgement**.

The tests said stop. This chunk is the replacement in the commonest case of all: **the
thing you were computing was a shape, and you can just write it.**

[Chunk 07](./07-overloads-and-the-handbook.md) handles the case where the *return type
varies with the argument*, which is where overloads and the handbook's two warnings come
in, and [chunk 08](./08-structure-and-tooling.md) the structural and generated options.

## 1 · Two named types (the boring answer, and usually right)

For a closed input set, the replacement for a computed type is **the types, written
out**:

```ts
// was: type Res<K> = K extends "user" ? User : K extends "order" ? Order : never;
interface UserResponse { kind: "user"; user: User }
interface OrderResponse { kind: "order"; order: Order }
type Response = UserResponse | OrderResponse;
```

Longer in characters, shorter in everything that matters: each name is
jump-to-definition-able, each shape hoverable without instantiating anything, and a
mismatch reports against a name a human wrote.

📌 **Judgement, stated plainly:** the derived version's only real advantage is that it
cannot drift. If drift is not a live risk — the shapes change together, rarely, in one
file — you are paying the error-message cost for an invariant you did not need.

⚠️ **The objection you will get is line count**, and it is the wrong measure. Type
declarations are read once, deliberately, by someone who chose to open the file. Error
messages are read every time somebody is stuck. Trading twelve lines of declaration for
a readable failure is not a close call.

## 2 · A discriminated union plus narrowing

Very often the computed type is trying to say *"if this field is X then that field is
Y"* — and the language has a first-class construction for exactly that:

```ts
// computed: a mapped type making `error` present only when ok is false
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

if (r.ok) r.value.toFixed();   // narrowed, no type-level programming at all
else console.error(r.error);
```

The failure mode is a narrowing error every reader has seen a hundred times
([phase 2 · discriminated unions](../../phase-2-narrowing/05-discriminated-unions.md)),
and exhaustiveness is enforced with a `never` check
([exhaustiveness](../../phase-2-narrowing/06-exhaustiveness.md)) rather than a computed
type.

📌 **Discriminated unions are enumerable**, so
[chunk 02](./02-three-designs-one-mistake.md)'s rule applies: the compiler can print each
member and the reason it did not match. That is a better failure than any conditional
produces.

## 3 · Annotate the return type instead of deriving it

The wiki's guidance from [chunk 03](./03-four-fixes.md) —

> Adding type annotations, especially return types, can save the compiler a lot of work.

— has a design consequence beyond compile time: **a written signature is often the
better version of a derived one.**

```ts
// derived: correct, and its errors print the derivation
declare function makeStore<T>(init: T): {
  get(): T; set(v: T): void; patch(p: Partial<T>): void;
};

// written: a named interface. Errors say "Store<User>".
interface Store<T> { get(): T; set(v: T): void; patch(p: Partial<T>): void }
declare function makeStore2<T>(init: T): Store<T>;
```

Same types. The second has a name in every message, a hover that fits on a screen, and a
place to hang documentation.

⚠️ **This is the highest-value single change in most codebases with unreadable types**,
because a factory function's inferred return type is where anonymous shapes are usually
born, and one annotation fixes every error message downstream of it.

## 4 · Delete the type parameter

The generics-level version of this whole topic. The handbook states it in one line,
quoted in full in
[phase 3 · topic 13](../../phase-3-generics/13-when-not-to-write-a-generic/README.md):

> Remember, type parameters are for *relating the types of multiple values*. If a type
> parameter is only used once in the function signature, it's not relating anything.

And blunter, in *Do's and Don'ts*:

> ❌ **Don't** ever have a generic type which doesn't use its type parameter.

⚠️ **Check this before redesigning anything.** A computed return type over a parameter
that appears once is not a design to improve — it is a `T` that could be `unknown`, plus
an assertion in disguise. The dissection is phase 3's; it belongs on your checklist here
because it is invisible until you count positions.

## 5 · Keep one source of truth, and derive *narrowly*

The honest middle ground, and the one that survives review: **derive one step, not
five.**

```ts
// one source of truth
interface User { id: string; name: string; email: string; createdAt: Date }

// one narrow derivation each — every name is meaningful and hoverable
type UserPatch  = Partial<Omit<User, "id" | "createdAt">>;
type UserPublic = Omit<User, "email">;
type NewUser    = Omit<User, "id" | "createdAt">;
```

Each of those is a single built-in applied once, named. That is type-level programming
doing exactly what it is for — and it is worth noticing that **none of these needs a
conditional type**. The utilities from [topic 03](../03-utility-types/README.md) cover
most real derivation; conditionals start appearing when the derivation depends on the
*input's* type rather than on a fixed key list.

📌 **A useful boundary to hold:** one built-in, named, is free. A chain of three named
steps is fine. An unnamed chain of three is where the trouble starts, and a chain that
branches is where the tests in [chunk 04](./04-the-stopping-tests.md) apply.

## Gotchas

**Symptom:** Written-out types drifted apart after a schema change.
**Cause:** The one genuine advantage of deriving, now realised.
**Fix:** Derive them narrowly from one source of truth, as in §5 — or generate them
([chunk 08](./08-structure-and-tooling.md)). Do not hand-write six shapes and hope.

**Symptom:** A conditional type is expressing "field B is present only when field A is
true".
**Cause:** A discriminated union written as a computation.
**Fix:** Write the union. Narrowing is a language feature whose errors readers already
recognise.

**Symptom:** Hover on a factory function prints a page of object type.
**Cause:** The return type is inferred and anonymous.
**Fix:** Declare a named interface and annotate the return — better errors, less
compiler work, one place for docs.

**Symptom:** A helper's type parameter appears exactly once in the signature.
**Cause:** It relates nothing — the handbook's rule.
**Fix:** Replace it with `unknown` or the concrete type and see what breaks. Usually
nothing, because the parameter was an unchecked assertion.

**Symptom:** Replacing a computed type with named types tripled the line count and
reviewers object.
**Cause:** Character count is being used as the measure.
**Fix:** Compare error messages, hover output and jump-to-definition. Declarations are
read once; failures are read whenever someone is stuck.

**Symptom:** `Partial<Omit<Pick<T, K>, "x">>` appears in a signature.
**Cause:** Narrow derivation, un-named — §5 done halfway.
**Fix:** Give it a name. The chain is fine; the anonymity is the problem.

**Symptom:** The union of written-out types has grown to fifteen members and errors are
long again.
**Cause:** Large unions print every member, and each is compared pairwise.
**Fix:** A base type the members extend, or grouping by discriminant
([chunk 08](./08-structure-and-tooling.md)). Writing types out is not a licence for an
unbounded union.

**Symptom:** Someone "improved" the written types back into a conditional to remove
duplication.
**Cause:** Duplication is visible and error-message cost is not.
**Fix:** Ask which lines actually duplicate. Two shapes that share three fields are
better served by one base interface than by a computation.

**Symptom:** The interface is written but callers still see anonymous types.
**Cause:** The interface is used in one place and the rest of the code re-derives the
shape inline.
**Fix:** Export the name and use it. A name only helps where it is written.

## Interview questions

**★ A colleague replaces a computed return type with a named interface. What did the
codebase gain and lose?**
It gained a name in every error message, a hover that fits on a screen, a place to attach
documentation, and less work for the compiler — the wiki's *"Adding type annotations,
especially return types, can save the compiler a lot of work"*. It lost automatic
tracking: if the implementation's shape changes, the interface must be updated by hand.
That trade is worth making unless drift is a live risk.

**★ Why is a discriminated union so often the right replacement for a computed type?**
Because what is usually being computed is a *correlation* — this field exists only when
that one has a particular value — and a discriminated union states it directly. It
narrows with `if`, it is exhaustively checkable with a `never` guard, and its failures are
narrowing errors that every TypeScript reader already knows. It is also enumerable, so
the compiler can print each member and why it did not match.

**★ "Writing the types out is more code." Answer the objection.**
It is more *declaration* and less *failure*. Declarations are read once by someone who
chose to open the file; error messages are read every time someone is stuck, by people who
did not choose anything. Line count is the wrong measure — compare the error message, the
hover output, and whether jump-to-definition lands somewhere useful.

**★ How much derivation is safe?**
One built-in applied once and named is free — `type UserPatch = Partial<Omit<User, "id">>`
is better than the hand-written version because it cannot drift. A chain of three *named*
steps is fine. An unnamed chain of three is where errors start printing things nobody
wrote, and a chain that *branches* on the input's type is where the stopping tests apply.
The boundary is naming and branching, not the number of operators.

**When does the drift argument for derived types actually hold?**
When the shapes change independently and often, and the source of truth is elsewhere — a
database schema, an API contract, another team's package. Then hand-written types are
guaranteed to go stale, and the answer is to derive them narrowly from one source, or to
generate them from the definition that already exists. When the shapes change together,
rarely, in one file, the drift risk is theoretical and the error-message cost is not.

**What is the single highest-value change in a codebase full of unreadable types?**
Annotating the return types of factory functions. Inferred returns are where anonymous
object types are born, and every downstream error message prints that anonymity. One named
interface per factory fixes every message beneath it, and the compiler does less work into
the bargain.

**Why does the handbook's "a type parameter used once relates nothing" rule belong in this
checklist?**
Because a computed return type over such a parameter is not a design to improve — it is
`unknown` plus an unchecked assertion in angle brackets. It is also invisible until you
count the parameter's positions in the signature, which is why it belongs on a checklist
rather than in intuition. Phase 3's *when not to write a generic* dissects the shape.

**Can writing types out make errors worse?**
Yes, in one way: a large union prints every member, and members are compared pairwise, so
a fifteen-member union is its own readability problem. The answer is not to compute it —
it is a base type the members extend, or grouping by discriminant. "Write them out" is not
a licence for an unbounded union.

---

← Prev: [05 · Is a type the tool?](./05-is-a-type-the-tool.md) ·
[Topic index](./README.md) · Next → [07 · Overloads, and the handbook's two warnings](./07-overloads-and-the-handbook.md)
