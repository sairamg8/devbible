---
title: "A JPQL string is checked when the repository bean is created, by handing it to a throwaway EntityManager — which is why a broken query fails at startup, why a native query does not, and why the bootstrap mode you choose decides when you find out"
sidebar_label: "03f · What is checked, and when"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Creating
> Repository Instances"
> ([create-instances.html](https://docs.spring.io/spring-data/jpa/reference/repositories/create-instances.html));
> validation mechanics read from the Spring Data JPA source —
> [`SimpleJpaQuery`](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/SimpleJpaQuery.java)
> and
> [`NativeJpaQuery`](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/NativeJpaQuery.java).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**The compiler does not read your query, so the interesting question is what does
and when. The answer is a specific, findable piece of machinery: when the
repository bean is created, Spring Data builds one `RepositoryQuery` object per
method, and for a JPQL `@Query` that construction hands the string to a throwaway
`EntityManager` and asks it to create a query from it. Parse failures therefore
become startup failures. Native queries skip that step entirely, and the
bootstrap mode you configure decides whether "startup" means before the
application accepts traffic or somewhere after it.**

## What actually happens at repository creation

The reference describes the startup interaction in general terms:

> "Repository instances are created as regular Spring beans… singleton scoped and
> eagerly initialized. During startup, they interact with the JPA
> `EntityManager` for verification and metadata analysis purposes."

The specific form of that verification for a declared JPQL query is worth reading
in the source, because it explains every symptom you will ever see from it.
`SimpleJpaQuery`'s constructor calls `validateQuery(…)`, and that method:

1. **skips stored-procedure query methods** entirely;
2. **opens a fresh `EntityManager`** from the factory, used for nothing else and
   closed immediately;
3. calls **`createQuery(queryString)`** on it;
4. wraps any `RuntimeException` in a **`QueryCreationException`** whose message is
   *"Query validation failed for …"* and which names the offending method.

The code even documents why the catch is that broad — *"there's ambiguities in
how an invalid query string shall be expressed by the persistence provider"* —
which is a fair description of the situation: the specification does not pin down
what a provider throws for a malformed query.

🔴 **If the method returns a `Page`, the count query is validated too.** The
constructor validates it separately, with the message *"Count query validation
failed for …"*. A `Slice` return does not issue a count query at all, so nothing
is validated for it — which means a broken `countQuery` in a `Slice`-returning
method is dead weight nobody will ever be told about.

## What the check covers, and what it does not

Because it is a real `createQuery` call, the provider parses the string properly.
That gets you more than syntax:

| Caught at startup | Not caught, ever |
|---|---|
| a syntax error anywhere in the query | the predicate being the wrong predicate |
| an unknown entity name | the method name not matching the query |
| an unknown field on a path expression | a `join` where `join fetch` was meant |
| an unknown function, on providers that resolve them | a return type that does not match the projection |
| a mismatched number of positional parameters | an inner join where you wanted `left join` |
| a named parameter with no matching argument | anything about the data |

⚠️ **"It started, so the query is fine" is the wrong conclusion, and it is the
common one.** Starting proves the string parses against the model. Everything a
reviewer would actually worry about is outside that set, which is why a
repository still needs one test per method that asserts rows rather than absence
of exceptions.

Derived queries get an equivalent check at the same moment, from a different
mechanism: the method name is parsed and each property resolved against the
entity, failing with `PropertyReferenceException` —
[02 · derived queries](02-derived-queries.md). So both styles fail at startup, and
that is the property to protect.

## Native queries are not checked at all

`NativeJpaQuery` — the class used when `nativeQuery = true` or `@NativeQuery` is
present — has no validation call in either constructor. It reads the
`sqlResultSetMapping` attribute, records whether the query targets an entity, and
stops. The SQL first reaches a parser when the method is first invoked, and the
parser is the database's.

🔴 **This is the concrete form of "you lose the earliest failure you had".** The
same defect — a typo, a renamed column, a dropped table — is a startup failure in
JPQL and a production incident in native SQL, and the difference is entirely in
which of these two classes builds your query. It is the strongest argument for
staying in JPQL when JPQL can express the query, and the reason
[03g · native queries](03g-native-queries.md) insists on a test per method.

## Bootstrap mode decides when "startup" is

Repositories are eager by default, and the reference offers three modes on
`@EnableJpaRepositories(bootstrapMode = …)`:

- **`DEFAULT`** — repositories are initialised eagerly, so every query is
  validated before the context finishes refreshing.
- **`LAZY`** — repository beans are created lazily; validation happens on first
  use of each repository.
- **`DEFERRED`** — initialisation is deferred and triggered by the
  `ContextRefreshedEvent`, which is what you want alongside an asynchronous
  `EntityManagerFactory` bootstrap.

The reference's own advice is to leave it alone: *"If you're not using
asynchronous JPA bootstrap stick with the default bootstrap mode."*

⚠️ **`LAZY` is frequently adopted to make application startup or tests faster, and
it silently converts your best defect detector into a runtime one.** A repository
that is only reached by one endpoint is validated when that endpoint is first
called — in production, at whatever hour that endpoint is first called. If you do
choose `LAZY`, a test that touches every repository restores what you gave up.

## Gotchas

**⚠️ Reading a green startup as a correct query.**
The parse says the string is well-formed against the model. It says nothing about
the predicate, the joins, the return type or the data. Most repository defects
live entirely inside the "not caught" column.

**⚠️ Switching to `LAZY` bootstrap for faster startup.**
It moves query validation to first use, one repository at a time. The failures
are the same failures, spread out over time and arriving under load instead of at
deployment.

**⚠️ Putting a broken `countQuery` on a `Slice`-returning method.**
Nothing validates it and nothing runs it, because a `Slice` does not count. The
error surfaces only if the return type is later changed to `Page`, at which point
the query looks like a fresh defect rather than an old one.

**⚠️ Assuming a native query fails the same way.**
`NativeJpaQuery` performs no validation. The string is not looked at until the
first execution, and by then it is the database rejecting it, with a message
about SQL rather than about your repository.

**⚠️ Catching `QueryCreationException` to "make the app start".**
It is thrown while the bean is being created, so the only way to swallow it is to
stop creating the bean. A repository that fails to build has a query that cannot
run; starting anyway just changes where the incident happens.

**⚠️ Expecting the validation to use your transaction or your `EntityManager`.**
It opens its own, uses it for the `createQuery` call, and closes it. Nothing about
your persistence context, flush mode or transaction affects the outcome — which
is also why validation costs a little startup time on a large repository set.

**⚠️ Believing a stored procedure query method is validated.**
The validation explicitly returns early for procedure query methods, so the
procedure's existence and signature are the database's business and are checked
at call time.

**⚠️ Trusting a provider to catch an unknown function.**
Function resolution differs: some names are registered by the dialect and
validate, others are passed through to the database. A query that starts is not a
query whose functions were all recognised.

**⚠️ Assuming the check runs once per query string.**
It runs once per query *method*, per repository. A generic
`@NoRepositoryBean` parent with a templated query is validated separately for
every concrete repository that extends it, which is how one template can be valid
for four entities and broken for the fifth.

**⚠️ Skipping the smoke test because startup validates everything.**
Startup validation covers the repositories that get created. Under `LAZY`, or in
a test slice that only loads part of the context, that set is smaller than you
think — and it is the untested repositories that were never validated either.

**⚠️ Treating the validation failure message as a JPQL tutorial.**
The wrapped exception comes from the provider, so the wording is Hibernate's and
often points at a token rather than at the mistake. The Spring Data half of the
message — the method name — is the useful part, because it tells you which of
forty methods to read.

## Interview questions

**★ When is a `@Query` JPQL string checked?**
When the repository bean is created. Spring Data builds one query object per
method, and for a declared JPQL query that construction hands the string to a
freshly-created `EntityManager` and calls `createQuery` on it. A failure becomes a
`QueryCreationException` naming the method, and the application does not start.

**★ Why does it open a separate `EntityManager` for that?**
Because it is a validation call, not a query execution: it needs the provider's
parser, not your persistence context or transaction. The manager is created from
the factory, used once and closed, which also means the check is unaffected by
anything happening in your application's sessions.

**★ What exactly does that check catch?**
Syntax, unknown entity names, unknown fields on path expressions, parameter
mismatches, and — depending on the provider's dialect — unknown functions. It
does not catch a wrong predicate, a mismatched return type, a `join` that should
have been a `join fetch`, or an inner join that should have been outer.

**★ Is the count query validated too?**
For a method returning `Page`, yes — separately, with its own message. For a
`Slice` there is no count query, so a declared `countQuery` on such a method is
never validated and never runs.

**★ How is a native query different?**
It is not validated at all. `NativeJpaQuery` has no validation step, so the SQL
first reaches a parser on the first invocation, and that parser belongs to the
database. The same typo is a failed deployment in JPQL and a 500 in production in
native SQL.

**★ What is the bootstrap mode and how does it change this?**
`DEFAULT` initialises repositories eagerly, so every query is validated during
context refresh. `LAZY` creates them on first use, moving validation to runtime.
`DEFERRED` waits for the `ContextRefreshedEvent` and exists for asynchronous JPA
bootstrap. The reference's advice is to stay on the default unless you are using
asynchronous bootstrap.

**★ Why is `LAZY` a bad trade for most applications?**
Because the thing you are trading away is the earliest, cheapest failure you get.
Startup validation turns a broken query into a deployment that does not roll out;
`LAZY` turns the same defect into a first-call failure on whichever endpoint
happens to touch that repository first.

**★ Does a derived query get the same protection?**
Yes, by a different route: the method name is parsed and each property resolved
against the entity metadata at bootstrap, failing with
`PropertyReferenceException`. Both styles fail before the application serves
traffic, which is the property worth preserving when you choose between them.

**★ If everything starts, what still needs a test?**
Everything that matters: that the predicate selects the right rows, that the
joins fetch what the caller will navigate, that the return type matches the
projection, and that pagination and sorting produce a stable order. Startup
validation is a syntax gate, not a correctness one.

**★ You have forty repository methods and startup is slow. What would you do
before reaching for `LAZY`?**
Look at whether the cost is validation or the `EntityManagerFactory` itself —
usually the latter, in which case asynchronous bootstrap with `DEFERRED` keeps
the eager validation and moves the expensive part off the critical path. `LAZY`
should be a last resort, because it is the option that removes a check rather
than reschedules it.

**★ How would you argue for JPQL over native SQL to someone who finds SQL
easier?**
On this exact ground. Both end as SQL; only one is parsed before your users see
it, and only one breaks at deployment when a field is renamed. Native SQL is the
right answer when JPQL cannot express the query — and then it needs a test per
method to buy back the check you lost.

{/* FOOTER */}
