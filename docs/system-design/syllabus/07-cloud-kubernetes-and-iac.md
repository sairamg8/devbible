---
title: "Part 7 — Cloud, Kubernetes and infrastructure as code"
sidebar_label: "7 · Cloud, K8s & IaC"
sidebar_position: 7
---

> Phases 12–14 · Where the design runs, how it is scheduled and scaled, and how all of it is built from code rather than clicks

A senior fullstack engineer is expected to own a service end to end, including the bill. This
part is the platform under the design: the cloud primitives and their cost model, Kubernetes
as the scheduler most product companies run, and infrastructure as code with a delivery
pipeline that can rebuild everything from a repository. The container mechanics are in the
[Docker track](../../docker/README.md) — its production and delivery phases
([10](../../docker/pages/phase-10-production/README.md),
[12](../../docker/pages/phase-12-delivery-ci/README.md)) — and Node's
[deployment phase](../../nodejs/pages/phase-11-deployment/README.md); this part is what
sits above the container.

---

## Phase 12 — Cloud on AWS, with the GCP and Azure map

AWS is the reference because it is what most product companies here run; every row names the
equivalent elsewhere. The point is not the service catalogue — it is knowing what "managed"
removes, what it leaves to you, and what each box costs when the traffic doubles.

| Topic | Tier |
|---|---|
| **Regions, availability zones and shared responsibility** — what the provider guarantees and what you still own; designing for the loss of one zone as the default, not the upgrade | <span className="db-tier t-master">Master</span> |
| **The network: VPC, subnets, security groups, NAT** — public vs private subnets, egress through NAT and the bill it produces, private endpoints to managed services | <span className="db-tier t-master">Master</span> |
| **Identity and access** — least privilege, roles over long-lived keys, short-lived credentials, workload identity for instances and pods; the leaked key that ran a crypto miner for a weekend | <span className="db-tier t-master">Master</span> |
| **Compute choices** — virtual machines, containers on a managed scheduler, Kubernetes, functions; choosing by workload shape and team size, not by what is new | <span className="db-tier t-master">Master</span> |
| **Managed data services** — managed PostgreSQL and its scale-out variants, managed Redis, managed Kafka, managed search, a serverless key-value store; what "managed" removes and what it still leaves you (backups you test, parameters, failover time, connection limits) | <span className="db-tier t-master">Master</span> |
| **The cost model** — egress, NAT, cross-zone traffic, storage tiers, on-demand vs reserved vs spot; reading the bill as an architecture review, and the two line items that surprise every first-time owner | <span className="db-tier t-master">Master</span> |
| **Storage classes** — object, block and file storage; when each fits; lifecycle tiers and what moving between them costs | <span className="db-tier t-understand">Understand</span> |
| **Edge and traffic** — the managed load balancers, DNS, CDN and API gateway; [Part 2](02-the-network-path-and-caching.md) mapped onto the provider | <span className="db-tier t-understand">Understand</span> |
| **Messaging services** — queues, topics, an event bus; when the managed queue beats running a broker, and the point where Kafka becomes worth its operators | <span className="db-tier t-understand">Understand</span> |
| **Secrets and configuration** — a secrets manager vs a parameter store, rotation, injection into containers and functions | <span className="db-tier t-understand">Understand</span> |
| **Serverless trade-offs** — cold starts, execution and payload limits, concurrency, the cost curve that is cheap at one request per second and ruinous at a thousand | <span className="db-tier t-understand">Understand</span> |
| **The Well-Architected pillars** — operational excellence, security, reliability, performance efficiency, cost, sustainability — as the review checklist you run over your own design | <span className="db-tier t-understand">Understand</span> |
| **Provider observability and where it stops** — logs, metrics and tracing services, the gaps OpenTelemetry fills; continues in [Part 8](08-reliability-and-observability.md) | <span className="db-tier t-understand">Understand</span> |
| **Multi-region** — active-passive vs active-active, data replication, DNS failover, the cost multiplier; when the availability target actually requires it | <span className="db-tier t-understand">Understand</span> |
| **The storefront on AWS** — the reference deployment: network, containers, managed PostgreSQL, Redis, object storage, CDN, queues; each box with its cost driver named | <span className="db-tier t-understand">Understand</span> |
| **Multi-account and landing zones** — an account per environment or team, organisation-level guardrails, central logging and billing | <span className="db-tier t-know">Know</span> |
| **The GCP and Azure map** — the equivalent of each service, and the differences that actually matter (networking and identity models) | <span className="db-tier t-know">Know</span> |
| **Lock-in, honestly** — what is portable (containers, PostgreSQL, Kafka, OpenTelemetry) and what is not (identity, serverless glue); the price of portability you may not want to pay | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can draw the storefront on a cloud provider with the network
boundaries marked, say which three line items dominate its bill, and explain what happens to
the design and the bill when one availability zone disappears.

