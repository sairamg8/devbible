# Topic 12 · Real-world testing scenarios — chunk plan

Tier: **Master**. Read `../_PHASE-NOTES.md` first.

🔴 **Added 2026-08-31 on the user's explicit instruction**, which is the scope statement for
this topic:

> *"since your going to work on testing please keep a section or phase for testing real world
> scenarios concepts like mocking class or api response just like how javascript or react
> testing real world scenarios involved"*

So the topic is **task-shaped, not API-shaped**. Topics 01–07 taught the tools (JUnit, Mockito,
AssertJ, slices, MockMvc, Testcontainers). This topic answers *"I have to test **this** thing
today — what do I actually write?"* for the situations that make up most real work, in the same
register JS/React testing treats as its bread and butter: mock the module, mock the network,
render the component, wait for the async thing, assert what was sent.

## Boundary — this topic REUSES, it does not re-teach

Every chunk links back to the topic that owns the mechanism and spends its own words on the
**scenario**: the seam, the decision, the failure mode, the assertion that is worth making.
- Mockito mechanics → **04**. `@MockitoBean` and slice choice → **05**. `MockMvc` → **06**.
  Containers → **07**. Builders/mothers for the data → **08**.
- ⛔ Do not re-explain `when/thenReturn`, `@WebMvcTest` or `@ServiceConnection` here.

## Chunks (a PLAN, not a budget)

| # | File | The scenario |
|---|---|---|
| 1 | `01-what-to-mock-and-what-to-let-run.md` | The one decision every chunk below depends on: mock at a boundary you own, never the class under test, never a value object |
| 1b | `01b-the-js-to-java-map.md` | 🔴 The mapping table the user asked for: `jest.mock('./x')` → constructor injection + `@Mock`; `msw`/`nock` → `MockRestServiceServer`/WireMock/`MockWebServer`; RTL `render` → `@WebMvcTest` + `MockMvcTester`; `waitFor` → Awaitility; `jest.useFakeTimers` → injected `Clock`; `jest.spyOn` → `@Spy`; snapshot → JSON approval. What transfers, and the three places the analogy breaks |
| 2 | `02-mocking-a-class-you-own.md` | The everyday case: a service with a collaborator. Constructor injection, `@Mock`/`@InjectMocks`, why the seam is the design |
| 2b | `02b-when-the-collaborator-is-hard-to-mock.md` | Static methods, `new` inside the method, a final class, a fat SDK client — each with the refactor that removes the need for a mocking trick |
| 3 | `03-mocking-an-outbound-http-api.md` | The most-asked scenario. `RestClient`/`RestTemplate` + `MockRestServiceServer` for the unit-ish case: stub the response, assert the request |
| 3b | `03b-wiremock-and-mockwebserver.md` | When you need a real socket: which to pick, what each proves that the Spring-side mock cannot, and the cost |
| 3c | `03c-the-error-paths-nobody-writes.md` | 500, 429 + `Retry-After`, a timeout, a connection reset, malformed JSON, an HTML error page with a 200, a redirect loop. The tests that actually catch outages |
| 3d | `03d-asserting-what-you-sent.md` | The half everyone forgets: headers, auth, idempotency key, serialized body, query encoding |
| 4 | `04-a-third-party-sdk.md` | A payment/mail/storage SDK with a fat client: the anti-corruption interface, and why you test your adapter against the SDK's own test double when it has one |
| 5 | `05-testing-a-controller-end-to-end-ish.md` | The React-`render`-equivalent: request in, JSON out, with the service mocked — and where the slice's boundary really is |
| 6 | `06-security-in-a-test.md` | "As an authenticated user with role X": `@WithMockUser`, JWT-bearing requests, and why an unauthenticated 401 test is the one people omit |
| 7 | `07-async-scheduled-and-eventual.md` | `@Async`, `@Scheduled`, an event listener, a retry. Awaitility instead of `Thread.sleep`; how to make a scheduled job testable without waiting for the schedule |
| 8 | `08-a-message-consumer.md` | Testing a listener: the handler as a plain method, the container as an integration test, poison messages and redelivery |
| 9 | `09-caching-and-idempotency.md` | Asserting a cache hit did not call through; asserting a retried request did not double-charge |
| 10 | `10-json-contracts-and-approval-tests.md` | The snapshot-test analogue: pinning a payload, what makes it useful vs a change-detector, and JSON comparison modes |
| 11 | `11-the-legacy-class-with-no-seams.md` | The honest chapter: characterization tests first, then the smallest seam that lets you test the change you were sent to make |
| 12 | `12-the-checklist.md` | Given a ticket, which of the above applies — and the tests that are worth writing before the fix |

## Verify, do not assume
- ⚠️ `MockRestServiceServer` with **`RestClient`** on Boot 4.1 — verify the binding API and
  whether the classic `RestTemplate` route differs. Do not assume the `RestTemplate` snippet.
- ⚠️ Boot 4 removed `@MockBean`/`@SpyBean` → **`@MockitoBean`/`@MockitoSpyBean`**.
- ⚠️ WireMock's JUnit 5 integration and its current artifact coordinates — verify, do not quote
  a blog. Same for `MockWebServer`'s current home after the OkHttp packaging change.
- ⚠️ `@WithMockUser` and the JWT request post-processors live in Spring Security's test module —
  verify the package and the current names against the Security reference for this Boot line.
