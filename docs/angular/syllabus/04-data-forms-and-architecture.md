---
title: "Part 4 — Data, forms and architecture"
sidebar_label: "4 · Data, forms and architecture"
sidebar_position: 4
---

> **Phases 9–11 · 40 topics · 12 Master**
> Talking to a server, the three forms systems Angular now ships, and the
> decision nobody can avoid: where does state live.

> Verified: 2026-08 against Angular **22.1.4**.
> *Explanation pages are not written yet — this is the inventory.*

Phase 10 is the largest phase in the syllabus, and it is large for an honest
reason: Angular ships **three** forms systems, all supported, and picking the
wrong one for a screen is a decision you live with for the life of that screen.

---

## Phase 9 — HTTP and data

*12 topics.* `HttpClient` did not go anywhere, but `httpResource()` changed the
default shape of a read: a request that is a signal, with `value`, `status` and
`error`, re-issued when its inputs change and aborted when they change again.

| Topic | Tier |
|---|---|
| **`provideHttpClient()` and `withFetch()`** — the modern setup, why `fetch` rather than `XMLHttpRequest`, and what changes for progress events when you switch | <span className="db-tier t-master">Master</span> |
| **Typed requests and responses** — generics on `get`/`post`, `observe: 'response'` vs `'body'` vs `'events'`, `responseType`, and why the generic is a claim rather than a check | <span className="db-tier t-understand">Understand</span> |
| **`httpResource()`** — a request expressed as a signal: reactive request functions, `value`/`status`/`error`, automatic cancellation, and when it replaces a service method returning an observable | <span className="db-tier t-master">Master</span> |
| **Functional interceptors** — `withInterceptors([...])`, the `HttpInterceptorFn`/`HttpHandlerFn` signature, `inject()` inside one, and the auth-header, logging and error-mapping interceptors every app writes | <span className="db-tier t-master">Master</span> |
| **Error handling** — `HttpErrorResponse`, distinguishing a network failure from a 4xx, mapping transport errors into domain errors once at the interceptor rather than at every call site | <span className="db-tier t-master">Master</span> |
| **`HttpParams` and `HttpHeaders`** — both immutable, so `.set()` returns a new instance; the silently-dropped-parameter bug that follows from forgetting it, and encoding rules | <span className="db-tier t-understand">Understand</span> |
| **`HttpContext` and `HttpContextToken`** — attaching per-request metadata ("skip the auth header", "do not retry this one") that an interceptor can read without pattern-matching the URL | <span className="db-tier t-understand">Understand</span> |
| **Retries and backoff** — `retry({count, delay})`, which status codes deserve a retry, and why a retried non-idempotent request is a bug | <span className="db-tier t-understand">Understand</span> |
| **XSRF protection** — the built-in cookie/header scheme, `withXsrfConfiguration()`, `withNoXsrfProtection()`, and what the server has to do for any of it to mean anything | <span className="db-tier t-understand">Understand</span> |
| **The transfer cache** — `withHttpTransferCache()`, how a server-rendered response is replayed into the client so hydration does not refetch everything, and the requests you must exclude from it | <span className="db-tier t-understand">Understand</span> |
| Upload and download progress — `reportProgress: true`, `observe: 'events'`, `HttpEventType`, and building a progress bar that is not a lie | <span className="db-tier t-know">Know</span> |
| Class interceptors and the legacy path — `HTTP_INTERCEPTORS`, `withInterceptorsFromDi()`, `HttpClientModule`; what you will meet in an older codebase and how to migrate it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can express a filtered, paginated list as an
`httpResource` whose request re-runs on filter change, cancels the previous
request, and surfaces an error state — with no `subscribe` anywhere.

---

## Phase 10 — Forms, all three systems

*16 topics.* Template-driven, reactive, and **signal forms** — the third, in
`@angular/forms/signals`, is schema-first and is where new work is heading.
All three ship in 22.1.4; none of them is deprecated.

