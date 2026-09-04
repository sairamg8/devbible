---
title: "By default every lazy column in an entity loads together, which turns one lazy field into a fetch of all of them — @LazyGroup is how you cut that, and enhancement charges for it in dirty-checking accuracy"
sidebar_label: "13d · Lazy groups and the cost"
sidebar_position: 48
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6.2.1 *Lazy attribute
> loading*, §6.2.2 *In-line dirty tracking*, §6.2.3 *Bidirectional association management*
> and §29.6.1 (Maven plugin parameters)
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *Introduction* §9.15 *Using the bytecode enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**Enhancement gives you lazy columns; it does not give you one lazy column. The default
grouping means touching any lazy basic attribute fetches every lazy basic attribute on that
entity — so an entity with a `text` body and a lazily-mapped audit blob loads both the
moment you read either. `@LazyGroup` is the knob, and knowing the default grouping rule is
what stops a "fix" from being a no-op. Enhancement also charges a price on the write side
that the fetching discussion tends to leave out.**

## The default grouping rule

The user guide states it in two sentences, and they are not symmetric:

> *"Lazy attributes can be designated to be loaded together, and this is called a 'lazy
> group'. **By default, all singular attributes are part of a single group**, meaning that
> when one lazy singular attribute is accessed all lazy singular attributes are loaded.
> **Lazy plural attributes, by default, are each a lazy group by themselves.**"*

So:

- **Singular** lazy attributes — basic columns, embeddables, to-one associations under
  enhancement — share **one** group. Read any of them and Hibernate loads all of them, in
  one statement.
- **Plural** lazy attributes — collections — are each their own group. A collection
  initialises alone, which is the behaviour everybody already expects from proxies.

The asymmetry is deliberate and it is also where the surprise lives. Mapping a second
column `@Basic(fetch = LAZY)` does not give you two independent lazy columns; it gives you
a two-column group. Marking the 200 kB `fullText` lazy is undone by a `lastReviewedNote`
that some code reads on every request, because reading the note fetches the full text with
it.

## Cutting the group

```java
@Entity
public class Customer {

    @Id
    private Integer id;

    private String name;

    @Basic(fetch = FetchType.LAZY)
    private UUID accountsPayableXrefId;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @LazyGroup("lobs")
    private Blob image;
}
```

The guide's reading of its own example is the thing to hold onto:

> *"In the above example, we have 2 lazy attributes: `accountsPayableXrefId` and `image`.
> Each is part of a different fetch group (`accountsPayableXrefId` is part of the default
> fetch group), which means that accessing `accountsPayableXrefId` will not force the
> loading of the `image` attribute, and vice-versa."*

Note what is annotated. `image` names a group; `accountsPayableXrefId` names nothing and
therefore lands in the default group. **One `@LazyGroup` was enough to separate two
attributes**, because the annotation does not create a partition so much as pull an
attribute out of the default one.

The practical rule that follows: **annotate the expensive attribute, not the cheap ones.**
If you have one large column and four small lazy ones, put the large one in its own group
and leave the rest in the default. If you have two large columns fetched by different
endpoints, give each its own group name.

`@LazyGroup` is `org.hibernate.annotations.LazyGroup` — a Hibernate annotation, not a
Jakarta Persistence one, and it does nothing at all without enhancement
([13c · Bytecode enhancement](13c-bytecode-enhancement.md)), for the same reason
`@Basic(fetch = LAZY)` does nothing without it.

## What a lazy group costs when it fires

A group is a separate `select` against the same table, keyed by the identifier, issued the
first time anything in the group is touched. That has an N+1 shape of its own: read the
lazy column on each of a hundred `Book` rows and you get a hundred statements, exactly as
if it were an association. **Lazy columns move a cost, they do not remove one.**

Which is why the right test for a lazy column is not "is this column big" but "is this
column read on the page that lists these rows". A column read by the detail view and not by
the list view is a good candidate. A column read by both is not — you have added a second
round trip to the detail view and saved nothing on the list.

There is no `@BatchSize` equivalent for lazy attribute groups that I could find in the 7.4
documentation, so a lazy group touched across a page of rows has no batching escape hatch
comparable to the one [`@BatchSize`](10-batch-size.md) gives associations. Fetch the
column with the query — a [projection](12-projections-and-dtos.md) selecting it
explicitly — when you
know you need it for the whole page.

