# Topic 05 · The test pyramid in Spring — chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns **slice choice and the Spring test context**: what to test at which level, every
slice annotation, the context cache, and bean overriding. 🔴 **Owns `@MockitoBean`,
`@MockitoSpyBean` and `@TestBean`** — 04 owns plain Mockito. **06 owns `MockMvc` detail**;
05 names the web slice and hands off. **07 owns Testcontainers.**

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-pyramid-and-the-honest-version.md` | The shape, and why the shape is really about feedback time |
| 2 | `02-a-unit-test-needs-no-spring.md` | The fastest test starts no context — and most domain logic qualifies |
| 3 | `03-the-slices.md` | The full list: `@WebMvcTest`, `@DataJpaTest`, `@JdbcTest`, `@JsonTest`, `@RestClientTest` and the rest — what each auto-configures |
| 3b | `03b-what-a-slice-excludes.md` | No full component scan; the bean that is missing and the error it gives |
| 4 | `04-springboottest.md` | The four `webEnvironment` values and what each costs |
| 5 | `05-the-context-cache.md` | 🔴 The single biggest lever on suite runtime — what the cache key is |
| 5b | `05b-what-evicts-it.md` | `@DirtiesContext`, a differing property, a differing mock — each starts a new context |
| 6 | `06-bean-overriding.md` | 🔴 `@MockitoBean`, `@MockitoSpyBean`, `@TestBean` — **and that Boot 4 removed `@MockBean`/`@SpyBean`** |
| 6b | `06b-overriding-changes-the-cache-key.md` | Why a mock in one test can double the suite's runtime |
| 7 | `07-test-properties-and-profiles.md` | `@TestPropertySource`, `properties = …`, `@ActiveProfiles`, and the same cache consequence |
| 8 | `08-transactions-in-tests.md` | `@Transactional` rolls back by default — what that hides, and `@Commit` |
| 9 | `09-the-twenty-minute-suite.md` | Where the time actually goes, and the order to attack it |
| 10 | `10-choosing-a-level.md` | A decision procedure, worked on the Phase 9/10 service |
| 11 | `11-the-checklist.md` | Reviewing a test's *level* before reviewing its content |

## Verify, do not assume
- 🔴 **`@MockitoBean` package and semantics** against the Framework 7.0.x reference. Every
  online sample is stale here.
- ⚠️ The exact `webEnvironment` values and what `MOCK` does and does not start.
- ⚠️ What forms the context cache key — quote the reference, do not paraphrase from memory.
