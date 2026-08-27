---
title: "Under enhancement a setter on a detached entity is silently accepted while the matching getter throws, and the helper you would use to ask whether an attribute is loaded returns true for a name that does not exist"
sidebar_label: "08c2 · Writes and checks"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM `7.4` branch source of
> `org.hibernate.bytecode.enhance.spi.interceptor.LazyAttributeLoadingInterceptor` and
> `org.hibernate.bytecode.enhance.internal.bytebuddy.PersistentAttributeTransformer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/bytecode/enhance/spi/interceptor/LazyAttributeLoadingInterceptor.java)),
> the `org.hibernate.Hibernate` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> and the Hibernate ORM 7.4 *User Guide* §6.2.2 *In-line dirty tracking*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**[08c](08c-when-enhancement-is-on.md) covered the loud change: the read throws. The two changes
on this page are quieter, and each breaks an assumption you did not know you had — that a setter
is at least as dangerous as a getter, and that "is this attribute loaded" is a safe question to
ask. Under enhancement both are false, and the first is false in the surprising direction: the
write succeeds where the read fails, and succeeding is worse.**

## The write that should throw and does not

`LazyAttributeLoadingInterceptor` handles the two directions completely differently:

```java
@Override
protected Object handleRead(Object target, String attributeName, Object value) {
    if ( !isAttributeLoaded( attributeName ) ) {
        final Object loadedValue = fetchAttribute( target, attributeName );
        attributeInitialized( attributeName );
        return loadedValue;
    }
    return value;
}

