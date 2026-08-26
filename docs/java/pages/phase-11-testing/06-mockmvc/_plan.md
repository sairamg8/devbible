# Topic 06 · Web-layer tests with MockMvc — chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns the **web layer in a test**: `@WebMvcTest`, the request builders, response
assertions, JSON, validation errors and security in a slice. **05 owns slice choice and
the context cache**; **07 owns real dependencies**. Phase 9 owns the controllers
themselves — `ls ../../phase-9-spring-boot/` and link rather than re-teaching MVC.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-no-socket-no-server.md` | What `MockMvc` actually runs, and what it therefore cannot catch |
| 2 | `02-webmvctest.md` | The slice: which beans exist, which do not, and mocking the service |
| 3 | `03-mockmvctester.md` | ⚠️ The AssertJ-based API (Framework 6.2+) — verify it is the current idiom in 7.0 |
| 3b | `03b-the-classic-api.md` | `perform`/`andExpect`, kept because every codebase has it |
| 4 | `04-building-a-request.md` | Path variables, params, headers, content type, body |
| 5 | `05-asserting-the-response.md` | Status, headers, and why asserting the whole body is brittle |
| 5b | `05b-json-assertions.md` | JSONPath, `@JsonTest`, and comparing JSON structurally |
| 6 | `06-validation-errors.md` | `@Valid` failures — the status, the body shape, and testing the contract |
| 7 | `07-exception-handlers.md` | Testing `@ControllerAdvice` through the slice |
| 8 | `08-security-in-a-slice.md` | ⚠️ Security filters in `@WebMvcTest`; `@WithMockUser`; the 401 that surprises everyone |
| 9 | `09-what-mockmvc-cannot-test.md` | Content negotiation edges, real serialization of the container, filters outside the chain — and `TestRestTemplate`/`WebTestClient` as the answer |
| 10 | `10-the-checklist.md` | Reviewing a controller test |

## Verify, do not assume
- ⚠️ **`MockMvcTester` vs `MockMvc`** — which the Boot 4.1 / Framework 7.0 reference
  presents as current. Say plainly if you cannot confirm.
- ⚠️ Whether `@WebMvcTest` auto-configures Spring Security in 4.1 and what that implies.
- 🔴 **No test-run output.** JSON *request/response bodies as source* are fine.
