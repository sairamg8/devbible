---
title: "Modeling relationships"
sidebar_label: "06 · Relationships"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex13-constraints-rel.mjs`.

**There are three shapes and each is enforced by a specific constraint. Getting the
relationship "right" means the database refuses the wrong data — not that the tables
look plausible.**

## One-to-many — the default

A foreign key on the *many* side. This is the shape most relationships take.

```sql
CREATE TABLE r_posts (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES r_users(id) ON DELETE CASCADE,
  title   text NOT NULL
);
CREATE INDEX r_posts_user_id_idx ON r_posts (user_id);   -- always
```

Three decisions in that one table:

- **`NOT NULL` on `user_id`** makes it a mandatory relationship. Leave it nullable
  only if a post genuinely can exist with no author.
- **`ON DELETE CASCADE`** because a post has no meaning without its user. Choose
  `RESTRICT` if deleting a user with posts should be refused
  ([Foreign keys](03-foreign-keys.md)).
- **The index**, because PostgreSQL does not create one for the referencing side and
  parent deletes then scan the child table — measured at 4× slower.

## One-to-one — a unique constraint on the foreign key

The only thing separating one-to-one from one-to-many is uniqueness. Make the
foreign key the primary key:

```sql
CREATE TABLE r_profiles (
  user_id bigint PRIMARY KEY REFERENCES r_users(id) ON DELETE CASCADE,
  bio     text
);
```

```console
$ node ex13-constraints-rel.mjs
=== 5. modelling the three relationships ===
second profile for same user → 23505 ← PRIMARY KEY on the FK enforces 1-1
```

Without that primary key it is a one-to-many wearing a one-to-one's name, and
nothing stops a second profile appearing. Using `user_id` as the primary key also
removes a pointless surrogate `id` and gives the index for free.

**When to split one-to-one at all**, rather than adding columns to the parent:

- The columns are large and rarely read (a `bio`, a document blob) — splitting keeps
  the main table's rows narrow, so more fit per page.
- The columns are optional as a *group* — either you have a full profile or none.
- Different access control: a `user_secrets` table can be granted separately.

Otherwise, put the columns on the parent table. A one-to-one split you did not need
is a join on every read forever.

## Many-to-many — a join table with a composite key

```sql
CREATE TABLE r_post_tags (
  post_id bigint NOT NULL REFERENCES r_posts(id) ON DELETE CASCADE,
  tag_id  bigint NOT NULL REFERENCES r_tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
```

```console
duplicate tag on a post → 23505 ← composite PK enforces it
```

The composite primary key **is** the business rule: a post cannot carry the same tag
twice. A surrogate `id` on this table would add a column and an index while allowing
exactly the duplicate you meant to forbid.

### The index trap: a composite key serves one direction only

20 000 rows in the join table:

```console
rows in join table: 20000
WHERE post_id = $1 → Index Only Scan using r_post_tags_pkey on r_post_tags  (cost=0.29..8.30 rows=1 width=16)
WHERE tag_id  = $1 → Seq Scan on r_post_tags  (cost=0.00..359.00 rows=1 width=16)
after adding (tag_id) index → Index Scan using r_post_tags_tag_idx on r_post_tags  (cost=0.29..8.30 rows=1 width=16)
```

`PRIMARY KEY (post_id, tag_id)` builds one btree ordered by `post_id` first. "Tags
of this post" uses it; **"posts with this tag" sequentially scans**. A join table
almost always gets queried from both ends, so it almost always needs a second index:

```sql
CREATE INDEX r_post_tags_tag_id_idx ON r_post_tags (tag_id);
```

Put the column you filter by most often first in the primary key, and index the
other one.

### When the join table grows attributes

The moment the relationship itself carries data — `added_at`, `added_by`, `role`,
`quantity` — it has become an entity:

```sql
CREATE TABLE memberships (
  user_id bigint NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  role    text NOT NULL CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);
```

Still a composite key, still a join table — but now it has a name from the domain
(`memberships`, not `users_teams`), which is a better name anyway.

Only add a surrogate `id` here if something else must *reference the relationship
itself* — an audit row pointing at a specific membership. That is the one real
argument for it.

## Self-referencing relationships

A tree — categories, org charts, comment threads:

```sql
CREATE TABLE categories (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id bigint REFERENCES categories(id) ON DELETE CASCADE,
  name      text NOT NULL
);
CREATE INDEX categories_parent_id_idx ON categories (parent_id);
```

`parent_id` is nullable — that is what marks a root. `ON DELETE CASCADE` deletes
whole subtrees, which is either exactly right or a disaster; consider `RESTRICT`.

Querying arbitrary depth needs a recursive CTE (Phase 6). If you find yourself
reaching for `ltree` or materialised paths, the read pattern has outgrown the naive
model — which is a Phase 12 conversation, not a schema-design one.

## Trade-off

Normalised relationships give you a schema where invalid states are unrepresentable:
no duplicate tags, no second profile, no orphan post. The cost is joins — every read
that spans the relationship pays for one, and a deeply normalised schema turns a
simple page into a five-table query.

The honest counterweight is that PostgreSQL joins indexed foreign keys very
efficiently, and the alternative — duplicating data to avoid joins — trades a
guaranteed cost (the join) for an unbounded one (keeping copies consistent). Start
normalised, and denormalise against a measurement, not a hunch
([Normalization](12-normalization.md)).

## Gotchas

**Symptom:** A user has two profiles
**Cause:** The "one-to-one" foreign key has no unique constraint.
**Fix:** Make the foreign key the primary key — measured, the second insert then
fails with `23505`.

**Symptom:** "Find posts with this tag" is slow while "find tags of this post" is
fast
**Cause:** The composite primary key indexes the leading column only — measured, a
Seq Scan on the non-leading column.
**Fix:** A second index on the other column.

**Symptom:** Duplicate rows in a join table
**Cause:** A surrogate `id` primary key instead of a composite key on the pair.
**Fix:** `PRIMARY KEY (a_id, b_id)`.

**Symptom:** Deleting a parent is slow
**Cause:** The referencing column is unindexed, so each delete scans the child.
**Fix:** Index every foreign key column.

**Symptom:** Deleting one category removed hundreds of rows
**Cause:** `ON DELETE CASCADE` on a self-reference cascades down the whole subtree.
**Fix:** `RESTRICT`, and delete deliberately.

**Symptom:** A one-to-one split costs a join on every page load
**Cause:** It was split without a reason — the columns are neither large, optional
as a group, nor separately secured.
**Fix:** Merge them back into the parent table.

## Interview questions

**★ How do you enforce one-to-one rather than one-to-many?**
A unique constraint on the foreign key — usually by making it the primary key of the
child table. Measured: with `user_id` as the primary key of `profiles`, a second
profile for the same user fails with `23505`. Without it, nothing prevents a second
row and you have a one-to-many.

**★ How do you model many-to-many, and what is the primary key?**
A join table holding both foreign keys, with `PRIMARY KEY (a_id, b_id)`. The
composite key *is* the uniqueness rule — measured, the duplicate pair raises
`23505`. A surrogate `id` there would permit exactly the duplicate you meant to
forbid.

**★ Why does a join table usually need a second index?**
Because the composite primary key builds one btree ordered by its leading column.
Measured on 20 000 rows: `WHERE post_id = …` used an Index Only Scan while
`WHERE tag_id = …` did a Seq Scan. Join tables are queried from both ends, so index
the trailing column too.

**★ When should a one-to-one be a separate table?**
When the columns are large and rarely read (keeping the main row narrow), optional
as a group, or need separate access control. Otherwise put them on the parent — an
unnecessary split is a join on every read, forever.

**★ When does a join table stop being a join table?**
When the relationship carries its own data — `role`, `joined_at`, `quantity`. It is
then an entity and deserves a domain name (`memberships`, not `users_teams`). Keep
the composite key; add a surrogate id only if something must reference the
relationship itself.

**Why is `parent_id` nullable in a self-referencing tree?**
NULL marks a root node — a row with no parent. Making it `NOT NULL` would require
every row to have a parent, which no tree can satisfy.

---

← [`ALTER TABLE`](05-alter-table.md) · Next → [DDL is transactional](07-transactional-ddl.md)
