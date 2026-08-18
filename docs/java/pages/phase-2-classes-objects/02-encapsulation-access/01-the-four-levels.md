---
title: "The four levels, precisely"
sidebar_label: "1 · The four levels"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §6.6 (access control), §6.6.2
> (details on protected access), and §7.6 (top-level declarations).

**Four access levels, one table — and two rows that most working Java
developers misread. `protected` is *wider* than package-private, not a
stricter alternative; and `private` protects the class, not the instance.
Getting these two exactly right is the difference between access control you
design with and access control that surprises you in review.**

## The four levels, precisely

| Modifier | Same class | Same package | Subclass (other package) | Everywhere |
|---|---|---|---|---|
| `private` | ✅ | — | — | — |
| *(none)* — package-private | ✅ | ✅ | — | — |
| `protected` | ✅ | ✅ | ✅ | — |
| `public` | ✅ | ✅ | ✅ | ✅ |

Two rows are routinely misread:

- **`protected` includes the whole package.** It is package-private *plus*
  subclasses elsewhere — strictly wider than the default, not an alternative
  to it. A same-package class that is not a subclass can touch your
  `protected` members freely. Java has **no** "subclasses only" level; if
  that is the design you want, the language cannot express it and package
  discipline has to.
- **Package-private is a real design tool, not an omission.** No keyword
  means "internal to this package" — which, combined with "one package per
  feature", gives you module-like encapsulation with zero machinery
  ([chunk 3](03-boundaries-at-scale.md) builds on this).

## The §6.6.2 subtlety on `protected`

From *outside* the package, a subclass may access a protected *instance*
member only **through a reference of its own type or a subtype** — not
through a supertype reference:

```java
package other;
class MyList extends BaseList {
    void merge(MyList peer, BaseList stranger) {
        this.hook();       // ✅ own instance
        peer.hook();       // ✅ reference typed as my own class
        stranger.hook();   // ❌ compile error — BaseList reference, outside package
    }
}
```

The rationale: `protected` grants a subclass access to *its own* inherited
state, not a skeleton key to every other subclass's. `protected static`
members and constructors-via-`super(...)` are exempt from the
own-type restriction.

## `private` is class-level, not instance-level

`private` protects the *class*, not the *object*: code in `Money` can read
`other.amount` for any other `Money`. That is deliberate, and the standard
`equals` idiom depends on it:

```java
@Override public boolean equals(Object o) {
    return o instanceof Money m
        && amount.equals(m.amount)          // touching m's private field: legal
        && currency.equals(m.currency);
}
```

The same license powers `compareTo`, copy constructors, and static factory
methods that assemble instances field-by-field. A reviewer flagging
"accessing another object's privates" in these idioms is misreading the
model.

## Where each modifier may appear

**Top-level classes** take only `public` or package-private — `private class
Foo` at file level has nothing to be private *to*, and `protected` needs an
inheritance context that top level lacks. **Members** (fields, methods,
nested types, constructors) take all four. Making a *constructor* private or
package-private is access control over construction itself — the lever
behind static factories and singletons
([class anatomy](../01-class-anatomy/03-factories-builders-safety.md)).

`private` members of *nested* classes are accessible across the whole
top-level file — the file compiles into one **nest**, and nestmates share
private access ([nested classes](../11-nested-classes.md) covers the
mechanics). And one modifier interaction worth naming: interface members are
implicitly `public` (fields also `static final`), so an interface offers no
access design space at all below `public` — except `private` interface
methods, which exist purely as helpers for `default` methods
([abstract vs interfaces](../05-abstract-vs-interfaces.md)).

## Gotchas

**Symptom:** a teammate "protected" a helper and same-package test/production code still calls it freely
**Cause:** `protected` includes the entire package — it is wider than package-private, not stricter
**Fix:** if the goal was "subclasses only", Java has no such level; package-private plus package discipline, or redesign so the hook isn't needed

**Symptom:** subclass in another package gets a compile error calling a `protected` method on a supertype-typed reference — "but I'm a subclass!"
**Cause:** JLS §6.6.2 — outside the package, protected instance access must go through a reference of the accessor's own type or below
**Fix:** retype the reference, or accept the design hint: that member wasn't meant as a cross-subclass API

**Symptom:** `equals` implementation reads another instance's private field and a reviewer flags it as a violation
**Cause:** misunderstanding — `private` is class-scoped; any `Money` code may access any `Money` instance's privates
**Fix:** nothing to fix; it is the standard idiom and the JLS-specified meaning

**Symptom:** `private` on a top-level class won't compile
**Cause:** top-level types take only `public` or package-private (JLS §7.6)
**Fix:** package-private for file-internal types, or nest the class inside its only user and then make it `private`

**Symptom:** a field on an interface turned out to be globally mutable state — except it wouldn't compile as mutable
**Cause:** interface fields are implicitly `public static final` — constants only; there is no instance state in interfaces
**Fix:** state belongs in classes; interfaces carry contract plus constants

**Symptom:** test in the same package reaches internals "by accident of layout"
**Cause:** the standard same-package-in-`src/test` convention deliberately grants package-private access to tests
**Fix:** that is the feature — test through the package boundary consciously: same package for white-box tests, a different package to force black-box testing of the public surface

## Interview questions

**★ List the four access levels and what each admits.**
`private` — same top-level class (nest); package-private (no keyword) — same
package; `protected` — same package *plus* subclasses anywhere (with the
outside-package "through your own type" rule for instance members); `public`
— everywhere. The commonly missed fact: `protected` ⊇ package-private.

**★ Is `private` per-instance or per-class, and what relies on the answer?**
Per-class: any instance's code may access another instance's private
members of the same class. The standard `equals`/`compareTo`/copy-constructor
idioms all read the other object's fields directly.

**★ Explain the JLS §6.6.2 restriction on `protected`.**
Outside the declaring package, a subclass reaches a protected instance
member only through references of its own type or a subtype — its own
inherited state, not sibling subclasses'. Statics and `super(...)` calls are
exempt.

**★ Why can't a top-level class be `private` or `protected`?**
`private` scopes to an enclosing class that doesn't exist at top level;
`protected` adds subclass access to package access, and top-level types
already offer package access as the default — the remaining half has no
meaning without an enclosing type. Nested classes take all four.

**What does a `private` constructor actually control?**
Construction: only the class itself (and nestmates) can instantiate —
enabling static factories, singletons, and utility classes that are never
instantiated. It also blocks subclassing, since no `super(...)` is
accessible.

**Why does making a member `private` in a nested class still expose it to the enclosing file?**
The top-level class and everything nested in it compile into one nest;
nestmates access each other's private members directly. Privacy is
file-scoped, not braces-scoped.

---

← Index: [Encapsulation and access](README.md) · Next → [Designing with access](02-designing-with-access.md)