---

## Phase 13 — Kubernetes

Kubernetes is a declarative scheduler: you describe the desired state and controllers
reconcile toward it. Most production pain comes from not holding that model — a liveness
probe that restarts healthy pods, limits that throttle a JVM, a rollout that drained
connections it had not finished serving.

| Topic | Tier |
|---|---|
| **What Kubernetes is for** — desired state, controllers and reconciliation; why it exists, and the honest answer to when a simpler scheduler or a managed container service is enough | <span className="db-tier t-master">Master</span> |
| **Pods and Deployments** — the pod as the unit, replica sets, rolling updates, revision history and rollback | <span className="db-tier t-master">Master</span> |
| **Services and cluster networking** — cluster-internal addresses, DNS inside the cluster, the network plugin, network policies as the firewall between services | <span className="db-tier t-master">Master</span> |
| **Ingress and the Gateway API** — routing HTTP into the cluster, TLS termination, the controller you actually run ([Nginx](../../nginx/README.md) among them) | <span className="db-tier t-master">Master</span> |
| **Probes** — startup, readiness, liveness; readiness as the load balancer's source of truth; the liveness probe that restarted a healthy pod under load and made the outage worse | <span className="db-tier t-master">Master</span> |
| **Requests, limits and quality of service** — CPU throttling vs memory kills, `OOMKilled`, JVM and Node memory settings inside a container; ties to [Java's JVM-in-production phase](../../java/pages/phase-12-jvm-production/README.md) | <span className="db-tier t-master">Master</span> |
| **Autoscaling** — horizontal scaling on CPU or custom metrics, vertical recommendations, event-driven scaling on queue depth, node autoscaling; the scale-up that arrived after the spike had passed | <span className="db-tier t-master">Master</span> |
| **Rollout strategies** — rolling, blue-green, canary with progressive analysis, rollbacks; what a plain Deployment cannot do that a rollout controller can | <span className="db-tier t-master">Master</span> |
| **Running Node and Java on Kubernetes** — PID 1 and signals, graceful shutdown hooks, connection draining, container-aware JVM settings; the deploy that dropped in-flight checkouts | <span className="db-tier t-master">Master</span> |
| **Debugging on Kubernetes** — events, describe, logs, exec, port-forward; `CrashLoopBackOff`, `ImagePullBackOff`, pods stuck Pending; the workflow before you reach for a dashboard | <span className="db-tier t-master">Master</span> |
| **Control plane and nodes** — API server, the state store, scheduler, controller manager, the node agent and proxy; what stops working when each one dies | <span className="db-tier t-understand">Understand</span> |
| **StatefulSets, DaemonSets, Jobs and CronJobs** — stable identity and storage, one-per-node agents, run-to-completion work; the storefront's workers and its nightly jobs | <span className="db-tier t-understand">Understand</span> |
| **ConfigMaps and Secrets** — configuration injection, why a Secret is not secret by default, external secret operators | <span className="db-tier t-understand">Understand</span> |
| **Storage** — persistent volumes, claims and storage classes; why a database on Kubernetes wants an operator, and why many teams still choose the managed service | <span className="db-tier t-understand">Understand</span> |
| **RBAC, namespaces and pod security** — least privilege for people and workloads, the namespace as the tenancy unit, admission control | <span className="db-tier t-understand">Understand</span> |
| **Helm and Kustomize** — templating vs overlays, chart hygiene, values per environment, the chart that hides a hundred decisions | <span className="db-tier t-understand">Understand</span> |
| **GitOps** — the cluster pulls desired state from a repository, drift detection, an audit trail for free; the manual `kubectl apply` that GitOps reverted | <span className="db-tier t-understand">Understand</span> |
| **Managed Kubernetes** — hosted control planes, node groups, add-ons, version upgrades; what is still yours after "managed" | <span className="db-tier t-understand">Understand</span> |
| **Cost on Kubernetes** — bin packing, requests as the real cost driver, idle capacity, spot nodes, showback per team | <span className="db-tier t-understand">Understand</span> |
| **Service mesh on Kubernetes** — mutual TLS, retries and timeouts as infrastructure, traffic splitting; the latency and cognitive cost | <span className="db-tier t-know">Know</span> |
| **Local development** — small local clusters, the development loop, and when [Compose](../../docker/pages/phase-8-compose/README.md) is still the right tool | <span className="db-tier t-know">Know</span> |
| **Multi-tenancy and platform teams** — namespaces vs clusters per team, the internal platform, golden paths; what "platform engineering" changes for a product team | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's API and its order worker as Kubernetes manifests
with probes, resources, autoscaling and a canary rollout — and a written answer to "why did
the pod restart at 2 a.m." for three different symptoms.

---

## Phase 14 — Infrastructure as code and delivery

Every box in the earlier phases is created by code, reviewed like code and rebuilt from code
after a disaster. This phase is Terraform's model and its sharp edges, the pipeline that
takes a pull request to production safely, and the metrics that say whether delivery is
healthy.

| Topic | Tier |
|---|---|
| **Why infrastructure as code** — reproducibility, review, drift detection, rebuild from zero; the console change nobody remembered making until the outage | <span className="db-tier t-master">Master</span> |
| **Terraform's model** — providers, resources, the state file, plan and apply, the dependency graph; reading a plan the way you read a diff | <span className="db-tier t-master">Master</span> |
| **State** — remote backends with locking, state per environment, secrets that end up in state, importing what already exists, the corrupted state file and its recovery | <span className="db-tier t-master">Master</span> |
| **Drift and reconciliation** — detecting manual changes, the plan that wants to destroy production, lifecycle rules that prevent it | <span className="db-tier t-master">Master</span> |
| **Secrets in infrastructure code** — never in plain text in state or repositories; the secrets manager as the source and the code as the reference | <span className="db-tier t-master">Master</span> |
| **CI/CD pipelines** — build, test, scan, package, deploy; pipeline as code, caching and parallelism, required checks; continues Docker's [delivery phase](../../docker/pages/phase-12-delivery-ci/README.md) | <span className="db-tier t-master">Master</span> |
| **Deployment strategies** — immutable artifacts, rolling, blue-green, canary; database migrations inside the pipeline using expand-and-contract from [Part 3](03-storage-and-data.md) | <span className="db-tier t-master">Master</span> |
| **Modules and structure** — reusable modules, a root module per environment, versioned modules; the monolithic configuration that takes forty minutes to plan | <span className="db-tier t-understand">Understand</span> |
| **Workspaces and environments** — separating dev, staging and production, promotion between them, variables per environment | <span className="db-tier t-understand">Understand</span> |
| **Testing infrastructure code** — validation, policy checks, plan review, ephemeral test stacks | <span className="db-tier t-understand">Understand</span> |
| **Progressive delivery and feature flags** — flags instead of branches, kill switches, cohort rollouts, flag hygiene and the flag that lived for three years | <span className="db-tier t-understand">Understand</span> |
| **Environments** — how many you need, ephemeral preview environments per pull request, the data problem in non-production | <span className="db-tier t-understand">Understand</span> |
| **DORA metrics** — deployment frequency, lead time, change failure rate, time to restore; what each one diagnoses and how teams game them | <span className="db-tier t-understand">Understand</span> |
| **Disaster recovery through code** — rebuilding a region from the repository plus backups; the drill that proves the claim | <span className="db-tier t-understand">Understand</span> |
| **Supply chain in delivery** — signed images, software bills of materials, pinned dependencies and actions; continues in [Part 9](09-security-and-compliance.md) | <span className="db-tier t-understand">Understand</span> |
| **The storefront's pipeline** — from pull request to production: checks, preview environment, canary, rollback — drawn once and defended | <span className="db-tier t-understand">Understand</span> |
| **Terraform's licensing split and the alternatives** — the open-source fork, and infrastructure written in a programming language (CDK, Pulumi); what each changes for a team | <span className="db-tier t-know">Know</span> |
| **Policy as code** — guardrails such as no public buckets and mandatory tags, enforced in the pipeline before apply | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's infrastructure as a Terraform layout (modules,
environments, remote state) plus a pipeline diagram from pull request to production, with
the rollback path and the migration step marked.

---

{/* NAV */}
