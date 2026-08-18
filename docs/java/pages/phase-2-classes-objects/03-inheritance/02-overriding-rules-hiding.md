---
title: "Overriding vs hiding — the exact rules"
sidebar_label: "2 · Overriding vs hiding"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §8.4.8.1 (overriding),
> §8.4.8.2 (hiding of class methods), §8.4.8.3 (requirements in overriding
> and hiding), §8.3 (field declarations — shadowing), §8.4.8.4 (inheriting
> methods with override-equivalent signatures), and the `@Override` Javadoc
> in the JDK 25 API documentation.

**Only instance methods override, and the compiler holds every override to
the contract the parent published: same signature, compatible return,
narrower-or-equal exceptions, wider-or-equal access. Everything else that
looks like overriding — fields, statics, privates — binds statically and
merely *hides*. The one habit that turns this whole rule set into compile
errors instead of production surprises is `@Override` on every single
override.**

## Overriding: the exact rules

An instance method overrides a parent method with the **same name and
parameter types**. The compiler then enforces:

| Aspect | Rule | Why |
|---|---|---|
| Return type | Same, or a **subtype** (covariant) | Callers were promised at least the parent type |
| Checked exceptions | Same, **fewer, or narrower** — never broader | Callers only handle what the parent declared |
| Visibility | Same or **wider** — never narrower | [Access can't be revoked](../02-encapsulation-access/README.md) |
| `static`? | No — statics don't override, they **hide** | Dispatch is per-instance; statics have no instance |

Covariant returns are why builder and `clone()`-style APIs can return their
own type — an override may promise `Child` where the parent declared
`Parent`, sparing callers a cast. Exception narrowing is why an
implementation of an interface method declared `throws IOException` may
throw nothing at all. Unchecked exceptions are outside the rule entirely —
any override may throw any `RuntimeException`.

Parameter types must match **exactly** — not covariantly. A "narrowed"
parameter creates an overload, which is the next section's bug.

## `@Override`: annotate every single one

`@Override` makes the compiler verify "this really overrides something".
The bug it kills is quiet and common — an *accidental overload*:

```java
@Override
public boolean equals(MyType o) { ... }   // compile error: overloads, not overrides
```

Without the annotation, this compiles, `equals(Object)` remains inherited
from `Object`, and every `HashSet`/`HashMap` silently uses identity — the
entity "randomly" fails lookups
([equals and hashCode](../06-equals-hashcode/README.md) owns the full
contract). Same trap with a typo'd name or a slightly different parameter
type (`long` vs `Long`). The rule with no exceptions: **every override
carries `@Override`**, so the compiler — not production — finds the
mismatch. It also catches the reverse failure: a parent method is renamed
in a refactor, and every annotated "override" of the old name stops
compiling instead of silently detaching.

## Overriding vs hiding

Only instance *methods* override. Two look-alikes bind statically:

- **Fields hide.** A subclass field with a parent field's name creates a
  second field; which one an expression reads depends on the *static type
  of the reference*, not the object. Two `name` fields, both alive, chosen
  at compile time — never do this deliberately. (If the parent's field is
  `private`, there is no conflict at all — the subclass field is just a
  field.)
- **Static methods hide.** `Child.create()` vs `Parent.create()` are
  chosen by the reference's compile-time type. A "polymorphic static" does
  not exist ([dispatch](../04-polymorphism-dispatch/README.md) has the full
  model). A static cannot hide an instance method or vice versa — that's a
  compile error, not a quiet rebind.
- **`private` methods are outside all of this**: not inherited, so a
  same-named `private` method in the subclass is an unrelated method, and
  parent-internal calls keep hitting the parent's own.

## Bridge methods: erasure meets overriding

Generics and covariant returns both create situations where the *source*
signatures differ but the *bytecode* must still dispatch correctly. The
compiler closes the gap with synthetic **bridge methods**:

```java
class StringBox implements Comparable<StringBox> {
    public int compareTo(StringBox o) { ... }
    // compiler also emits: public int compareTo(Object o) { return compareTo((StringBox) o); }
}
```

After [erasure](../../phase-3-generics-collections/02-type-erasure.md),
`Comparable`'s method is `compareTo(Object)`; the bridge is the real
override, delegating with a cast. You meet bridges in three places:
reflection returns them (`Method#isBridge` filters), stack traces show a
second frame with the erased signature, and that generated cast is where
the `ClassCastException` from a raw-typed misuse actually fires. Covariant
returns generate the same shape — one bridge per changed return type.

## Gotchas

**Symptom:** entity "disappears" from a `HashSet` — `contains` false for an element that is present
**Cause:** `equals(MyType)` overload instead of `equals(Object)` override; identity comparison inherited from `Object` was in effect
**Fix:** `@Override public boolean equals(Object o)` — the annotation would have made the original mistake a compile error

**Symptom:** the same expression reads different `name` values depending on whether the reference is typed `Parent` or `Child`
**Cause:** field *hiding* — fields bind by static type; both fields exist on the object
**Fix:** never shadow a parent field; rename one. If the parent's is `private`, no conflict exists in the first place

**Symptom:** override that declares `throws SQLException` won't compile, though the body genuinely throws it
**Cause:** the parent method declares no (or narrower) checked exceptions; overrides cannot broaden them
**Fix:** wrap in an unchecked domain exception at this boundary (phase 5's translation pattern), or widen the declaration at the parent *if you own the contract*

**Symptom:** "overrode" a static factory method; parent-typed call sites ignore it
**Cause:** statics hide, not override — resolution used the reference's compile-time type
**Fix:** don't design around static polymorphism; use instance methods on a factory object, or keep statics unique per class

**Symptom:** refactoring rename left subclasses silently calling nothing — behaviour reverted to the parent's
**Cause:** the "overrides" carried no `@Override`, so renaming the parent method detached them into dead private-ish methods without a diagnostic
**Fix:** `@Override` everywhere turns the detachment into compile errors at every site

**Symptom:** reflection over a generic class finds two methods with the same name, one marked synthetic
**Cause:** erasure bridge — the compiler generated the erased-signature override that delegates to yours
**Fix:** filter with `Method::isBridge`; never invoke the bridge directly, and expect the cast inside it to be where raw-type `ClassCastException`s surface

**Symptom:** override compiles without `@Override` but `@Override` on it fails
**Cause:** it isn't an override — parameter types differ (`Long` vs `long`, or a typo), so it's an overload
**Fix:** trust the annotation, fix the signature to match the parent exactly; parameters are never covariant

## Interview questions

**★ What are the rules an overriding method must satisfy?**
Same name and *exact* parameter types; return type same or covariant;
checked exceptions same, fewer or narrower; visibility same or wider; and
it must be an instance method — statics hide instead. `@Override` asks the
compiler to verify all of it.

**★ Overriding vs hiding — what binds when?**
Instance methods override and bind dynamically (runtime type). Fields and
static methods hide and bind statically (compile-time type of the
reference). Private methods are outside inheritance entirely.

**★ What do covariant return types buy in API design?**
An override can promise its own, more specific type — fluent builders and
copy methods return `Child` where the parent declared `Parent`, sparing
callers a cast. Parameters get no such freedom: changing one creates an
overload.

**★ What is a bridge method?**
A compiler-synthesized override with the erased (or parent-return)
signature that casts and delegates to your real method — the mechanism
that makes generic and covariant overriding work on a JVM that dispatches
by exact signature. Visible via reflection (`isBridge`) and in stack
traces.

**★ Why must `equals` take `Object`, not your own type?**
`equals(MyType)` is an overload; every collection calls
`equals(Object)`, which stays `Object`'s identity version — lookups break
silently. The override must take `Object` and typically uses
[`instanceof` or `getClass`](../06-equals-hashcode/README.md) inside.

**Can an override change visibility or exceptions freely?**
Only in the caller-friendly direction: visibility may widen
(protected → public), never narrow; checked exceptions may shrink or
narrow, never grow. Both rules exist so code written against the parent
type keeps compiling and keeps its guarantees.

**What does `@Override` protect against besides typos?**
Refactoring drift (parent rename detaches overrides loudly), wrong
parameter types (`Long`/`long`), overloading instead of overriding, and
"overriding" a static or private method — all become compile errors
instead of silent behaviour changes.

---

← Prev: [`extends`, `super` and construction](01-extends-super-construction.md) · Next → [The fragile base class, and designing for extension](03-fragile-base-design.md)
