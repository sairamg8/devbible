---
title: "Bytecode enhancement is the fix for the N+1 you cannot annotate your way out of — and the only Hibernate feature whose off state is a silently ignored mapping"
sidebar_label: "13c · Bytecode enhancement"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §9.15 *Using the bytecode
> enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Hibernate ORM 7.4 *User Guide* §6.2 *Bytecode Enhancement*, §29.1 *Bytecode
> Enhancement* / §29.1.1 *Runtime Bytecode Enhancement*, §29.5.1 (Gradle plugin) and
> §29.6.1 (Maven plugin)
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2.

**Two of the N+1 shapes in this topic cannot be fixed by any annotation, any query and any
fetch plan: a `@Basic(fetch = LAZY)` column that is fetched eagerly anyway, and the parent
side of a bidirectional `@OneToOne` that issues a select per row no matter what you write.
Both have the same fix and it is not in your source code — it is a build step that rewrites
your entity classes. Enhancement is also the one Hibernate feature that fails by doing
nothing: if the plugin is not applied, or is applied with a syntax the documentation
explicitly warns about, your lazy mappings are ignored and nothing tells you.**

## What the enhancer actually enables

The introduction lists three capabilities:

> *"Hibernate's bytecode enhancer enables the following features: **attribute-level lazy
> fetching** for basic attributes annotated `@Basic(fetch=LAZY)` and for lazy
> non-polymorphic associations, **interception-based** — instead of the usual
> snapshot-based — detection of modifications. In addition, use of the bytecode enhancer
> relaxes the usual requirement that entity and embeddable classes have default
> constructors."*

Only the first of those is an N+1 concern, and it is the one this topic sent you here for.

The user guide's framing in §6.2.1 is worth having, because it is a different mental model
from proxies:

> *"Think of this as partial loading support… Note that this is very much different from
> the proxy-based idea of lazy loading which is entity-centric where the entity's state is
> loaded at once as needed. With bytecode enhancement, individual attributes or groups of
> attributes are loaded as needed."*

**A proxy is a stand-in for a whole entity. Enhancement is field-level interception inside
a real entity.** That distinction is why one of them needs a build step and the other does
not: a proxy can be generated at runtime as a subclass, but intercepting a read of
`this.fullText` inside a method of `Book` requires changing `Book`'s own bytecode.

## The failure mode: your mapping is ignored

This is the sentence that matters more than any other on this page. The introduction, on a
`@Basic(optional = false, fetch = LAZY)` field mapped to a `text` column:

> *"**Without** the bytecode enhancer, this instruction is ignored, and the field is always
> fetched immediately, as part of the initial `select` that retrieves the `Book` entity.
> **With** bytecode enhancement, Hibernate is able to detect access to the field, and lazy
> fetching is possible."*

Read the failure direction carefully. Without enhancement you do **not** get a
`LazyInitializationException`, you do **not** get a warning, and you do **not** get a
startup error. You get a `select` that reads the 200 kB column on every row of every page
that loads a `Book` — which is the column-level version of the problem
[4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md) describes, and it is
invisible in a statement count because the number of statements is correct. Only the bytes
are wrong.

The same silence applies to the bidirectional `@OneToOne` parent side. The user guide, in
its mapping chapter, says that although you may annotate the parent-side association lazy,
"Hibernate cannot honor this request since it cannot know whether the association is `null`
or not… Because this can lead to N+1 query issues, it's much more efficient to use
unidirectional `@OneToOne` associations with the `@MapsId` annotation in place. However, if
you really need to use a bidirectional association and want to make sure that this is always
going to be fetched lazily, **then you need to enable lazy state initialization bytecode
enhancement**." That is the shape
[4d · The ones you cannot make lazy](04d-the-ones-you-cannot-make-lazy.md) sets up, and this
is its only real answer short of remapping.

## Turning it on: Gradle

```groovy
plugins {
    id "org.hibernate.orm" version "7.4.6.Final"
}

hibernate {
  enhancement {}
}
```

The introduction attaches a warning to this snippet that is unusual enough to quote whole:

> *"Some online documentation (including previous versions of the present one) suggest to
> use `hibernate { enhancement }`, which will **not** work as it is interpreted by Gradle as
> a (pointless) getter call instead of actual configuration. That form will result in
> bytecode enhancement NOT happening (unfortunately silently). To enable bytecode
> enhancement, make sure to always use the block form (with `{}`)."*

