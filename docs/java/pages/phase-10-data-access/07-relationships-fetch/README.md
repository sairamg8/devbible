---
title: "07 · Relationships and fetch types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**The owning side, `mappedBy` and the fetch-type defaults — and why `EAGER` on a collection is a time bomb.**

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · Two models, one key](01-two-models-one-foreign-key.md)** | A database has one foreign key where your object model has two references — every confusing thing about JPA relationships comes from that one asymmetry |
| 2 | **[2 · The owning side](02-the-owning-side.md)** | The owning side is the side that maps the foreign-key column — not the side that feels more important, and not the side you happened to write first |
| 3 | **[2b · The silent nothing](02b-mappedby-and-the-silent-nothing.md)** | Adding to the inverse collection persists nothing — no exception, no warning, and the object graph looks correct right up until the next transaction |
| 4 | **[2c · Keeping both sides in step](02c-keeping-both-sides-in-step.md)** | The fix is a helper method on the parent that sets both sides — here it is in full, along with the accessor change that stops anyone bypassing it |
| 5 | **[3 · @ManyToOne](03-many-to-one.md)** | @ManyToOne is the one association that maps cleanly onto the database — reach for it first, and reach for its inverse collection only when you need it |
| 6 | **[4 · Unidirectional @OneToMany](04-one-to-many-unidirectional.md)** | A @OneToMany with no @ManyToOne on the other side does not map the foreign key you were thinking of — by default it invents a third table |
| 7 | **[4b · @JoinColumn on the collection](04b-mapping-it-to-a-real-foreign-key.md)** | @JoinColumn on the collection removes the join table but not the underlying problem — the parent still owns a column on the child's table |
| 8 | **[5 · Bidirectional @OneToMany](05-one-to-many-bidirectional.md)** | The bidirectional pair is the mapping to reach for — one foreign key, the child owns it, the parent gets a collection, and every write is a single-column update |
| 9 | **[6 · @OneToOne](06-one-to-one.md)** | @OneToOne is a @ManyToOne with a unique constraint — the mapping is easy, and the decision about which table holds the key is the part that matters |
| 10 | **[6b · Why lazy @OneToOne fails](06b-why-lazy-one-to-one-fails.md)** | A lazy @OneToOne on the inverse side is ignored, and the reason is precise: Hibernate cannot decide between a proxy and null without going to the database first |
| 11 | **[6c · The three real options](06c-the-three-real-options.md)** | Three ways to get a lazy one-to-one, in order of preference: share the primary key, make it non-optional, or turn on bytecode enhancement |
| 12 | **[7 · @ManyToMany](07-many-to-many.md)** | @ManyToMany maps a join table you never see — which is fine right up until the relationship needs a column of its own |
| 13 | **[7b · Model the join table](07b-model-the-join-table.md)** | Promote the join table to an entity and the many-to-many becomes two ordinary one-to-manys — which is what Hibernate's own best-practice chapter tells you to do |
| 14 | **[8 · Cascade](08-cascade.md)** | Cascade propagates an operation, not a value — six types in the specification, and ALL means all six plus everything Hibernate adds |
| 15 | **[8b · REMOVE, and Hibernate's extras](08b-cascade-remove-and-the-hibernate-extras.md)** | CascadeType.REMOVE on a @ManyToOne says 'deleting this line deletes the order' — which nobody means, and which the annotation lets you write anyway |
| 16 | **[9 · Orphan removal](09-orphan-removal.md)** | orphanRemoval fires when a child leaves the collection; CascadeType.REMOVE fires when the parent is deleted — they are different triggers and you often want both |
| 17 | **[10 · Collection types](10-collection-types.md)** | Set, List or Map is not a style choice — Hibernate classifies the declared type and each classification gets different SQL |
| 18 | **[10b · What a List costs](10b-what-a-list-costs.md)** | A List without @OrderColumn is a bag, and a bag Hibernate cannot identify row by row gets deleted and reinserted wholesale |
| 19 | **[10c · @OrderBy vs @OrderColumn](10c-orderby-versus-ordercolumn.md)** | @OrderBy adds an ORDER BY to the query; @OrderColumn stores a position in a column — one reads an ordering, the other maintains one |
| 20 | **[11 · @ElementCollection](11-element-collection.md)** | @ElementCollection is for values with no identity — the right answer when the child is a fact about the parent, and the wrong one the moment it needs a column of its own |
| 21 | **[12 · The fetch defaults](12-fetch-type-defaults.md)** | The four fetch defaults, exactly: singular associations are EAGER and collections are LAZY — and the two singular defaults are wrong for almost every application |
| 22 | **[13 · EAGER on a collection](13-eager-on-a-collection.md)** | EAGER on a collection is a time bomb because it is a decision made once, in one file, that every present and future call site is forced to obey |
| 23 | **[13b · How it multiplies](13b-how-it-multiplies.md)** | One eager collection is a cost; two is a product, and a nested chain turns findById into a join across half the schema |
| 24 | **[14 · What a lazy association is](14-what-a-lazy-association-is.md)** | A lazy association is not your class — it is a generated subclass or a collection wrapper, and that changes what getClass, instanceof and equals mean |
| 25 | **[14b · Inspecting initialization](14b-inspecting-initialization.md)** | Ask whether something is loaded without loading it — Hibernate's static helpers and JPA's PersistenceUnitUtil, and the operations that answer questions about a collection without fetching it |
| 26 | **[15 · equals, hashCode, toString](15-equals-hashcode-tostring.md)** | toString on a bidirectional pair recurses until the stack ends, and a hashCode built on a generated id loses the object inside its own Set |
| 27 | **[15b · No natural key, and Lombok](15b-no-natural-key-and-lombok.md)** | Four honest answers when an entity has no natural key — and why @Data on an entity generates every mistake in the previous chunk at once |
| 28 | **[16 · Serialising an entity graph](16-serialising-an-entity-graph.md)** | Serialising an entity graph to JSON hits the same recursion as toString, and every annotation that patches it is a worse answer than a DTO |
