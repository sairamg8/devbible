---
title: "Part 9 — Security and compliance at scale"
sidebar_label: "9 · Security & compliance"
sidebar_position: 9
---

> Phase 17 · The controls a design needs before it touches money or personal data, and the regimes that dictate some of them

Security in a design interview is rarely its own question; it is the follow-up that exposes
whether you think about it at all. "How do you stop one customer reading another's orders",
"where is the card number", "what happens when a key leaks" — each has a short, specific
answer a senior gives without prompting. The implementation lives in Node's
[security phase](../../nodejs/pages/phase-8-security/README.md), Express's
[validation and authorization phase](../../expressjs/pages/phase-8-validation-authz/README.md) and Java's
[OAuth2 and OIDC phase](../../java/pages/phase-13-oauth2-oidc/README.md); this part is the design layer
and the compliance context those pages assume.

---

## Phase 17 — Security and compliance at scale

One phase, because the topics only make sense together: authentication decides who,
authorization decides what, secrets and encryption protect the data in between, and the
compliance regimes say which of these are optional. The storefront is the example throughout
— it holds addresses, orders, and a payment flow.

| Topic | Tier |
|---|---|
| **Threat modelling** — a data-flow diagram with trust boundaries, assets and attackers, the STRIDE categories per boundary; the twenty-minute version you can run on a whiteboard | <span className="db-tier t-master">Master</span> |
| **Authentication at scale** — sessions vs tokens, refresh rotation with reuse detection, token storage on web and mobile, logout everywhere, device sessions; the trade-offs restated as design decisions | <span className="db-tier t-master">Master</span> |
| **OAuth2 and OpenID Connect** — authorization code with PKCE, client credentials between services, the flows you must never use, ID token vs access token; the mistakes that survive code review | <span className="db-tier t-master">Master</span> |
| **Authorization models** — role-based, attribute-based, relationship-based (Zanzibar-style), and when each fits; central policy vs per-service checks; customer, seller and admin in the storefront | <span className="db-tier t-master">Master</span> |
| **Object-level and function-level authorization** — the insecure direct reference that leaked every order, ownership checked on every read, deny by default | <span className="db-tier t-master">Master</span> |
| **API security as a checklist** — broken object authorization, broken authentication, unrestricted resource consumption, mass assignment, server-side request forgery; the OWASP API list applied to the storefront's endpoints | <span className="db-tier t-master">Master</span> |
| **Input handling** — validation at the boundary, output encoding, the injection classes (SQL, command, template), unsafe deserialization, file uploads that are not what they claim | <span className="db-tier t-master">Master</span> |
| **Secrets management** — a vault or key-management service, envelope encryption, rotation without downtime, secrets never in environment dumps or logs; the key that lived in git history | <span className="db-tier t-master">Master</span> |
| **Encryption in transit and at rest** — TLS everywhere including inside the network, mutual TLS between services, disk and database encryption, field-level encryption for the sensitive columns, the key hierarchy | <span className="db-tier t-master">Master</span> |
| **Data protection and privacy engineering** — PII classification, minimisation, retention, pseudonymisation and tokenisation, deletion that must reach backups, replicas and search indexes | <span className="db-tier t-master">Master</span> |
| **PCI scope reduction** — never touching the card number: hosted fields, tokenisation by the payment provider, the network segment that stays out of scope; why "we store cards" is the wrong answer | <span className="db-tier t-master">Master</span> |
| **Multi-tenant isolation** — a tenant id on every row and every query, row-level security, per-tenant keys, the cross-tenant bug class and the test that catches it | <span className="db-tier t-master">Master</span> |
| **Single sign-on and enterprise identity** — federation, user provisioning, what business customers ask for before signing | <span className="db-tier t-understand">Understand</span> |
| **Passkeys and multi-factor** — WebAuthn, one-time codes, risk-based step-up; account recovery as the weakest link in every scheme | <span className="db-tier t-understand">Understand</span> |
| **Zero trust** — access by identity rather than network position, short-lived credentials, per-request authorization; what it changes in the network design of [Part 7](07-cloud-kubernetes-and-iac.md) | <span className="db-tier t-understand">Understand</span> |
| **DDoS, WAF and bot management** — volumetric absorption at the edge, application-layer rules, rate limits as security controls, the scraper that looked like a sale | <span className="db-tier t-understand">Understand</span> |
| **Supply chain security** — dependency scanning, lockfiles, signed artifacts, software bills of materials, pinned pipeline actions; Docker's [image quality phase](../../docker/pages/phase-5-image-quality/README.md) | <span className="db-tier t-understand">Understand</span> |
| **Compliance regimes as design inputs** — GDPR, India's data-protection law, PCI DSS, SOC 2; what each actually changes (consent, residency, scope, audit evidence) and what is merely paperwork | <span className="db-tier t-understand">Understand</span> |
| **Audit logging** — immutable, who did what to which record and when, separate from application logs, with its own retention; the trail that satisfied the regulator and the incident review | <span className="db-tier t-understand">Understand</span> |
| **Security in the pipeline** — static analysis, dependency and container scanning, secret detection, policy gates; shifting left without blocking delivery | <span className="db-tier t-understand">Understand</span> |
| **Session and cookie hygiene** — SameSite, HttpOnly, Secure, CSRF, CORS; how the React client handles tokens without leaking them | <span className="db-tier t-understand">Understand</span> |
| **Security incident response** — containment, credential rotation, forensics, disclosure obligations and timelines; the breach playbook written before the breach | <span className="db-tier t-understand">Understand</span> |
| **Abuse and fraud** — velocity checks, device signals, promo abuse, account-takeover indicators; the storefront's coupon abuse and the controls that stopped it | <span className="db-tier t-know">Know</span> |
| **Security reviews and penetration tests** — threat-model refreshes, external testing, bug bounties; what a senior does with the findings list | <span className="db-tier t-know">Know</span> |
| **Security of LLM features** — prompt injection, exfiltration through tools, output handling; detailed in [Part 10](10-ai-systems-design.md) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a threat model of the storefront's checkout on one page — the
data-flow diagram with trust boundaries, the top five threats with their controls, where the
card data goes, and the answer to "a signing key leaked at 3 a.m., what do you do".

---

← [Part 8 — Reliability and observability](08-reliability-and-observability.md) · [Index](../README.md) · Next → [Part 10 — AI systems design](10-ai-systems-design.md)