@Override
protected Object handleWrite(Object target, String attributeName, Object oldValue, Object newValue) {
    attributeInitialized( attributeName );
    return newValue;
}
```

`handleWrite` never touches the session. It marks the attribute loaded and returns the new value.
So:

```java
book.setFullText("replacement");   // detached, enhanced, never fetched — does NOT throw
String s = book.getFullText();     // and now returns "replacement", with no query
```

This is correct for Hibernate's purposes — overwriting a value makes reading the old one
pointless — and it is a trap for yours. **A setter on a detached enhanced entity is silently
accepted, and it silently converts the field from "not loaded" to "loaded".** Any subsequent
`Hibernate.isPropertyInitialized` check answers `true`, and any code relying on that check to
decide whether the object is safe to hand onward now gets the wrong answer.

The read-modify-write shape is where this bites:

```java
book.setFullText(book.getFullText() + suffix);   // throws on the read, detached
book.setFullText(newText);                       // succeeds, detached — same object, same field
```

One line throws, the other does not, and the only difference is whether the old value was needed.

### Why this matters on the write path, not just the read path

Interception-based dirty tracking is the second thing the enhancer turns on, and it is on by
default in both build plugins. The user guide's description of the mechanism it replaces:

> *"Hibernate would keep track of the last known state of an entity in regards to the database …
> Then, as part of flushing the persistence context, Hibernate would walk every entity associated
> with the persistence context and check its current state against that 'last known database
> state'. This is by far the most thorough approach to dirty checking … However, in a persistence
> context with a large number of associated entities, it can also be a performance-inhibiting
> approach."*

and of the replacement: *"the entity itself keeps track of which of its attributes have changed.
During the flush time, Hibernate asks your entity what has changed."*

The combination of that with `handleWrite` is the interesting part. **Under interception,
Hibernate can record that `fullText` changed without ever having read the old value.** A
snapshot-based flush cannot do that — it has nothing to compare against unless the column was
loaded — which is precisely why attribute-level laziness and interception-based dirty tracking
arrive in the same build step rather than as two independent features.

What interception *gives up* — in-place mutation of a mutable field value, the `java.util.Date`
and `byte[]` cases, and the `enableDirtyTracking` switch that is deprecated for removal — is
argued in full in
**[Topic 08 · 13d · Lazy groups and the cost](../08-the-n-plus-1-problem/13d-lazy-groups.md)**.
Do not re-derive it; the point here is only that you cannot enable lazy columns and decline the
write-side change, because the write-side change is what makes lazy columns writable at all.

## Asking instead of touching

Because a read is now a fetch, you need a way to ask whether a field is loaded that is not itself
a read. `org.hibernate.Hibernate` has one, and its javadoc contains two clauses that decide how
much you can trust it:

> *"Determines if the field or property with the given name of the given entity instance is
> initialized. **If the named property does not exist or is not persistent, this method always
> returns `true`.** This operation returns `true` if the field or property references an unfetched
> collection or proxy."*

```java
if (Hibernate.isPropertyInitialized(book, "fullText")) { … }
```

Both emphasised clauses are traps.

- **A typo returns `true`.** `"fullTxt"`, a renamed field, a property that was made `@Transient` —
  all answer "initialized", because the method's contract for "I do not recognise that name" is
  `true`, not an exception. A guard built on this fails open, and keeps failing open silently
  after any rename.
- **`true` is a statement about the field, not about what it points at.** For an association the
  method tells you the reference is populated; the object it references may be an unfetched proxy.
  For deciding whether a graph is safe to serialise this is nearly useless on its own — that
  question is `Hibernate.isInitialized` on each target, one level at a time.

The overload that takes a `jakarta.persistence.metamodel.Attribute` removes the first trap
entirely, because the name comes from the generated static metamodel and a rename breaks the
compile:

```java
if (Hibernate.isPropertyInitialized(book, Book_.fullText)) { … }
```

There is a matching initialiser, and its javadoc is equally precise:

> *"Initializes the field or property with the given name of the given entity instance. This
> operation **does not fetch a collection or proxy referenced by the field or property**."*

`Hibernate.initializeProperty(book, "fullText")` goes through the interceptor —
`getAttributeInterceptor(entity).readObject(entity, attributeName, null)` — so it needs an open
session and throws the same `Unable to perform requested lazy initialization` if there is not one.
And it is guarded by `isPersistentAttributeInterceptable(entity)`: **on an unenhanced class it
does nothing at all and reports nothing**, which is the same silent no-op
[08](08-lazy-basic-attributes.md) is about, wearing a different hat. It is the attribute-level
sibling of `Hibernate.initialize` and inherits every objection
[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md) raises against it.

The Jakarta-standard equivalents are `PersistenceUnitUtil.isLoaded(Object, String)` and
`PersistenceUnitUtil.load(Object, String)`, which the javadoc of both Hibernate methods points at.
Prefer them when you want the portable spelling; the semantics above are what Hibernate implements
underneath.

## Gotchas

**★ Writing a lazy attribute detached is silently accepted and marks it loaded.** No exception,
and `Hibernate.isPropertyInitialized` flips to `true` afterwards. Any "is this object safe" check
performed after a setter has run is answering a question about a value your own code put there.

**★ A read-modify-write throws where a plain write succeeds, on the same field of the same
object.** `setFullText(getFullText() + x)` fails; `setFullText(x)` does not. A reviewer scanning
for "does this touch a lazy field" passes both, because the distinction is whether the old value
is read, not whether the field is mentioned.

**★ A silently accepted detached write becomes a real problem at `merge` time.** The object you
merge carries "loaded" markers for attributes nobody fetched and a value for one attribute you
assigned. What the merged row ends up containing is decided by machinery outside this topic —
[Topic 06 · 13b · merge returns a copy](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md) —
and the general rule stands: do not mutate detached entities and merge them back. Load, mutate
inside the transaction, let dirty checking write.

**★ `Hibernate.isPropertyInitialized` returns `true` for an attribute name that does not exist.**
The javadoc is explicit. Every string-literal guard you write is one rename away from silently
always passing, and nothing fails at compile time. The `Attribute` overload fed from the static
metamodel removes the whole class of bug.

**★ `isPropertyInitialized` being `true` does not mean the graph is safe.** The javadoc says it
returns `true` when the field references an unfetched collection or proxy. It answers "is this
field populated", not "is everything under this field fetched". Building a serialisation guard on
it produces a check that passes and a response that throws.

**★ `Hibernate.initializeProperty` does nothing on an unenhanced class.** It is guarded by
`isPersistentAttributeInterceptable`, so on classes the plugin never touched it returns normally
having accomplished nothing. A "fix" built on it works in the module that is enhanced and is a
no-op in the module that is not — and both are in the same codebase.

**★ An instance you constructed with `new` never throws any of this.** The interceptor is null, so
every generated accessor falls through to the raw field. Unit tests that build entities by hand
exercise none of the behaviour on this page, which is how enhancement problems reach production
through a green suite.

**★ You cannot take lazy columns without taking the dirty-tracking change.** Both build plugins
default `enableDirtyTracking` to `true`, the switch that turns it off is deprecated for removal,
and the interception mechanism is what lets Hibernate record a change to a column it never
read. Budget for the accuracy loss
([Topic 08 · 13d](../08-the-n-plus-1-problem/13d-lazy-groups.md)) as part of the price of the
feature, not as an optional extra.

## Interview questions

**★ Does writing a lazy attribute on a detached entity throw?**
No, and that asymmetry is worth knowing. `LazyAttributeLoadingInterceptor.handleWrite` marks the
attribute initialised and returns the new value without ever looking at the session, because
Hibernate has no reason to fetch a value you are about to replace. So the setter succeeds, the
field is now considered loaded, and a subsequent get returns what you wrote with no query. The
consequences are that a read-modify-write on a lazy column throws while a straight overwrite does
not, and that any "is this loaded" check taken after a setter has run is reporting on your own
assignment rather than on a fetch.

**★ How do you check whether a lazy attribute is loaded without loading it?**
`Hibernate.isPropertyInitialized(entity, attributeName)`, or the Jakarta-standard
`PersistenceUnitUtil.isLoaded(Object, String)`. Two caveats decide how much weight it will carry.
First, the javadoc says that if the named property does not exist or is not persistent the method
*always returns `true`* — so a typo or a rename turns the guard into a constant, silently; use the
`Attribute` overload with the static metamodel so the compiler checks the name. Second, `true`
means the field is populated, not that what it points at is fetched: the javadoc says it returns
`true` when the field references an unfetched proxy. For "is this whole graph safe to serialise"
you need `Hibernate.isInitialized` per target, and the honest answer is that if you are asking
that question at runtime you have already lost the argument [05](05-the-dto-boundary.md) makes.

**★ Why do attribute-level laziness and interception-based dirty tracking come in the same build
step?**
Because the second is what makes the first survivable on the write path. Snapshot-based dirty
checking compares the entity's current state against the last known database state at flush; it
cannot do that for a column it never loaded. Interception records the write as it happens, which
means Hibernate can issue an update for `fullText` without ever having selected `fullText`. They
are separate plugin flags, but the flag that disables dirty tracking is deprecated for removal
with the stated intent that both become unconditional, and in practice enabling lazy columns means
accepting interception's known accuracy loss on in-place mutation of mutable field values.

**★ A service loads an entity, the transaction ends, a caller sets a lazy column and you call
`save()`. What is wrong with that?**
Several things, and only one of them is about laziness. The setter itself does not throw, so the
code looks fine; but the object now carries a value for one lazy attribute and "not loaded"
markers for whatever shares its lazy group, and `save()` on a detached entity is a `merge`, which
returns a copy and issues a select of its own. The shape that avoids all of it is the one the
whole topic argues for: take the identifier and the new value across the boundary, load inside a
transaction, mutate the managed instance, and let dirty checking write it. Nothing detached, no
merge, no question about what a partially-loaded object means.

**The third change — every method your entity declares is now a caller of the database, which
puts `toString`, `equals`, `hashCode` and the JPA callbacks in scope — is
[08c3 · The entity's own methods](08c3-the-entitys-own-methods.md).**

{/* FOOTER */}
