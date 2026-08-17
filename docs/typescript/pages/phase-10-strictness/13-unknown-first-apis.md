---
title: "Designing APIs `unknown`-first"
sidebar_label: "13 · Designing APIs unknown-first"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** for `unknown`, type
> predicates and assertion signatures, the **5.5 release notes** for inferred type
> predicates, and the **5.9.3 diagnostic table** (`sandbox/ts-p0`) for `TS18046`
> and `TS2571`. ⚠️ **The vocabulary is not repeated here** —
> [phase 1 · 06](../phase-1-type-vocabulary/06-any-unknown-never-void.md) owns
> `any` / `unknown` / `never` / `void`, and
> [phase 2 · 12](../phase-2-narrowing/12-unknown-in-catch.md) owns narrowing an
> `unknown` you caught. This page is about **designing a signature**.
> **No sandbox run, no console block.**

The last topic ended by pointing at `unknown` from three directions — as the honest
spelling for parsed data, as the alternative to `as any`, and as the thing an
assertion is usually standing in for
([topic 12](./12-assertion-discipline/README.md)). This one asks the design
question: **when should a function you write take or return `unknown`?**

## 🔴 A parameter type is a promise the compiler cannot keep at a boundary

Inside a program, `function save(u: User)` is enforced — the compiler checked every
caller. **At a boundary it is enforced by nobody.** The `User` that arrives from
`res.json()`, a form, a queue or another service got its type from an assertion
somewhere upstream, and the annotation is now *documenting an assumption* rather
than *checking* one.

```ts
// looks checked, is not
function handle(body: RegisterRequest) { … }
handle(await req.json() as RegisterRequest)     // ← the only "check" is this `as`
```

📌 The same observation, argued on a real server, is
[phase 7 · a promise the compiler cannot keep](../phase-7-server/05-typed-express-handlers/02-a-promise-the-compiler-cannot-keep.md).
**`unknown`-first is the design that stops the promise being made.**

## The move, in one line

> **Take `unknown`, return the type.** The function that *produces* a `User` is the
> only place a `User` can be honestly claimed, because it is the only place anything
> was checked.

```ts
function parseUser(input: unknown): User { … }     // the type is an OUTPUT
```

🔴 **This inverts where the type comes from.** In the trusting design the type is an
*input* — an annotation asserting what arrived. Here it is an *output* — the return
value of something that did the work. **A type that is produced by validation cannot
be wrong in the way an asserted one can.**

## Four shapes, and when each is right

| Shape | Signature | Use when |
|---|---|---|
| **Parse** | `(input: unknown) => T` | failure is exceptional — config at startup, a migration |
| 🔴 **Safe parse** | `(input: unknown) => \| { ok: true; value: T } \| { ok: false; error: E }` | **failure is expected** — user input, a flaky upstream. The caller *must* handle both, and the union makes it structural rather than remembered |
| **Predicate** | `(input: unknown) => input is T` | the caller decides what to do, and there is nothing useful to report about *why* it failed |
| **Assertion** | `(input: unknown) => asserts input is T` | the narrowing must survive past the call ([phase 2 · 09](../phase-2-narrowing/09-assertion-functions/README.md) owns the mechanism) |

⚠️ **The predicate and assertion forms carry a caveat worth stating every time: the
compiler does not check that the body proves the claim.** They relocate the trust
rather than removing it — which is still worth doing, because the claim is then
written once instead of at every call site. 📌 Since **5.5**, a simple unannotated
guard gets its predicate **inferred**, and an inferred predicate cannot disagree
with its own body; prefer that where the guard is simple enough for it.

## 🔴 The mistake this design is usually confused with

```ts
function handle<T>(body: T) { … }        // this checks NOTHING
```

An unconstrained generic parameter is inferred **from the argument**, so it accepts
anything and simply carries the caller's type through. It has the shape of a typed
API and the checking of none. ⚠️ **It is worse than `unknown` for this purpose**,
because `unknown` at least forces the body to narrow, while `T` lets the body do
nothing and the caller believe something happened.

**Use a generic when you are *propagating* a type the caller already has. Use
`unknown` when you are *establishing* one.** Those are different jobs and the
syntax makes them look adjacent.

## Returning `unknown`

The mirror image: a function that returns `unknown` forces **every** caller to
narrow before use.

```ts
function readConfigValue(key: string): unknown { … }   // honest about a dynamic read
```

Right for genuinely dynamic reads — a config bag, a cache, a deserialiser. ⚠️ **The
cost is real and lands on the callers**, so it is right when they are few, or when
they genuinely need different types out of the same call. When they all want the
same type, the function should be the one doing the work and returning it.

📌 **The best-known instance is `JSON.parse`, which returns `any`.** Making it return
`unknown` is a global augmentation and the technique is
[phase 4 · global augmentation](../phase-4-classes-declarations/06-global-augmentation.md)'s;
what belongs here is the *reason* — an `any` return means every call site silently
opts out of checking, which is topic 03's inherited `any` arriving through a
standard-library signature.

