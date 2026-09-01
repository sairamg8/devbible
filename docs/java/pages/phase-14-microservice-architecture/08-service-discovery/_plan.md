# Topic 08 · Service discovery — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **finding an instance to call**: the registry, the client, and the argument that on
Kubernetes the platform already solved it. 🔴 **07 owns the edge**; 08 owns service-to-service
resolution. 🔴 **09 owns configuration**, even though Consul does both — 08 covers Consul's
*discovery* half only. 🔴 **16 owns health checks that don't lie** — 08 covers only how a
registry uses health to decide membership.

## 🔴 The trap this topic exists to defuse — and the trap inside the trap

`_PHASE-NOTES.md` fact 5, **as corrected 2026-09-01**. The Oakwood note *"RestTemplate support
removed from Spring Cloud Netflix"* is **narrower than it sounds**, and the first draft of these
notes got it wrong — which is exactly why the rule is *verify the brief, do not comply with it*.

- ✅ **What was actually removed:** the **Eureka client's own HTTP transport**.
  `RestTemplateTransportClientFactory` is deprecated for removal in favour of a `RestClient`-based
  implementation. The Eureka client now speaks to the Eureka **server** over `RestClient`,
  `WebClient` or Jersey — add `spring-boot-restclient`; if `spring-boot-webclient` is also present
  **and** `eureka.client.webclient.enabled=true`, WebClient is used, otherwise RestClient.
- ❌ **What was NOT removed:** `@LoadBalanced RestTemplate` for calling *another service*.
  Spring Cloud LoadBalancer (**Commons 5.0.x**) still supports `RestTemplate`, `RestClient`,
  `WebClient` and HTTP Service Clients.

🔴 **Write both halves.** A reader who hears "RestTemplate is gone" and rips out working code has
been actively harmed by this page. Recommend `RestClient` for new code on the merits; state
plainly that the existing `@LoadBalanced RestTemplate` still works.

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
| 6b | `06b-calling-a-discovered-service.md` | 🔴 `RestClient`/`WebClient`/`RestTemplate` with load balancing — all four still supported |
| 7 | `07-kubernetes-already-did-this.md` | Services, DNS and `kube-proxy` — the registry you did not have to run |
| 7b | `07b-spring-cloud-kubernetes.md` | **Kubernetes 5.0** — the `DiscoveryClient` over the API server, and when you want it |
| 8 | `08-choosing.md` | The decision table: are you on a platform that already resolves names |
| 9 | `09-the-second-registry-problem.md` | Running Eureka *on* Kubernetes: two sources of truth, one outage |
| 10 | `10-what-breaks-in-practice.md` | Registration races on startup, split brain, and the cold-start thundering herd |
| 11 | `11-the-checklist.md` | Questions to ask before adding a registry to a deployment |

## Verify, do not assume
- ⚠️ 🔴 Confirm the **scope** of the Netflix 5.0 `RestTemplate` removal from the Netflix reference
  and `RestTemplateTransportClientFactory`'s own deprecation note — it is the Eureka *transport*,
  not the load-balanced client. Then confirm against the **Commons 5.0.x LoadBalancer** page which
  clients are still supported. Quote both. **Getting this backwards breaks working reader code.**
- ⚠️ 🔴 Verify Spring Cloud LoadBalancer's current API on the Oakwood train before showing any
  annotation. Ribbon and Hystrix are **dead** — never present them as options.
- ⚠️ Verify Eureka's maintenance status honestly from the project's own pages, not from opinion
  pieces. Say what is true, including if it is healthier than its reputation.
- ⚠️ **No sandbox and no cluster.** No Eureka dashboard, no `kubectl get endpoints` output, no
  registration logs. YAML and Java only.