**Two empty braces are the difference between the feature working and the feature not
existing, and both forms compile.** Combine that with the previous section — an unenhanced
build silently ignores your lazy mappings — and you have a configuration mistake that
produces no error anywhere in the toolchain and shows up only as a page that is slower than
it should be. Hibernate's own older documentation shipped the broken form, so the odds that
a copied build file has it are not small.

The plugin's `enhancement` block exposes three properties (§29.5.1):

| Property | Default | What it does |
|---|---|---|
| `enableLazyInitialization` | `true` | attribute-level lazy loading and `@LazyGroup` |
| `enableDirtyTracking` | `true` | in-line dirty tracking instead of state snapshots |
| `enableAssociationManagement` | `false` | auto-synchronise the other side of a bidirectional association |

## Turning it on: Maven

```xml
<plugin>
  <groupId>org.hibernate.orm</groupId>
  <artifactId>hibernate-maven-plugin</artifactId>
  <version>7.4.6.Final</version>
  <executions>
    <execution>
      <goals><goal>enhance</goal></goals>
    </execution>
  </executions>
</plugin>
```

The guide notes that "by default the plugin will perform bytecode enhancement for lazy
initialization and dirty tracking" — the same two `true` defaults as Gradle, so the plugin
above with no configuration block is already what you want. `classesDirectory` defaults to
`{project.build.directory}/classes`, so it enhances `target/classes` in place after
compilation.

⚠️ The artifact id is `hibernate-maven-plugin` with an `enhance` goal, under the
`org.hibernate.orm` group. Older material names `hibernate-enhance-maven-plugin`; if you
are copying a `<plugin>` block from an article, check the coordinates against the 7.4 guide
rather than against the article.

## Runtime enhancement, and why it is not your route

§29.1.1 documents a third path:

> *"Hibernate can also perform run-time bytecode enhancement when used in Jakarta EE
> compliant containers through `jakarta.persistence.spi.ClassTransformer`… Run-time
> enhancement is controlled through 3 true/false settings (all of which default to
> false)"* — `hibernate.enhancer.enableDirtyTracking`,
> `hibernate.enhancer.enableLazyInitialization` and
> `hibernate.enhancer.enableAssociationManagement`.

**Note the defaults invert.** The build plugins default lazy initialization and dirty
tracking to `true`; the runtime settings default all three to `false`. So setting
`spring.jpa.properties.hibernate.enhancer.enableLazyInitialization=true` in an
`application.yaml` looks like the obvious way to switch this on — and it is the path the
documentation scopes to Jakarta EE containers using the container's `ClassTransformer`,
telling you to "see the documentation of your container for any additional details". A
plain Spring Boot executable jar is not that environment, and I could not confirm against
the 7.4 documentation that those properties take effect there. **Use the build plugin.**
It runs at a point in the lifecycle where there is no ambiguity about whether it ran: the
class files on disk are either rewritten or they are not.

## The deprecations, read correctly

Both build-plugin flags carry a deprecation notice, and it is easy to misread as "this
feature is going away". The Maven documentation states the intent explicitly:

> *"This parameter has been deprecated for removal. After this removal, lazy loading will
> always be enabled."*

and the same for dirty tracking. **What is deprecated is the ability to switch them off, not
the capability.** Enhancement is moving toward being unconditional once the plugin is
applied. Two other deprecations in the same area are real removals of behaviour, and both
are covered in [13d · Lazy groups and what enhancement costs](13d-lazy-groups.md):
*extended* enhancement, and bidirectional association management.

## Gotchas

**★ `hibernate { enhancement }` and `hibernate { enhancement {} }` differ by two characters
and one of them does nothing.** Gradle reads the first as a getter call. No error, no
warning, no enhancement — and therefore no attribute-level laziness, silently.

**★ An unenhanced build does not throw; it over-fetches.** `@Basic(fetch = LAZY)` is
"ignored" and the column is read eagerly. Your statement count is unchanged, so a count
assertion ([6b · Asserting the count](06b-asserting-the-count-in-a-test.md)) will not catch
it. This is the one problem in this topic that counting statements cannot detect.

**★ Enhancement is a build-time transformation, so it is per-module.** If entities live in
a shared library module and the plugin is applied to the application module, the library's
classes on the classpath are the unenhanced ones. Apply the plugin where the entity classes
are compiled.

**★ The runtime `hibernate.enhancer.*` settings default to `false` while the build plugins
default to `true`.** Reading one table and configuring from the other is a common way to end
up believing enhancement is on when it is not.

