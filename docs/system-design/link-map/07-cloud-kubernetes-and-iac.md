---
title: "Link map · System design · Part 7 (phases 12–14)"
sidebar_label: "07 · cloud, K8s, IaC"
sidebar_position: 7
---

# Link map · System design · Part 7 (phases 12–14)

Covers every topic row of phases 12 to 14 in `docs/system-design/syllabus/07-cloud-kubernetes-and-iac.md`: cloud on AWS with the GCP and Azure map (T12-01 to T12-18), Kubernetes (T13-01 to T13-22) and infrastructure as code and delivery (T14-01 to T14-18). That is 58 rows. One has a written page of ours (the service mesh, in phase 2); `docs/system-design/pages` holds phases 0 to 3 only, so the rest are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means vendor and project documentation, standards and specifications; blogs and vendor-adjacent articles count as beyond the docs.

---

## Phase 12 — Cloud on AWS, with the GCP and Azure map

### T12-01 · Regions, availability zones and shared responsibility — Master · 🔲 not written
- **Read this:** [AWS Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/) · AWS · splits security "of" the cloud (hardware, software, networking, facilities, AWS's job) from security "in" the cloud (the customer's job) (*read*) · covers our angle: **partial** — security framing only, not availability or the loss of a zone · fetched 2026-10-14
- **Also good:** [Availability Zones - AWS Fault Isolation Boundaries](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/availability-zones.html) · AWS whitepaper · an AZ is one or more discrete data centers with separate power and networking, far enough apart (up to about 100 km) to avoid correlated failure yet close enough for synchronous replication at single-digit millisecond latency (*read*) · fetched 2026-10-14
- **Our delta:** designing for the loss of one zone as the default, and what the provider guarantees versus what you still own.

