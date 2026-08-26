# Topic 09 · Spring Data JPA — chunk plan

Tier: **Understand**. Target: Spring Data JPA 4.1.0, Spring Boot 4.1.0, Hibernate ORM
7.4.1, Jakarta Persistence 3.2, JDK 25, PostgreSQL 18.

## Boundary (fixed, do not cross)

- **09 owns** — the repository abstraction itself: interfaces, derived queries, `@Query`,
  `Pageable`/`Sort`, `Specification`, modifying queries, projections *as a Spring Data
  feature*, `@Transactional` defaults on repositories, custom implementations, and the
  auditing/lifecycle bits.
- **06 owns** the persistence context and entity states; **07** owns mappings; **08 owns
  N+1 and every fix**, including `@EntityGraph` on a repository method and Spring Data
  projections *as an N+1 fix*. 🔴 **09 links to 08's chunks rather than re-arguing them.**
  Check `ls ../08-the-n-plus-1-problem/` before linking.
- **05 owns** `JdbcTemplate`/`JdbcClient`. 09 contrasts with it, does not re-teach it.

## Chunks (a PLAN, not a budget — split at 301 lines, rule 1)

| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-repository-is.md` | An interface Spring implements at runtime — what is actually generated |
| 1b | `01b-the-repository-hierarchy.md` | `Repository` → `CrudRepository` → `ListCrudRepository` → `JpaRepository`; ⚠️ the reactive/list split changed in 3.x — verify against 4.1 |
| 2 | `02-derived-queries.md` | The method-name parser: subject, predicate, keywords |
| 2b | `02b-where-derived-queries-stop.md` | The name that becomes unreadable before it becomes wrong |
| 3 | `03-at-query-jpql.md` | `@Query`, named parameters, why positional is a trap |
| 3b | `03b-native-queries.md` | `nativeQuery = true`, what you lose, and the count-query problem |
| 4 | `04-modifying-queries.md` | `@Modifying`, `clearAutomatically`, `flushAutomatically` — the stale-context trap |
| 5 | `05-pageable-and-sort.md` | `Pageable`, `Page` vs `Slice` — and the extra COUNT query |
| 5b | `05b-offset-pagination-at-depth.md` | Why `OFFSET 500000` is slow on PostgreSQL; keyset pagination as the fix |
| 5c | `05c-sort-is-not-free.md` | Sorting by an unindexed column; sorting by an aliased expression |
| 6 | `06-projections.md` | Interface, class and dynamic projections — hand the N+1 argument to 08 |
| 7 | `07-specifications-and-criteria.md` | `Specification`, when a composable predicate beats a method name |
| 7b | `07b-query-by-example.md` | What QBE can and cannot express |
| 8 | `08-custom-implementations.md` | The fragment interface + `Impl` naming rule |
| 9 | `09-transactions-on-repositories.md` | The default `@Transactional(readOnly = true)` on reads, and why a service boundary still matters — links to topic 04 |
| 10 | `10-auditing-and-lifecycle.md` | `@CreatedDate`, `@LastModifiedBy`, `@EnableJpaAuditing` |
| 11 | `11-what-spring-data-hides.md` | The closing argument: the SQL is still there |
| 12 | `12-the-checklist.md` | Reviewing a repository interface |

## Traps to verify, not assume

- ⚠️ **`save()` on a detached entity is a `merge`** — extra SELECT, and it returns a
  different instance. Ties directly to `../06-jpa-hibernate-model/13b-merge-returns-a-copy.md`.
- ⚠️ **`getReferenceById` replaced `getOne`/`getById`** — verify the 4.1 state.
- ⚠️ `deleteAll()` loads every entity and deletes one by one; `deleteAllInBatch()` does not.
- ⚠️ A `Page` return type issues a second COUNT query; `Slice` does not. `@Query` with a
  native query needs an explicit `countQuery`.
- ⚠️ Derived-query keyword list and the `Top`/`First` limiting syntax — quote the reference.
