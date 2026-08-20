---
title: "Declare the client as an interface and stop writing call plumbing"
sidebar_label: "4 · HTTP interfaces"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients →
> HTTP Service Clients* — including method parameters, return values, group
> registration with `@ImportHttpServices` and `AbstractHttpServiceRegistrar`
> (docs.spring.io/spring-framework/reference/integration/rest-clients.html) — and
> the Spring Boot reference *Calling REST Services → HTTP Service Clients*
> (docs.spring.io/spring-boot/reference/io/rest-client.html). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**A hand-written client class is 80% plumbing: the same base URL threaded
through five methods, the same `Accept` header, the same URI-template calls, the
same `retrieve().body(...)` ending. An HTTP service interface deletes all of it.
You declare the *contract* as a Java interface — the method, the path, the
parameters, the return type — and Spring generates the proxy. In Framework 7 the
registration side finally caught up too: `@ImportHttpServices` turns a package of
interfaces into beans, `groups` let you configure a whole family of clients as a
unit, and Boot exposes per-group base URLs and timeouts as ordinary properties.
This is the nicest way to write an outbound client in 2026, and the reason
almost nobody uses it is that it arrived quietly.**

## The interface *is* the client

```java
@HttpExchange(url = "/repos/{owner}/{repo}", accept = "application/vnd.github.v3+json")
public interface RepositoryService {

    @GetExchange
    Repository getRepository(@PathVariable String owner, @PathVariable String repo);

    @PatchExchange(contentType = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    void updateRepository(@PathVariable String owner, @PathVariable String repo,
            @RequestParam String name, @RequestParam String description,
            @RequestParam String homepage);
}
```

The annotations are deliberately the *mirror image* of the server-side ones you
already know. `@GetExchange` is to `@GetMapping` what a client is to a server;
`@PathVariable`, `@RequestParam`, `@RequestHeader`, `@RequestBody`,
`@CookieValue`, `@RequestPart` all mean the same thing pointing outward. A
developer who can read a `@RestController` can read this on the first try, which
is most of the argument for it.

The reference lists the supported method parameters:

| Parameter | Effect |
|---|---|
| `URI` | set the URL dynamically, overriding the annotation |
| `UriBuilderFactory` | supply the URI builder |
| `HttpMethod` | set the method dynamically |
| `@RequestHeader` | add request headers |
| `@PathVariable` | supply URI variables |
| `@RequestBody` | the request body |
| `@RequestParam` | query parameters (or form fields, given a form content type) |
| `@RequestPart`, `MultipartFile` | multipart parts |
| `@CookieValue` | cookies |
| `@RequestAttribute` | a request attribute, for interceptors to read |

And the return values, which is where the sync/reactive split shows:

- **Synchronous adapters** (`RestClient`, `RestTemplate`): `void`, `HttpHeaders`,
  `T`, `ResponseEntity<Void>`, `ResponseEntity<T>`.
- **Reactive adapter** (`WebClient`): all of the above plus `Mono<Void>`,
  `Mono<HttpHeaders>`, `Mono<T>`, `Flux<T>`, `Mono<ResponseEntity<Void>>`,
  `Mono<ResponseEntity<T>>`, `Mono<ResponseEntity<Flux<T>>>`.

⚠️ **The return type and the adapter must agree.** Declaring `Mono<Repository>`
on an interface backed by `RestClientAdapter` is a configuration error, not a
clever way to get asynchrony.

## Building the proxy by hand

Underneath the declarative registration there is a two-line factory, and it is
worth seeing once because it makes clear that the interface is not magic:

```java
RestClient restClient = RestClient.create("https://api.github.com/");
RestClientAdapter adapter = RestClientAdapter.create(restClient);

HttpServiceProxyFactory factory = HttpServiceProxyFactory.builderFor(adapter).build();
RepositoryService service = factory.createClient(RepositoryService.class);
```

