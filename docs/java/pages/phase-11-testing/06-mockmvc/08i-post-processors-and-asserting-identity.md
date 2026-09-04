---
title: "RequestPostProcessors attach the principal to the REQUEST rather than the test thread, so one test can act as two users and httpBasic(...) is the only one of them that actually authenticates — and every annotation on the previous three pages stops working the moment a real server handles the request on another thread"
sidebar_label: "08i · Post-processors and asserting identity"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Security 7.1.1**
> [`SecurityMockMvcRequestPostProcessors`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/web/servlet/request/SecurityMockMvcRequestPostProcessors.java)
> (the full list of public static factories, and `UserRequestPostProcessor`'s defaults and
> `ROLE_PREFIX` assertion),
> [`SecurityMockMvcResultMatchers`](https://github.com/spring-projects/spring-security/blob/7.1.1/test/src/main/java/org/springframework/security/test/web/servlet/response/SecurityMockMvcResultMatchers.java),
> `SecurityMockMvcResultHandlers`; the **Spring Framework 7.0.9**
> [`MvcTestResultAssert`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-test/src/main/java/org/springframework/test/web/servlet/assertj/MvcTestResultAssert.java);
> and the Security reference
> [Running a Test as a User in Spring MVC Test](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/authentication.html),
> [Testing HTTP Basic Authentication](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/http-basic.html),
> [`SecurityMockMvcResultMatchers`](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/result-matchers.html)
> and [Testing Method Security](https://docs.spring.io/spring-security/reference/servlet/test/method.html)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/authentication.html)),
> read as asciidoc at tag `7.1.1`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**The annotations of [08g](08g-authenticating-the-test.md) and
[08h](08h-the-other-three-annotations.md) populate a thread-local before the test method
runs. `RequestPostProcessor`s do something different: they attach the principal to the
individual request, which means they are values you can compose, one test can act as two
different users, and one of them — `httpBasic(...)` — sends real credentials through your
`AuthenticationManager` instead of fabricating a result. This chunk is that family, how to
assert who ended up authenticated, and the thread boundary where all of it stops working.**

## The other family: `RequestPostProcessor`s

`SecurityMockMvcRequestPostProcessors` attaches the principal to the *request* rather than
the thread. The public factories in 7.1.1 are `user(String)`, `user(UserDetails)`,
`authentication(Authentication)`, `securityContext(SecurityContext)`, `anonymous()`,
`httpBasic(String, String)`, `digest()`, `x509(...)`, `csrf()`, `testSecurityContext()`,
`jwt()`, `opaqueToken()`, `oauth2Login()`, `oidcLogin()` and `oauth2Client()`.

```java
mvc.get().uri("/orders").with(user("alice").roles("ADMIN"));
mvc.get().uri("/orders").with(user(customUserDetails));       // your principal type
mvc.get().uri("/orders").with(anonymous());
mvc.get().uri("/orders").with(httpBasic("user", "password")); // sends a real header
```

`user(...)` mirrors `@WithMockUser`'s defaults — password `"password"`, authorities
`ROLE_USER`, and the same `Assert.isTrue(!role.startsWith(ROLE_PREFIX))` guard — but it is a
value, not an annotation, so it composes: a static factory of your own, as the docs
recommend, keeps the house user in one place.

```java
public static RequestPostProcessor rob() {
    return user("rob").roles("ADMIN");
}
```

`httpBasic(...)` is different in kind from all the others: it does not fabricate a principal,
it *"will attempt to use HTTP Basic to authenticate a user"* by setting a real
`Authorization: Basic …` header, which means the credentials go through your
`AuthenticationManager` and must be real. That makes it the only one of these that tests
authentication rather than assuming it.

**Which family to use.** Annotations are declarative and read well; post-processors are
values and compose. The functional difference: a post-processor is per-request, so one test
can make two requests as two different users, which no annotation can do. Use annotations for
the common case, post-processors when the user varies within a test or when you need a
principal object you already have.

## Asserting who ended up authenticated

`SecurityMockMvcResultMatchers` are `ResultMatcher`s, and `MvcTestResultAssert.matches(...)`
takes one:

```java
import static org.springframework.security.test.web.servlet.response
        .SecurityMockMvcResultMatchers.authenticated;

assertThat(mvc.get().uri("/orders").with(user("admin").roles("USER", "ADMIN")))
    .matches(authenticated().withUsername("admin").withRoles("USER", "ADMIN"));
```

with `unauthenticated()` for the negative and `withAuthentication(Consumer)` for anything
else — *"We can also make arbitrary assertions on the authentication"*. There is no
AssertJ-native equivalent in Security 7.1.1; `matches(...)` is the bridge
([08c](08c-asserting-protection-not-the-challenge.md)).

## The boundary this all stops at

Every annotation on this page works by populating a thread-local. Spring Security's
reference states the limit exactly:

> *"`@WithMockUser`, `@WithUserDetails`, and `@WithSecurityContext` populate the
> `SecurityContextHolder` for the test thread. This cannot apply to full HTTP requests a test
> makes to a running server since those requests are handled by a different thread. For
> end-to-end HTTP tests, authenticate the request itself (for example, with HTTP Basic or a
> bearer token)."*

That is the seam between this topic and the next: everything here is `MockMvc`, in-process,
same thread. The moment a test starts a server, the annotations become silently useless and
only `httpBasic(...)`-style real credentials survive —
[09 · What MockMvc cannot test](09-what-mockmvc-cannot-test.md).


## Gotchas

**★ Forgetting `.with(csrf())` once authentication starts working.**
Authenticating fixes the 401 and reveals the 403 underneath it on every write
([08d](08d-csrf-in-the-slice.md)). The two are independent and both are required; the usual
sequence is "I fixed the 401, now everything is 403".

**★ Using `httpBasic(...)` with a fabricated user and wondering why it fails.**
Unlike every other post-processor here, `httpBasic(...)` sets a real
`Authorization: Basic …` header and the credentials are genuinely authenticated. The user
must exist in whatever `AuthenticationManager` the slice has — which by default is Boot's
in-memory `user` with a `UUID.randomUUID()` password ([08](08-security-in-a-slice.md)), so
the credentials you invented are rejected and the test 401s.

**★ Reaching for `httpBasic(...)` when you meant `user(...)`.**
`user("alice")` fabricates an authenticated principal and skips authentication entirely;
`httpBasic("alice", "pw")` exercises it. Use the first when the subject is authorisation and
the second when the subject is authentication. Using the second by accident makes your
authorisation tests depend on password storage, encoders and account flags.

**★ `user("alice").roles("ROLE_ADMIN")`.**
`UserRequestPostProcessor.roles(...)` carries the same guard as the annotation —
`Assert.isTrue(!role.startsWith(ROLE_PREFIX))` — and fails with *"Role should not start with
ROLE_ since this method automatically prefixes with this value."* Use
`.authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))` if you want it raw.

**★ Chaining `.roles(...)` after `.authorities(...)` and expecting both.**
They write the same field: `roles(...)` replaces the authority list, and `authorities(...)`
replaces it back. The last call wins, silently — unlike the annotation, which throws.

**★ Mixing a class-level `@WithMockUser` with a `user(...)` post-processor in one request.**
Both mechanisms are active, and which principal the chain sees depends on how the request
post-processor and `testSecurityContext()` interact. Do not rely on it: pick one mechanism
per test class.

**★ Applying `with(...)` before the property it depends on.**
A `RequestPostProcessor` runs when the request is built, and `csrf()` in particular reads the
chain's token repository off the request as it runs. Establish authentication first, then
`csrf()`, then anything of your own — [04c](04c-multipart-and-request-postprocessors.md) has
the ordering rules for the builder generally.

**★ Using `defaultRequest(get("/").with(user(...)))` and then wondering why one test is
authenticated that should not be.**
`MockMvcBuilders`' `defaultRequest` merges into *every* request, so the anonymous test in
that class is not anonymous. It is a real technique the docs show, and it needs the same care
as a class-level `@WithMockUser`.

**★ Asserting only the status after a successful login.**
`formLogin()` returning 302 to `/` proves a redirect, not a session. `authenticated()` — and
`authenticated().withUsername(...)` / `.withRoles(...)` — is the assertion that says a
principal actually exists, and `unauthenticated()` is the one that catches a login that
"succeeded" with the wrong credentials.

**★ Expecting `authenticated().withRoles("ADMIN")` to pass for `authorities = "ADMIN"`.**
`withRoles` compares against `ROLE_`-prefixed authorities, exactly like `hasRole`. An
authority list built without the prefix fails it, and the failure message names authorities
that look correct.

**★ Trying to read the `SecurityContextHolder` after the request to see who was authenticated.**
The test-scoped context lives in `TestSecurityContextHolder` and the listener clears the
holder after the test.
`SecurityMockMvcResultHandlers.exportTestSecurityContext()` exists to copy it across —
`assertThat(result).apply(exportTestSecurityContext())` via
`MvcTestResultAssert.apply(ResultHandler)`.

**★ Carrying `@WithMockUser` into a `@SpringBootTest(webEnvironment = RANDOM_PORT)` test.**
It populates the *test* thread's `SecurityContextHolder`; the server handles the request on a
container thread with its own thread-local. The annotation has no effect at all, the request
goes out unauthenticated, and the failure looks like a security misconfiguration rather than
a test-mechanism mistake.

**★ Assuming `jwt()` / `opaqueToken()` work in a bare slice.**
They set up a resource-server authentication, which requires the resource-server support to
be configured in the chain — and the chain in a bare slice is Boot's default, which has none
([08e](08e-the-chain-you-are-not-testing.md)). `@Import` the resource-server configuration
first, or the post-processor authenticates against rules that do not consult it.

## Interview questions

**★ Annotation or `RequestPostProcessor` — how do you choose?**
Annotations are per-test and declarative; post-processors are per-request and compose as
values. The functional difference is that a post-processor is scoped to one request, so a
single test can issue two requests as two different users, which no annotation can do. For
house conventions, the docs recommend a static factory returning a `RequestPostProcessor` —
`public static RequestPostProcessor rob() { return user("rob").roles("ADMIN"); }` — and a
static import at the call site.

**★ Which of these actually authenticates, rather than assuming authentication?**
`httpBasic(username, password)`, and the form-login request builder. `httpBasic` sets a real
`Authorization: Basic …` header, so the credentials pass through the
`AuthenticationManager`, the `PasswordEncoder` and the account flags. Every other
post-processor here — `user`, `authentication`, `securityContext`, `anonymous`, `jwt`,
`opaqueToken`, `oauth2Login` — installs a result and skips the authentication step entirely.

**★ How do you assert *who* was authenticated, rather than just that the request succeeded?**
`SecurityMockMvcResultMatchers.authenticated()`, refined with `withUsername(...)`,
`withRoles(...)` or `withAuthentication(Consumer)`, and `unauthenticated()` for the negative.
They are `ResultMatcher`s, and with `MockMvcTester` you reach them through
`MvcTestResultAssert.matches(ResultMatcher)` — there is no AssertJ-native equivalent in
Security 7.1.1.

**★ How would you test that an invalid login does not authenticate?**
`mvc.perform(formLogin().password("invalid")).andExpect(unauthenticated())`, or the
`MockMvcTester` equivalent through `.matches(unauthenticated())`. Asserting the status alone
is not enough, because a failed form login also produces a redirect — to the failure URL
rather than the success URL, but still a 302.

**★ Why does none of this work against a running server?**
Because every annotation populates the `SecurityContextHolder` for the *test* thread, and a
real HTTP request is handled on a container thread with its own thread-local. Spring Security
says it outright: *"This cannot apply to full HTTP requests a test makes to a running server
since those requests are handled by a different thread. For end-to-end HTTP tests,
authenticate the request itself (for example, with HTTP Basic or a bearer token)."* The
request-level post-processors are equally `MockMvc`-only — `MockHttpServletRequest` does not
exist in an end-to-end test. What survives the boundary is a real credential in a real
header, which is the subject of [09 · What MockMvc cannot test](09-what-mockmvc-cannot-test.md).

{/* FOOTER */}
