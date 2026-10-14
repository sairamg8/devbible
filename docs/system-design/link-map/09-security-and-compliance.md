---
title: "Link map · System design · Part 9 (phase 17)"
sidebar_label: "09 · security & compliance"
sidebar_position: 9
---

# Link map · System design · Part 9 (phase 17)

Covers every topic row of phase 17 in `docs/system-design/syllabus/09-security-and-compliance.md`: threat modelling through security of LLM features (T17-01 to T17-25). That is 25 rows. One has a written page of ours (DDoS, WAF and bot management, covered by the phase 2 abuse-at-the-edge chunks); `docs/system-design/pages` holds phases 0 to 3 only, so the rest are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title, table of contents or abstract checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means standards, specifications, regulator and vendor documentation and the OWASP projects; blogs and training sites count as beyond the docs.

---

## Phase 17 — Security and compliance at scale

### T17-01 · Threat modelling — Master · 🔲 not written
- **Read this:** [Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html) · OWASP · asks for a clear view of trust boundaries, data flows, data stores, processes and external entities, poses the manifesto's four questions, and says traditional techniques often need adaptation for cloud architectures, naming multi-tenancy and identity federation (*read*) · covers our angle: **partial** — method and caveats, no twenty-minute whiteboard drill · fetched 2026-10-14
- **Also good:** [Threats - Microsoft Threat Modeling Tool](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) · Microsoft Learn · the STRIDE table: spoofing, tampering and the other categories with a definition each (*read*) · covers our angle: **partial** — the category list, not per-boundary application · fetched 2026-10-14
- **Beyond the docs:** [The Ultimate Beginner's Guide to Threat Modeling](https://shostack.org/resources/threat-modeling) · Shostack + Associates · frames the whole activity as four questions (what are we working on, what can go wrong, what are we going to do about it, did we do a good job), which fits a whiteboard slot (*read*) · fetched 2026-10-14
- **Our delta:** the twenty-minute version on the storefront's checkout: one diagram, trust boundaries drawn first, STRIDE asked once per boundary, five threats kept.

### T17-02 · Authentication at scale — Master · 🔲 not written
- **Read this:** [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) · OWASP · the session ID must be renewed after any privilege level change; idle timeouts of 2 to 5 minutes for high-value applications and 15 to 30 for low-risk ones; HttpOnly is mandatory against theft through XSS, and session IDs, JWTs and refresh tokens must not go in browser storage (*read*) · covers our angle: **partial** — server-side sessions in depth, not refresh rotation or mobile storage · fetched 2026-10-14
- **Also good:** [RFC 9700 Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/html/rfc9700) · IETF · refresh tokens for public clients must be sender-constrained or use refresh token rotation (*read*) · covers our angle: **partial** — the rotation rule, not reuse-detection UX or logout everywhere · fetched 2026-10-14
- **Beyond the docs:** [Stop using JWTs](https://gist.github.com/samsch/0d1f3d3b4745d778f78b230cf6061452) · samsch gist (a long-lived opinion piece) · argues that truly stateless authentication needs extra servers for issuance, renewal and revocation, so "stateless is better" does not hold up (*read*) · fetched 2026-10-14
- **Our delta:** sessions versus tokens restated as design decisions: where revocation state lives, rotation with reuse detection, one device session per row so logout-everywhere is a query.

### T17-03 · OAuth2 and OpenID Connect — Master · 🔲 not written
- **Read this:** [RFC 9700 Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/html/rfc9700) · IETF · the implicit grant and other response types that issue access tokens in the authorization response are vulnerable to token leakage and replay; the resource owner password credentials grant MUST NOT be used; redirect URIs MUST be compared by exact string matching (*read*) · covers our angle: **full** — the flows to avoid, with the attacks behind each · fetched 2026-10-14
- **Also good:** [RFC 7636 Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636) · IETF · the abstract defines the authorization code interception attack on public clients and PKCE as the mitigation (*read*) · fetched 2026-10-14
- **Also good:** [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) · OpenID Foundation · the ID Token is a security token carrying claims about the authentication of an end-user, represented as a JWT (*read*) · covers our angle: **partial** — ID token versus access token is implied, not argued · fetched 2026-10-14
- **Beyond the docs:** [OAuth 2.0 Simplified](https://www.oauth.com/) · Aaron Parecki · a book-length guide with chapters for server-side, single-page and mobile apps, redirect URLs, PKCE, token introspection and OpenID Connect (*headings only*) · fetched 2026-10-14
- **Our delta:** the mistakes that survive code review (ID token sent to an API, missing state or PKCE, wildcard redirect URIs) as a checklist for the storefront's three clients.

### T17-04 · Authorization models — Master · 🔲 not written
- **Read this:** [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) · OWASP · defines RBAC, ABAC and ReBAC, notes the choice has consequences for the whole lifecycle and should be made early, and recommends preferring attribute and relationship based control over RBAC (*read*) · covers our angle: **partial** — the models, not central policy versus per-service · fetched 2026-10-14
- **Also good:** [Zanzibar: Google's Consistent, Global Authorization System](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/) · Google, USENIX ATC 2019 · the abstract: a global system for storing and evaluating access control lists (*read*) · fetched 2026-10-14
- **Also good:** [NIST SP 800-162 Guide to ABAC](https://csrc.nist.gov/pubs/sp/800/162/upd2/final) · NIST · ABAC decides by evaluating attributes of subject, object, operation and environment against policy (*read*) · fetched 2026-10-14
- **Our delta:** customer, seller and admin in the storefront as the worked case, plus the central-policy versus per-service-check trade-off.

### T17-05 · Object-level and function-level authorization — Master · 🔲 not written
- **Read this:** [API1:2023 Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) · OWASP API Security Top 10 · attackers manipulate an object ID in the request; it can be an integer, UUID or string and appears in path, query, headers or body (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [API5:2023 Broken Function Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/) · OWASP · test questions such as whether a regular user can reach administrative endpoints or switch a GET to a DELETE (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Insecure direct object references (IDOR)](https://portswigger.net/web-security/access-control/idor) · PortSwigger Web Security Academy · defines IDOR as an access control flaw where user-supplied input is used to access objects directly, with the customer_number-in-the-URL example (*read*) · fetched 2026-10-14
- **Our delta:** the IDOR that leaked every order, ownership checked in the query rather than after it, deny by default as a code-review rule.

### T17-06 · API security as a checklist — Master · 🔲 not written
- **Read this:** [OWASP Top 10 API Security Risks 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/) · OWASP · the ten: object-level, authentication, object-property-level (mass assignment), unrestricted resource consumption, function-level, sensitive business flows, server-side request forgery, misconfiguration, inventory, unsafe consumption of APIs (*read*) · covers our angle: **full** on the list · fetched 2026-10-14
- **Also good:** [Server Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) · OWASP · two cases: calls only to identified trusted applications, where an allowlist works, and calls to any external address, where it does not and a denylist covering metadata, localhost, private and link-local ranges is the fallback; network segregation recommended in both (*read*) · fetched 2026-10-14
- **Our delta:** each risk applied to a named storefront endpoint, so the checklist is a table of endpoints rather than a list of categories.

### T17-07 · Input handling — Master · 🔲 not written
- **Read this:** [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) · OWASP · define what the application accepts and reject the rest rather than recognising malicious strings; validation is not the defence against SQL injection or XSS, which need parameterized queries and context-aware output encoding (*read*) · covers our angle: **partial** — validation, and points elsewhere for output encoding · fetched 2026-10-14
- **Also good:** [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · OWASP · primary defences are prepared statements, properly constructed stored procedures and allow-list validation; escaping all user input is listed as strongly discouraged (*read*) · fetched 2026-10-14
- **Also good:** [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) · OWASP · the Content-Type header is user-supplied and trivial to spoof, a file-signature check should not be used on its own, and files belong on a different host or outside the webroot (*read*) · fetched 2026-10-14
- **Also good:** [Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html) · OWASP · avoiding native serialization formats in favour of pure data formats such as JSON is the big risk reduction; otherwise refuse any message without an authenticated signature (*read*) · fetched 2026-10-14
- **Beyond the docs:** [What is SQL Injection?](https://portswigger.net/web-security/sql-injection) · PortSwigger Web Security Academy · exploitation walk-through with labs; prevention is parameterized queries, which do not cover table names, column names or ORDER BY, so those need allowlisting (*read*) · fetched 2026-10-14
- **Our delta:** one boundary where validation lives, plus encoding at each output context and uploads treated as hostile until sniffed.

### T17-08 · Secrets management — Master · 🔲 not written
- **Read this:** [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) · OWASP · covers centralising secrets, automated rotation, auditing and the secret lifecycle; says user credentials are excluded from regular rotation and rotated only on suspected compromise; for secrets found in code it says revoke or rotate first and warns that squashing commits rewrites git history (*read*) · covers our angle: **partial** — rotation, detection and removal, not the overlapping-version rotation that avoids downtime · fetched 2026-10-14
- **Also good:** [AWS KMS keys](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html) · AWS · customer data keys are returned encrypted under a KMS key, in plaintext, or both, which is the envelope pattern (*read*) · covers our angle: **partial** — one vendor's key model · fetched 2026-10-14
- **Our delta:** rotation without downtime (two valid versions overlap), nothing in environment dumps or logs, and the git-history key as a revoke-first incident.

### T17-09 · Encryption in transit and at rest — Master · 🔲 not written
- **Read this:** [Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html) · OWASP · applications must default to TLS 1.3, may support TLS 1.2, and must disable TLS 1.0 and 1.1 (*read*) · covers our angle: **partial** — transit only · fetched 2026-10-14
- **Also good:** [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) · OWASP · AES with an authenticated mode, GCM or CCM first; a data encryption key wrapped by a key encryption key stored separately, and keys kept apart from the encrypted data (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Illustrated TLS 1.3 Connection](https://tls13.xargs.org/) · xargs.org · a byte-by-byte capture of a client negotiating TLS 1.3, sending "ping" and receiving "pong" (*read*) · fetched 2026-10-14
- **Our delta:** TLS inside the network, mutual TLS, disk then database then field-level encryption, and the key hierarchy above them; transit is partly covered in the phase 2 TLS and mesh pages.

### T17-10 · Data protection and privacy engineering — Master · 🔲 not written
- **Read this:** [Art. 5 GDPR Principles relating to processing](https://gdpr-info.eu/art-5-gdpr/) · GDPR text · storage limitation and integrity and confidentiality as principles (*read*) · covers our angle: **partial** — principles, not engineering · fetched 2026-10-14
- **Also good:** [Art. 17 GDPR Right to erasure](https://gdpr-info.eu/art-17-gdpr/) · GDPR text · the controller must erase personal data without undue delay when a listed ground applies (*read*) · fetched 2026-10-14
- **Also good:** [Pseudonymisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/pseudonymisation/) · UK ICO · pseudonymised data is still personal data in the hands of whoever holds the additional information; the page is flagged as under review after the Data (Use and Access) Act (*read*) · fetched 2026-10-14
- **Our delta:** PII classification as a column tag, retention as a job, and deletion that reaches backups, replicas and search indexes.

### T17-11 · PCI scope reduction — Master · 🔲 not written
- **Read this:** [Integration security guide](https://docs.stripe.com/security/guide) · Stripe docs · defines PCI DSS as the standard for all entities that store, process or transmit cardholder data, says handling card data directly can mean more than 300 controls, and that card type, last four digits and expiry are out of scope and storable (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Stripe Web Elements](https://docs.stripe.com/payments/elements) · Stripe docs · Stripe.js tokenizes sensitive payment details inside an Element without them touching your server (*read*) · fetched 2026-10-14
- **Also good:** [What is PCI DSS compliance?](https://stripe.com/guides/pci-compliance) · Stripe · Checkout and Elements host the card inputs in an iframe on Stripe's domain and qualify for SAQ A; a self-hosted form posting through Stripe.js v2 needs SAQ A-EP; sending card data to the API directly needs SAQ D (*read*) · fetched 2026-10-14
- **Our delta:** why "we store cards" is the wrong answer, and the network segment that stays out of scope.

### T17-12 · Multi-tenant isolation — Master · 🔲 not written
- **Read this:** [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) · PostgreSQL docs · enable row level security on a table and attach policies with a USING clause; the implied WITH CHECK applies to writes (*read*) · covers our angle: **partial** — the mechanism, not the tenant model · fetched 2026-10-14
- **Also good:** [Tenant isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html) · AWS whitepaper · a user can be authenticated and authorized and still reach another tenant's resources, so isolation is applied separately from authentication and authorization; AWS flags the whitepaper as historical reference only (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Row Level Security for Tenants in Postgres](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) · Craig Kerstiens, Crunchy Data, 3 Apr 2024 · two policies: the org id column compared to the connected database user, then to a session variable set per request (*read*) · fetched 2026-10-14
- **Our delta:** tenant id on every row and query, per-tenant keys, and the cross-tenant test that fails the build.

### T17-13 · Single sign-on and enterprise identity — Understand · 🔲 not written
- **Read this:** [RFC 7644 SCIM protocol](https://www.rfc-editor.org/info/rfc7644/) · IETF · SCIM is an HTTP-based protocol for managing identities across domains (*read*) · covers our angle: **partial** — provisioning only · fetched 2026-10-14
- **Beyond the docs:** [The developer's guide to SSO](https://workos.com/guide/the-developers-guide-to-sso) · WorkOS · notes SAML is not the only SSO protocol, with OAuth and OpenID Connect alongside (*read*) · vendor guide · fetched 2026-10-14
- **Our delta:** what business customers ask for before signing: SAML or OIDC, SCIM, domain capture.

### T17-14 · Passkeys and multi-factor — Understand · 🔲 not written
- **Read this:** [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) · NIST · AAL3 requires a cryptographic authenticator with a non-exportable private key that provides phishing resistance, and two distinct factors, so syncable authenticators are barred there; verifiers must offer at least one phishing-resistant option at AAL2 (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/) · W3C · W3C Recommendation of 25 August 2026; strong, attested, public key credentials, each scoped to one relying party (*read*) · fetched 2026-10-14
- **Also good:** [Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) · OWASP · the same response for existing and non-existent accounts, reset tokens random, single use and expiring, and no automatic login after the reset (*read*) · fetched 2026-10-14
- **Beyond the docs:** [What are passkeys?](https://passkeys.dev/docs/intro/what-are-passkeys/) · passkeys.dev · a passkey replaces a password, the browser and OS only use it for the service it belongs to, and sync providers never see the private keys (*read*) · fetched 2026-10-14
- **Our delta:** account recovery as the weakest link of every scheme, and risk-based step-up.

### T17-15 · Zero trust — Understand · 🔲 not written
- **Read this:** [NIST SP 800-207 Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) · NIST, August 2020 · the abstract: defenses move from static network perimeters to users, assets and resources, and no implicit trust is granted based on physical or network location (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [BeyondProd](https://docs.cloud.google.com/docs/security/beyondprod) · Google Cloud · only authenticated, trusted and specifically authorized services can call another service, and service identities are constrained to authorized code and configuration (*read*) · fetched 2026-10-14
- **Also good:** [BeyondCorp: A New Approach to Enterprise Security](https://research.google/pubs/beyondcorp-a-new-approach-to-enterprise-security/) · Ward and Beyer, ;login: 2014 · the abstract: once the perimeter is breached the intranet is open, so Google removes the privileged intranet and moves corporate applications to the Internet (*read*) · fetched 2026-10-14
- **Our delta:** what it changes in the network design of Part 7; the mesh workload identity in the phase 2 chunks is the nearest page.

### T17-16 · DDoS, WAF and bot management — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/18-abuse-at-the-edge.md`
- **Read this:** [AWS Best Practices for DDoS Resiliency](https://docs.aws.amazon.com/whitepapers/latest/aws-best-practices-ddos-resiliency/aws-best-practices-ddos-resiliency.html) · AWS whitepaper, publication date August 2026 · a DDoS-resilient reference architecture, with infrastructure-layer and application-layer attacks treated separately and the best practice for each (*read*) · covers our angle: **partial** — one vendor's tools · fetched 2026-10-14
- **Also good:** [OWASP Automated Threats to Web Applications](https://owasp.org/projects/automated-threats-to-web-applications) · OWASP · covers unwanted automated usage of web applications, defined in the Automated Threat Handbook as named threat events such as OAT-008 Credential Stuffing and OAT-005 Scalping (*read*) · fetched 2026-10-14
- **Our delta:** layers that each subtract a class of traffic, WAF rules starting in log-only mode, and the bot ladder; the chunks 18b to 18e extend it.

### T17-17 · Supply chain security — Understand · 🔲 not written
- **Read this:** [About SLSA](https://slsa.dev/spec/v1.2/about) · SLSA v1.2 · incrementally adoptable supply-chain guidelines organised as tracks with ascending levels; the Build Track runs Levels 1 to 3 (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [NPM Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html) · OWASP · enforce the lockfile, ignore run-scripts, audit dependencies (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Timeline of the xz open source attack](https://research.swtch.com/xz-timeline) · Russ Cox, 1 Apr 2024 · an attacker named Jia Tan spent over two years acting as a diligent maintainer before the backdoor (*read*) · fetched 2026-10-14
- **Our delta:** lockfiles, signed artifacts, SBOMs and pinned pipeline actions, linked to Docker's image-quality phase.

### T17-18 · Compliance regimes as design inputs — Understand · 🔲 not written
- **Read this:** [Digital Personal Data Protection Act, 2023 (gazette text)](https://www.trai.gov.in/sites/default/files/2024-09/DPDT_11082024.pdf) · Government of India gazette, mirrored by TRAI · the Act (No. 22 of 2023) on processing digital personal data, with consent and a Consent Manager (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Art. 5 GDPR](https://gdpr-info.eu/art-5-gdpr/) · GDPR text · the processing principles (*read*) · fetched 2026-10-14
- **Also good:** [SOC Suite of Services](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services) · AICPA and CIMA · landing page for SOC reports, which give user entities what they need to assess the risks of outsourcing; SOC 2 appears as the examination relevant to security, availability, processing integrity, confidentiality or privacy (*read*) · fetched 2026-10-14
- **Also good:** [PCI Security Standards Council document library](https://www.pcisecuritystandards.org/document_library/) · PCI SSC · featured documents list PCI DSS v4.0.1 and its summary of changes from v4.0 (*read*) · fetched 2026-10-14
- **Our delta:** what each regime changes (consent, residency, scope, audit evidence) and what is merely paperwork.

### T17-19 · Audit logging — Understand · 🔲 not written
- **Read this:** [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) · OWASP · advises a separate partition for file logs, built-in tamper detection and copying to read-only media, and keeping passwords and raw session IDs out (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [NIST SP 800-92 Guide to Computer Security Log Management](https://csrc.nist.gov/pubs/sp/800/92/final) · NIST, September 2006 · log management guide (*read*) · fetched 2026-10-14
- **Our delta:** immutable, who did what to which record, kept apart from application logs with its own retention.

### T17-20 · Security in the pipeline — Understand · 🔲 not written
- **Read this:** [CI CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html) · OWASP · secrets never hardcoded in repositories or pipeline configuration and never printed to the console or logs; pipeline identities get only the minimum permissions; pinned dependency versions checked against a known hash (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Code scanning](https://docs.github.com/en/code-security/concepts/code-scanning/code-scanning) · GitHub Docs · code scanning analyses a repository for vulnerabilities and coding errors, CodeQL is GitHub's engine for it, and findings appear as alerts that close when the code is fixed (*read*) · fetched 2026-10-14
- **Our delta:** policy gates that shift left without blocking delivery.

### T17-21 · Session and cookie hygiene — Understand · 🔲 not written
- **Read this:** [Set-Cookie header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) · MDN · syntax of SameSite=Strict, Lax and None (with Secure), plus Secure and HttpOnly (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · OWASP · SameSite is defence in depth and does not replace a CSRF defence; synchronizer token for stateful apps, signed double-submit cookie otherwise, and a custom request header for API endpoints because it forces a preflight (*read*) · fetched 2026-10-14
- **Also good:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · a credentialed request must not be answered with the wildcard Access-Control-Allow-Origin, only an explicit origin (*read*) · fetched 2026-10-14
- **Beyond the docs:** [SameSite cookies explained](https://web.dev/articles/samesite-cookies-explained) · web.dev · Rowan Merewood, updated 7 May 2019 · a cookie without SameSite is treated as Lax, and SameSite=None must also be Secure (*read*) · fetched 2026-10-14
- **Our delta:** how the React client holds tokens without leaking them.

### T17-22 · Security incident response — Understand · 🔲 not written
- **Read this:** [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) · NIST, April 2025 · supersedes Rev. 2 and recasts incident response against the CSF 2.0 (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Art. 33 GDPR Notification of a personal data breach](https://gdpr-info.eu/art-33-gdpr/) · GDPR text · notification to the authority within 72 hours, with reasons if late (*read*) · fetched 2026-10-14
- **Also good:** [CERT-In Directions of 28 April 2022](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf) · CERT-In, India · incidents reported to CERT-In within 6 hours of noticing (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Security Incident Response](https://response.pagerduty.com/during/security_incident_response/) · PagerDuty incident response docs · stop the attack, cut off the vector, isolate instances, image disks to read-only storage before shutting down rather than deleting, revoke compromised credentials, with a mandatory incident commander (*read*) · fetched 2026-10-14
- **Our delta:** the playbook written before the breach, starting with the 3 a.m. signing-key leak.

### T17-23 · Abuse and fraud — Know · 🔲 not written
- **Read this:** [OWASP Automated Threats to Web Applications](https://owasp.org/projects/automated-threats-to-web-applications) · OWASP · unwanted automated usage named as threat events in the Automated Threat Handbook, such as OAT-008 Credential Stuffing and OAT-005 Scalping (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Radar](https://docs.stripe.com/radar) · Stripe docs · real-time risk evaluation of transactions, accounts and customers; customer abuse prevention covers multi-accounting, free-trial abuse, bots and account farming; rules allow, block, review or request 3DS (*read*) · fetched 2026-10-14
- **Our delta:** velocity checks, device signals, the coupon abuse and the controls that stopped it; phase 2 chunk 18d covers business-logic abuse but not promo or fraud scoring.

### T17-24 · Security reviews and penetration tests — Know · 🔲 not written
- **Read this:** [OWASP Web Security Testing Guide](https://owasp.org/projects/web-security-testing-guide) · OWASP · the project describes itself as the premier cybersecurity testing resource for web application developers and security professionals (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [disclose.io](https://disclose.io/) · disclose.io · standards and tools for vulnerability disclosure and security reporting (*read*) · fetched 2026-10-14
- **Our delta:** what a senior does with the findings list: triage, owners, threat-model refresh.

### T17-25 · Security of LLM features — Know · 🔲 not written
- **Read this:** [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) · OWASP GenAI Security Project · the 2025 list, including LLM01 prompt injection, LLM02 sensitive information disclosure, LLM05 improper output handling, LLM06 excessive agency and LLM10 unbounded consumption (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) · Simon Willison, 16 Jun 2025 · private data, untrusted content and external communication together are the dangerous combination for tool-using agents (*read*) · fetched 2026-10-14
- **Our delta:** deferred to Part 10; here only the pointer and the exfiltration-through-tools framing.
