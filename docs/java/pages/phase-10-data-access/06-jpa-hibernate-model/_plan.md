# Topic 06 · The JPA/Hibernate model — chunk plan

Tier: **Understand**. Target: Hibernate ORM 7.4.1, Jakarta Persistence 3.2,
Spring Boot 4.1.0, Spring Data JPA 4.1.0, JDK 25, PostgreSQL 18.

## Boundary (fixed, do not cross)
- **06 owns** — what an entity is, single-entity mapping, `@Id` + generation,
  the persistence context, entity states, dirty checking, flush, L1 cache,
  `EntityManager` operations, the lifecycle, `@Version`, `ddl-auto`, logging.
- **07 owns** — relationships, owning side, `mappedBy`, cascade, fetch defaults.
- **08 owns** — N+1 and every fix (fetch join, `@EntityGraph`, `@BatchSize`,
  projections). Never solved here; named and handed off.

## Chunks

| # | File | What it argues | Status |
|---|---|---|---|
| 1 | `01-what-an-entity-is.md` | An entity is a class the runtime agrees to watch | ✅ 265 lines |
| 1b | `01b-the-rules-the-spec-imposes.md` | No-arg ctor, non-final, identifier — and why | ✅ 238 lines |
| 1c | `01c-why-not-a-record.md` | A record cannot be an entity, precisely why | ✅ 223 lines |
| 2 | `02-entity-and-table.md` | `@Entity`, `@Table`, naming strategies | ✅ 271 lines |
| 3 | `03-fields-columns-access.md` | Access type, `@Basic`, `@Column`, `@Transient` | ✅ 294 lines |
| 4 | `04-enums-ordinal-corruption.md` | `@Enumerated(ORDINAL)` is silent corruption | ✅ 296 lines |
| 5 | `05-embeddables-lobs-converters.md` | `@Embeddable`, `AttributeConverter`, why not Serializable | ✅ 246 lines |
| 5b | `05b-lobs-and-large-columns.md` | `@Lob` selects a JDBC API; use a length instead | ✅ 194 lines |
| 6 | `06-the-identifier.md` | What `@Id` means to the runtime, not the DB | ✅ 282 lines |
| 7 | `07-generatedvalue-identity.md` | `IDENTITY` and the immediate INSERT | ✅ 221 lines |
| 7b | `07b-identity-kills-batching.md` | The most consequential default in the topic | ✅ 241 lines |
| 8 | `08-sequence-and-allocationsize.md` | `SEQUENCE`, pooled optimizers, the real meaning | ✅ 296 lines |
| 8b | `08b-sequence-on-postgres.md` | What PostgreSQL 18 actually does | ✅ 244 lines |
| 9 | `09-table-auto-uuid.md` | `TABLE`, `AUTO`, `UUID`, Hibernate 6/7 changes | ✅ 248 lines |
| 10 | `10-equals-and-hashcode.md` | Generated id + `HashSet` = a lost element | ✅ 169 lines |
| 10b | `10b-fixing-entity-equality.md` | The three fixes; natural key wins | ✅ 199 lines |
| 11 | `11-the-persistence-context.md` | The identity map, made concrete first | ✅ 273 lines |
| 11b | `11b-find-that-issues-no-sql.md` | The L1 cache is not a performance cache | ✅ 231 lines |
| 12 | `12-the-four-states.md` | New, managed, detached, removed + transitions | ✅ 271 lines |
| 13 | `13-persist-find-getreference.md` | What each call does to state | ✅ 274 lines |
| 13b | `13b-merge-returns-a-copy.md` | The most misunderstood method in JPA | ✅ 282 lines |
| 13c | `13c-remove-refresh-detach-clear.md` | The rest of the API | ✅ 279 lines |
| 14 | `14-dirty-checking.md` | The UPDATE you never wrote | ✅ 277 lines |
| 14b | `14b-when-the-snapshot-is-taken.md` | Which operation snapshots what | ✅ 240 lines |
| 14c | `14c-what-counts-as-a-change.md` | Mapped + not equal to the snapshot | ✅ 288 lines |
| 14d | `14d-the-shape-of-the-update.md` | All columns by default; `@DynamicUpdate` | ✅ 222 lines |
| 14e | `14e-what-dirty-checking-costs.md` | Snapshot comparison at scale | ✅ 262 lines |
| 14f | `14f-turning-dirty-checking-off.md` | Read-only, `@Immutable`, `StatelessSession` | ✅ 283 lines |
| 15 | `15-flush.md` | Flush is not commit | ✅ 246 lines |
| 15b | `15b-what-triggers-a-flush.md` | The three AUTO triggers; native queries | ✅ 233 lines |
| 15c | `15c-flush-operation-order.md` | The ActionQueue; delete-then-insert | ✅ 231 lines |
| 15d | `15d-reading-your-own-writes.md` | Bulk statements and a stale context | ✅ 250 lines |
| 16 | `16-version-and-optimistic-locking.md` | Why `@Version` is a mapping concern | ✅ 283 lines |
| 16b | `16b-when-the-version-check-fails.md` | Four exception types; retry placement | ✅ 281 lines |
| 16c | `16c-beyond-version.md` | Versionless, forced increments, pessimistic | ✅ 268 lines |
| 17 | `17-ddl-auto.md` | Every value; the `create` ambiguity | ✅ 225 lines |
| 17b | `17b-why-update-is-never-production.md` | `update` only adds; what `validate` catches | ✅ 236 lines |
| 18 | `18-seeing-what-hibernate-does.md` | Loggers, statistics, JFR, slow-query | ✅ 248 lines |
| 18b | `18b-the-statistics-you-actually-read.md` | Six counters and their ratios | ✅ 199 lines |
| 18c | `18c-open-in-view.md` | Persistence-context lifetime | ✅ 223 lines |
| 19 | `19-the-checklist.md` | Reviewing an entity | ✅ 216 lines |
| 19b | `19b-reviewing-the-unit-of-work.md` | Reviewing the calling code | ✅ 217 lines |

