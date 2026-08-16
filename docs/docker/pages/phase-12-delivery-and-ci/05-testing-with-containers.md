---
title: "Testing with containers"
sidebar_label: "05 · Testing with containers"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Testcontainers — getting started](https://testcontainers.com/getting-started/)
> and [podman-system-service(1)](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html).
> **No sandbox** — no console output on this page.

**The mocks you wrote for your database were never testing your database.** They
tested your belief about it — your assumption about how a unique constraint
fails, what a transaction rolls back, how the driver reports a timeout.

Containers make the real thing cheap enough to use in a test run, and that is the
whole argument. What follows is how, and where the sharp edges are.

## Two ways to do it, and they suit different things

| | **Testcontainers** | **CI service containers / Compose** |
|---|---|---|
| Who starts the container | Your test code | The CI system or `compose up` before the tests |
| Lifetime | Per test class or per suite | The whole job |
| Runs identically on a laptop | **Yes** | Only if you replicate the config |
| Isolation between tests | Strong — a fresh instance per suite | Shared, so tests can pollute each other |
| Startup cost | Paid per suite | Paid once |

🔴 **The deciding question is "does this run the same way on a developer's
machine?"** A test that only works in CI is a test people stop running.
Testcontainers wins on that axis because the test code owns the dependency; a
service container wins on total runtime when the suite is large and the
dependency is expensive.

## Testcontainers, in one paragraph

It is "a library that provides easy and lightweight APIs for bootstrapping local
development and test dependencies with real services wrapped in Docker
containers" — databases, message brokers, search engines, anything with an image.
It exists for **Java, Go, .NET, Node.js, Python, Rust, Ruby, PHP, Haskell,
Clojure, Elixir, Scala** and native, so it is rarely the language that rules it
out.

Two of its features are the ones that make it work rather than merely start
things:

**Wait strategies.** "Docker containers need to be started and fully initialized
before using them in your tests", and the library "offers several out-of-the-box
wait strategies implementations". This is the same problem as
[Phase 9 · 04 · Waiting for the database](../phase-9-mern-pern-stack/04-waiting-for-the-database/README.md)
— a container being *up* is not the same as its service being *ready* — solved
inside the test framework instead of in a shell script.

**Automatic cleanup.** The library "takes care of removing any created resources
(containers, volumes, networks etc.) automatically after the test execution is
complete by using the Ryuk sidecar container". That matters more than it sounds:
a test run that crashes halfway still gets cleaned up, so a developer machine
does not accumulate orphaned Postgres containers over a month.

⚠️ **Ryuk is a container that deletes containers, so it needs engine access.** On
a locked-down CI runner it is the first thing to fail, and the failure looks like
a hang rather than a permission error.

## What it needs from the environment

Testcontainers talks to a container engine, so the environment has to give it
one:

- **A reachable engine socket.** On Podman that means enabling the API socket and
  pointing `DOCKER_HOST` at it — the compatibility layer covered in
  [Phase 11 · 13](../phase-11-podman-in-depth/13-docker-cli-compatibility.md).
  Socket activation means nothing runs between test runs.
- **Permission to create containers.** Docker-in-Docker setups, restricted
  runners and rootless configurations each have their own version of this
  problem.
- **Enough pull bandwidth**, and preferably an authenticated pull so a shared CI
  address does not exhaust an anonymous rate limit
  ([topic 04](04-registry-auth-in-ci.md)).

🔴 **This is where "it works locally, hangs in CI" comes from**, and the usual
cause is the socket or the reaper rather than the test.

## The service-container shape

The alternative is starting the dependency alongside the job — a CI system's
service containers, or `docker compose up -d` before the test step. It is simpler
and it has one real advantage: **the dependency starts once for the whole
suite**, so a hundred test files do not each pay a container start.

Its cost is that the setup lives in CI configuration rather than in the test
code, so reproducing a failure locally means reading the pipeline file and
replicating it. Compose narrows that gap, because the same `compose.yaml` runs on
both — and `depends_on` with `condition: service_healthy`
([Phase 8 · 05](../phase-8-compose/05-depends-on.md)) gives you the readiness gate
that a raw service container does not.

⚠️ **A shared instance means tests can see each other's data.** Either give each
test file its own schema or database, or accept that ordering becomes load-bearing
— which is how a suite becomes flaky without anyone changing a test.

## What to test against a real dependency, and what not to

Being able to run a real Postgres does not mean everything should:

- ✅ **Anything about the database's behaviour** — constraints, transactions,
  migrations, the SQL your ORM actually emits, index behaviour, error codes.
- ✅ **Integration boundaries** — a message broker's redelivery, a cache's
  eviction, an object store's semantics.
- ⚠️ **Not pure business logic.** A function that computes a total does not need a
  container, and giving it one converts a millisecond test into a second.
- ⚠️ **Not third-party HTTP APIs you do not control.** A container of *their*
  service is only as accurate as the image, and a contract test or a recorded
  fixture usually says more.

🔴 **The migration test is the one most teams are missing.** Running your
migrations from empty against the real engine, in CI, catches the class of
failure that only appears at deploy time — which is exactly what
[Phase 9 · 10](../phase-9-mern-pern-stack/10-migrations-and-seeds.md) sets up.

## Keeping it fast

- **Reuse the container across a suite**, not per test. Start-up dominates.
- **Pin the image by version**, and prefer the same major version you run in
  production — testing against a different engine version tests the wrong thing.
- **Use a tmpfs or a throwaway volume for the data directory** where the library
  supports it: durability is worthless in a test and `fsync` is not free.
- **Do not run migrations in every test.** Migrate once per suite, then use
  transactions or truncation between tests.

⚠️ **A test suite that takes twenty minutes stops being run before a commit.**
Speed is a correctness property here, not a luxury.

## Gotchas

**Symptom:** Tests hang in CI and pass locally, with no error.
**Cause:** Testcontainers cannot reach an engine socket, or the Ryuk reaper
cannot start. Both present as waiting rather than failing.
**Fix:** Confirm the socket is enabled and `DOCKER_HOST` points at it — on Podman
that means `podman.socket` — and check whether the runner permits the reaper.

**Symptom:** Developer machines accumulate stopped test containers.
**Cause:** The reaper was disabled, or the tests were run in a way that bypassed
it.
**Fix:** Leave automatic cleanup on. It is the feature that makes a crashed test
run harmless.

**Symptom:** The suite is flaky, and reordering the tests changes which ones
fail.
**Cause:** A shared dependency instance. Tests are reading each other's rows.
**Fix:** Isolate — a schema or database per test file, or truncation between
tests. Order-dependence is the symptom of shared state, not of bad tests.

**Symptom:** A test passes against the container and the same query fails in
production.
**Cause:** The image version does not match the production engine version.
**Fix:** Pin the test image to the version you deploy, and change them together.

## Interview questions

**★ What does testing against a real container buy you over a mock?**
The behaviour you did not know to mock: constraint violations, transaction and
isolation semantics, the SQL your ORM actually emits, driver error codes,
migration failures. A mock encodes your assumption about the dependency, so it
passes precisely when your assumption is wrong — which is the case you needed the
test for.

**★ How do you choose between Testcontainers and a CI service container?**
By whether it runs the same way on a developer machine. Testcontainers puts the
dependency in the test code, so the suite is self-contained and each suite gets a
fresh isolated instance; a service container or Compose starts it once for the
job, which is faster overall but lives in CI configuration and shares state
between tests. A test that only runs in CI is one people stop running.

**★ What are wait strategies and why are they not optional?**
A container being started is not the same as its service being ready to accept
connections — the documentation says containers "need to be started and fully
initialized before using them in your tests", and the library ships several wait
strategies for it. Without one you get a race that fails a few percent of the
time, which is the worst kind of test failure.

**What is Ryuk and why should you care?**
The sidecar container Testcontainers uses to remove containers, volumes and
networks after a run. It matters because a crashed test run still gets cleaned
up. It also means the library needs enough engine access to start a container
that deletes containers — often the first thing a restricted CI runner blocks,
and it presents as a hang.

**Does this work with Podman?**
Yes, through the Docker-compatible API socket: enable `podman.socket` and point
`DOCKER_HOST` at it. Because the socket is systemd socket-activated, nothing runs
between test runs — which is arguably a better fit for CI than a persistent
daemon.

**What should not be tested against a container?**
Pure logic, which does not need one and is orders of magnitude faster without it,
and third-party services you do not control, where an image is only as accurate
as whoever published it. Containers are for dependencies whose *behaviour* is
what you are testing.

---

← Prev: [Registry authentication in CI](04-registry-auth-in-ci.md) · Index: [Phase 12](README.md) · Next → [06 · Deploying without an orchestrator](06-deploying-without-an-orchestrator.md)