Swap `RestClientAdapter` for `WebClientAdapter` or `RestTemplateAdapter` and the
same interface runs on a different transport. The interface is a declaration; the
adapter is the choice of client; the client is where every setting that matters
lives. Timeouts and pooling are configured on the `RestClient`, never on the
interface.

## Type-level and method-level annotations combine

`@HttpExchange` on the interface supplies defaults; the method-level annotation
supplies the rest. In the example above, the type-level annotation carries the
path template and the `Accept` header, and `@GetExchange` carries only the
method — the path is inherited. This is exactly how `@RequestMapping` at class
level combines with `@GetMapping` at method level on the server side.

The practical consequence is that a per-method path is a *suffix* decision, and
if two methods on the same interface need genuinely unrelated paths, that is a
signal they belong on two interfaces — which is fine, because interfaces are
free and groups are what tie them together.

## If you already know `@FeignClient`

The shape will look extremely familiar, because it is the same idea. The
differences that matter:

| | `@FeignClient` | `@HttpExchange` |
|---|---|---|
| Lives in | Spring Cloud OpenFeign, an extra dependency | Spring Framework itself |
| Enabled by | `@EnableFeignClients` | `@ImportHttpServices`, or a hand-built proxy |
| Annotations | Feign's own, or a Spring MVC contract adapter | the same `@PathVariable`/`@RequestParam` as your controllers |
| Transport | Feign's client abstraction | `RestClient`, `WebClient` or `RestTemplate` |

`@FeignClient` has been described as being in maintenance mode in favour of
`RestClient`/`WebClient` with `HttpServiceProxyFactory` and `@HttpExchange`.
⚠️ **That status statement comes from project tracking and community
documentation rather than from a version-stamped reference page I could pin to a
specific release**, so treat it as strong direction rather than a dated promise —
check the Spring Cloud OpenFeign reference for the release train you are on
before planning a migration. What is not in doubt is the direction of travel: the
declarative-client capability now lives in the framework, so a new project needs
no extra dependency to get it.

## Gotchas

**⚠️ A reactive return type on a synchronous adapter**
**Symptom:** the proxy fails to be created, or the method's return value is not
what the signature promises.
**Cause:** `Mono`/`Flux` returns are only supported by `WebClientAdapter`.
**Fix:** either back the group with a `WebClient`, or declare `T` /
`ResponseEntity<T>` and let the call block on a virtual thread.

**⚠️ Missing `-parameters`, and the annotations stop resolving names**
**Symptom:** `@PathVariable String owner` cannot be matched to the `{owner}`
template.
**Cause:** parameter names are erased unless the compiler is told to keep them.
Boot's parent POM sets `-parameters`; a hand-rolled build often does not.
**Fix:** either enable the compiler flag or name the variable explicitly —
`@PathVariable("owner") String o`. This is the same trap as on the server side;
see [Topic 07 — REST controllers](../07-rest-controllers/README.md).

**⚠️ A `void` return that hides a failure**
**Symptom:** a call "succeeds" against a service that is returning 500s.
**Cause:** `void` discards the response — but *not* the exception, unless a
status handler was configured to swallow it.
**Fix:** this one usually turns out to be a status handler that logs and returns
rather than throwing. Make the client's default handler throw, and let `void`
mean "no body I care about", not "no outcome I care about".

**⚠️ Putting business logic on a `default` method of the interface**
**Symptom:** the proxy behaves inconsistently, or a method that was meant to
combine two calls silently makes none.
**Cause:** the proxy implements the *abstract* methods; a `default` method runs
as written, which is fine for composing two proxied calls but not for anything
you expected to be intercepted.
**Fix:** keep the interface a pure declaration. Composition, retries and caching
belong on a service class that depends on the interface, not on the interface
itself.