**★ IDE incremental compilation can hand you unenhanced classes.** The plugin rewrites
`target/classes` (or the Gradle equivalent) as a build step; a run launched from an IDE that
compiled the classes itself and skipped the plugin has un-rewritten bytecode. If lazy
attributes behave differently under `mvn test` and under a green Run button, this is why.

**★ It changes what your entity classes are, which affects anything else reading them.**
The enhancer adds fields and rewrites accessors; the introduction notes it will even add a
default constructor to a class that has none. Tools that reflect over entities — serialisers,
mappers, equality helpers — see the enhanced shape at runtime, not the shape in your source.

## Interview questions

**★ Why does attribute-level lazy loading need a build step when association lazy loading
does not?**
Because they intercept different things. A lazy association is served by a proxy — an object
that stands in for the whole entity and can be generated at runtime as a subclass, because
every access goes through a method call on a reference you hold. A lazy *attribute* has to
intercept a read of a field on an entity that is already fully materialised, including reads
from inside the entity's own methods. There is no subclass trick that catches
`this.fullText` inside `Book.getSummary()`; the only way is to rewrite `Book`. That is why
§6.2.1 describes enhancement as "very much different from the proxy-based idea of lazy
loading which is entity-centric".

**★ You mapped a large `text` column `@Basic(fetch = LAZY)` and the page is still slow. What
do you check first?**
Whether enhancement actually ran. Without the enhancer that annotation is documented to be
ignored outright — the column is fetched as part of the initial select every time — and
nothing in the logs, the mapping validation or the statement count reveals it. Check that the
Hibernate build plugin is applied to the module where the entity is compiled, and that a
Gradle build uses `enhancement {}` with braces rather than the bare `enhancement` form that
the documentation warns silently does nothing. Only after confirming the class files were
rewritten is it worth looking anywhere else.

**★ Is enhancement being deprecated?**
No — the opposite. What carries the deprecation notice is the ability to turn lazy
initialization and dirty tracking *off*: "after this removal, lazy loading will always be
enabled." Two neighbouring features are genuinely deprecated for removal — extended
enhancement and bidirectional association management — but the core capability is heading
toward being unconditional once the plugin is applied.

**★ Would you enable enhancement in a project that has no lazy basic attributes?**
Probably not for fetching reasons, and the honest answer is that it is a cost/benefit call
rather than a default. It buys interception-based dirty tracking, which removes the
per-flush state-snapshot comparison the user guide describes as "performance-inhibiting" in
a persistence context with many entities — but that same section is clear the interception
approach is "less accurate", and it introduces a build step that can silently not run. On a
model that needs lazy columns or a lazily-fetched bidirectional `@OneToOne`, it is not
optional; on one that does not, I would leave it off and revisit if flush cost showed up in a
profile.

**★ Where does enhancement sit in the list of N+1 fixes?**
Off to one side. Every other fix in this topic changes *which query runs*; enhancement
changes *what your classes are*, and it is the only entry that addresses the two cases no
query can reach — a lazy basic column, and the parent side of a bidirectional `@OneToOne`.
That makes it a last resort by shape rather than by quality: if a fetch join, a graph, a
batch size or a projection can solve your problem, one of those is the smaller change.

**★ How would you actually verify that enhancement ran?**
By looking at the compiled classes rather than at the build file, since the build file is where
the silent failure lives. Decompile or `javap` an entity from the build output directory and look
for the machinery the enhancer adds — the interceptor field and the Hibernate-generated interfaces
and accessors are not in your source. That check is worth doing once when the plugin is first
applied and once in CI, because the Gradle brace trap and per-module application both produce a
build that succeeds and enhances nothing. A behavioural check works too: assert that reading a
non-lazy field of an entity does not fetch the lazy column, which fails as an over-fetch rather
than an exception and therefore needs to be written deliberately.

**★ Does enhancement change how a lazy `@ManyToOne` works?**
Yes, for the non-polymorphic case. Without enhancement the association is served by a proxy — a
subclass instance holding the identifier, which is why `getClass()` and `instanceof` misbehave on
it. With enhancement, the introduction says interception "lets us implement lazy fetching for
non-polymorphic associations without the need for a separate proxy object", so you get a real
instance in an unloaded state with its identifier set, and typecasts and `instanceof` work
normally. The exception is polymorphic associations: if the target type has subclasses, Hibernate
cannot know the concrete type before fetching, so a proxy is still required and the old caveats
still apply.

---

← Prev: [13b · Enabling a profile](13b-enabling-and-the-default-profile.md) · Index: [08 · The N+1 problem](README.md) · Next → [13d · Lazy groups and the cost](13d-lazy-groups.md)
