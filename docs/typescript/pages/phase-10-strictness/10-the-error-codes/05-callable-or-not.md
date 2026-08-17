---
title: "Callable or not — the parentheses family"
sidebar_label: "05 · Callable or not"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **numbered diagnostic table** in the **TypeScript
> 5.9.3** build. Codes and templates read from that table: `TS2349`, `TS2351`,
> `TS2757`, `TS2348`, `TS2347`, `TS2560`, `TS2774`, `TS2721`, `TS2722`, `TS2723`,
> `TS6212`, `TS6234`, `TS1209`, `TS1329`, `TS7052`. **No sandbox, no console
> block.**

TypeScript spends **at least eight distinct diagnostics** on one mistake:
parentheses. That is a strong signal about how often it happens, and the codes
differ by *where* the un-called function ended up, which makes them a fast
diagnosis.

> **A forgotten `()` never looks like a forgotten `()`.** It looks like a type
> mismatch, or an object with no properties in common, or a condition that is
> always true, or an index signature complaint. The compiler knows, and says so —
> in a clause at the end of a message nobody reads to the end.

## "Did you mean to call it?" — the same mistake, five reports

| Code | Template | Where the un-called function was |
|---|---|---|
| `TS2560` | `Value of type '{0}' has no properties in common with type '{1}'. Did you mean to call it?` | passed as an **argument** or assigned |
| `TS2774` | `This condition will always return true since this function is always defined. Did you mean to call it instead?` | inside an **`if`** or a `&&` |
| `TS7052` | `Element implicitly has an 'any' type because type '{0}' has no index signature. Did you mean to call '{1}'?` | used as an **index** — `obj[getKey]` |
| `TS1209` | `Invalid optional chain from new expression. Did you mean to call '{0}()'?` | after `new` in an **optional chain** |
| `TS1329` | `'{0}' accepts too few arguments to be used as a decorator here. Did you mean to call it first and write '@{0}()'?` | as a **decorator** — `@factory` instead of `@factory()` |
| `TS6212` | `Did you mean to call this expression?` | a `Message`-category related line, attached elsewhere |

🔴 **`TS2774` is the dangerous one**, because without it the code *runs* and is
silently wrong:

```ts
if (user.isAdmin) { /* always taken — isAdmin is a method */ }
```

A function object is truthy, so the branch is unconditional. **This is a real
production bug class, and the compiler catches it only because someone added a
dedicated diagnostic for it.** Without `strictNullChecks` and this check, a
permission gate that always opens looks identical to one that works.

📌 **`TS1329` deserves a mention because decorator factories are conventionally
called and decorators conventionally are not** — `@Injectable()` versus
`@override`. There is no way to tell from the name which kind you have, so the
compiler's willingness to say so is the only defence.

## 🔴 `TS6234` — the inverse mistake

```text
This expression is not callable because it is a 'get' accessor.
Did you mean to use it without '()'?
```

**Too many parentheses**, not too few. A `get` accessor looks like a method at the
call site and is not one:

```ts
class Box { get size() { return 3; } }
new Box().size();      // TS6234 — it is already a number
```

📌 **This is why the accessor-versus-method decision is an API decision, not a
style one.** Changing `get size()` to `size()` is a breaking change with no
type-level warning at the *declaration*; every caller breaks instead. Pick one and
keep it.

## The three "not callable" codes, and what each implies

| Code | Template | Implies |
|---|---|---|
| `TS2349` | `This expression is not callable.` | the value has a type, and that type has no call signature |
| `TS2757` | `Type '{0}' has no call signatures.` | the same thing, said with the type named — usually appears as elaboration |
| `TS2351` | `This expression is not constructable.` | you used `new` on something with no construct signature |
| `TS2348` | `Value of type '{0}' is not callable. Did you mean to include 'new'?` | 🔴 the opposite — it **is** constructable and you called it without `new` |

`TS2348` is the friendly one: a class-like value called as a function. Common with
older UMD packages whose types declare a constructor, and with `Symbol`-like
values.

📌 **`TS2349` on something you are certain is a function** almost always means the
*type* is wrong, not the value — a namespace import used as a callable
(`import * as express from "express"` then `express()`), which is
`esModuleInterop`'s territory and belongs to **phase 6 · `esModuleInterop` and
default imports** *(not written yet)*.

## 🔴 `TS2347` — the error that is really about a missing dependency type

```text
Untyped function calls may not accept type arguments.
```

You wrote `thing<Foo>()` and `thing` is `any`. **The message is about type
arguments; the finding is that the callee has no type at all.** A type argument
on an untyped call is meaningless, so the compiler refuses rather than silently
ignoring it.

**The value here is that it is one of the few places `any` produces an error
instead of silence.** Almost everything else about `any` is quiet propagation —
[topic 03](../03-containing-any.md) is the inventory. `TS2347` is a rare loud
signal that you are calling into an untyped module, and it is worth treating as a
prompt to type the dependency rather than to delete the type argument.

⚠️ **Deleting the type argument "fixes" it and makes things worse** — you lose the
only indication that the call is untyped.

## Calling something that might not be there

| Code | Template |
|---|---|
| `TS2721` | `Cannot invoke an object which is possibly 'null'.` |
| `TS2722` | `Cannot invoke an object which is possibly 'undefined'.` |
| `TS2723` | `Cannot invoke an object which is possibly 'null' or 'undefined'.` |

