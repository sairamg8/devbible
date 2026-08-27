---
title: "The day the enhancer starts running, a getter that returned a value starts throwing — and the exception it throws is a different string from a different class, with a field name where you are used to reading an identifier"
sidebar_label: "08c · When enhancement is on"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM `7.4` branch source of
> `org.hibernate.bytecode.enhance.spi.interceptor.EnhancementHelper`,
> `LazyAttributeLoadingInterceptor` and `AbstractInterceptor`, and of
> `org.hibernate.bytecode.enhance.internal.bytebuddy.FieldReaderAppender` /
> `PersistentAttributeTransformer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/bytecode/enhance/spi/interceptor/EnhancementHelper.java)),
> compared against the same file on the `6.2` and `6.6` branches; and the Hibernate ORM 7.4
> *Introduction* §9.15 *Using the bytecode enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**[08](08-lazy-basic-attributes.md) and [08b](08b-the-lob-reflex-and-the-group.md) were about a
feature that is off: an annotation the documentation says is ignored, a build plugin nobody
applied, and a failure mode consisting entirely of silence. This chunk is the other side of the
switch. Turning enhancement on does not merely make the lazy column lazy — it changes what your
entity class *is*, and failures that were structurally impossible the day before become
possible. The first and loudest of them is that a getter which returned a `String` now throws,
with a message most people have never seen, from a class that is not the one every article about
this exception talks about. Enabling the plugin belongs to
[Topic 08 · 13c](../08-the-n-plus-1-problem/13c-bytecode-enhancement.md); this is what changes
afterwards.**

## What the enhancer put in your class

You need one mechanical fact before any of the failures make sense. The enhancer does not
subclass `Book`; it rewrites `Book`. Two things happen.

**Every `getfield`/`putfield` on a persistent field, in every method the entity declares, is
replaced with a call to a generated accessor.** `PersistentAttributeTransformer` walks the
declared methods and swaps `GETFIELD fullText` for `INVOKEVIRTUAL $$_hibernate_read_fullText()`,
and `PUTFIELD` for `$$_hibernate_write_fullText(…)`. Final fields are skipped on the write side,
with the source's own reason: *"Final fields will only be written to from the constructor, so
there's no point trying to replace final field writes with a method call."*

**The generated reader has one branch, and it is the branch everything below depends on.**
`FieldReaderAppender` emits it in bytecode, but its own comments spell out the Java it stands
for — `// if ( this.$$_hibernate_getInterceptor() != null )` guarding
`// .readXXX( self, fieldName, field );`. In source terms:

```java
String $$_hibernate_read_fullText() {
    if ( this.$$_hibernate_getInterceptor() != null ) {
        this.fullText = (String) this.$$_hibernate_getInterceptor()
                .readObject( this, "fullText", this.fullText );
    }
    return this.fullText;
}
```

Three consequences fall straight out of that shape, and they are worth stating before the
failures:

- **No interceptor, no interception.** An instance you created with `new Book()` has a null
  interceptor field, so every read and write goes through untouched. Enhancement is inert on
  objects Hibernate did not hand you.
- **The fetched value is written back into the field.** A lazy attribute is fetched at most once
  per instance; the second read finds the attribute already marked loaded and returns
  immediately, with no session involvement at all.
- **The interception point is the field, not the getter.** Renaming `getFullText()`, deleting it,
  or reading the field from a `toString()` in the same class changes nothing.

The enhancer also adds bookkeeping members — `$$_hibernate_attributeInterceptor`,
`$$_hibernate_entityEntryHolder`, `$$_hibernate_previousManagedEntity`,
`$$_hibernate_nextManagedEntity`, and with dirty tracking `$$_hibernate_tracker` and
`$$_hibernate_collectionTracker` — all declared `private transient` **and** annotated
`@Transient`. That pair of modifiers is the whole serialisation story, and it is
**[08c4 · The enhanced instance](08c4-the-enhanced-instance.md)**.

## The read that used to work now throws

This is the headline change and it is a regression in the literal sense: code that ran correctly
before the plugin was applied now raises an exception.

```java
@Transactional(readOnly = true)
public Book load(long id) {
    return repository.findById(id).orElseThrow();
}

// ... after the transaction has completed:
String text = book.getFullText();     // unenhanced: returns the value.
                                      // enhanced:   LazyInitializationException.
```

Nothing in the mapping changed. Nothing in the service changed. The column simply stopped being
part of the initial `select`, and the object you carried out of the transaction no longer has it.