## Interception-based dirty tracking, and what it gives up

Enhancement's second capability is a write-side one, and this topic reaches it only because
it arrives in the same build step. The guide's description of the default mechanism:

> *"Hibernate would keep track of the last known state of an entity in regards to the
> database… Then, as part of flushing the persistence context, Hibernate would walk every
> entity associated with the persistence context and check its current state against that
> 'last known database state'. This is by far the most thorough approach to dirty checking…
> However, in a persistence context with a large number of associated entities, it can also
> be a performance-inhibiting approach."*

Enhancement replaces the walk with interception: "the entity itself keeps track of which of
its attributes have changed. During the flush time, Hibernate asks your entity what has
changed."

**The accuracy loss is real and the introduction gives the worked case.** For a field
`byte[] image`:

> *"Interception is able to detect writes to the `image` field, that is, replacement of the
> whole array. It's not able to detect modifications made directly to the elements of the
> array, and so such modifications may be lost."*

The generalisation matters more than the example: **interception sees assignments to the
field, snapshots see changes to the value.** Any mutable field mutated in place —
an array, a `java.util.Date`, a mutable object inside an `@Embeddable` — is a change the
snapshot approach catches and interception does not. The guide names `java.util.Date` as
"the prime example" of the data types this affects. A codebase that assigns new values
rather than mutating them is unaffected; one that calls `date.setTime(...)` is not, and the
failure is a silently lost update, which is about the worst failure shape there is.

If you enable enhancement purely to get lazy columns, you get in-line dirty tracking too
unless you switch it off — `enableDirtyTracking = false` in the plugin configuration — and
that switch is itself deprecated for removal ([13c](13c-bytecode-enhancement.md)).

## The two deprecations that are real

**Extended enhancement is deprecated.** The Maven parameter `enableExtendedEnhancement`
(default `false`) enables "enhancement of non-entities to trigger lazy-loading and inline
dirty tracking even when accessing entity fields directly". The 7.4 documentation's reason
for retiring it is worth reading, because it explains why it existed and why it was always
fragile:

> *"Hibernate's extended bytecode enhancement feature has been deprecated, primarily
> because it relies on assumptions and behaviors that often require a broader runtime scope
> than what Hibernate alone can reliably provide, similar to container-based environments
> such as Quarkus or WildFly. Applications which make use of this feature should instead use
> proper object-oriented encapsulation, exposing managed state via getters and setters."*

The advice at the end is the fix: if some other class reads `book.fullText` as a field
rather than through a getter, standard enhancement cannot intercept it, and the answer is to
add the getter, not to rewrite every class in the application.

**Bidirectional association management is deprecated.** `enableAssociationManagement`
(default `false`) automatically set the other side of a bidirectional association when you
set one side. The guide's note: *"Hibernate's bidirectional association management bytecode
enhancement feature has been deprecated. Users should instead manage both sides of such
associations directly."* Keeping both sides in step is the topic-07 problem
([../07-relationships-fetch/02c-keeping-both-sides-in-step.md](../07-relationships-fetch/02c-keeping-both-sides-in-step.md)),
and the resolution is now unambiguously "write the helper method".

## Gotchas

**★ Adding a second lazy basic column silently un-lazies the first.** All singular lazy
attributes share the default group. The column you carefully made lazy is fetched whenever
any other lazy singular attribute is read, and nothing about the mapping hints at the
coupling.

**★ `@LazyGroup` on the cheap attribute is the wrong way round.** Pulling
`lastReviewedNote` into a group of its own leaves `fullText` in the default group — where it
is fetched by every other lazy read. Name the group on the attribute you are protecting.

**★ Lazy plural and lazy singular behave differently by default, and the docs say so in one
sentence you can read past.** Collections are each their own group; basics and to-ones share
one. If you reason about lazy columns using your intuition about lazy collections, you will
get the grouping backwards.

**★ A lazy group fetched across a page of rows is an N+1 with a different name.** One
`select` per row, keyed by id, and no `@BatchSize`-style escape that I could find documented
for attribute groups.