## Validate once, at the edge

⚠️ **`unknown`-first is a boundary discipline, not a house style.** Applying it to
interior functions produces narrowing at every layer and buys nothing — the value
was already proved.

> **The shape to aim for: a ring of `unknown`-taking functions around a core that
> takes real types.** Data is proved once on the way in, and every function inside
> can trust its parameters because something actually checked.

🔴 **Two validations of the same value in the same request is a design smell, not
extra safety.** It means the boundary is in the wrong place, or nobody could tell
where it was.

## Gotchas

**Symptom:** a handler declares `body: RegisterRequest` and receives something else
in production.
**Cause:** the annotation was never a check — the value crossed a boundary and got
its type from an assertion.
**Fix:** take `unknown` and parse. 🔴 The annotation is not wrong so much as
*unenforceable in that position*.

**Symptom:** `handle<T>(body: T)` was written to "accept any shape safely".
**Cause:** an unconstrained generic infers from the argument and checks nothing.
**Fix:** `unknown` if you intend to establish the type, a constrained generic
(`<T extends …>`) if you intend to propagate one. ⚠️ The generic version is the more
dangerous of the two because it looks typed.

**Symptom:** every call site of an `unknown`-returning function has the same
narrowing copied into it.
**Cause:** the boundary is one level too far out — the callers all want the same
type.
**Fix:** move the narrowing into the function and return the type. `unknown` returns
are for callers that genuinely differ.

**Symptom:** the same payload is validated in the handler, again in the service, and
again in the repository.
**Cause:** nobody could tell where the boundary was.
**Fix:** one ring. Interior functions take real types and trust them; that trust is
what the boundary was bought for.

**Symptom:** a `input is T` predicate is wrong and nothing caught it.
**Cause:** the compiler does not check a predicate's body against its claim.
**Fix:** for simple guards, drop the annotation and let 5.5 infer the predicate. For
complex ones, accept that the guard is now the only thing standing behind every call
site and review it accordingly.

**Symptom:** `unknown` was adopted everywhere and the codebase got noisier without
getting safer.
**Cause:** it was applied as a style rather than at boundaries.
**Fix:** ⚠️ `unknown` in the interior is a cost with no matching benefit — the value
was already proved. Put it where data enters and nowhere else.

**Symptom:** a `TS18046` (*"'x' is of type 'unknown'"*) is silenced with an
assertion.
**Cause:** the error is doing its job and the assertion is the substitution
[topic 12 · chunk 02](./12-assertion-discipline/02-what-an-as-is-standing-in-for.md)
warns about.
**Fix:** narrow it. An `unknown` that gets asserted rather than proved is an `any`
that took two steps.

## Interview questions

**What does "designing an API `unknown`-first" mean?**
Taking `unknown` at the boundary and returning the real type, so the type is an
*output* of validation rather than an *input* asserted by the caller. Inside a
program a parameter annotation is enforced by the compiler; at a boundary it is
enforced by nobody, so it documents an assumption instead of checking one.

**Why is `function f<T>(x: T)` not a safer version of this?**
Because an unconstrained generic is inferred from the argument — it accepts anything
and carries the caller's type through unchanged. It has the shape of a typed API and
does no checking at all, which makes it more misleading than `unknown`, since
`unknown` at least forces the body to narrow.

**When would you return `unknown`?**
When the read is genuinely dynamic — a config bag, a cache, a deserialiser — and the
callers want different types out of it. If they all want the same type, the function
should do the narrowing and return that type; otherwise the same narrowing is copied
to every call site.

**Parse, predicate or assertion signature?**
Parse when failure is exceptional and you want the value. A result union when
failure is expected, because it forces the caller to handle both branches
structurally rather than by remembering. A predicate when the caller decides and
there is nothing useful to say about the failure. An assertion signature when the
narrowing has to survive past the call.

**What is the catch with predicates and assertion signatures?**
The compiler does not verify that the body proves the claim, so they concentrate the
trust rather than removing it. That is still an improvement — one place to review
instead of every call site — and since 5.5 a simple unannotated guard has its
predicate inferred, which is genuinely checked because it cannot disagree with its
own body.

**Should everything take `unknown`?**
No. It is a boundary discipline. Applied in the interior it produces narrowing at
every layer for a value that was already proved, which is cost without benefit. The
shape to aim for is a ring of `unknown`-taking functions around a core that takes
real types — and validating the same value twice in one request is a sign the
boundary is in the wrong place.

**How does this connect to assertion discipline?**
It is the answer to it. Topic 12 found that most assertions stand in for something
that should have been checked, and that the most dangerous ones are claims about
data from outside the program. An `unknown`-first boundary removes the position
those assertions occupy — there is no longer a place to write `as User`, because the
only thing that produces a `User` is the function that checked.

---

← [12 · Assertion discipline](./12-assertion-discipline/README.md) · [Phase 10 index](./README.md)