**Every argument in the whole of this topic now applies to a `String` field.** The detached
entity ([04](04-the-detached-entity.md)), the serialiser walking the graph
([02b](02b-where-it-fires.md)), the reference that outlives the method
([04e](04e-references-that-outlive-the-method.md)) — all of it was previously about associations
only, and a lazy column was immune because the value was already sitting in the object. After
enhancement it is not.

## The message, which is not the one you have memorised

The proxy messages in [02 · The exception](02-the-exception.md) come from
`AbstractLazyInitializer`. A lazy *attribute* is not a proxy and never reaches that class. The
throw site is `EnhancementHelper.createLazyInitializationException`, and it builds one format
string with four possible tails:

```java
new LazyInitializationException( String.format(
        Locale.ROOT,
        "Unable to perform requested lazy initialization [%s.%s] - %s",
        entityName,
        attributeName,
        switch ( cause ) {
            case NO_SESSION -> "no session and settings disallow loading outside the Session";
            case CLOSED_SESSION -> "session is closed and settings disallow loading outside the Session";
            case DISCONNECTED_SESSION -> "session is disconnected and settings disallow loading outside the Session";
            case NO_SF_UUID -> "could not determine SessionFactory UUId to create temporary Session for loading";
        }
) );
```

Read the differences from the proxy form carefully, because they are what you search on:

| | Proxy path | Enhancement path |
|---|---|---|
| Class that throws | `AbstractLazyInitializer` | `EnhancementHelper` |
| Prefix | `Could not initialize proxy` | `Unable to perform requested lazy initialization` |
| What is named | `[Entity#id]` — entity **and identifier** | `[Entity.attribute]` — entity **and attribute**, no id |
| Separator | `#` | `.` |
| Number of tails | three, plus two more from the escape hatch | four |
| Rewritten in Hibernate 7? | yes | **no** — the format string is identical in the 6.2, 6.6 and 7.4 sources |

🔴 **The identifier is not in this message.** The proxy message hands you a primary key you can go
and look at; this one hands you a field name instead. That is a real diagnostic downgrade, and
the compensation is that the field name usually identifies the mapping uniquely — there is
generally only one place in a schema called `Book.fullText`, where `Customer#4711` tells you
nothing about which of six associations was unloaded.

The other half of the table is a fact about searching. The famous Hibernate 5-to-7 rewording
that [02](02-the-exception.md) documents applies to the proxy strings only. This one has been
stable across three major-version branches, so the results you find for it are at least talking
about the same string — there are simply far fewer of them.

## The four tails, and what each one means

- **`no session and settings disallow loading outside the Session`** — the interceptor's session
  reference is null. `AbstractInterceptor.unsetSession()` ran, which is exactly the detachment
  event [04](04-the-detached-entity.md) describes, applied to an interceptor instead of a proxy.
- **`session is closed and settings disallow loading outside the Session`** and **`session is
  disconnected …`** — the same two states the proxy path distinguishes, for the same reasons, and
  with the same diagnostic value: *closed* means the unit of work finished, *disconnected* means
  it has not finished but has given the JDBC connection back.
- **`could not determine SessionFactory UUId to create temporary Session for loading`** — you only
  ever see this one with `hibernate.enable_lazy_load_no_trans` enabled, because it is thrown from
  `openTemporarySessionForLoading`. Its presence in a stack trace is a *tell* that the unsafe
  setting is on in the environment that produced it, in the same way the `session was closed or
  disconnected` form is a tell on the proxy path. That setting is
  [06b2 · Turning it off](06b2-turning-the-exception-off.md).

Note the wording of the first three: *"settings disallow loading outside the Session"*. The
enhancement path names the setting it wishes you had enabled, inside the message for the failure
that happens when you have not. **That is not an instruction.**

## Gotchas

**★ Turning enhancement on is a behaviour change to code nobody edited.** The commit adds a build
plugin. The diff contains no Java. The failures appear in getters, in `toString`, in log lines
and in serialisers across the whole application, and none of them are in the changed files. Treat
it as a change with a blast radius, not as a build tweak.

**★ The exception message is a different string, so your alert did not fire.** A log pattern or a
test matching `Could not initialize proxy` does not match `Unable to perform requested lazy
initialization`. If you alert on this exception at all, alert on the *type*
`org.hibernate.LazyInitializationException`, which covers both — the advice
[02](02-the-exception.md) gives for the Hibernate 5-to-7 wording change happens to also cover the
proxy-to-attribute difference.

**★ The message does not contain the identifier.** You get `[Book.fullText]`, not `[Book#4711]`.
There is no row to go and look at, and if the attribute is read from three call sites the message
does not distinguish them. The stack trace matters more here than on the proxy path, which is
awkward because the frames just below the throw are all generated `$$_hibernate_read_*` methods.