| Topic | Tier |
|---|---|
| **Three systems, and how to choose** — template-driven for a two-field filter, reactive for the large legacy surface, signal forms for new work; the decision written down once so it is not re-argued per screen | <span className="db-tier t-master">Master</span> |
| **Reactive forms** — `FormControl`, `FormGroup`, `FormArray`, `FormRecord`, `FormBuilder`; the model-first mental picture and how the template attaches to it | <span className="db-tier t-master">Master</span> |
| **Typed reactive forms** — what the generics actually promise, why every control is nullable by default, `nonNullable`, `NonNullableFormBuilder`, and the `UntypedForm*` escape hatches you should be deleting | <span className="db-tier t-master">Master</span> |
| **Validators** — the built-in set, writing a `ValidatorFn`, cross-field validation on the group rather than the control, and where the error message actually lives | <span className="db-tier t-master">Master</span> |
| **Signal forms — `form()` and the field tree** — a signal of your model turned into a tree of fields, each with its own value, state and errors; how it differs from constructing controls by hand | <span className="db-tier t-master">Master</span> |
| **Binding fields to controls** — the `Field` directive, the `FormValueControl` and `FormCheckboxControl` contracts a custom control implements, and `submit()` | <span className="db-tier t-master">Master</span> |
| **Template-driven forms** — `ngModel`, `NgForm`, `NgModelGroup`, name-based registration, and the cases where it genuinely is the right amount of machinery | <span className="db-tier t-understand">Understand</span> |
| **Async validators** — the signature, the pending state, debouncing the request, and why an async validator on every keystroke is a denial-of-service on your own API | <span className="db-tier t-understand">Understand</span> |
| **Control state and events** — `touched`/`dirty`/`pristine`/`pending`, `markAsTouched`, the `ControlEvent` stream (`ValueChangeEvent`, `StatusChangeEvent`, `TouchedChangeEvent`, `FormSubmittedEvent`), and showing an error at the right moment | <span className="db-tier t-understand">Understand</span> |
| **`ControlValueAccessor`** — writing a custom control that works with both older systems: the four methods, `NG_VALUE_ACCESSOR`, and the `setDisabledState` contract | <span className="db-tier t-understand">Understand</span> |
| **Signal-form schemas** — `schema()`, `apply()`, `applyEach()`, `applyWhen()`/`applyWhenValue()`; composing validation for a nested model and reusing it across screens | <span className="db-tier t-understand">Understand</span> |
| **Signal-form validation rules** — `required`, `min`/`max`, `minLength`/`maxLength`, `email`, `pattern`, `minDate`/`maxDate`, plus `validate()` for the custom case and `validateTree()` for cross-field rules | <span className="db-tier t-understand">Understand</span> |
| **`validateAsync()` and `validateHttp()`** — server-backed validation as part of the schema instead of bolted onto the component, and the resource semantics underneath | <span className="db-tier t-understand">Understand</span> |
| **Standard Schema integration** — `validateStandardSchema()` against a zod or valibot schema, so the same definition validates the form and parses the API response | <span className="db-tier t-understand">Understand</span> |
| **Field logic and metadata** — `disabled()`, `readonly()`, `hidden()` as declarative rules, `metadata()` and custom metadata keys, and `debounce()` on a field | <span className="db-tier t-understand">Understand</span> |
| Dynamic forms — building a control tree from a configuration object, and the type safety you give up doing it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can build the same non-trivial form twice — once
reactive, once as a signal form with a schema — and state which one you would
put into a new codebase and why.

---

## Phase 11 — Architecture, state and UI

*12 topics.* Angular gives you DI and signals and then declines to tell you
where to put your state. This phase is that decision, plus the first-party UI
layers that a real application ends up leaning on.

| Topic | Tier |
|---|---|
| **Where state lives** — component-local, a service holding signals, or a store; the three-way decision, the cost of each, and the rule for promoting state from one level to the next | <span className="db-tier t-master">Master</span> |
| **The service-with-signals store** — `@Injectable({providedIn: 'root'})` holding `signal`s and exposing `computed` reads with write methods; why this is the default and how far it scales before it stops | <span className="db-tier t-master">Master</span> |
| **Smart and presentational components** — the split, what it buys in testing, and how `input()`/`output()` make the boundary enforceable rather than a convention | <span className="db-tier t-understand">Understand</span> |
| **`@ngrx/signals` and `signalStore`** — what a library adds over a hand-rolled signal service (entities, `rxMethod`, devtools, composable features), and the size of app where it starts paying | <span className="db-tier t-understand">Understand</span> |
| **Angular CDK** — the parts you will reach for: `Overlay`, `Portal`, `a11y` (`FocusTrap`, `LiveAnnouncer`), `drag-drop`, `ScrollingModule` virtual scroll, and `Dialog` | <span className="db-tier t-understand">Understand</span> |
| **Accessibility in an Angular app** — focus management across route changes, announcing async results, `role`/`aria-*` bindings that survive change detection, and testing with the CDK a11y harnesses | <span className="db-tier t-understand">Understand</span> |
| **Project structure** — feature folders, what belongs in `core`/`shared` and what that split gets wrong, route-level providers as the real module boundary, and barrel files as a circular-import generator | <span className="db-tier t-understand">Understand</span> |
| **Immutability with signals** — why `array.push()` on a signal's value updates nothing, the update patterns, and where a structural-sharing helper earns its place | <span className="db-tier t-understand">Understand</span> |
| Angular Material 22 — the component set, theming with design tokens and system variables, and the argument for and against adopting it wholesale | <span className="db-tier t-know">Know</span> |
| NgRx Store and the Redux pattern — actions, reducers, effects, selectors; the applications where it is still the right answer, and the far larger number where it is not | <span className="db-tier t-know">Know</span> |
| Internationalisation — `@angular/localize`, `$localize`, `i18n` attributes, build-time locale bundles, and why Angular's approach produces one build per locale | <span className="db-tier t-when">When Needed</span> |
| Experimental Web MCP tools — `declareExperimentalWebMcpTool()` and `provideExperimentalWebMcpTools()`, exposing application capabilities to an AI agent in the browser; experimental in 22.1.4, so recognise it and label it | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can point at every piece of state in a feature and
say which of the three levels it lives at and what would have to change for it
to move up one.