**★ Enhancement quietly changes your dirty-checking semantics.** Turning it on for lazy
columns also turns on interception-based dirty tracking, which cannot see in-place mutation
of a mutable field. `date.setTime(...)` and `array[0] = x` become lost updates. This is a
correctness change bought by a performance annotation.

**★ `@LazyGroup` is a Hibernate annotation and inert without the enhancer.** Same silent-no-op
failure mode as `@Basic(fetch = LAZY)`: the mapping reads as configured and the bytes come
back anyway.

**★ Extended enhancement is not the answer to "another class reads the field directly".**
It is deprecated for removal and the documentation's replacement advice is encapsulation —
expose the state through a getter so ordinary enhancement can intercept it.

## Interview questions

**★ An entity has two lazy basic columns. You profile and find both are always fetched. Why?**
Because the default lazy group holds all singular lazy attributes together — "when one lazy
singular attribute is accessed all lazy singular attributes are loaded". Something on the
path reads one of them, which fetches both. The fix is `@LazyGroup` on whichever attribute
should be independent, and the diagnostic habit is to check the grouping before assuming
enhancement is not working.

**★ Why are lazy collections grouped differently from lazy columns?**
Because they already have their own initialisation mechanism. A lazy collection is backed by
a persistent collection wrapper that knows how to load itself, so making each one its own
group costs nothing and matches what developers already expect. Lazy basic attributes have no
such per-attribute machinery — they are fields on a rewritten class — and fetching them one at
a time would mean a separate round trip per column, which for the common case of several small
lazy fields is worse than one statement for all of them. The default optimises each for its
typical shape.

**★ What does interception-based dirty tracking give up compared with snapshot comparison?**
The ability to see changes made *through* a reference rather than *to* it. Snapshot dirty
checking compares values, so it catches an array whose element was reassigned or a
`java.util.Date` whose time was set in place; interception only sees writes to the field
itself, so those modifications "may be lost". The guide is explicit that snapshotting is "by
far the most thorough approach". You are trading correctness on mutable field values for the
removal of a per-flush walk over the persistence context — a good trade in a codebase that
treats field values as immutable and a silent data-loss bug in one that does not.

**★ You want lazy columns but not the dirty-tracking change. Can you have that?**
Today, yes — set `enableDirtyTracking = false` alongside `enableLazyInitialization = true` in
the plugin configuration. But both parameters are documented as deprecated for removal, with
the stated intent that after removal the behaviours are always enabled. So treat it as a
transitional measure and fix the in-place mutation instead, which is the change you would have
to make eventually anyway.

**★ A colleague suggests turning on `enableExtendedEnhancement` so a mapper class can read
entity fields directly and still trigger lazy loading. What do you say?**
That it is deprecated for removal, and that the documentation's own reason is that it needs a
broader runtime scope than Hibernate can reliably provide outside a container framework. The
replacement is the boring one: give the field a getter and have the mapper call it. Standard
enhancement intercepts the accessor, the behaviour is then the same in every environment, and
nothing depends on a build flag that is on its way out.

**★ How does a lazy attribute interact with the second-level cache?**
Through `@Cache`'s `include` attribute, which the user guide documents as controlling "if lazy
properties should be included in the second level cache", with a default of `all` — so **lazy
properties are cached by default**. Setting `include = "non-lazy"` keeps them out. That default is
worth knowing before you cache an entity with a large lazy column, because the whole reason the
column was made lazy was that you did not want to move it around, and caching it puts a copy of it
in memory on every node.

**★ How do you decide whether a column should be lazy at all?**
By whether there is a query that reads the row and does not read the column. A large `text` or
`bytea` column read by a detail view and skipped by a list view is the clear case. A column read
by everything is not — you have added a round trip to every path and saved nothing. And the size
threshold is lower than people expect to matter, because the cost is per row: a 2 kB column on a
page of 200 rows is 400 kB moved to render a list that shows none of it. The check that settles it
is not "is this column big" but "is this column read on the page that lists these rows".

---

← Prev: [13c · Bytecode enhancement](13c-bytecode-enhancement.md) · Index: [08 · The N+1 problem](README.md) · Next → [14 · Choosing a fix](14-choosing-a-fix.md)
