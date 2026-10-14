---
title: "Link map · System design · Part 10 (phase 18)"
sidebar_label: "10 · AI systems"
sidebar_position: 10
---

# Link map · System design · Part 10 (phase 18)

Covers every topic row of phase 18 in `docs/system-design/syllabus/10-ai-systems-design.md`: where a model belongs in the storefront through cloud-provider access (T18-01 to T18-28). That is 28 rows, none with a written page of ours (`docs/system-design/pages` holds phases 0 to 3 only), so every row is marked not written and its delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title, table of contents or abstract checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means the Claude Platform documentation, Anthropic engineering posts, cloud-provider docs, project docs and papers; blogs count as beyond the docs. The Claude documentation moves quickly (it lists the 5.x model family on the day it was fetched), so every Claude link carries the 2026-10-14 fetch date and model names are not repeated in the rows except where the page said them.

---

## Phase 18 — LLM applications in the stack

### T18-01 · Where a model belongs in the storefront — Master · 🔲 not written
- **Read this:** [Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents) · Anthropic · recommends finding the simplest solution possible and only adding complexity when needed, because agentic systems trade latency and cost for task performance (*read*) · covers our angle: **partial** — a when-to-use argument, not the exact-and-auditable boundary (pricing, inventory) · fetched 2026-10-14
- **Beyond the docs:** [Patterns for Building LLM-based Systems and Products](https://eugeneyan.com/writing/llm-patterns/) · Eugene Yan · opens on the gap between demos that are easy to imagine and products that are hard to make, then lists evals, RAG, fine-tuning, caching, guardrails, defensive UX and user feedback (*read*) · fetched 2026-10-14
- **Our delta:** a per-feature table for the storefront (search, assistant, review summaries, catalogue enrichment, supplier extraction) with the "must be exact" list held out of the model's reach.

### T18-02 · The Messages API mental model — Master · 🔲 not written
- **Read this:** [Messages API reference](https://platform.claude.com/docs/en/api/messages) · Claude Platform docs · Create a Message is POST /v1/messages: a structured list of input messages with text or image content, and the model generates the next message in the conversation (*read*) · covers our angle: **partial** — the endpoint and schema, not the design framing · fetched 2026-10-14
- **Also good:** [SDKs, CLI, and libraries](https://platform.claude.com/docs/en/cli-sdks-libraries/overview) · Claude Platform docs · official client SDKs in seven languages, including Python, TypeScript and Java, and the page also lists an OpenAI SDK compatibility entry that our row says to avoid (*read*) · fetched 2026-10-14
- **Our delta:** one endpoint, typed content blocks, system prompt versus messages, stop reasons and usage as the four things to draw on a whiteboard.

### T18-03 · Model choice by task — Master · 🔲 not written
- **Read this:** [Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) · Claude Platform docs · choosing a model means balancing capabilities, speed and cost, with a way to pick a starting model and test the choice (*read*) · covers our angle: **full** on the method · fetched 2026-10-14
- **Also good:** [Models overview](https://platform.claude.com/docs/en/models/overview) · Claude Platform docs · the comparison table, which describes the smallest model as for high-volume, latency-sensitive tasks such as classification, extraction and routing (*read*) · fetched 2026-10-14
- **Our delta:** the three tiers mapped to storefront routes, with quality, cost and latency measured on your own traffic.

### T18-04 · Streaming end to end — Master · 🔲 not written
- **Read this:** [Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming) · Claude Platform docs · set stream to true to receive the response incrementally as server-sent events, and the SDKs wrap it (*read*) · covers our angle: **partial** — the API half only · fetched 2026-10-14
- **Also good:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · the browser side: an EventSource instance opened on a URL that generates events (*read*) · covers our angle: **partial** — no abort or reconnect design · fetched 2026-10-14
- **Our delta:** the full chain API to Express to React, with abort, reconnection and the timeout streaming avoids.

### T18-05 · Prompt design as engineering — Master · 🔲 not written
- **Read this:** [Prompt engineering overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview) · Claude Platform docs · before prompt engineering have a clear definition of success criteria, a way to test against them empirically and a first draft (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Define success criteria and build evaluations](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) · Claude Platform docs · good criteria are specific and measurable, with the loop of evaluating before shipping a polished prompt (*read*) · fetched 2026-10-14
- **Also good:** [Prompt engineering guide](https://developers.openai.com/api/docs/guides/prompt-engineering) · OpenAI docs · another vendor's guidance on instructions and examples (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Prompting Fundamentals and How to Apply them Effectively](https://eugeneyan.com/writing/prompting/) · Eugene Yan, May 2024 · fundamentals beyond "think step by step", and a reminder that evals come before major prompt engineering (*read*) · fetched 2026-10-14
- **Our delta:** prompts as versioned source with an eval that gates every change.

### T18-06 · Prompt caching — Master · 🔲 not written
- **Read this:** [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) · Claude Platform docs · caching resumes from prompt prefixes; the cache follows the hierarchy tools, then system, then messages, and a change at one level invalidates that level and all later ones; usage reports cache_read_input_tokens; the troubleshooting notes name a timestamp in the cached block and unstable JSON key order (some languages randomise it) as cache breakers (*read*) · covers our angle: **full** — mechanics and most of our invalidators list · fetched 2026-10-14
- **Our delta:** the timestamp-in-system-prompt, unsorted-JSON and changing-tool-list invalidators, with cache-read tokens as the proof.

### T18-07 · Structured outputs and extraction — Master · 🔲 not written
- **Read this:** [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · Claude Platform docs · without structured outputs the model can emit malformed JSON or invalid tool inputs; JSON outputs and strict tool use (strict true) guarantee schema validation (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the same schema library validating the model's output as validates the rest of the stack.

### T18-08 · Tool use and the agent loop — Master · 🔲 not written
- **Read this:** [Tool use with Claude](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) · Claude Platform docs · for client tools the model answers with stop_reason tool_use and tool_use blocks, your code runs the operation and returns a tool_result; server tools run on Anthropic's infrastructure (*read*) · covers our angle: **partial** — loop mechanics, not authorization per tool · fetched 2026-10-14
- **Also good:** [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) · Anthropic engineering, 11 Sep 2025 · how to write high-quality tools and evaluations for them (*read*) · fetched 2026-10-14
- **Our delta:** the order-lookup assistant that issues nothing: two tools, each with its own authorization check, and error results as part of the loop.

### T18-09 · When an agent is justified — Master · 🔲 not written
- **Read this:** [Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents) · Anthropic · draws the line between workflows (predefined code paths) and agents (the model directs its own process and tool use) (*read*) · covers our angle: **partial** — no four-test rubric · fetched 2026-10-14
- **Beyond the docs:** [Agents](https://huyenchip.com/2025/01/07/agents.html) · Chip Huyen, 7 Jan 2025 · compound mistakes: at 95% accuracy per step, ten steps fall to about 60%, which is the cost-of-error argument in numbers (*read*) · fetched 2026-10-14
- **Our delta:** complexity, value, viability and cost of error as four tests; single call, then workflow, then agent.

### T18-10 · Embeddings and vector search with pgvector — Master · 🔲 not written
- **Read this:** [pgvector README](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md) · pgvector project · HNSW builds a multilayer graph with better speed-recall than IVFFlat but slower builds and more memory; supports inner product, cosine and L1 distance; hybrid search pairs it with Postgres full-text ranking (*read*) · covers our angle: **partial** — the extension, not reranking or freshness · fetched 2026-10-14
- **Also good:** [Embeddings](https://platform.claude.com/docs/en/build-with-claude/embeddings) · Claude Platform docs · says the guide uses Voyage AI as the example provider and tells you to assess several embeddings vendors (*read*) · fetched 2026-10-14
- **Also good:** [Text Search](https://www.postgresql.org/docs/current/textsearch.html) · PostgreSQL docs · includes ranking search results (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search) · Supabase docs · a SQL function runs full-text and semantic search as two CTEs and merges them with reciprocal rank fusion (*read*) · fetched 2026-10-14
- **Our delta:** embedding the catalogue, index trade-offs, hybrid plus rerank, and re-embedding when a product changes.

### T18-11 · Retrieval-augmented generation — Master · 🔲 not written
- **Read this:** [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) · Anthropic · describes the usual pipeline: split the corpus into chunks of at most a few hundred tokens, embed them, store them in a vector database, and retrieve by similarity at query time (*read*) · covers our angle: **partial** — retrieval quality, not metadata filters or citations · fetched 2026-10-14
- **Also good:** [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) · Lewis et al., arXiv 2020 · the paper that names RAG; the abstract motivates it by models' limited ability to access and precisely manipulate knowledge (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Systematically Improving Your RAG](https://jxnl.co/writing/2024/05/22/systematically-improving-your-rag/) · Jason Liu, 22 May 2024 · synthetic-data retrieval evals, metadata, full-text plus vector search in one database, user feedback and monitoring (*read*) · fetched 2026-10-14
- **Our delta:** chunking, filters, a labelled retrieval set, citations, and the answer that quoted last year's return policy.

### T18-12 · Guardrails — Master · 🔲 not written
- **Read this:** [Mitigate jailbreaks and prompt injections](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) · Claude Platform docs · separates direct injection (the user is the adversary) from indirect injection through third-party content such as documents and tool results, with input screens and hardened system prompts as mitigations (*read*) · covers our angle: **partial** — no PII or tool-scope design · fetched 2026-10-14
- **Also good:** [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) · OWASP · lists prompt injection (LLM01) and sensitive information disclosure (LLM02) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) · Simon Willison, 16 Jun 2025 · private data, untrusted content and external communication combined in one agent is the exfiltration setup (*read*) · fetched 2026-10-14
- **Our delta:** allow-listed tools and scopes, PII kept out of prompts and logs, and the assistant that was talked into a refund.

### T18-13 · Evals — Master · 🔲 not written
- **Read this:** [Define success criteria and build evaluations](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) · Claude Platform docs · criteria must be specific and measurable, numbers for scalability, qualitative scales where needed (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) · Zheng et al., arXiv 2023 · the abstract examines LLM-as-a-judge and its position, verbosity and self-enhancement biases (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) · Hamel Husain, 29 Mar 2024 · a case study organised as levels of evaluation, starting with unit tests (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [A Field Guide to Rapidly Improving AI Products](https://hamel.dev/blog/posts/field-guide/) · Hamel Husain, 24 Mar 2025 · starts with error analysis as the most common thing teams skip (*headings only*) · fetched 2026-10-14
- **Our delta:** twenty real transcripts, a grading rule, splits, and no change without a measured delta.

### T18-14 · Observability for LLM features — Master · 🔲 not written
- **Read this:** [Semantic conventions for generative AI systems](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/README.md) · OpenTelemetry GenAI semantic conventions repository · the new home (the opentelemetry.io gen-ai page now says the conventions moved here and is no longer maintained); status Development; covers client inference, events, exceptions, metrics, token metrics, model spans and agent spans, plus Anthropic, Bedrock, Azure AI Inference and OpenAI specifics (*read*) · covers our angle: **partial** — the vocabulary, not cost per tenant or privacy limits · fetched 2026-10-14
- **Also good:** [Model spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) · same repository · span name is operation plus model, with gen_ai.usage.input_tokens (which should include cached tokens) among the attributes, all marked Development (*read*) · fetched 2026-10-14
- **Also good:** [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) · Claude Platform docs · programmatic access to the organisation's historical usage and cost data through the Admin API; unavailable for individual accounts (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Building A Generative AI Platform](https://huyenchip.com/2024/07/25/genai-platform.html) · Chip Huyen, 25 Jul 2024 · its observability section is organised as metrics, logs and traces and argues for building it in from the start (*read*) · fetched 2026-10-14
- **Our delta:** tokens in and out, cost per task and per tenant, latency per stage, traces across retrieval and generation, with privacy limits on capture.

### T18-15 · Cost design — Master · 🔲 not written
- **Read this:** [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) · Claude Platform docs · per-million-token prices by model, a 50% batch discount, and cache read and write prices (*read*) · covers our angle: **partial** — the rates, not cost per completed task · fetched 2026-10-14
- **Our delta:** cost per resolved task with the arithmetic shown; caching first, effort second, model choice third.

### T18-16 · The AI feature's high-level design — Master · 🔲 not written
- **Read this:** [Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents) · Anthropic · the workflow patterns to compose from (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Building A Generative AI Platform](https://huyenchip.com/2024/07/25/genai-platform.html) · Chip Huyen, 25 Jul 2024 · adds components in order: context, guardrails, router and gateway, cache, then complex logic and write actions (*read*) · fetched 2026-10-14
- **Our delta:** the support assistant end to end on one page, the fifteen-minute whiteboard version.

### T18-17 · Thinking and effort — Understand · 🔲 not written
- **Read this:** [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) · Claude Platform docs · lower effort conserves tokens for speed and cost at some capability loss; the default equals omitting the parameter and differs by model (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) · Claude Platform docs · fixed-budget extended thinking is deprecated on some models in favour of adaptive thinking (*read*) · fetched 2026-10-14
- **Our delta:** effort per route, and why lower effort on a newer model can beat a cheaper model at full effort (to be measured, not assumed).

### T18-18 · Managed agents, self-hosted loops and the Agent SDK — Understand · 🔲 not written
- **Read this:** [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) · Claude Code docs · the SDK gives the same tools, agent loop and context management as Claude Code, and a table compares the Agent SDK, CLI, Client SDK and Managed Agents by who runs the agent (*read*) · covers our angle: **full** on the ownership question · fetched 2026-10-14
- **Also good:** [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) · Claude Platform docs · an agent (model, system prompt, tools, MCP servers, skills) runs as sessions in an environment that is either an Anthropic-managed cloud sandbox or a self-hosted one; the page is marked beta access (*read*) · fetched 2026-10-14
- **Our delta:** choose by ownership and operational burden.

### T18-19 · Model Context Protocol — Understand · 🔲 not written
- **Read this:** [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) · modelcontextprotocol.io · the current revision per the versioning page; JSON-RPC 2.0 messages between hosts (LLM applications), clients (connectors in the host) and servers (context and capabilities), and a security section on user consent, data privacy and tool safety (tool descriptions untrusted unless from a trusted server) (*read*) · covers our angle: **partial** — principles, not an implementation · fetched 2026-10-14
- **Also good:** [MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) · Claude Platform docs · calling remote MCP servers from the Messages API; the page is marked beta (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Model Context Protocol has prompt injection security problems](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/) · Simon Willison, 9 Apr 2025 · rug pulls, tool shadowing and tool poisoning: mixing tools with untrusted instructions is inherently dangerous (*read*) · fetched 2026-10-14
- **Our delta:** server and client responsibilities, and securing the connection.

### T18-20 · Context management — Understand · 🔲 not written
- **Read this:** [Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) · Claude Platform docs · for long conversations and agentic workflows, server-side compaction is the primary strategy (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) · Claude Platform docs · server-side strategies clear tool results or thinking blocks from history, and client-side compaction is a separate option (*read*) · fetched 2026-10-14
- **Also good:** [Files API](https://platform.claude.com/docs/en/build-with-claude/files) · Claude Platform docs · upload and manage files without re-uploading content on each request (*read*) · fetched 2026-10-14
- **Also good:** [Compaction overview](https://platform.claude.com/docs/en/build-with-claude/compaction) · Claude Platform docs · compaction on demand versus at a token threshold (both beta), background compaction, and keeping recent turns word for word (*read*) · fetched 2026-10-14
- **Also good:** [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · Anthropic engineering, 29 Sep 2025 · context as a finite resource; compaction, structured note-taking and multi-agent architectures for long horizons (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How Long Contexts Fail](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html) · Drew Breunig, 22 Jun 2025 · names context poisoning, distraction, confusion and clash (*read*) · fetched 2026-10-14
- **Our delta:** what to keep verbatim versus summarise.

### T18-21 · Rate limits, retries and fallbacks — Understand · 🔲 not written
- **Read this:** [Rate limits](https://platform.claude.com/docs/en/api/rate-limits) · Claude Platform docs · limits cap an organisation's use; a spend-limit rejection looks like a rate-limit error but carries no retry-after header, so SDK retries fail until access resumes (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Errors](https://platform.claude.com/docs/en/api/errors) · Claude Platform docs · the error types and codes (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · Marc Brooker, AWS Architecture Blog, 4 Mar 2015 · compares full, equal and decorrelated jitter by client work and call counts (*read*) · fetched 2026-10-14
- **Our delta:** timeouts for long generations, model fallback on refusal or overload, queueing non-urgent work.

### T18-22 · Batch and offline pipelines — Understand · 🔲 not written
- **Read this:** [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing) · Claude Platform docs · the Message Batches API processes requests asynchronously and cuts cost by 50% (*read*) · covers our angle: **partial** — no idempotent job design · fetched 2026-10-14
- **Our delta:** nightly enrichment keyed by record so a re-run changes nothing.

### T18-23 · Caching responses and semantic caching — Understand · 🔲 not written
- **Read this:** [What is semantic caching?](https://redis.io/blog/what-is-semantic-caching/) · Redis, 20 Jan 2026 · embed the query, compare by cosine similarity, and return the cached answer above a threshold it puts at commonly 0.85 to 0.95; vendor material (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Building A Generative AI Platform](https://huyenchip.com/2024/07/25/genai-platform.html) · Chip Huyen, 25 Jul 2024 · contrasts prompt cache, exact cache and semantic cache, and notes semantic cache needs a reliable similarity test (*read*) · fetched 2026-10-14
- **Our delta:** invalidation when the prompt or the underlying data changes.

### T18-24 · Fine-tuning vs prompting vs retrieval — Understand · 🔲 not written
- **Read this:** [Optimizing LLM accuracy](https://developers.openai.com/api/docs/guides/optimizing-llm-accuracy) · OpenAI docs · rejects the linear prompt-then-RAG-then-fine-tune flow for a matrix: context optimisation (missing, stale or proprietary knowledge) versus LLM optimisation (behaviour) (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Patterns for Building LLM-based Systems and Products](https://eugeneyan.com/writing/llm-patterns/) · Eugene Yan · separates fine-tuning (get better at specific tasks) from RAG (add recent, external knowledge) (*read*) · fetched 2026-10-14
- **Our delta:** the decision order, and what fine-tuning cannot fix.

### T18-25 · Data privacy and retention — Understand · 🔲 not written
- **Read this:** [Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency) · Claude Platform docs · inference_geo pins the geography that serves requests, and US-only inference is priced at 1.1x the standard rate on newer models (*read*) · covers our angle: **partial** — residency, not retention or consent · fetched 2026-10-14
- **Our delta:** what leaves your boundary, retention options, and the Part 9 duties applied to prompts.

### T18-26 · Multi-tenancy and quotas — Understand · 🔲 not written
- **Read this:** [Rate limits](https://platform.claude.com/docs/en/api/rate-limits) · Claude Platform docs · limits apply per organisation, with spend limits and per-workspace configuration noted (*read*) · covers our angle: **partial** — provider side only · fetched 2026-10-14
- **Our delta:** per-tenant budgets, isolated retrieval indexes, and the noisy tenant that consumed the shared limit.

### T18-27 · The interview questions — Understand · 🔲 not written
- **Read this:** [Building A Generative AI Platform](https://huyenchip.com/2024/07/25/genai-platform.html) · Chip Huyen, 25 Jul 2024 · a component-by-component build useful as a design-round skeleton (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the rubric and the mistake of designing the model instead of the system around it.

### T18-28 · Cloud-provider access — Know · 🔲 not written
- **Read this:** [Claude in Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock) · Claude Platform docs · the Messages API shape on AWS-managed infrastructure for newer models; access criteria are set per model by Bedrock, and the page points to Claude Platform on AWS as the Anthropic-operated alternative with AWS Marketplace billing (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Claude on Google Cloud](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai) · Claude Platform docs · model availability varies by region (*read*) · fetched 2026-10-14
- **Also good:** [Claude in Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry) · Claude Platform docs · Global Standard and US Data Zone deployments, billed through the Azure Marketplace (*read*) · fetched 2026-10-14
- **Also good:** [Anthropic Claude Messages API](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html) · AWS Bedrock user guide · inference parameters and code examples for the Messages API on Bedrock (*read*) · fetched 2026-10-14
- **Our delta:** features, regions and billing differences.
