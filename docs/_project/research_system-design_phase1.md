---
name: research-system-design-phase1
description: Banked primary-source quotes for docs/system-design/pages/phase-1-the-method/ (18 pages) — RFC 9110 safe/idempotent methods (verbatim), adr.github.io definitions (verbatim), the C4 model's four abstractions and diagrams (summarised by the fetch, NOT verbatim). The SRE book SLO/availability quotes are in research_system-design_phase0.md. Fetched once on 2026-09-07 by session 9602e64d. Do not re-derive.
metadata:
  type: reference
---

# Research bank — System Design phase 1 (fetched 2026-09-07, session `9602e64d`)

**Do not re-fetch.** Estimation, traffic shapes, time management and the deep-dive choice are
**method** — no primary source exists; write them as method and say so on the `> Verified:` line.
The SRE book quotes (SLI/SLO/SLA, availability formulas, the cost curve) are in
[research_system-design_phase0.md](research_system-design_phase0.md) — reuse them for the
non-functional-requirements page.

## RFC 9110 — HTTP Semantics (verbatim, with section numbers)
URL: https://www.rfc-editor.org/rfc/rfc9110.html
- §9.2.1 Safe Methods: *"A request method is considered 'safe' if its defined semantics are essentially read-only"* · *"GET, HEAD, OPTIONS, and TRACE are defined as safe methods"*
- §9.2.2 Idempotent Methods: *"A request method is idempotent if the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request"* · *"PUT, DELETE, and the safe methods are idempotent"* · *"Clients may be able to automatically retry requests with idempotent methods following a connection failure, since the intended effect should be equivalent"*
- ⚠️ POST is therefore neither safe nor idempotent by definition — an idempotency key is the application-level mechanism, not an HTTP one. Do not claim RFC 9110 defines idempotency keys (it does not; the IETF draft `draft-ietf-httpapi-idempotency-key-header` is separate and was **not fetched**).

## adr.github.io — Architectural Decision Records (verbatim)
URL: https://adr.github.io/
- AD: *"A justified design choice that addresses a functional or non-functional requirement that is architecturally significant."*
- ADR: *"Captures a single AD and its rationale; Put it simply, ADR can help you understand the reasons for a chosen architectural decision, along with its trade-offs and consequences."*
- The collection of ADRs in a project is its **decision log** (paraphrase of the site's wording; the fetch did not return the exact sentence).

## c4model.com — the C4 model (⚠️ SUMMARISED by the fetch, not verbatim — quote nothing from this block)
URL: https://c4model.com/
- Four abstractions: **software system** (the top-level unit), **container** (a separately runnable/deployable unit — the site's own phrase is "applications and data stores"), **component** (a grouping of related functionality behind an interface), **code** (classes, functions).
- Four core diagrams: **System Context** (the system, its users and the other systems it touches), **Container**, **Component**, **Code**.
- The model is described as a hierarchical set of abstractions and diagrams that zoom in progressively, like maps at different scales; the site calls itself "an easy to learn, developer friendly approach to software architecture diagramming" (that phrase was returned as a quote by the fetch).
- Write about C4 in prose from this summary; attribute the one quoted phrase only.

## Not fetched / not available
- Any "estimation cheat sheet" — none is primary; the arithmetic is the source.
- Google design-doc practice — secondary blogs only; describe design docs as a common shape (context, goals, non-goals, options, decision, risks) without attributing it to a company.