### T12-02 · The network: VPC, subnets, security groups, NAT — Master · 🔲 not written
- **Read this:** [NAT gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) · AWS VPC User Guide · a NAT gateway lets instances in a private subnet reach out while external services cannot initiate connections; a public one sits in a public subnet with an Elastic IP routed to the internet gateway (*read*) · covers our angle: **partial** — mechanism, not the bill · fetched 2026-10-14
- **Also good:** [Amazon VPC pricing](https://aws.amazon.com/vpc/pricing/) · AWS · NAT gateway is billed per gateway-hour plus a per-GB data processing charge regardless of source or destination, on top of normal data transfer (*read*) · fetched 2026-10-14
- **Also good:** [AWS PrivateLink concepts](https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html) · AWS · a consumer creates a VPC endpoint to reach an endpoint service from its VPC, in several endpoint types (*read*) · fetched 2026-10-14
- **Beyond the docs:** [AWS NAT Gateway Pricing: Why Your Bill is Spiking and How to Reduce It](https://cloudchipr.com/blog/aws-nat-gateway-pricing) · Cloudchipr, 27 Feb 2026 · NAT spikes come from more bytes quietly crossing the gateway, appearing as an "EC2-Other" increase, with endpoints as the remediation (*read*) · fetched 2026-10-14
- **Our delta:** egress through NAT as a bill line item and private endpoints as the fix.

### T12-03 · Identity and access — Master · 🔲 not written
- **Read this:** [Security best practices in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html) · AWS · require workloads to use temporary credentials via IAM roles, humans to federate, update long-term keys only when unavoidable, and apply least privilege (*read*) · covers our angle: **partial** — AWS identities, not the incident story · fetched 2026-10-14
- **Also good:** [EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html) · AWS · lets applications in a pod's containers sign AWS API requests with IAM permissions without static keys (*read*) · covers our angle: **partial** — the pod half of workload identity · fetched 2026-10-14
- **Beyond the docs:** [Dev put AWS keys on Github. Then BAD THINGS happened](https://www.theregister.com/security/2015/01/06/dev-put-aws-keys-on-github-then-bad-things-happened/597225) · The Register, 6 Jan 2015 · a developer pulled leaked S3 keys within five minutes, yet a bot that searches GitHub for keys had already started EC2 instances for Bitcoin mining, leaving a $2,375 bill (*read*) · fetched 2026-10-14
- **Our delta:** the leaked key that ran a crypto miner for a weekend, tied to roles over long-lived keys.

### T12-04 · Compute choices — Master · 🔲 not written
- **Read this:** [Choosing an AWS container service](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html) · AWS Decision Guides · compares ECS, EKS, App Runner, Lambda, Lightsail, Batch and Fargate, grouping them by how much container and infrastructure experience a team has (*read*) · covers our angle: **partial** — containers only, not plain virtual machines · fetched 2026-10-14
- **Our delta:** choose by workload shape and team size, not novelty, across VMs, managed containers, Kubernetes and functions.

### T12-05 · Managed data services — Master · 🔲 not written
- **Read this:** [Multi-AZ deployments for Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html) · AWS · one-standby deployments provide failover without serving reads; two-standby cluster deployments also serve reads (*read*) · covers our angle: **partial** — Postgres-style RDS only, not Redis, Kafka or key-value stores · fetched 2026-10-14
- **Also good:** [Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) · AWS · pools and shares connections so surges do not oversubscribe the database, and reconnects to a standby on failure (*read*) · fetched 2026-10-14
- **Our delta:** what "managed" removes and still leaves you (tested backups, parameters, failover time, connection limits).

### T12-06 · The cost model — Master · 🔲 not written
- **Read this:** [Overview of data transfer costs for common architectures](https://aws.amazon.com/blogs/architecture/overview-of-data-transfer-costs-for-common-architectures/) · AWS Architecture Blog · inbound transfer is free, internet egress is charged per service, traffic inside one AZ is free, cross-AZ traffic is charged, and a NAT gateway adds a per-GB processing charge (*read*) · covers our angle: **partial** — transfer, not reserved or spot pricing · fetched 2026-10-14
- **Also good:** [Cost Optimization Pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html) · AWS Well-Architected · the pillar paper (June 2024) organises cost work into five practice areas: cloud financial management, expenditure and usage awareness, cost-effective resources, managing demand and supply, and optimising over time (*read*) · fetched 2026-10-14
- **Beyond the docs:** [AWS NAT Gateway Pricing: Why Your Bill is Spiking](https://cloudchipr.com/blog/aws-nat-gateway-pricing) · Cloudchipr, 27 Feb 2026 · traces NAT cost back through Cost Explorer and flow logs to the traffic causing it (*read*) · fetched 2026-10-14
- **Our delta:** reading the bill as an architecture review, and the two line items that surprise a first-time owner.

### T12-07 · Storage classes — Understand · 🔲 not written
- **Read this:** [Choosing an AWS storage service](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-storage-service.html) · AWS Decision Guides · covers S3, EBS, EFS, FSx and related services for object, block and file storage (*read*) · covers our angle: **partial** — selection, not tier-move costs · fetched 2026-10-14
- **Also good:** [Managing the lifecycle of objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) · AWS S3 · lifecycle rules transition objects to cheaper classes or expire them, and the page notes costs associated with lifecycle transitions (*read*) · fetched 2026-10-14
- **Also good:** [Understanding and managing Amazon S3 storage classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html) · AWS S3 · the storage classes from frequently accessed through Glacier archive (*read*) · fetched 2026-10-14
- **Our delta:** which of object, block and file fits, and what moving between tiers costs.

### T12-08 · Edge and traffic — Understand · 🔲 not written
- **Read this:** [What is Elastic Load Balancing](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html) · AWS · the current-generation load balancers are Application, Network and Gateway Load Balancers (*read*) · covers our angle: **partial** — load balancing only · fetched 2026-10-14
- **Also good:** [What is Amazon CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html) · AWS · a distribution names origins such as S3 or an HTTP server and serves content from edge servers near viewers (*read*) · fetched 2026-10-14
- **Our delta:** Part 2's network path mapped onto the provider's load balancers, DNS, CDN and gateway.

### T12-09 · Messaging services — Understand · 🔲 not written
- **Read this:** [Amazon SQS, Amazon SNS, or Amazon EventBridge?](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/sns-or-sqs-or-eventbridge.html) · AWS Decision Guides · explains the differences between the queue, topic and event-bus services and which to pick (*read*) · covers our angle: **partial** — no Kafka threshold · fetched 2026-10-14
- **Our delta:** when the managed queue beats running a broker and where Kafka becomes worth its operators.

### T12-10 · Secrets and configuration — Understand · 🔲 not written
- **Read this:** [Rotate AWS Secrets Manager secrets](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html) · AWS · rotation periodically updates the credentials in both the secret and the database or service, and can be automatic (*read*) · covers our angle: **partial** — rotation, not injection · fetched 2026-10-14
- **Also good:** [Referencing Secrets Manager secrets from Parameter Store parameters](https://docs.aws.amazon.com/systems-manager/latest/userguide/integration-ps-secretsmanager.html) · AWS Systems Manager · how the two services connect (*read*) · fetched 2026-10-14
- **Our delta:** secrets manager versus parameter store, and injection into containers and functions.

### T12-11 · Serverless trade-offs — Understand · 🔲 not written
- **Read this:** [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) · AWS Lambda · code runs up to 15 minutes, invocation payloads are 6 MB each way for synchronous calls and 1 MB for asynchronous ones, and each function scales by 1,000 execution environments every 10 seconds (*read*) · covers our angle: **partial** — limits, not the cost curve · fetched 2026-10-14
- **Also good:** [Understanding the Lambda execution environment lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html) · AWS Lambda · the Init phase behind a cold start starts extensions, bootstraps the runtime and runs the function's static code, and is limited to 10 seconds before Lambda retries it on the first invocation (*read*) · fetched 2026-10-14
- **Beyond the docs:** [When is serverless more expensive than containers?](https://dev.to/aws-heroes/when-is-serverless-more-expensive-than-containers-58k1) · Allen Helton, AWS Heroes on dev.to, Nov 2022 · against a four-instance EC2 fleet behind an ALB, Lambda at 1,024 MB and 200 ms per request becomes the more expensive option at about 66 requests per second on average; at 50 requests per second a single App Runner container already undercuts Lambda (*read*) · fetched 2026-10-14
- **Our delta:** the cost curve that is cheap at one request per second and ruinous at a thousand.

### T12-12 · The Well-Architected pillars — Understand · 🔲 not written
- **Read this:** [The pillars of the Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html) · AWS Well-Architected · six pillars: operational excellence, security, reliability, performance efficiency, cost optimization, sustainability (*read*) · covers our angle: **partial** — names the pillars, not a self-review routine · fetched 2026-10-14
- **Our delta:** the pillars as a checklist you run over your own design.

### T12-13 · Provider observability and where it stops — Understand · 🔲 not written
- **Read this:** [What is Amazon CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html) · AWS · metrics, alarms, dashboards, logs, application monitoring, and OpenTelemetry support (*read*) · covers our angle: **partial** — the provider side · fetched 2026-10-14
- **Also good:** [What is OpenTelemetry?](https://opentelemetry.io/docs/what-is-opentelemetry/) · OpenTelemetry · a vendor- and tool-agnostic framework for generating, collecting and exporting traces, metrics and logs, and not itself a backend (*read*) · fetched 2026-10-14
- **Our delta:** the gaps OpenTelemetry fills; continues in Part 8.

### T12-14 · Multi-region — Understand · 🔲 not written
- **Read this:** [Disaster recovery options in the cloud](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) · AWS whitepaper · four approaches from backup and restore through pilot light and warm standby to multi-site active/active (*read*) · covers our angle: **partial** — no DNS failover or cost multiplier detail · fetched 2026-10-14
- **Beyond the docs:** [Trade-Offs in Multi-Region Architectures: Latency vs. Cost](https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/) · InfoQ, 10 Jul 2026 · says active-active cuts latency but adds replication and consistency complexity that can raise operating cost by 20 to 35 percent, with active-passive as the middle path (*read*) · fetched 2026-10-14
- **Our delta:** when the availability target actually requires multi-region.

### T12-15 · The storefront on AWS — Understand · 🔲 not written
- **Read this:** [Overview of data transfer costs for common architectures](https://aws.amazon.com/blogs/architecture/overview-of-data-transfer-costs-for-common-architectures/) · AWS Architecture Blog · walks a multi-AZ web tier plus RDS example and names where the transfer charges land (*read*) · covers our angle: **partial** — cost drivers, not the full reference diagram · fetched 2026-10-14
- **Also good:** [Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) · AWS · the connection-pooling box between containers and the database (*read*) · fetched 2026-10-14
- **Our delta:** the whole storefront with network, containers, PostgreSQL, Redis, object storage, CDN and queues, each with its cost driver named.

### T12-16 · Multi-account and landing zones — Know · 🔲 not written
- **Read this:** [Organizing Your AWS Environment Using Multiple Accounts](https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html) · AWS whitepaper · multiple accounts isolate applications and data and help across the Well-Architected pillars (*read*) · covers our angle: **partial** — guidance, not a checklist · fetched 2026-10-14
- **Our delta:** an account per environment or team, guardrails, central logging and billing.

### T12-17 · The GCP and Azure map — Know · 🔲 not written
- **Read this:** [AWS, Azure, and Google Cloud service comparison](https://docs.cloud.google.com/docs/get-started/aws-azure-gcp-service-comparison) · Google Cloud · a service-by-service table mapping each category across the three providers (*read*) · covers our angle: **partial** — names, not the networking and identity differences · fetched 2026-10-14
- **Also good:** [Azure for AWS professionals](https://learn.microsoft.com/en-us/azure/architecture/aws-professional/) · Microsoft Learn · the Azure-side mapping for AWS users; notes that AWS uses accounts as the boundary for permissions and spend where Azure uses subscriptions, and that resources are organised differently, such as resource groups (*read*) · fetched 2026-10-14
- **Our delta:** the differences that matter, networking and identity.

### T12-18 · Lock-in, honestly — Know · 🔲 not written
- **Read this:** [Don't get locked up into avoiding lock-in](https://martinfowler.com/articles/oss-lockin.html) · Gregor Hohpe, 9 Sep 2019 · lock-in is not true or false, avoiding one aspect often locks you into another, and open source does not automatically remove it (*read*) · covers our angle: **partial** — the argument, not our portable and non-portable list · fetched 2026-10-14
- **Our delta:** containers, PostgreSQL, Kafka and OpenTelemetry as portable; identity and serverless glue as not; the price of portability.

---

## Phase 13 — Kubernetes

### T13-01 · What Kubernetes is for — Master · 🔲 not written
- **Read this:** [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/) · Kubernetes · explains a control loop with a thermostat: you set the desired state and the controller drives current state toward it (*read*) · covers our angle: **partial** — the model, not when a simpler scheduler is enough · fetched 2026-10-14
- **Also good:** [Kubernetes overview](https://kubernetes.io/docs/concepts/overview/) · Kubernetes · what the platform provides, including automated rollouts and rollbacks from a described desired state (*read*) · fetched 2026-10-14
- **Our delta:** the honest answer to when a simpler scheduler or managed container service is enough.

### T13-02 · Pods and Deployments — Master · 🔲 not written
- **Read this:** [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) · Kubernetes · a Deployment declares desired state and its controller moves the actual state there at a controlled rate through ReplicaSets, with each revision recorded and rollback to an earlier one possible (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the pod as the unit, revision history and rollback tied to the storefront.

### T13-03 · Services and cluster networking — Master · 🔲 not written
- **Read this:** [Service](https://kubernetes.io/docs/concepts/services-networking/service/) · Kubernetes · a Service gets a cluster IP and targets Pods by label selector (*read*) · covers our angle: **partial** — Services, not the network plugin · fetched 2026-10-14
- **Also good:** [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) · Kubernetes · rules for traffic between pods and outside, enforced only if the cluster's network plugin supports them (*read*) · fetched 2026-10-14
- **Also good:** [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) · Kubernetes · Services get names of the form `name.namespace.svc.cluster.local`, and a bare name is expanded through the search list kubelet writes into each Pod's `/etc/resolv.conf`, so it resolves in the Pod's own namespace only (*read*) · fetched 2026-10-14
- **Our delta:** network policies as the firewall between services.

### T13-04 · Ingress and the Gateway API — Master · 🔲 not written
- **Read this:** [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/) · Kubernetes · a family of API kinds for dynamic infrastructure provisioning and advanced traffic routing with a role-oriented configuration model (*read*) · covers our angle: **partial** — no controller choice · fetched 2026-10-14
- **Also good:** [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) · Kubernetes · the project recommends Gateway instead of Ingress and the Ingress API is frozen (*read*) · fetched 2026-10-14
- **Our delta:** TLS termination and the controller you actually run, Nginx among them.

### T13-05 · Probes — Master · 🔲 not written
- **Read this:** [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · Kubernetes · the readiness probe decides whether the Pod is marked ready and receives traffic from Services (*read*) · covers our angle: **partial** — configuration, not the failure story · fetched 2026-10-14
- **Beyond the docs:** [Kubernetes pod liveness probe killing healthy containers](https://www.netdata.cloud/guides/kubernetes/kubernetes-pod-liveness-probe-killing/) · Netdata · a container that is serving requests, not OOMKilled and not crashed can still be restarted repeatedly because a liveness probe failed, with probe configuration, resource pressure such as a GC pause or CPU throttling, and kubelet lag as the causes to separate (*read*) · fetched 2026-10-14
- **Our delta:** readiness as the load balancer's source of truth, and the liveness probe that made an outage worse.

### T13-06 · Requests, limits and quality of service — Master · 🔲 not written
- **Read this:** [Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) · Kubernetes · CPU limits are a hard limit enforced by throttling; memory limits are enforced by kernel OOM kills that happen only once the kernel detects memory pressure, so a container can briefly exceed its limit (*read*) · covers our angle: **partial** — no JVM or Node settings · fetched 2026-10-14
- **Also good:** [Pod Quality of Service Classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/) · Kubernetes · Guaranteed, Burstable and BestEffort decide eviction order under node pressure (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How Not To Use Kubernetes: 5 Failure Stories](https://cloudnativenow.com/editorial-calendar/best-of-2021/how-not-to-use-kubernetes-5-failure-stories/) · Cloud Native Now · opens with CPU limits that cause high latency, from the k8s.af failure stories (*read*) · fetched 2026-10-14
- **Beyond the docs:** [OOMKilled at Endowus](https://build.endowus.com/oomkilled/) · Endowus engineering · an 80 percent heap share of the container limit ignored off-heap memory and caused repeated OOM kills (*read*) · fetched 2026-10-14
- **Our delta:** throttling versus kills, and JVM and Node memory inside a container.

### T13-07 · Autoscaling — Master · 🔲 not written
- **Read this:** [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/) · Kubernetes · scales on average CPU, memory or any custom metric you specify (*read*) · covers our angle: **partial** — no event-driven or node scaling · fetched 2026-10-14
- **Also good:** [KEDA concepts](https://keda.sh/docs/2.21/concepts/) · KEDA · watches event sources such as queues and feeds their metrics to the HPA rather than replacing it, and itself scales a workload between zero and one replica (*read*) · fetched 2026-10-14
- **Also good:** [Node Autoscaling](https://kubernetes.io/docs/concepts/cluster-administration/node-autoscaling/) · Kubernetes · adds nodes when Pods cannot be scheduled and consolidates underused ones; Cluster Autoscaler and Karpenter are the two autoscalers SIG Autoscaling sponsors (*read*) · fetched 2026-10-14
- **Our delta:** queue-depth scaling and the scale-up that arrived after the spike passed.

### T13-08 · Rollout strategies — Master · 🔲 not written
- **Read this:** [Argo Rollouts](https://argo-rollouts.readthedocs.io/en/stable/) · Argo · a controller and CRDs adding blue-green, canary, canary analysis and progressive delivery, shifting traffic through ingress controllers or meshes; lists what a Deployment's RollingUpdate lacks: speed control, traffic control, checks against external metrics and automatic abort and rollback (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Canary Release](https://martinfowler.com/bliki/CanaryRelease.html) · Danilo Sato, martinfowler.com, 25 Jun 2014 · roll out to a small subset of users before everyone (*read*) · fetched 2026-10-14
- **Our delta:** what a plain Deployment cannot do that a rollout controller can.

### T13-09 · Running Node and Java on Kubernetes — Master · 🔲 not written
- **Read this:** [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) · Kubernetes · a Pod is granted a termination grace period that defaults to 30 seconds (*read*) · covers our angle: **partial** — no PID 1 or runtime advice · fetched 2026-10-14
- **Beyond the docs:** [Graceful shutdown](https://learnkube.com/graceful-shutdown) · Learnk8s · endpoints are not removed everywhere at once, so wait after SIGTERM and keep serving, then close long-lived connections, with a preStop hook (*read*) · fetched 2026-10-14
- **Our delta:** PID 1 and signals, connection draining, container-aware JVM settings and the deploy that dropped in-flight checkouts.

### T13-10 · Debugging on Kubernetes — Master · 🔲 not written
- **Read this:** [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/) · Kubernetes · start with describe pods and its events, then branch by state such as a pod stuck Pending for lack of resources (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Troubleshooting deployments](https://learnkube.com/troubleshooting-deployments) · Learnk8s · walks Pending, ImagePullBackOff and the other failing states (*read*) · fetched 2026-10-14
- **Our delta:** the workflow before reaching for a dashboard, across CrashLoopBackOff, ImagePullBackOff and Pending.

### T13-11 · Control plane and nodes — Understand · 🔲 not written
- **Read this:** [Kubernetes components](https://kubernetes.io/docs/concepts/overview/components/) · Kubernetes · lists kube-apiserver, etcd, kube-scheduler and kube-controller-manager on the control plane plus the node components (*read*) · covers our angle: **partial** — no failure behaviour · fetched 2026-10-14
- **Our delta:** what stops working when each component dies.

### T13-12 · StatefulSets, DaemonSets, Jobs and CronJobs — Understand · 🔲 not written
- **Read this:** [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) · Kubernetes · gives each Pod a sticky identity that survives rescheduling, plus stable storage and ordered rollout; it needs a headless Service you create, and deleting or scaling it down does not delete its volumes (*read*) · covers our angle: **partial** — the primitives, not the storefront's workers · fetched 2026-10-14
- **Also good:** [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/) · Kubernetes · runs a copy of a Pod on all (or some) nodes, adding it as nodes join, for storage, log-collection and monitoring agents (*read*) · fetched 2026-10-14
- **Also good:** [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) · Kubernetes · one-off tasks that retry Pods until a set number complete successfully, with `backoffLimit` capping the retries (*read*) · fetched 2026-10-14
- **Also good:** [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) · Kubernetes · creates a Job approximately once per scheduled time, can sometimes create two or none, so jobs must be idempotent; `concurrencyPolicy` controls overlap (*read*) · fetched 2026-10-14
- **Our delta:** the storefront's workers and nightly jobs.

### T13-13 · ConfigMaps and Secrets — Understand · 🔲 not written
- **Read this:** [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/) · Kubernetes · by default Secrets are stored unencrypted in etcd and anyone with API access, or access to etcd, can read or modify one; the page recommends encryption at rest, least-privilege RBAC and external Secret store providers (*read*) · covers our angle: **partial** — the risk and mitigations, not an operator · fetched 2026-10-14
- **Also good:** [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/) · Kubernetes · non-confidential key-value data, consumed as environment variables, command-line arguments or files in a volume, capped at 1 MiB and explicitly providing no secrecy or encryption (*read*) · fetched 2026-10-14
- **Also good:** [External Secrets Operator](https://external-secrets.io/latest/) · External Secrets · an operator that reads secrets from AWS Secrets Manager, Vault, Google and Azure stores and others and writes them into Kubernetes Secrets, through `ExternalSecret`, `SecretStore` and `ClusterSecretStore` resources (*read*) · fetched 2026-10-14
- **Our delta:** why a Secret is not secret by default.

### T13-14 · Storage — Understand · 🔲 not written
- **Read this:** [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) · Kubernetes · a PersistentVolume has a lifecycle independent of any Pod, a PersistentVolumeClaim requests size and access mode (ReadWriteOnce and the others), and a StorageClass lets the cluster provision volumes dynamically; reclaim policy decides whether a released volume is retained or deleted (*read*) · covers our angle: **partial** — the API, not the database-operator question · fetched 2026-10-14
- **Beyond the docs:** [How to run databases in Kubernetes](https://thenewstack.io/how-to-run-databases-in-kubernetes/) · Kolawole Olowoporoku, The New Stack, 23 Jul 2024 · covers resource planning, high availability and a backup CronJob that ships `pg_dumpall` output to S3, and argues an operator such as Zalando's Postgres Operator is what brings read replicas and automatic failover comparable to a managed database service (*read*) · fetched 2026-10-14
- **Our delta:** why a database wants an operator, and why many teams still choose the managed service.

### T13-15 · RBAC, namespaces and pod security — Understand · 🔲 not written
- **Read this:** [Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) · Kubernetes · permissions are purely additive with no deny rules; a Role grants within one namespace and a ClusterRole is cluster-wide, each attached to users or service accounts by a binding (*read*) · covers our angle: **partial** — authorization, not tenancy design · fetched 2026-10-14
- **Also good:** [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) · Kubernetes · Privileged, Baseline and Restricted profiles from permissive to restrictive (*read*) · fetched 2026-10-14
- **Also good:** [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/) · Kubernetes · namespaces scope names and divide resources through quotas, are meant for many users across teams or projects rather than a cluster of a few to tens of users, and do not apply to cluster-wide objects such as nodes and StorageClasses (*read*) · fetched 2026-10-14
- **Also good:** [Admission Controllers](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/) · Kubernetes · code that intercepts API requests after authentication and authorization but before the object is persisted; mutating controllers may change the object, validating ones may only reject it (*read*) · fetched 2026-10-14
- **Our delta:** the namespace as the tenancy unit.

### T13-16 · Helm and Kustomize — Understand · 🔲 not written
- **Read this:** [Using Helm](https://helm.sh/docs/intro/using_helm/) · Helm 4 docs · values files passed with `-f` override chart defaults with the rightmost file winning, every install, upgrade or rollback creates a numbered release revision, and `helm rollback` returns to an earlier one (*read*) · covers our angle: **partial** — templating mechanics, not the overlay comparison · fetched 2026-10-14
- **Also good:** [Declarative Management of Kubernetes Objects Using Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/) · Kubernetes · applied with kubectl apply -k (*read*) · fetched 2026-10-14
- **Also good:** [The Chart Best Practices Guide](https://helm.sh/docs/chart_best_practices/) · Helm · the Helm team's conventions for chart structure, values, templates, dependencies, labels, CRDs and RBAC (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Helm vs. Kustomize: Which Is Better for K8s Config?](https://www.plural.sh/blog/helm-vs-kustomize/) · Plural, 15 Jan 2026 · Helm for packaging and versioning upstream apps, Kustomize for per-environment overlays without a template language, often combined (*read*) · fetched 2026-10-14
- **Our delta:** values per environment and the chart that hides a hundred decisions.

### T13-17 · GitOps — Understand · 🔲 not written
- **Read this:** [OpenGitOps](https://opengitops.dev/) · OpenGitOps · the four GitOps principles v1.0.0: desired state is declarative, versioned and immutable, pulled automatically by agents, and continuously reconciled against the actual state (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Argo CD](https://argo-cd.readthedocs.io/en/stable/) · Argo · declarative GitOps continuous delivery for Kubernetes (*read*) · fetched 2026-10-14
- **Our delta:** drift detection, a free audit trail and the manual kubectl apply that GitOps reverted.

### T13-18 · Managed Kubernetes — Understand · 🔲 not written
- **Read this:** [What is Amazon EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html) · AWS · in EKS standard AWS runs the control plane, and EKS Auto Mode extends that to the nodes, provisioning, scaling and patching them (*read*) · covers our angle: **partial** — what AWS takes, not what is left · fetched 2026-10-14
- **Also good:** [Kubernetes version lifecycle on EKS](https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html) · AWS · each minor version gets 14 months of standard support, then 12 months of extended support at an extra per-cluster-hour cost, after which the cluster is auto-upgraded, so upgrades stay your job (*read*) · fetched 2026-10-14
- **Our delta:** what is still yours after "managed".

### T13-19 · Cost on Kubernetes — Understand · 🔲 not written
- **Read this:** [Best Practices for Cost Optimization - Amazon EKS](https://docs.aws.amazon.com/eks/latest/best-practices/cost-opt.html) · AWS EKS Best Practices Guide · groups cost work into cost-effective resources (autoscaling, purchasing options), expenditure awareness and right-sizing over time, and points to on-demand, Spot and Savings Plans (*read*) · covers our angle: **partial** — no showback or requests-as-cost argument · fetched 2026-10-14
- **Beyond the docs:** [Choose Requests or Usage for Kubernetes Showback](https://oneuptime.com/blog/post/2026-08-04-kubernetes-showback-requests-vs-usage/view) · OneUptime, 4 Aug 2026 · separates requested capacity, actual usage and limit, and notes requests are what the scheduler must fit (*read*) · fetched 2026-10-14
- **Our delta:** requests as the real cost driver, idle capacity, spot nodes and per-team showback.

### T13-20 · Service mesh on Kubernetes — Know · ✅ written `docs/system-design/pages/phase-2-request-path/16-service-mesh.md`
- **Read this:** [Istio traffic management](https://istio.io/latest/docs/concepts/traffic-management/) · Istio · routing rules plus circuit breakers, timeouts and retries as configuration, and percentage-based traffic splits for canaries (*read*) · covers our angle: **partial** — the capability, not the cost · fetched 2026-10-14
- **Also good:** [Linkerd overview](https://linkerd.io/2-edge/overview/) · Linkerd · ultralight, transparent micro-proxies installed beside each service instance handle all its traffic, with no code changes (*read*) · fetched 2026-10-14
- **Our delta:** the latency and cognitive cost, with the mesh pages in phase 2 (mTLS, retries, traffic splitting, when a mesh earns its cost).

### T13-21 · Local development — Know · 🔲 not written
- **Read this:** [kind](https://kind.sigs.k8s.io/) · Kubernetes SIGs · runs local clusters using Docker containers as nodes, bootstrapped with kubeadm; built primarily to test Kubernetes itself but usable for local development and CI (*read*) · covers our angle: **partial** — the cluster, not when Compose is enough · fetched 2026-10-14
- **Also good:** [Tilt docs](https://docs.tilt.dev/) · Tilt · `tilt up` automates the loop from a code change to a running process, watching files, rebuilding images and updating the environment, pitched as Kubernetes for prod and Tilt for dev (*read*) · fetched 2026-10-14
- **Our delta:** when Compose is still the right tool.

### T13-22 · Multi-tenancy and platform teams — Know · 🔲 not written
- **Read this:** [Multi-tenancy](https://kubernetes.io/docs/concepts/security/multi-tenancy/) · Kubernetes · separates multi-team from multi-customer tenancy and weighs namespace per tenant (cheap, well supported, but blind to non-namespaced resources such as CRDs and StorageClasses) against a virtual control plane per tenant and dedicated clusters (*read*) · covers our angle: **partial** — isolation options, not platform teams or golden paths · fetched 2026-10-14
- **Also good:** [CNCF Platforms White Paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/) · CNCF TAG App Delivery · platforms curate foundational capabilities and experiences, as platform engineering emerged from DevOps cooperation (*read*) · fetched 2026-10-14
- **Our delta:** namespaces versus clusters per team, golden paths and what platform engineering changes for a product team.

---

## Phase 14 — Infrastructure as code and delivery

### T14-01 · Why infrastructure as code — Master · 🔲 not written
- **Read this:** [Infrastructure As Code](https://martinfowler.com/bliki/InfrastructureAsCode.html) · Martin Fowler, 1 Mar 2016 · defines infrastructure as code and points to Kief Morris's book for depth (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [PhoenixServer](https://martinfowler.com/bliki/PhoenixServer.html) · Martin Fowler, 10 Jul 2012 · rebuilding servers regularly to avoid configuration drift (*read*) · fetched 2026-10-14
- **Our delta:** reproducibility, review, rebuild from zero, and the console change nobody remembered.

### T14-02 · Terraform's model — Master · 🔲 not written
- **Read this:** [What is Terraform](https://developer.hashicorp.com/terraform/intro) · HashiCorp · declarative configuration, with a state file as source of truth that Terraform compares to make the real infrastructure match (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Dependency Graph](https://developer.hashicorp.com/terraform/internals/graph) · HashiCorp · Terraform builds a graph of resource and provider nodes from references and `depends_on`, adds orphans still in state but gone from config, and walks it in parallel, 10 nodes at a time by default (`-parallelism`) (*read*) · fetched 2026-10-14
- **Also good:** [terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan) · HashiCorp · a plan refreshes state from the real objects, compares configuration with prior state and proposes actions without carrying them out; `-out` saves it to a file that `terraform apply` can later execute, the two-step workflow meant for automation, while a plan without it is only speculative (*read*) · fetched 2026-10-14
- **Our delta:** reading a plan the way you read a diff.

### T14-03 · State — Master · 🔲 not written
- **Read this:** [State: remote](https://developer.hashicorp.com/terraform/language/state/remote) · HashiCorp · remote backends can lock state to stop concurrent runs (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Import resources overview](https://developer.hashicorp.com/terraform/language/import) · HashiCorp · bringing existing infrastructure under management (*read*) · fetched 2026-10-14
- **Also good:** [S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3) · HashiCorp · locking is opt-in through `use_lockfile` in S3, DynamoDB-based locking is deprecated, and bucket versioning is strongly recommended so state can be recovered after accidental deletion or human error (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to manage Terraform state](https://www.gruntwork.io/blog/how-to-manage-terraform-state) · Yevgeniy Brikman, Gruntwork, 29 Sep 2016 · file layout, isolation and locking for Terraform projects (*read*) · fetched 2026-10-14
- **Our delta:** state per environment, secrets in state, and recovery from a corrupted state file.

### T14-04 · Drift and reconciliation — Master · 🔲 not written
- **Read this:** [Manage resource drift](https://developer.hashicorp.com/terraform/tutorials/state/resource-drift) · HashiCorp tutorial · manual changes make state drift from real infrastructure, and Terraform's attempt to reconcile may destroy or recreate resources; a `-refresh-only` plan shows the drift without changing anything (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [The lifecycle meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle) · HashiCorp · prevent_destroy, with the caveat that removing the resource's configuration still destroys it (*read*) · fetched 2026-10-14
- **Our delta:** the plan that wants to destroy production.

### T14-05 · Secrets in infrastructure code — Master · 🔲 not written
- **Read this:** [Manage sensitive data](https://developer.hashicorp.com/terraform/language/manage-sensitive-data) · HashiCorp · secrets added to configuration are stored in state and plan files, with options and trade-offs (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the secrets manager as the source and the code as the reference.

### T14-06 · CI/CD pipelines — Master · 🔲 not written
- **Read this:** [Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html) · Martin Fowler · practices such as one mainline, self-testing builds and fast builds (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Deployment Pipeline](https://martinfowler.com/bliki/DeploymentPipeline.html) · Martin Fowler, 30 May 2013 · staged builds balance fast feedback against comprehensive tests (*read*) · fetched 2026-10-14
- **Also good:** [Dependency caching reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) · GitHub Docs · the cache action's exact-key then restore-keys lookup (*read*) · fetched 2026-10-14
- **Our delta:** build, test, scan, package, deploy, with required checks.

### T14-07 · Deployment strategies — Master · 🔲 not written
- **Read this:** [Blue Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html) · Martin Fowler, 1 Mar 2010 · two production environments kept as identical as possible, with the router switched to the tested one and switched back for a fast rollback; databases are named as the hard part (*read*) · covers our angle: **partial** — one strategy, not migrations in the pipeline · fetched 2026-10-14
- **Also good:** [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) · Martin Fowler · expand, migrate, contract for backward-incompatible changes (*read*) · fetched 2026-10-14
- **Also good:** [Canary Release](https://martinfowler.com/bliki/CanaryRelease.html) · Danilo Sato, 25 Jun 2014 · roll the change out to a small subset of users before the entire infrastructure (*read*) · fetched 2026-10-14
- **Our delta:** migrations inside the pipeline using expand-and-contract from Part 3.

### T14-08 · Modules and structure — Understand · 🔲 not written
- **Read this:** [Standard module structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure) · HashiCorp · the root module is the only required element (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Modules](https://developer.hashicorp.com/terraform/language/modules) · HashiCorp · the root module calls child modules, loaded from local paths, a public or private registry or VCS by source and version, through a develop, distribute, provision workflow (*read*) · fetched 2026-10-14
- **Our delta:** a root module per environment and the monolith that takes forty minutes to plan.

### T14-09 · Workspaces and environments — Understand · 🔲 not written
- **Read this:** [State: workspaces](https://developer.hashicorp.com/terraform/language/state/workspaces) · HashiCorp · CLI workspaces are several states behind one backend and one set of credentials, and the page warns they are not appropriate for deployments that need separate credentials and access controls; `terraform.workspace` can vary sizing or naming per workspace (*read*) · covers our angle: **partial** — the mechanism and its limit, not promotion · fetched 2026-10-14
- **Beyond the docs:** [How to manage Terraform state](https://www.gruntwork.io/blog/how-to-manage-terraform-state) · Yevgeniy Brikman, Gruntwork, 29 Sep 2016, updated for Terraform 1.2 in 2022 · argues workspaces are unsuitable for separating staging from production because every workspace shares one backend and its access controls and is invisible in the code, so a `terraform destroy` in the wrong one is easy; isolate environments by file layout instead (*read*) · fetched 2026-10-14
- **Our delta:** promotion between environments and variables per environment.

### T14-10 · Testing infrastructure code — Understand · 🔲 not written
- **Read this:** [Tests](https://developer.hashicorp.com/terraform/language/tests) · HashiCorp · the native framework (Terraform 1.6 and later) runs `.tftest.hcl` files whose run blocks default to `command = apply` against real, short-lived infrastructure, like an integration test, or use `command = plan`, and provider mocking since 1.7, for unit-style tests (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Conftest](https://www.conftest.dev/) · Conftest · tests for structured configuration such as Terraform and Kubernetes using Rego policies (*read*) · fetched 2026-10-14
- **Our delta:** validation, policy checks, plan review and ephemeral test stacks.

### T14-11 · Progressive delivery and feature flags — Understand · 🔲 not written
- **Read this:** [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html) · Pete Hodgson, martinfowler.com · categories of toggles, with long-lived kill switches as the exception to retiring flags (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [OpenFeature introduction](https://openfeature.dev/docs/reference/intro/) · OpenFeature · a flag is an if/else controlled at runtime, behind a vendor-agnostic API (*read*) · fetched 2026-10-14
- **Our delta:** flag hygiene and the flag that lived for three years.

### T14-12 · Environments — Understand · 🔲 not written
- **Read this:** [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) · GitHub Docs · deployment protection rules, environment secrets and variables (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** how many environments, ephemeral preview environments per pull request, the data problem in non-production.

### T14-13 · DORA metrics — Understand · 🔲 not written
- **Read this:** [DORA's software delivery metrics](https://dora.dev/guides/dora-metrics/) · DORA, Nathen Harvey · five metrics replacing the original four keys: throughput is change lead time, deployment frequency and failed deployment recovery time (which replaced MTTR); instability is change fail rate and deployment rework rate; the pitfalls list opens with setting metrics as goals and Goodhart's law (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [How to Misuse and Abuse DORA Metrics](https://newsletter.getdx.com/p/misuse-dora) · Abi Noda, 22 Jul 2022 · summarises Bryan Finster's paper on rolling out DORA metrics: teams spent two days a month gathering numbers to report and directors compared teams on them, because the metrics were set as goals (*read*) · fetched 2026-10-14
- **Our delta:** what each metric diagnoses and how teams game them.

### T14-14 · Disaster recovery through code — Understand · 🔲 not written
- **Read this:** [REL13-BP03 Test disaster recovery implementation](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_dr_tested.html) · AWS Well-Architected · regularly fail over to the recovery site to prove RTO and RPO are met, since "the only error recovery that works is the path you test frequently"; never exercising failover in production is the named anti-pattern (*read*) · covers our angle: **partial** — the drill, not the rebuild from code · fetched 2026-10-14
- **Beyond the docs:** [Disaster Recovery (DR) Architecture on AWS, Part I](https://aws.amazon.com/blogs/architecture/disaster-recovery-dr-architecture-on-aws-part-i-strategies-for-recovery-in-the-cloud/) · Seth Eliot, AWS Architecture Blog, 5 Apr 2021 · backup and restore across Regions only works if the infrastructure can also be redeployed there from code (CloudFormation or CDK); pilot light keeps data live but deploys zero instances until failover, from pre-copied machine images (*read*)
- **Beyond the docs:** [Postmortem of database outage of January 31](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/) · GitLab, 10 Feb 2017 · after an engineer wiped the primary's data directory, the nightly `pg_dump` backups turned out to be empty (a 9.2 client against a 9.6 server, failure emails rejected), disk snapshots were off, and recovery came from a staging copy six hours old, because nobody owned testing the backups (*read*) · fetched 2026-10-14
- **Our delta:** rebuilding a region from the repository plus backups, and the drill that proves it.

### T14-15 · Supply chain in delivery — Understand · 🔲 not written
- **Read this:** [Sigstore overview](https://docs.sigstore.dev/about/overview/) · Sigstore · signing and verifying release files, container images and SBOMs with ephemeral keys and a tamper-resistant public log (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [About SLSA](https://slsa.dev/spec/v1.2/about) · SLSA v1.2 · incrementally adoptable supply-chain guidelines that track code from source to binary, so review of the source still applies to what was built; if an SBOM is the ingredient list, SLSA is the food-safety handling that makes it credible (*read*) · fetched 2026-10-14
- **Also good:** [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) · GitHub Docs · pin actions to a full-length commit SHA (*read*) · fetched 2026-10-14
- **Our delta:** pinned dependencies and actions; continues in Part 9.

### T14-16 · The storefront's pipeline — Understand · 🔲 not written
- **Read this:** [Deployment Pipeline](https://martinfowler.com/bliki/DeploymentPipeline.html) · Martin Fowler, 30 May 2013 · stages that trade speed for thoroughness (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Argo Rollouts](https://argo-rollouts.readthedocs.io/en/stable/) · Argo · the canary and rollback step (*read*) · fetched 2026-10-14
- **Our delta:** pull request to production drawn once, with preview environment, canary and rollback.

### T14-17 · Terraform's licensing split and the alternatives — Know · 🔲 not written
- **Read this:** [OpenTofu manifesto](https://opentofu.org/manifesto/) · OpenTofu · on 10 Aug 2023 HashiCorp switched Terraform from the MPL to the Business Source License with little or no notice (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [OpenTofu FAQ](https://opentofu.org/faq/) · OpenTofu · a fork started by Gruntwork, Spacelift, Harness, env0, Scalr and others in response to the BUSL switch, handed to the Linux Foundation (*read*) · fetched 2026-10-14
- **Also good:** [Pulumi concepts](https://www.pulumi.com/docs/iac/concepts/) · Pulumi · infrastructure in TypeScript, Python, Go, .NET, Java and YAML (*read*) · fetched 2026-10-14
- **Also good:** [What is the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html) · AWS · constructs provisioned through CloudFormation (*read*) · fetched 2026-10-14
- **Our delta:** what each choice changes for a team.

### T14-18 · Policy as code — Know · 🔲 not written
- **Read this:** [Open Policy Agent](https://www.openpolicyagent.org/docs) · OPA · a general-purpose policy engine for policy as code (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Checkov](https://www.checkov.io/) · Checkov · scans infrastructure configurations for misconfigurations before deploy (*read*) · fetched 2026-10-14
- **Also good:** [Policy enforcement overview](https://developer.hashicorp.com/terraform/cloud-docs/policy-enforcement) · HashiCorp · HCP Terraform validates plans against policies written in Sentinel, OPA (Rego) or a native HCL framework in beta, kept in a VCS repository as policy sets, with pre-written sets for standards such as PCI DSS (*read*) · fetched 2026-10-14
- **Our delta:** guardrails such as no public buckets and mandatory tags, enforced before apply.
