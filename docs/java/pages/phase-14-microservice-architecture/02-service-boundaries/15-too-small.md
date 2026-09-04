---
title: "Every service carries a fixed cost that is independent of how much code is in it, so a boundary drawn too finely pays full price for a service that does almost nothing — and the fixed cost is the item most consistently missing from the decision"
sidebar_label: "15 · Too small"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Service per team*
> ([microservices.io](https://microservices.io/patterns/decomposition/service-per-team.html)),
> which names *"Finer-grained decomposition adds complexity"* as a force and sizes a codebase
> *"so as to not exceed the cognitive capacity of team"*; *Dark matter force: simple
> interactions*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/simple-interactions.html));
> *Dark energy force: simple components*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-energy/simple-components.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Arguments about service size usually run on intuition, and intuition consistently omits the
same thing: a large part of what a service costs does not depend on its size at all. A
service with one endpoint and a service with sixty need the same pipeline, the same deployment
manifests, the same dashboards, the same alert routes, the same dependency upgrades, the same
security patching, the same on-call familiarity and the same contract with every consumer.
Once that fixed cost is on the page, the question "should this be its own service" gets a
much sharper answer than "it feels like a separate concern".**
## The fixed-cost inventory

None of these scale down with the amount of code. Write your own version of this list with
your own organisation's items — the point is the enumeration, not this particular set.

**Build and release**
- A repository, its access control, its branch protection and its CODEOWNERS.
- A pipeline: build, test, static analysis, image build, sign, publish, deploy.
- A release process and a rollback procedure that someone has actually rehearsed.
- A versioning policy for its API and a deprecation policy for old versions.

**Runtime**
- Deployment manifests per environment, plus resource requests and limits somebody has to
  tune.
- Health checks, readiness gating, and a liveness policy that does not restart under load.
- Configuration and secrets, per environment.
- A JVM to size, and — on Spring Boot 4.1 — a startup profile, a memory footprint and a
  baseline of framework overhead that exists regardless of how much of your code runs.

**Operations**
- Dashboards, and someone who knows what normal looks like on them.
- Alert rules, an alert route, and a rotation that includes it.
- A runbook, kept current.
- Log retention, trace sampling and their costs.

**Maintenance**
- Dependency upgrades, forever. Every service is a full copy of the framework's upgrade
  burden.
- Security patching and CVE triage.
- A language and framework version to keep current, or a decision to let it rot.

**Human**
- A place in every engineer's mental model of the system.
- A row in every architecture diagram and every incident review.
- Onboarding time for anyone who has to touch it.

**Per-consumer**
- A contract with every consumer, and a compatibility obligation on every change.
- A client — generated or hand-written — in every consumer's build.
- A failure mode every consumer must handle: timeouts, retries, degraded behaviour.

That last group is the one that grows quadratically. A service with five consumers has five
contracts to maintain and five places where a breaking change must be coordinated. Splitting
one service into three does not divide the work into three; it multiplies the interfaces.

## What "too small" looks like

Recognisable shapes, all real:

**The wrapper service.** A service whose entire job is to call one vendor API and pass the
result on. It has no rules, no state and no decisions. It is an adapter, and adapters belong
inside the service that uses them — see [03b · Core, supporting,
generic](03b-core-supporting-generic.md).

**The single-entity service.** `AddressService`. Every operation on it is part of some other
capability's workflow. [13 · Entity services](13-entity-services.md).

**The utility service.** `IdGeneratorService`, `DateFormatterService`,
`ValidationService`. Functions promoted to deployables. The network call costs more than the
function by orders of magnitude, and now the function can be unavailable.

**The one-endpoint service.** Sometimes correct — a webhook receiver with a genuinely
different scaling and security profile is a real case. Usually it is a handler that was
extracted because the repository was getting big.

**The service that only one other service calls, synchronously, on every request.** If A
cannot serve a request without B, and nothing else calls B, then A and B have one
availability, one latency budget and one release cadence. They are one service with a network
in the middle. This is the single most reliable test for a boundary that should not exist.

## The forces name both sides of this argument

"Too small" is usually argued as a feeling, and the ten forces give it vocabulary — which matters
because the *reason* to split small is also on the list and deserves a fair hearing.

**The force that says split:**

> **Simple components** — *"simple components consisting of few subdomains are easier to understand
> and maintain than complex components"*

That is real. A service you can hold entirely in your head is genuinely easier to work on, and
somebody arguing for the split is not being foolish.

**The three that say do not:**

> **Simple interactions** — *"an operation that's local to a component or consists of a few simple
> interactions between components is easier to understand and troubleshoot than a distributed
> operation"*

> **Efficient interactions** — *"a distributed operation that involves lots of network round trips and
> large data transfers can be too inefficient"*

> **Minimize runtime coupling** — keeping services tightly integrated maximises availability and
> reduces operation latency.

