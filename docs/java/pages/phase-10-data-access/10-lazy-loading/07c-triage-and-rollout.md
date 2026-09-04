---
title: "Once the failures are visible the migration becomes a sorting exercise — five buckets with five different fixes, an order that pays, and a rollout whose success is measured in payload shapes rather than error rates"
sidebar_label: "07c · Triage and rollout"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 *Common Application Properties* appendix entry
> for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> Jakarta Persistence 3.2 `FetchType` — `EAGER` as a requirement and `LAZY` as a hint
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/fetchtype)),
> and the `3.x` source of `tools.jackson.datatype.hibernate7.Hibernate7ProxySerializer`, which
> writes `null` for an uninitialised proxy when `FORCE_LAZY_LOADING` is off
> ([github.com/FasterXML/jackson-datatype-hibernate](https://github.com/FasterXML/jackson-datatype-hibernate/blob/3.x/hibernate7/src/main/java/tools/jackson/datatype/hibernate7/Hibernate7ProxySerializer.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**A list of forty stack traces is not a plan. The failures fall into five kinds with five
different fixes, and the most common way this migration sprawls is that somebody fixes a
type-boundary problem with a query change because the query change was quicker. This chunk is
the sorting, the conversion order, the rollout, and the four things that will end the migration
by making the remaining work invisible.** Continues
**[07b · Doing the migration](07b-doing-the-migration.md)**.

## Step 3 · Triage, do not fix

Sort every failure into one of five buckets before changing anything. The buckets have
different fixes and mixing them is why migrations sprawl.

| Bucket | What it looks like | Where it goes |
|---|---|---|
| **A · The method returns an entity** | throw in a serialiser, a template, a mapper | a record — **[05](05-the-dto-boundary.md)** |
| **B · The query is missing a fetch** | the DTO exists, the mapper throws or issues N queries | a fetch join or `@EntityGraph` |
| **C · A non-web caller** | a job, a listener, a runner | already broken; fix on its own merits |
| **D · Asynchronous response** | `SseEmitter`, `StreamingResponseBody` | never covered — **[04e](04e-references-that-outlive-the-method.md)** |
| **E · A mapping that cannot be lazy** | a `@OneToOne` parent side, a `@NotFound` association | Topic 07 and Topic 08 |

Bucket C is the one worth calling out to the team early: those failures are **not caused by
this change**. They were latent, and the migration merely gave you a reason to run the code.

## Step 4 · Convert, in an order that pays

Convert bucket A first and in this order:

1. **Endpoints that already return something DTO-shaped** but happen to hold an entity field.
   The smallest change with the largest number of failures resolved.
2. **The highest-traffic read endpoints**, because they also carry the biggest query-count
   savings from projecting rather than loading.
3. **Everything else**, one endpoint per pull request: a record, a query, a controller
   signature. Each is independently shippable and independently revertible.

The fetch-plan work in bucket B belongs to
**[Topic 08 · 14 · Choosing a fix](../08-the-n-plus-1-problem/14-choosing-a-fix.md)**, which
works through three real services and picks a different answer for each.

## Step 5 · Flip it per environment

```yaml
# application-staging.yaml
spring:
  jpa:
    open-in-view: false
```

Then watch. What you are looking for is not only 500s — it is also `null` fields, missing keys
in a response, and any endpoint whose payload got smaller. If Jackson's Hibernate module is
registered, an unfetched association writes `null` instead of throwing, so a migration can
"succeed" while quietly removing data. That behaviour, and why it hides exactly the signal you
need here, is **[06c · Jackson and the Hibernate module](06c-jackson-and-the-hibernate-module.md)**.

Only then move it to the default in `application.yaml`.

## Step 6 · Stop it coming back

Two mechanisms, both cheap:

- **Keep it off in the test profile permanently**, so a new endpoint that returns an entity
  fails in CI rather than in production.
- **Assert the statement count** on the paths that matter. A DTO conversion closes the
  boundary; only a count assertion stops the mapper quietly acquiring an N+1 six months later.
  The tooling is **[Topic 08 · 06b · Asserting the count](../08-the-n-plus-1-problem/06b-asserting-the-count-in-a-test.md)**.

## What not to do while the migration is running

Every one of these makes the remaining failures invisible and therefore makes the migration
un-finishable:

- registering Jackson's Hibernate module "temporarily";
- adding `EAGER` to whatever the current failure names;
- setting `hibernate.enable_lazy_load_no_trans`;
- catching `LazyInitializationException` in a `@ControllerAdvice`.

Each is argued out in **[06](06-fixes-that-are-not-fixes.md)**,
**[06b](06b-more-fixes-that-are-not-fixes.md)** and
**[06b2](06b2-turning-the-exception-off.md)**. The specific harm during a migration is
narrower: **they delete the list of remaining work.**

## The catalogue of what breaks

Seven concrete breakages with a proper fix for each — serialisation, a repository call outside
any transaction, a controller navigating an entity, a template dotting through an association,
exception handlers and audit logging, `@PostAuthorize`, and async returns — are already written
as **[Topic 08 · 15c · Turning it off](../08-the-n-plus-1-problem/15c-turning-it-off.md)**.
This chunk deliberately does not repeat them.

## Gotchas

**★ Do not fix failures as you find them.** Triage first. Bucket A needs a type change and
bucket B needs a query change, and fixing a bucket-A failure with a bucket-B fix — adding a
fetch join so the entity serialises — leaves the design untouched and the next caller exposed.


**★ Bucket C failures predate the migration and will be blamed on it.** Scheduled jobs and
message listeners never had open-in-view. Say this before the first one appears, not after.


**★ With Jackson's Hibernate module registered, the migration can appear to succeed while
losing data.** No exception, no 500, just `null` where an association was not fetched. Check
payload sizes and field presence, not only error rates.


**★ Flipping the property in production without flipping it in staging first tells you nothing
new.** The endpoints exercised by a smoke test are not the endpoints that fail, because the
ones that fail are the ones with complete data and distinct parents.


**★ A revert is cheap and a partial revert is not.** Keep the property change separate from the
DTO conversions, in its own commit, so backing out the flag does not back out the work.


**★ "We turned it off and only three things broke" is not a completion criterion.** It means
three were reachable with the data and configuration you tested. The rest are waiting for a row
with a populated foreign key — see
**[03b · It was never a proxy](03b-it-was-never-a-proxy.md)**.


**★ Converting an endpoint and leaving its neighbours is fine; converting half an endpoint is
not.** A record with one entity field still leaks. The unit of work is one endpoint, all the
way from query to signature.

## Interview questions

**★ You turn it off in staging and three endpoints break. Are you done?**
No, and this is the most important thing to say about the exercise. Whether an association is a
proxy depends on the data — a null foreign key produces no proxy, an already-loaded target
produces no proxy, an empty collection ends the walk. Staging data is typically a scrubbed
subset, which is the profile that maximally hides this. The three that broke are the ones
reachable with that data; the completion criterion is that the endpoints return values, not
that they stopped throwing.


**★ Why does the Jackson Hibernate module make a migration harder rather than easier?**
Because it converts the signal into silence. With it registered, an unfetched association
serialises as `null` instead of throwing, so the endpoints you were trying to enumerate return
200 with missing fields. You end the migration believing it succeeded and having shipped a
quiet data-loss bug. If it is already registered, the honest move is to remove it for the
duration of the migration.


**★ Somebody proposes adding `EAGER` to unblock the migration and cleaning it up later. What do
you say?**
That it deletes the work queue. The point of the exercise is to enumerate every place a fetch
plan is missing, and each `EAGER` removes one entry from that list without fixing anything —
while adding a permanent per-call-site cost that no query can undo, since the specification
makes `EAGER` a requirement and `LAZY` only a hint. The same applies to
`enable_lazy_load_no_trans` and to catching the exception globally: they all end the migration
by making it undetectable.


**★ How do you keep it from coming back?**
Keep open-in-view off in the test profile permanently, so any new method that returns an entity
fails in CI. And add statement-count assertions on the paths that matter, because a DTO closes
the boundary but does not stop a mapper acquiring an N+1 later — the boundary and the query
count are separate properties and each needs its own test.


**★ Why sort the failures into buckets before fixing any of them?**
Because the buckets have incompatible fixes and the quick one is usually wrong. A method that
returns an entity needs a type change; adding a fetch join so the entity serialises makes the
error go away and leaves the next caller exactly as exposed. A missing fetch plan on an
existing DTO genuinely does need a query change. A scheduled job that fails was never covered
and should be fixed on its own merits, not by reasoning about the web layer. Doing them in one
undifferentiated pass produces a branch that touches everything and can be reverted by nobody.

{/* FOOTER */}
