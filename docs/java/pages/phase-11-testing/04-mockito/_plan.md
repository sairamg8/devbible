# Topic 04 · Mockito — chunk plan

Tier: 🔴 **Master**. Read `../_PHASE-NOTES.md` first.

## Boundary — 🔴 the one that matters most in this phase
Owns **plain Mockito**: stubbing, verification, captors, strictness, `@Mock`/`@InjectMocks`.
🔴 **`@MockitoBean` / `@MockitoSpyBean` / `@TestBean` in a Spring context belong to topic
05**, not here. 04 may name them once and hand off.

## Chunks (a PLAN, not a budget — Master tier, split at 301 lines)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-mock-is-for.md` | You mock a boundary you do not control, to make a test deterministic |
| 1b | `01b-mock-stub-spy-fake.md` | The four words, used precisely |
| 2 | `02-creating-mocks.md` | `mock()`, `@Mock` + `MockitoExtension`, and the `openMocks` legacy |
| 3 | `03-stubbing.md` | `when(...).thenReturn(...)`, multiple returns, `thenAnswer` |
| 3b | `03b-stubbing-voids.md` | `doThrow`/`doAnswer`/`doNothing` and why the order flips |
| 4 | `04-argument-matchers.md` | `any()`, `eq()` — and the rule that mixing them breaks |
| 5 | `05-verification.md` | `verify`, `times`, `never`, `atLeast`, `inOrder` |
| 5b | `05b-verifying-too-much.md` | A test that verifies every call is a test that fails on every refactor |
| 6 | `06-argument-captors.md` | `@Captor`, and asserting on what was passed |
| 7 | `07-strictness.md` | `STRICT_STUBS` — the unnecessary stub as a real signal |
| 8 | `08-spies.md` | Partial mocks, why `when` on a spy calls the real method, and `doReturn` |
| 9 | `09-injectmocks.md` | What it actually does, the three injection strategies, and why constructor injection makes it unnecessary |
| 10 | `10-never-mock-the-class-under-test.md` | The central argument of the topic |
| 10b | `10b-do-not-mock-types-you-do-not-own.md` | Mocking a third-party client encodes your guess about it |
| 11 | `11-static-and-final.md` | `mockStatic`, the inline mock maker, and what needing it tells you about the design |
| 12 | `12-mocks-vs-fakes.md` | An in-memory fake often beats twenty stubbings |
| 13 | `13-the-checklist.md` | Reviewing a test that uses mocks |

## Verify, do not assume
- ⚠️ **Mockito 5 made the inline mock maker the default** — check what the Boot-4.1-managed
  version does, and what that means for final classes and JDK 25.
- ⚠️ `MockitoExtension`'s default strictness, and how it differs from `MockitoSettings`.
- ⚠️ Mockito's own documentation warns against mocking types you do not own — quote it.
- 🔴 **No test-run output, no `UnnecessaryStubbingException` transcript you did not read in
  the docs.**