**⚠️ Two `@RequestParam` arguments and a form content type you did not intend**
**Symptom:** parameters arrive as form fields rather than as a query string, or
the other way round.
**Cause:** `@RequestParam` means "query parameter" for methods without a body and
"form field" when the content type is
`application/x-www-form-urlencoded` — as in the `@PatchExchange` example above.
**Fix:** be explicit about `contentType` on the method-level annotation, and
assert the resulting request in a test rather than reasoning about it.

## Interview questions

**★ What is an HTTP service interface, and what does it not do?**
It is a Java interface annotated with `@HttpExchange`/`@GetExchange`/etc. that
Spring turns into a client proxy via `HttpServiceProxyFactory`. It declares the
contract — method, path, parameters, return type — and generates the plumbing.
What it does *not* do is choose or configure a transport: the proxy runs on an
adapter over a real `RestClient`, `WebClient` or `RestTemplate`, and every
setting that determines survivability — connect and read timeouts, the connection
pool, TLS, observation — is configured on that client, not on the interface. The
common misconception is that HTTP interfaces "do not support timeouts"; they
support exactly the timeouts of whatever executes them.

**★ Why would you choose an HTTP interface over writing a `RestClient` call by
hand?**
Because most of a hand-written client class is repetition — the base URL, the
`Accept` header, the URI template call, the `retrieve().body(...)` tail — and
repetition is where drift happens: five methods that were supposed to have the
same headers, four of which do. The interface states the contract once, per
method, in a form that reads like the server's controller. It also makes the
client mockable as an ordinary interface in unit tests, which is materially
simpler than standing up a `MockRestServiceServer`. The cost is that per-call
error nuance gets harder, which is why mixing the styles is normal.

**★ Where do the `@HttpExchange` annotations come from conceptually, and why does
that matter?**
They are the deliberate mirror of the server-side `@RequestMapping` family —
`@GetExchange` to `@GetMapping`, and the same `@PathVariable`, `@RequestParam`,
`@RequestBody`, `@RequestHeader` on the parameters. That matters because it means
the client contract and the server contract are written in the same vocabulary,
so a reviewer can compare them line by line, and in a monorepo the interface can
literally be shared between the provider and its consumers. It also means the
traps transfer: the `-parameters` compiler flag is required for name-based
binding on both sides.

**★ How does an HTTP interface interact with `-parameters` and why is that not
a Spring problem?**
Binding `@PathVariable String owner` to the `{owner}` template requires the
parameter's *name* to survive compilation, and Java erases parameter names unless
the compiler is given `-parameters`. Boot's parent POM sets it, which is why the
problem is invisible in a Boot project and appears immediately in a hand-rolled
Gradle build or a library module. The fix is either the flag or an explicit name
in the annotation, `@PathVariable("owner")`. It is a language and toolchain fact
that Spring merely depends on, and the identical trap exists on the server side
for controller parameters.

**★ You want to share the client contract between the service that provides an
API and the three services that consume it. Does the HTTP interface help?**
It does, and this is one of its better properties: the interface is a plain Java
type with annotations, so the provider can publish it as a small artifact and
each consumer gets a compile-time-checked client for free — a signature change
breaks the consumers' builds instead of their production traffic. The caveats are
organisational rather than technical. The shared artifact becomes a coupling
point that has to be versioned as carefully as the API itself, and it tempts
people to put DTOs with provider-side concerns in it. My rule is that the shared
module contains only the interface and its request/response records, has no
dependencies beyond `spring-web`, and is versioned with the API version rather
than with the provider's build.

**★ Where would you put a retry for a method on an HTTP interface?**
Not on the interface. The interface is a declaration of the wire contract, and
mixing a policy into it makes the contract lie about what one call does. The
retry belongs on the service class that calls the interface — where you can also
decide whether the operation is idempotent, which is the question that actually
decides whether retrying is safe. Framework 7's `@Retryable` on that service
method is the mechanism; the reasoning about safety is in
[chunk 15](15-retrying-safely.md).

---

← Prev: [The fluent API](03-the-fluent-api.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [HTTP service groups](05-http-service-groups.md)
