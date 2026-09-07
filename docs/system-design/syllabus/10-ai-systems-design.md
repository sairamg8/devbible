---
title: "Part 10 — AI systems design"
sidebar_label: "10 · AI systems"
sidebar_position: 10
---

> Phase 18 · Putting a language model inside the stack without losing correctness, money or the customer's data

In 2026 a senior fullstack engineer is expected to ship an LLM-backed feature the same way
they ship a payment flow: designed, measured, guarded and costed. The interview version is
"design a support assistant" or "design semantic search"; the failure mode is treating the
model as a database. This phase is the architecture: where the model sits, how the request
flows, what retrieval feeds it, how you know it works, and what it costs per task. Every API
fact here follows the Claude API documentation (https://docs.claude.com) and the official
SDKs; the vector-search rows lean on the [PostgreSQL track](../../postgresql/README.md).

---

## Phase 18 — LLM applications in the stack

| Topic | Tier |
|---|---|
| **Where a model belongs in the storefront** — semantic search, a support assistant, review summaries, catalogue enrichment, extraction from supplier documents; and where it does not belong (pricing, inventory, anything that must be exact and auditable) | <span className="db-tier t-master">Master</span> |
| **The Messages API mental model** — one endpoint, a conversation of typed content blocks, system prompt vs messages, stop reasons, usage; the official SDKs for TypeScript/Node, Python and Java, never a compatibility shim | <span className="db-tier t-master">Master</span> |
| **Model choice by task** — the most capable model as the default, a mid-tier model for high-volume routes, the small model for classification-shaped work; quality, cost per million tokens, latency and context window measured on your traffic rather than assumed | <span className="db-tier t-master">Master</span> |
| **Streaming end to end** — token-by-token from the API, over server-sent events from Express, into a React component; abort, reconnection, and the request timeout you avoid by streaming ([Part 6](06-api-design-and-contracts.md)) | <span className="db-tier t-master">Master</span> |
| **Prompt design as engineering** — system prompts, instructions the model can actually follow, examples, prompt versions in source control, and the eval that tells you whether a change helped | <span className="db-tier t-master">Master</span> |
| **Prompt caching** — prefix-based: tools, then system, then messages; stable content first, breakpoints, cache-read tokens in usage as the proof; the silent invalidators (a timestamp in the system prompt, unsorted JSON, a changing tool list) | <span className="db-tier t-master">Master</span> |
| **Structured outputs and extraction** — schema-constrained responses, strict tool schemas, validation with the same schemas the rest of the stack uses; the JSON-in-prose parsing that used to break at 2 a.m. | <span className="db-tier t-master">Master</span> |
| **Tool use and the agent loop** — tools as typed functions, parallel tool calls answered in one message, the SDK's tool runner vs a hand-written loop, error results, stop conditions; the assistant that looks up an order and issues nothing | <span className="db-tier t-master">Master</span> |
| **When an agent is justified** — complexity, value, viability and cost of error as the four tests; single call, then workflow, then agent — an escalation, never a default | <span className="db-tier t-master">Master</span> |
| **Embeddings and vector search with pgvector** — embedding the catalogue, approximate-nearest-neighbour indexes and their trade-offs, distance metrics, hybrid search with full-text ranking, reranking, keeping vectors fresh when products change | <span className="db-tier t-master">Master</span> |
| **Retrieval-augmented generation** — chunking strategies, metadata filters, retrieval evaluated on a labelled set, citations back to sources; the answer that quoted last year's return policy | <span className="db-tier t-master">Master</span> |
| **Guardrails** — prompt injection through user content and tool results, PII in prompts and logs, output validation, refusal handling with fallbacks, allow-listed tools and scopes; the assistant that was talked into a refund | <span className="db-tier t-master">Master</span> |
| **Evals** — an eval set built from real transcripts, grading by exact match, rubric or model-as-judge, train/validation/test splits, hill-climbing a prompt against it; no prompt change ships without a measured delta | <span className="db-tier t-master">Master</span> |
| **Observability for LLM features** — tokens in and out, cost per task and per tenant, latency per stage, traces across retrieval and generation, capture with privacy limits ([Part 8](08-reliability-and-observability.md)) | <span className="db-tier t-master">Master</span> |
| **Cost design** — cost per completed task rather than per request; caching first, effort second, model choice third; budgets per feature; the feature that was cheap in the demo and ruinous at launch | <span className="db-tier t-master">Master</span> |
| **The AI feature's high-level design** — the storefront's support assistant end to end: retrieval, tools, streaming, guardrails, evals, cost; the whiteboard version in fifteen minutes | <span className="db-tier t-master">Master</span> |
| **Thinking and effort** — adaptive reasoning, the effort setting as the first cost lever, effort per route; why lower effort on a newer model often beats a cheaper model at full effort | <span className="db-tier t-understand">Understand</span> |
| **Managed agents, self-hosted loops and the Agent SDK** — who runs the loop and who hosts the sandbox, versioned agent configurations, scheduled runs; choosing by ownership and operational burden | <span className="db-tier t-understand">Understand</span> |
| **Model Context Protocol** — exposing tools and data to models through a standard connector, server and client responsibilities, securing the connection | <span className="db-tier t-understand">Understand</span> |
| **Context management** — context windows and their cost, server-side compaction, context editing, long documents through a files API; what to keep verbatim and what to summarise | <span className="db-tier t-understand">Understand</span> |
| **Rate limits, retries and fallbacks** — provider limits, backoff, timeouts for long generations, model fallbacks on refusal or overload, queueing non-urgent work | <span className="db-tier t-understand">Understand</span> |
| **Batch and offline pipelines** — nightly enrichment, summaries and classification through the batch endpoint at reduced cost; idempotent batch jobs keyed by record | <span className="db-tier t-understand">Understand</span> |
| **Caching responses and semantic caching** — exact-match caches, similarity caches over embeddings, invalidation when the prompt or the underlying data changes | <span className="db-tier t-understand">Understand</span> |
| **Fine-tuning vs prompting vs retrieval** — the decision order, when a retrieval fix beats a model change, what fine-tuning cannot fix | <span className="db-tier t-understand">Understand</span> |
| **Data privacy and retention** — what leaves your boundary, retention options, regional inference, consent; the data-protection duties from [Part 9](09-security-and-compliance.md) applied to prompts | <span className="db-tier t-understand">Understand</span> |
| **Multi-tenancy and quotas** — per-tenant budgets, isolated retrieval indexes, the noisy tenant that consumed the shared rate limit | <span className="db-tier t-understand">Understand</span> |
| **The interview questions** — "design semantic search", "design a document-processing pipeline", "design a support bot"; the rubric interviewers hold and the mistake of designing the model instead of the system around it | <span className="db-tier t-understand">Understand</span> |
| **Cloud-provider access** — the same models through the major clouds and what differs: features, regions, billing | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's support assistant designed on one page — retrieval
over orders and policies, two tools with their authorization, streaming to React, the
guardrails, an eval set of twenty transcripts with a grading rule, and the cost per resolved
conversation with the arithmetic shown.

---

{/* NAV */}
