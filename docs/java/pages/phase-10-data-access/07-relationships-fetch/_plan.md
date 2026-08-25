# Topic 07 · Relationships and fetch types — chunk plan

Tier: **Understand**. Fork-owned. Coordinator generates `README.md` and footers.

Boundary: 06 owns the persistence context (assume it). 08 owns N+1 and every fix
(name the danger, hand off). 10 owns `LazyInitializationException` and OSIV.

| # | File | What it argues | Status |
|---|---|---|---|
| 1 | `01-two-models-one-foreign-key.md` | One FK column, two possible references — the asymmetry that causes everything | ✅ written 249 lines |
| 2 | `02-the-owning-side.md` | The owning side is the side with the FK column | ✅ written 236 lines |
| 2b | `02b-mappedby-and-the-silent-nothing.md` | Adding to the inverse collection persists nothing | ✅ written 248 lines |
| 2c | `02c-keeping-both-sides-in-step.md` | The helper method, shown in full | ✅ written 262 lines |
| 3 | `03-many-to-one.md` | The well-behaved one — reach for it first | ✅ written 256 lines |
| 4 | `04-one-to-many-unidirectional.md` | What Hibernate generates without `@JoinColumn` | ✅ written 209 lines |
| 4b | `04b-mapping-it-to-a-real-foreign-key.md` | `@JoinColumn` on the collection, and the read-only hybrid | ✅ written 201 lines |
| 5 | `05-one-to-many-bidirectional.md` | The pair that actually maps one FK | ✅ written 263 lines |
| 6 | `06-one-to-one.md` | The mapping, `@JoinColumn` and uniqueness | ✅ written 235 lines |
| 6b | `06b-why-lazy-one-to-one-fails.md` | The inverse side cannot be lazy — the precise reason | ✅ written 233 lines |
| 6c | `06c-the-three-real-options.md` | `@MapsId`, owning side, bytecode enhancement | ✅ written 266 lines |
| 7 | `07-many-to-many.md` | `@JoinTable`, and its two owners | ✅ written 255 lines |
| 7b | `07b-model-the-join-table.md` | Promote it to an entity — what you gain and lose | ✅ written 275 lines |
| 8 | `08-cascade.md` | Every `CascadeType`, and what `ALL` includes | ✅ written 230 lines |
| 8b | `08b-cascade-remove-and-the-hibernate-extras.md` | `REMOVE` on `@ManyToOne`; Hibernate's extra cascade types | ✅ written 243 lines |
| 9 | `09-orphan-removal.md` | Not the same as `CascadeType.REMOVE` | ✅ written 214 lines |
| 10 | `10-collection-types.md` | `List` vs `Set` vs `Map` | ✅ written 236 lines |
| 10b | `10b-what-a-list-costs.md` | Bag semantics, `@OrderColumn`, delete-all-and-reinsert | ✅ written 234 lines |
| 10c | `10c-orderby-versus-ordercolumn.md` | Two different jobs | ✅ written 207 lines |
| 11 | `11-element-collection.md` | Value types without an entity | ✅ written 285 lines |
| 12 | `12-fetch-type-defaults.md` | The four defaults, exactly, from the spec | ✅ written 248 lines |
| 13 | `13-eager-on-a-collection.md` | The time bomb — a query you cannot opt out of | ✅ written 229 lines |
| 13b | `13b-how-it-multiplies.md` | Nested eager, cartesian products, bags | ✅ written 218 lines |
| 14 | `14-what-a-lazy-association-is.md` | A proxy is not your class | ✅ written 242 lines |
| 14b | `14b-inspecting-initialization.md` | `Hibernate.isInitialized`, `Persistence.getPersistenceUtil` | ✅ written 210 lines |
| 14b | `14b-inspecting-initialization.md` | `Hibernate.isInitialized`, `PersistenceUnitUtil`, the no-fetch operations | ✅ written 210 lines |
| 15 | `15-equals-hashcode-tostring.md` | The bidirectional recursion and the Lombok trap | ✅ written 252 lines |
| 15b | `15b-no-natural-key-and-lombok.md` | Four answers with no natural key; the Lombok `@Data` trap; why records cannot be entities | ✅ written 295 lines |
| 16 | `16-serialising-an-entity-graph.md` | JSON recursion, and why a DTO is the honest answer | ✅ written 260 lines |

**Final: 28 chunk files, 6,832 body lines, none over 296.** Thirteen planned chunks became
26 planned files when the material was listed out, then 28 once two of them
(`04`, `15`) grew past the cap and were split on concept boundaries.

Splits made while writing (do not merge them back):
- `04` → `04` (join-table default + the `Comment` case) and
  `04b` (`@JoinColumn` FK strategy + the read-only hybrid).
- `15` → `15` (`toString` recursion, `hashCode`/`equals` rules, the natural key) and
  `15b` (no natural key: four options; the Lombok `@Data` trap; why records cannot be
  entities).
- `14b` was added when `14` could not carry the `Hibernate`/`PersistenceUnitUtil` API.

Boundary held: N+1 and every fix for it (fetch joins, `@EntityGraph`, `@BatchSize`,
projections) handed off to **Topic 08** as bold plain text, 5 times.
`LazyInitializationException` and OSIV handed off to **Topic 10**, 4 times. The
persistence context handed off to **Topic 06**, 3 times. No links to unwritten files.
