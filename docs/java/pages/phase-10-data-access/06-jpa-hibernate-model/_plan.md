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
| 14 | `14-dirty-checking.md` | The UPDATE you never wrote | ⏳ planned |
| 14b | `14b-what-dirty-checking-costs.md` | Snapshot comparison at scale | ⏳ planned |
| 15 | `15-flush.md` | Flush is not commit | ⏳ planned |
| 15b | `15b-flush-order-and-mixed-jdbc.md` | Operation order; read-your-own-writes | ⏳ planned |
| 16 | `16-version-and-optimistic-locking.md` | Why `@Version` is a mapping concern | ⏳ planned |
| 17 | `17-ddl-auto.md` | Every value; why `update` is never production | ⏳ planned |
| 18 | `18-seeing-what-hibernate-does.md` | `show-sql` vs logger vs statistics; `open-in-view` | ⏳ planned |
| 19 | `19-the-checklist.md` | Reviewing an entity | ⏳ planned |

Fifteen planned became ~28. That is rule 1 working.


## 🔴 RESUME HERE (session stopped 2026-08-25 by user order)

**22 of 30 chunks written, 5,619 lines, all wired.** Start at
`14-dirty-checking.md` — the syllabus centrepiece, and the fork was about to write
it when it was stopped. Then 14b, 15, 15b, 16, 17, 18, 19 in plan order.

⚠️ **17 forward references to those files were converted from links to bold plain
text** *(not written yet)* so the build stays clean. When each file lands, repoint
its references — and read each one **in its own sentence** first; a bulk replace
has produced a wrong target every time it has been tried in this phase.