🔴 **The asymmetry is what settles it.** *Simple components* is a benefit to whoever is **reading**
one component. The three opposing forces are costs paid by whoever is **operating the whole system**
— and there are more of the second group, they compound across every operation, and they land on
people who were not in the design discussion. A split that makes one component simpler and three
operations distributed has not simplified anything; it has moved the complexity from a place where a
compiler can see it to a place where only an incident can.

**The honest formulation to take into the argument:** *simple components* is the only dark-energy
force a very small service wins on. It does not deliver team autonomy (a service nobody deploys
independently is not autonomous), it does not need a separate technology stack, and it has no
distinct scaling characteristics to segregate. One force in favour, three against, and the three are
the ones that show up at 3am.

## The test to apply before splitting small

Ask all five. A split needs a convincing answer to at least one, and "no" to all five is a
module, not a service.

1. **Does a different team own it?** If not, you are paying the fixed cost for an ownership
   boundary that does not exist.
2. **Does it need to scale differently?** Not "might one day" — is there a current, measured
   difference in resource profile?
3. **Does it need a different availability or security posture?** A component handling card
   data, or one that must stay up when the rest is down, has a real reason.
4. **Does it change on a different schedule?** Demonstrated from the commit history, not
   asserted.
5. **Does it need a different technology?** A Python model server or a native-image
   low-latency component is a genuine reason; "we wanted to try Kotlin" is not.

Note that none of these is "it is a separate concern". Separate concerns are what packages
are for.

The alternative to a service that is too small is not a bigger service —
[15b · The module is the alternative](15b-the-module-is-the-alternative.md).

## Gotchas

**★ Symptom: a service only one other service calls, on every request, synchronously.**
Cause: an extraction that did not create independence. Fix: merge them. They share an
availability, a latency budget and a release cadence already; the network between them adds
failure modes and buys nothing.

**★ Symptom: a service nobody has deployed in eight months.** Cause: either it is genuinely
finished, or it is unowned. Fix: check whether its dependencies are current. A stable service
is fine; a service whose framework version is three years old is an incident waiting for a
CVE.

**★ Splitting to make a repository smaller.** Repository size is fixed by extracting packages
or modules, which costs nothing. A service boundary costs the whole fixed list and is chosen
for independence, not for tidiness.

**★ Symptom: an engineer who cannot name all the services.** Cause: the count exceeded human
capacity. Fix: this is a real cost and it is invisible in every architecture metric —
incidents take longer because nobody knows where to look, and changes get made in the wrong
place because the right place was not known to exist.

**★ Assuming small services are individually cheap because each is simple.** The cost is per
service and mostly fixed, and the interface count grows with the square of the service count.
The total is not the sum of the code sizes.

## Interview questions

**★ How small is too small for a service?**
Size is the wrong measure; the question is whether the service earns its fixed cost. Every
service, however small, needs a repository, a pipeline, deployment manifests, dashboards,
alerts, an on-call surface, dependency upgrades, security patching and a contract with every
consumer — none of which scale down with the amount of code. So the test is whether at least
one of five things is true: a different team owns it, it scales differently, it needs a
different availability or security posture, it changes on a demonstrably different schedule,
or it needs a different technology. If all five are no, it is a module.

**★ What is the single strongest indicator that two services should be one?**
That A cannot serve a request without calling B, and nothing else calls B. They already share
an availability — A's uptime is bounded by B's — they share a latency budget, and in practice
they share a release cadence because B's changes are driven entirely by A's needs. The network
between them contributes timeouts, retries and partial-failure handling and contributes no
independence at all. Merging removes a failure mode and a pipeline and loses nothing.

**★ Why is "too small" harder to recover from than "too big"?**
Because the fix runs in the expensive direction. Correcting "too big" means extracting a
module and later a service — incremental, reversible, and each step is independently useful.
Correcting "too small" means merging: two datastores to combine, two pipelines to retire, two
API contracts to deprecate with consumers, and two teams whose ownership is being changed.
The technical work is the easy part; the ownership conversation is what stalls it. That
asymmetry is why the default under uncertainty should be to err large and keep the internal
boundaries enforced.

**★ A team wants to extract a small component to its own service because the repository is
getting unwieldy. What do you say?**
That repository size is solved by extracting a package or a module, which costs nothing and
can be done this afternoon, and that a service boundary is chosen for independent deployment
rather than for tidiness. Then offer the concrete alternative: an enforced module with a
declared API, verified by `ApplicationModules.verify()` or an ArchUnit rule, with its own test
slice and its own CODEOWNERS entry. That gives them every property they actually want except
independent deployment — and if they do need independent deployment, they should say so and
we can price it properly.


---

← [One team per service](14b-one-team-per-service.md) · [Topic index](README.md) · Next → [The module is the alternative](15b-the-module-is-the-alternative.md)