🔴 **These have no named variant, and that asymmetry is worth noticing.** For
*property access* the compiler has both an anonymous form (`TS2532`) and a named
one (`TS18048` — *"'x' is possibly 'undefined'"*), and it prefers the named form
whenever it can print the expression
([chunk 09](./09-you-have-not-proved-it.md)). For **invocation** there is only the
anonymous form. So the trick of extracting a subexpression into a named `const` to
get a better message — which works everywhere else — buys you nothing here.

**The fixes, in order:**

```ts
onDone?.();                    // optional call — the idiomatic answer
if (onDone) onDone();          // narrow first, when you need a fallback
const fn = onDone ?? noop;     // supply a default at the boundary
fn();
```

⛔ **`onDone!()` is not on the list.** It asserts the callback exists at a point
where the type says it may not, and callbacks are exactly the values that are
sometimes absent.

📌 **`?.()` is the right default for optional callbacks and it is frequently
forgotten**, because `?.` is so associated with property access that its call form
goes unused.

## Gotchas

**Symptom:** an `if` on a permission or feature check that always passes.
**Cause:** `TS2774` — you are testing a **method**, and functions are truthy.
**Fix:** call it. And treat this as the reason to prefer boolean *properties* over
zero-argument predicate methods on config-like objects.

**Symptom:** `Value of type '…' has no properties in common with type '…'`.
**Cause:** `TS2560`. You passed a function where its result was expected.
**Fix:** add `()`. The clause naming this is at the very end of the message.

**Symptom:** `TS6234` — "not callable because it is a 'get' accessor".
**Cause:** the opposite mistake; you added `()` to a getter.
**Fix:** remove them. And decide once, per API, whether a value is an accessor or
a method — switching later breaks every caller with no warning at the
declaration.

**Symptom:** `express is not a function` at runtime, with `TS2349` in the editor.
**Cause:** a namespace import used as a callable.
**Fix:** `esModuleInterop` and a default import. **Phase 6 · `esModuleInterop`
and default imports** *(not written yet)* owns this.

**Symptom:** `Untyped function calls may not accept type arguments`.
**Cause:** `TS2347` — the callee is `any`, so your type argument means nothing.
**Fix:** type the dependency, or write a local `.d.ts` for it. Do **not** delete
the type argument, which removes the only evidence that the call is untyped.

**Symptom:** `TS2722` on a callback, and extracting it to a `const` does not
improve the message.
**Cause:** the invocation codes have no named variant, unlike the property-access
ones.
**Fix:** nothing to improve. Use `?.()` and move on.

**Symptom:** a decorator silently does nothing.
**Cause:** you wrote `@factory` where `@factory()` was needed. `TS1329` fires only
when the arity makes it detectable.
**Fix:** check the decorator's docs. There is no naming convention that
distinguishes a factory from a decorator.

**Symptom:** `obj[getKey]` complains about an index signature.
**Cause:** `TS7052` — `getKey` is the function, not the key.
**Fix:** `obj[getKey()]`. The "Did you mean to call" clause is at the end of a
message whose first half is about index signatures, which is why it gets missed.

**Symptom:** `new Foo?.()` is rejected.
**Cause:** `TS1209` — optional chaining is not allowed on `new`.
**Fix:** `Foo ? new Foo() : undefined`. Optional chaining short-circuits property
and call expressions, not construction.

## Interview questions

**How many ways does TypeScript tell you that you forgot to call a function?**
At least six distinct codes, differing by where the un-called function ended up:
`TS2560` when it was passed or assigned, `TS2774` when it was used as a condition,
`TS7052` when it was used as an index, `TS1209` after `new` in an optional chain,
`TS1329` as a decorator, and `TS6212` as a related-information line. The number of
dedicated diagnostics is itself the point — this is the mistake the compiler has
invested most in recognising.

**Why is `if (user.isAdmin)` on a method a serious bug rather than a style
problem?**
Because a function object is truthy, so the branch is unconditional and the code
runs without error. A permission gate written that way always opens. The only
thing standing between you and shipping it is `TS2774`, a diagnostic that exists
solely for this case.

**What does `Untyped function calls may not accept type arguments` actually tell
you?**
That the function you are calling is typed `any`. The message is about the type
argument, but the finding is the missing type. It is one of the very few places
where `any` produces an error rather than silent propagation, so it is worth
treating as a prompt to type the dependency. Deleting the type argument silences it
and removes the only signal that the call is unchecked.

**How do you call a possibly-undefined callback?**
`onDone?.()`. The optional-call form of `?.` is the idiomatic answer and is
underused because `?.` is so associated with property access. Narrowing with an
`if` is equally correct when you need an else branch, and supplying a default at
the boundary — `const fn = onDone ?? noop` — is best when the callback is called in
several places. A non-null assertion is the wrong answer, because an optional
callback is precisely the kind of value that is sometimes absent.

**Why does extracting an expression into a named variable improve some nullability
errors but not others?**
Because the improvement comes from the compiler having a printable name for the
expression, and only some diagnostics have a named variant. Property access has
both forms — `TS2532` anonymous and `TS18048` named. Invocation has only the
anonymous `TS2721`–`TS2723`. So the naming trick works for `.foo` and does nothing
for `()`.

**What breaks when you change a `get` accessor into a method?**
Every caller, and nothing at the declaration. The declaration change is legal on
its own; the failures appear at each call site as `TS6234` or as a type mismatch
where the function object was used as a value. It is a breaking API change that
looks like a refactor, which is why the accessor-versus-method choice is worth
making deliberately and keeping.

---

← [04 · Arity and overloads](./04-the-call-site-family.md) · [Topic index](./README.md) · Next → [06 · The name is wrong](./06-the-name-is-wrong.md)