**★ The message names one attribute and the fetch would have covered several.** All singular
lazy attributes share one lazy group by default, so `[Book.fullText]` is the attribute that was
*touched*, not the set that would have been loaded. Do not read the message as a statement about
how much data was involved — that is
[08b · One lazy column is never one lazy column](08b-the-lob-reflex-and-the-group.md) and
[Topic 08 · 13d](../08-the-n-plus-1-problem/13d-lazy-groups.md).

**★ One read inside the transaction immunises the object for the rest of its life.** The
generated reader assigns the fetched value back into the field and the interceptor records the
attribute as initialised, so an entity whose lazy column was touched — deliberately or by a log
line — serialises perfectly after detachment. This is the column-level version of
[03c · Something initialised it first](03c-something-initialised-it-first.md), and it is why the
same endpoint can throw for one caller and not another.

**★ The temporary session on this path is a *stateless* session.**
`openTemporarySessionForLoading` calls `openStatelessSession()`, where the proxy path's
`permissiveInitialization()` calls `openSession()`. If you are reasoning about what
`enable_lazy_load_no_trans` costs, the two escape hatches do not open the same kind of object and
do not have the same lifecycle.

**★ A statement-count test cannot tell you the enhancer started working, only that it did not.**
Before enhancement the column rides along in an existing statement; afterwards it is an extra
statement per group per instance. So the count goes *up* when the feature starts working, which
reads like a regression in exactly the tests you would use to prove it is not one
([Topic 08 · 6b](../08-the-n-plus-1-problem/06b-asserting-the-count-in-a-test.md)).

## Interview questions

**★ You applied the Hibernate enhancement plugin and a getter that worked yesterday now throws.
Is that a bug?**
No — it is the feature arriving. Before the plugin, `@Basic(fetch = LAZY)` was documented to be
ignored, so the column was fetched as part of the initial select and the value was sitting in the
object regardless of session state. After the plugin the column is genuinely not loaded, so
reading it outside a session is the same failure as following an uninitialised proxy and it
throws for the same reason. The correct reaction is not to remove the plugin but to notice that
you have just extended every detached-entity argument in this topic to cover a `String` field,
and to go and check the call sites the topic already names: the serialiser, the reflective
mapper, the log statement and `toString`.

**★ How does the exception for a lazy column differ from the one for a lazy association?**
Same type — `org.hibernate.LazyInitializationException` — and a completely different message from
a completely different class. The proxy path throws from `AbstractLazyInitializer` with `Could
not initialize proxy [Entity#id] - no session`; the enhancement path throws from
`EnhancementHelper` with `Unable to perform requested lazy initialization [Entity.attribute] - no
session and settings disallow loading outside the Session`. Practically, the proxy message gives
you an identifier and the attribute message gives you a field name, so the first is a row you can
look up and the second is a grep. And where Hibernate 7 rewrote all the proxy strings, this one is
unchanged across the 6.2, 6.6 and 7.4 sources, so the two behave differently in a search engine
as well.

**★ You see `could not determine SessionFactory UUId to create temporary Session for loading` in a
production stack trace. What has it told you?**
Two things, neither of them about the attribute. First, `hibernate.enable_lazy_load_no_trans` is
enabled in that environment — that tail is only reachable from `openTemporarySessionForLoading`,
which is only called when the interceptor allows loading outside a transaction. Second, the
`SessionFactory` that owned this object is no longer registered under the UUID the interceptor
remembers, which in practice means the object outlived the factory: a serialised entity restored
after a restart, a cached object from a previous context, or a test that closed the factory
between phases. The fix is not to make the UUID resolvable; it is to stop the object from
travelling that far, and to reconsider the unsafe setting
([06b2](06b2-turning-the-exception-off.md)).

**★ Why is a statement count a bad test for "did enhancement start working"?**
Because the direction of the change is counter-intuitive. Unenhanced, the lazy column is read as
part of the select that was already happening — correct count, wrong width. Enhanced, the column
becomes an extra statement issued the first time anything in its lazy group is touched, so the
count goes *up*. A test asserting "exactly two statements" fails when the feature you wanted
starts working, and passes when it silently stops. What you actually want to assert is the shape
of the SQL, or that the enhanced class file contains the generated accessors, or behaviourally
that reading a non-lazy field does not trigger the extra select.

**The other three changes — a write that should throw and does not, the two Hibernate helpers for
asking whether an attribute is loaded, and the fact that your entity's own `toString` is now a
caller of the database — continue in
[08c2 · Writes and checks](08c2-writes-and-checks.md) and
[08c3 · The entity's own methods](08c3-the-entitys-own-methods.md).**

{/* FOOTER */}
