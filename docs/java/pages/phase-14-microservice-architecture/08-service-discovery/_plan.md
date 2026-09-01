# Topic 08 · Service discovery — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **finding an instance to call**: the registry, the client, and the argument that on
Kubernetes the platform already solved it. 🔴 **07 owns the edge**; 08 owns service-to-service
resolution. 🔴 **09 owns configuration**, even though Consul does both — 08 covers Consul's
*discovery* half only. 🔴 **16 owns health checks that don't lie** — 08 covers only how a
registry uses health to decide membership.

## 🔴 The trap this topic exists to defuse
`_PHASE-NOTES.md` fact 5: **Spring Cloud Netflix 5.0 removed `RestTemplate` support.** The
`@LoadBalanced RestTemplate` that opens essentially every discovery tutorial ever written
**does not work on this train.** Show the current client and say explicitly that the old idiom
was removed — do not quietly omit it and leave the reader wondering why their copy-paste fails.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-problem.md` | Instances are ephemeral; a hardcoded host is a deploy-time lie |
| 2 | `02-client-side-versus-server-side-discovery.md` | Who does the lookup, and who therefore owns the failure |
| 3 | `03-the-registry.md` | Register, heartbeat, deregister — and the three ways that goes wrong |
| 3b | `03b-stale-registrations.md` | The instance that died without deregistering; eviction and its lag |
| 4 | `04-eureka.md` | **Spring Cloud Netflix 5.0** — server, client, and its self-preservation mode |
| 4b | `04b-eureka-honestly.md` | What it is still good at, and the maintenance reality of the Netflix stack |
| 5 | `05-consul.md` | **Consul 5.0** discovery: agents, health checks, and its DNS interface |
| 6 | `06-load-balancing.md` | Spring Cloud LoadBalancer — 🔴 Ribbon is long gone, do not mention it as live |
| 6b | `06b-calling-a-discovered-service.md` | 🔴 `RestClient`/`WebClient` with load balancing; **`RestTemplate` support was removed** |
| 7 | `07-kubernetes-already-did-this.md` | Services, DNS and `kube-proxy` — the registry you did not have to run |
| 7b | `07b-spring-cloud-kubernetes.md` | **Kubernetes 5.0** — the `DiscoveryClient` over the API server, and when you want it |
| 8 | `08-choosing.md` | The decision table: are you on a platform that already resolves names |
| 9 | `09-the-second-registry-problem.md` | Running Eureka *on* Kubernetes: two sources of truth, one outage |
| 10 | `10-what-breaks-in-practice.md` | Registration races on startup, split brain, and the cold-start thundering herd |
| 11 | `11-the-checklist.md` | Questions to ask before adding a registry to a deployment |

## Verify, do not assume
- ⚠️ 🔴 Confirm from the **Spring Cloud Netflix 5.0** docs/release notes that `RestTemplate`
  support is removed, and find what the reference actually recommends in its place. Quote it.
- ⚠️ 🔴 Verify Spring Cloud LoadBalancer's current API on the Oakwood train before showing any
  annotation. Ribbon and Hystrix are **dead** — never present them as options.
- ⚠️ Verify Eureka's maintenance status honestly from the project's own pages, not from opinion
  pieces. Say what is true, including if it is healthier than its reputation.
- ⚠️ **No sandbox and no cluster.** No Eureka dashboard, no `kubectl get endpoints` output, no
  registration logs. YAML and Java only.