Eight planned chunks 14–19 became **twenty**. That is rule 1 and rule 13 working.



## ✅ TOPIC COMPLETE (2026-08-26)

**42 chunks written, ~10,550 lines, 0 files over 296, 0 broken links.**
Chunks 01–13c (22 files) written 2026-08-25; chunks 14–19b (20 files, 4,928 lines)
written 2026-08-26.

⚠️ **17 forward references in chunks 01–13c are still bold plain text** *(not written
yet)* pointing at files that now exist. The session that wrote 14–19b was scoped to
chunks 14 onward and did not edit them. **They need repointing** — read each one in its
own sentence first; a bulk replace has produced a wrong target every time it has been
tried in this phase. The targets have also changed shape: the plan's `14b · what dirty
checking costs` is now `14e-what-dirty-checking-costs.md`, and `15b · flush order and
mixed JDBC` split into `15b`, `15c` and `15d`.

Known references to repoint, from `grep -rn "not written yet"`:
`01`, `01b`, `01c`, `02`, `03`, `05`, `05b`, `07`, `07b`, `11`, `11b`, `13`, `13b`, `13c`.

### The repointing map (exact, one target per sentence — do not bulk-replace)

| File · line | Bold text | Repoint to |
|---|---|---|
| `01-what-an-entity-is.md` 115 | 14 · Dirty checking | `14-dirty-checking.md` |
| `01-what-an-entity-is.md` 124 | 15 · Flush | `15-flush.md` |
| `01-what-an-entity-is.md` 162–164 | 14b · What dirty checking costs | `14e-what-dirty-checking-costs.md` |
| `02-entity-and-table.md` 107 | 17 · `ddl-auto` | `17-ddl-auto.md` (leave the Flyway one) |
| `03-fields-columns-access.md` 184 | 17 · `ddl-auto` | `17-ddl-auto.md` |
| `05b-lobs-and-large-columns.md` 138 | 17 · `ddl-auto` | `17-ddl-auto.md` |
| `07-generatedvalue-identity.md` 91 | 15 · Flush | `15-flush.md` |
| `07b-identity-kills-batching.md` 131–133 | 18 · Seeing what Hibernate does | `18-seeing-what-hibernate-does.md` |
| `07b-identity-kills-batching.md` 152 | 14b · What dirty checking costs | `14e-what-dirty-checking-costs.md` |
| `11-the-persistence-context.md` 59 | 14 · Dirty checking | `14-dirty-checking.md` |
| `11-the-persistence-context.md` 143 | 14 · Dirty checking | `14-dirty-checking.md` |
| `11-the-persistence-context.md` 151 | 15 · Flush | `15-flush.md` |
| `11-the-persistence-context.md` 169–171 | 14b · What dirty checking costs | `14e-what-dirty-checking-costs.md` |
| `11b-find-that-issues-no-sql.md` 152 | 15 · Flush | `15-flush.md` |
| `13-persist-find-getreference.md` 61 | 14 · Dirty checking | `14-dirty-checking.md` |
| `13b-merge-returns-a-copy.md` 182 | …optimistic locking | `16-version-and-optimistic-locking.md` |
| `13c-remove-refresh-detach-clear.md` 174 | …optimistic locking | `16-version-and-optimistic-locking.md` |

**Leave alone** — these point outside topic 06: `01:145`, `01b:97`, `01c:131`, `01c:191`,
`03:176`, `03:232`, `05:73`, `05:195`, `05b:121–122`, `11b:82`, `11b:133`, `11b:221`,
`13:159`, and the Flyway half of `02:107`.
⚠️ Several of those say **Topic 07 · Relationships and fetch types** *(not written yet)* —
but `../07-relationships-fetch/` **is now written**. Topic 08 is part-written. Whoever owns
those topics should sweep them.
