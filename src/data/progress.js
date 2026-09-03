/**
 * Single source of truth for "how much of the bible is written".
 *
 * Update the `pages` number on a phase the moment its explanations land, and
 * every progress indicator on the site follows — the homepage bar, the card
 * stats, and the `<Progress />` block inside the docs. Nothing else is
 * hand-maintained, so the UI can never disagree with itself.
 *
 * `topics`       syllabus row count for that phase (they sum to 248 for Node).
 * `pages`        explanation pages written so far; 0 means not started.
 * `pagesPlanned` set only while a phase is mid-flight, so the bar can show
 *                partial credit. Remove it when the phase is finished.
 * `updated`      🔴 REQUIRED. Local date and time, `'YYYY-MM-DD HH:MM'`, of when
 *                that language's pages last changed. **Every session updates its
 *                own language's stamp when it finishes a piece of work** — the
 *                homepage prints the most recent one, so the site can always say
 *                how fresh it is. Minute precision on purpose; seconds are noise.
 *                It is per-language rather than one global field because several
 *                sessions run in this checkout at once, each locked to one
 *                language: a single shared field would collide on every commit,
 *                while a per-language one is a row that session already owns.
 * `parked`       the phase is deliberately out of the active queue — its
 *                remaining topics are not scheduled work. Parked phases are
 *                excluded from the percentage and the phase counters (they
 *                would otherwise pin a finished language below 100% forever)
 *                and reported separately, so the map stays honest about what
 *                exists and what was set aside. Whatever *is* written in them
 *                still counts in the page total.
 */

export const LANGUAGES = {
  css: {
    label: 'CSS',
    updated: '2026-08-14 09:15',
    docsPath: '/docs/css',
    pagesPath: '/docs/css/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-css-runs', name: 'How CSS runs', part: 'How CSS resolves', topics: 12, pages: 12},
      {n: 1, slug: 'phase-1-selectors', name: 'Selectors', part: 'How CSS resolves', topics: 16, pages: 16},
      {n: 2, slug: 'phase-2-cascade', name: 'Cascade control', part: 'How CSS resolves', topics: 4, pages: 4},
      {n: 3, slug: 'phase-3-custom-properties', name: 'Custom properties and modern values', part: 'Values and layout', topics: 4, pages: 4},
      {n: 4, slug: 'phase-4-flexbox', name: 'Flexbox, deeply', part: 'Values and layout', topics: 7, pages: 7},
      {n: 5, slug: 'phase-5-grid', name: 'Grid, deeply', part: 'Values and layout', topics: 10, pages: 10},
      {n: 6, slug: 'phase-6-container-queries', name: 'Container queries and intrinsic responsive', part: 'Adaptive and visual', topics: 3, pages: 3},
      {n: 7, slug: 'phase-7-positioning', name: 'Positioning, stacking and overlay', part: 'Adaptive and visual', topics: 4, pages: 4},
      {n: 8, slug: 'phase-8-color-theming', name: 'Colour and theming', part: 'Adaptive and visual', topics: 3, pages: 3},
      {n: 9, slug: 'phase-9-motion', name: 'Motion and the cost model', part: 'Adaptive and visual', topics: 3, pages: 3},
      {n: 10, slug: 'phase-10-scss', name: 'SCSS, practically', part: 'SCSS', topics: 8, pages: 8},
    ],
  },
  javascript: {
    label: 'JavaScript',
    updated: '2026-08-15 14:06',
    docsPath: '/docs/javascript',
    pagesPath: '/docs/javascript/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-javascript-runs', name: 'How JavaScript runs', part: 'Language core', topics: 12, pages: 12},
      {n: 1, slug: 'phase-1-values-and-coercion', name: 'Values, types and coercion', part: 'Language core', topics: 17, pages: 17},
      {n: 2, slug: 'phase-2-operators', name: 'Operators, expressions and control flow', part: 'Language core', topics: 15, pages: 15},
      {n: 3, slug: 'phase-3-functions', name: 'Functions, scope and closures', part: 'Language core', topics: 20, pages: 20},
      {n: 4, slug: 'phase-4-objects-and-classes', name: 'Objects, prototypes and classes', part: 'Language core', topics: 20, pages: 20},
      {n: 5, slug: 'phase-5-built-in-library', name: 'The built-in library', part: 'Data & async', topics: 26, pages: 26},
      {n: 6, slug: 'phase-6-iteration-and-destructuring', name: 'Iteration, destructuring and generators', part: 'Data & async', topics: 13, pages: 13},
      {n: 7, slug: 'phase-7-async', name: 'Asynchronous JavaScript', part: 'Data & async', topics: 22, pages: 22},
      {n: 8, slug: 'phase-8-modules-errors', name: 'Modules, errors, memory and the toolchain', part: 'Data & async', topics: 18, pages: 18},
      {n: 9, slug: 'phase-9-dom', name: 'The DOM', part: 'Web APIs', topics: 19, pages: 19},
      {n: 10, slug: 'phase-10-events', name: 'Events and user input', part: 'Web APIs', topics: 14, pages: 14},
      {n: 11, slug: 'phase-11-network-storage', name: 'Network, storage and data transfer', part: 'Web APIs', topics: 21, pages: 21},
      {n: 12, slug: 'phase-12-browser-platform', name: 'The browser platform', part: 'Web APIs', topics: 21, pages: 21},
      {n: 13, slug: 'phase-13-complexity', name: "Complexity and real costs (parked at Master)", part: 'DSA & machine coding', topics: 10, pages: 3, parked: true},
      {n: 14, slug: 'phase-14-data-structures', name: 'Core data structures (parked at Master)', part: 'DSA & machine coding', topics: 17, pages: 5, parked: true},
      {n: 15, slug: 'phase-15-algorithm-patterns', name: 'Algorithmic patterns (parked at Master)', part: 'DSA & machine coding', topics: 20, pages: 5, parked: true},
      {n: 16, slug: 'phase-16-dynamic-programming', name: 'Dynamic programming (Master only — rest dropped)', part: 'DSA & machine coding', topics: 3, pages: 3},
      {n: 17, slug: 'phase-17-machine-coding', name: 'Machine coding: implement it yourself', part: 'DSA & machine coding', topics: 18, pages: 18},
      {n: 18, slug: 'phase-18-storefront', name: 'Building the store front end', part: 'Applied storefront', topics: 10, pages: 10},
    ],
  },
  typescript: {
    label: 'TypeScript',
    updated: '2026-08-18 19:16',
    docsPath: '/docs/typescript',
    pagesPath: '/docs/typescript/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-typescript-runs', name: 'How TypeScript runs', part: 'The type system', topics: 13, pages: 13},
      {n: 1, slug: 'phase-1-type-vocabulary', name: 'The type vocabulary', part: 'The type system', topics: 17, pages: 17},
      {n: 2, slug: 'phase-2-narrowing', name: 'Narrowing and control flow analysis', part: 'The type system', topics: 13, pages: 13},
      {n: 3, slug: 'phase-3-generics', name: 'Generics', part: 'The type system', topics: 14, pages: 14},
      {n: 4, slug: 'phase-4-classes-declarations', name: 'Classes, objects and declaration merging', part: 'Types at scale', topics: 14, pages: 14},
      {n: 5, slug: 'phase-5-type-level', name: 'Type-level programming', part: 'Types at scale', topics: 16, pages: 16},
      {n: 6, slug: 'phase-6-modules-build', name: 'Modules, declarations and the build', part: 'Types at scale', topics: 16, pages: 16},
      {n: 7, slug: 'phase-7-server', name: 'TypeScript on the server (Master rows only — rest dropped)', part: 'In the stack', topics: 5, pages: 5},
      {n: 10, slug: 'phase-10-strictness', name: 'Strictness and correctness', part: 'Rigour and tooling', topics: 13, pages: 13},
      {n: 12, slug: 'phase-12-tooling', name: 'Tooling, performance and testing', part: 'Rigour and tooling', topics: 15, pages: 15},
    ],
  },
  mongodb: {
    label: 'MongoDB',
    updated: '2026-09-01 21:00',
    docsPath: '/docs/mongodb',
    pagesPath: '/docs/mongodb/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-mongodb-runs', name: 'How MongoDB runs', part: 'The document model', topics: 5, pages: 5},
      {n: 1, slug: 'phase-1-documents-and-bson', name: 'Documents, BSON types and _id', part: 'The document model', topics: 6, pages: 6},
      {n: 2, slug: 'phase-2-mongosh', name: 'mongosh, mastered', part: 'The document model', topics: 5, pages: 5},
      {n: 3, slug: 'phase-3-schema-design', name: 'Schema design and modelling', part: 'The document model', topics: 6, pages: 6},
      {n: 4, slug: 'phase-4-crud', name: 'CRUD and DML', part: 'Querying', topics: 6, pages: 6},
      {n: 5, slug: 'phase-5-query-operators', name: 'Query operators and projection', part: 'Querying', topics: 6, pages: 6},
      {n: 6, slug: 'phase-6-aggregation', name: 'The aggregation pipeline', part: 'Querying', topics: 6, pages: 5},
      {n: 7, slug: 'phase-7-indexes', name: 'Indexes and the query planner', part: 'Querying', topics: 6, pages: 0},
      {n: 8, slug: 'phase-8-node-driver', name: 'The Node.js driver, end to end', part: 'From Node', topics: 6, pages: 0},
      {n: 9, slug: 'phase-9-mongoose', name: 'Mongoose', part: 'From Node', topics: 6, pages: 0},
      {n: 10, slug: 'phase-10-transactions', name: 'Transactions, sessions and consistency', part: 'From Node', topics: 6, pages: 0},
      {n: 11, slug: 'phase-11-replication-sharding', name: 'Replication, sharding and the cluster', part: 'Production', topics: 4, pages: 0},
      {n: 12, slug: 'phase-12-performance-ops', name: 'Performance, monitoring and operations', part: 'Production', topics: 3, pages: 0},
      {n: 13, slug: 'phase-13-security', name: 'Security and deployment', part: 'Production', topics: 5, pages: 0},
      {n: 14, slug: 'phase-14-storefront', name: 'The storefront data layer', part: 'Production', topics: 6, pages: 0},
    ],
  },
  react: {
    label: 'React',
    updated: '2026-08-17 07:35',
    docsPath: '/docs/react',
    pagesPath: '/docs/react/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-react-runs', name: 'How React runs', part: 'The React model', topics: 17, pages: 14},
      {n: 1, slug: 'phase-1-jsx', name: 'JSX and what a component returns', part: 'The React model', topics: 15, pages: 15},
      {n: 2, slug: 'phase-2-components', name: 'Components, props and composition', part: 'The React model', topics: 16, pages: 16},
      {n: 3, slug: 'phase-3-state', name: 'State and the render cycle', part: 'The React model', topics: 17, pages: 17},
      {n: 4, slug: 'phase-4-effects', name: 'Effects and synchronization', part: 'Hooks, completely', topics: 18, pages: 18},
      {n: 5, slug: 'phase-5-refs-context-reducers', name: 'Refs, context and reducers', part: 'Hooks, completely', topics: 16, pages: 16},
      {n: 6, slug: 'phase-6-performance', name: 'Rendering performance and the React Compiler', part: 'Hooks, completely', topics: 17, pages: 17},
      {n: 7, slug: 'phase-7-custom-hooks', name: 'Custom hooks and the Rules of React', part: 'Hooks, completely', topics: 12, pages: 12},
      {n: 8, slug: 'phase-8-concurrent-suspense', name: 'Concurrent rendering, Suspense and transitions', part: 'Concurrent and server', topics: 18, pages: 18},
      {n: 9, slug: 'phase-9-forms-actions', name: 'Forms, Actions and optimistic UI', part: 'Concurrent and server', topics: 14, pages: 14},
      {n: 10, slug: 'phase-10-server-components', name: 'Server Components and Server Functions', part: 'Concurrent and server', topics: 19, pages: 19},
      {n: 11, slug: 'phase-11-ssr-hydration', name: 'Server rendering, hydration and the DOM APIs', part: 'Concurrent and server', topics: 17, pages: 17},
      {n: 14, slug: 'phase-14-correctness', name: 'Testing React', part: 'Testing React', topics: 14, pages: 14},
      {n: 15, slug: 'patterns', name: 'Patterns — choosing a shape', part: 'Patterns', topics: 7, pages: 7},
    ],
  },
  angular: {
    label: 'Angular',
    updated: '2026-08-31 12:05',
    docsPath: '/docs/angular',
    pagesPath: '/docs/angular/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-angular-runs', name: 'How Angular runs', part: 'The Angular model', topics: 12, pages: 0},
      {n: 1, slug: 'phase-1-components-templates', name: 'Components and templates', part: 'The Angular model', topics: 16, pages: 0},
      {n: 2, slug: 'phase-2-signals', name: 'Signals', part: 'The Angular model', topics: 15, pages: 0},
      {n: 3, slug: 'phase-3-signal-component-api', name: 'The signal component API', part: 'Components in the signal era', topics: 12, pages: 0},
      {n: 4, slug: 'phase-4-template-control-flow', name: 'Template syntax and control flow', part: 'Components in the signal era', topics: 12, pages: 0},
      {n: 5, slug: 'phase-5-change-detection', name: 'Change detection and zoneless', part: 'Components in the signal era', topics: 11, pages: 0},
      {n: 6, slug: 'phase-6-dependency-injection', name: 'Dependency injection', part: 'Injection, streams and routing', topics: 14, pages: 0},
      {n: 7, slug: 'phase-7-rxjs', name: 'RxJS in Angular', part: 'Injection, streams and routing', topics: 12, pages: 0},
      {n: 8, slug: 'phase-8-routing', name: 'Routing', part: 'Injection, streams and routing', topics: 16, pages: 0},
      {n: 9, slug: 'phase-9-http-and-data', name: 'HTTP and data', part: 'Data, forms and architecture', topics: 12, pages: 0},
      {n: 10, slug: 'phase-10-forms', name: 'Forms, all three systems', part: 'Data, forms and architecture', topics: 16, pages: 0},
      {n: 11, slug: 'phase-11-architecture-state-ui', name: 'Architecture, state and UI', part: 'Data, forms and architecture', topics: 12, pages: 0},
      {n: 12, slug: 'phase-12-ssr-hydration', name: 'SSR, hydration and the server', part: 'Rendering on the server, and testing', topics: 13, pages: 0},
      {n: 13, slug: 'phase-13-testing', name: 'Testing', part: 'Rendering on the server, and testing', topics: 14, pages: 0},
      {n: 14, slug: 'phase-14-performance-build', name: 'Performance and the build', part: 'Performance, tooling and the ecosystem', topics: 12, pages: 0},
      {n: 15, slug: 'phase-15-tooling-ecosystem', name: 'Tooling, upgrades and the ecosystem', part: 'Performance, tooling and the ecosystem', topics: 12, pages: 0},
    ],
  },
  nodejs: {
    label: 'Node.js',
    updated: '2026-09-03 07:57',
    docsPath: '/docs/nodejs',
    pagesPath: '/docs/nodejs/pages',
    phases: [
      {n: 0, slug: 'phase-0-runtime-model', name: 'The runtime model', part: 'Foundations', topics: 13, pages: 10},
      {n: 1, slug: 'phase-1-modules', name: 'Modules and packages', part: 'Foundations', topics: 16, pages: 14},
      {n: 2, slug: 'phase-2-async', name: 'Async and the event loop', part: 'Foundations', topics: 26, pages: 22},
      {n: 3, slug: 'phase-3-buffers-streams', name: 'Buffers and streams', part: 'Core I/O', topics: 21, pages: 19},
      {n: 4, slug: 'phase-4-filesystem', name: 'Filesystem, paths, URLs', part: 'Core I/O', topics: 16, pages: 14},
      {n: 5, slug: 'phase-5-http-processes', name: 'Networking, HTTP, processes', part: 'Core I/O', topics: 30, pages: 26},
      {n: 6, slug: 'phase-6-data-access', name: 'Data access', part: 'Application', topics: 16, pages: 16},
      {n: 7, slug: 'phase-7-background-work', name: 'Background work and resilience', part: 'Application', topics: 16, pages: 16},
      {n: 8, slug: 'phase-8-security', name: 'Security', part: 'Application', topics: 28, pages: 28},
      {n: 9, slug: 'phase-9-testing', name: 'Testing', part: 'Application', topics: 20, pages: 20},
      {n: 10, slug: 'phase-10-observability', name: 'Observability and performance', part: 'Production', topics: 23, pages: 23},
      {n: 11, slug: 'phase-11-deployment', name: 'Deployment and operations', part: 'Production', topics: 14, pages: 14},
      {n: 12, slug: 'phase-12-native', name: 'Native and advanced', part: 'Production', topics: 10, pages: 10},
    ],
  },
  expressjs: {
    label: 'Express.js',
    updated: '2026-08-14 17:38',
    docsPath: '/docs/expressjs',
    pagesPath: '/docs/expressjs/pages',
    phases: [
      // `pages` here counts topics brought to the bible's standard — explained to
      // depth and carrying a `> Verified:` line — NOT files on disk. Every phase
      // below already has outline files (78 of them, linked from the phase READMEs);
      // counting those as finished is what made Express read 100% while the claims
      // table called it a draft. Do not "correct" these back to file counts.
      {n: 0, slug: 'phase-0-express-basics', name: 'Express over node:http', part: 'Foundations', topics: 8, pages: 8},
      {n: 1, slug: 'phase-1-routing', name: 'Routing and path matching', part: 'Foundations', topics: 9, pages: 9},
      {n: 2, slug: 'phase-2-middleware', name: 'Middleware architecture', part: 'Foundations', topics: 9, pages: 9},
      {n: 3, slug: 'phase-3-requests', name: 'Requests and body parsing', part: 'HTTP surface', topics: 12, pages: 12},
      {n: 4, slug: 'phase-4-responses', name: 'Responses and static files', part: 'HTTP surface', topics: 12, pages: 12},
      {n: 5, slug: 'phase-5-errors', name: 'Error handling', part: 'HTTP surface', topics: 10, pages: 10},
      {n: 6, slug: 'phase-6-rest-surface', name: 'REST surface and API features', part: 'API product', topics: 14, pages: 14},
      {n: 7, slug: 'phase-7-layering', name: 'Layering at the edge', part: 'API product', topics: 8, pages: 8},
      {n: 8, slug: 'phase-8-validation-authz', name: 'Validation and authorization', part: 'Edge & ops', topics: 13, pages: 13},
      {n: 9, slug: 'phase-9-hardening', name: 'Hardening middleware', part: 'Edge & ops', topics: 9, pages: 9},
      {n: 10, slug: 'phase-10-app-factory', name: 'Testable app and ops boundary', part: 'Edge & ops', topics: 11, pages: 11},
    ],
  },
  postgresql: {
    label: 'PostgreSQL',
    updated: '2026-08-17 06:20',
    docsPath: '/docs/postgresql',
    pagesPath: '/docs/postgresql/pages',
    phases: [
      {n: 0, slug: 'phase-0-architecture', name: 'PostgreSQL and its architecture', part: 'Foundations', topics: 12, pages: 13},
      {n: 1, slug: 'phase-1-psql', name: 'psql, mastered', part: 'Foundations', topics: 15, pages: 15},
      {n: 2, slug: 'phase-2-types', name: 'Data types and the relational model', part: 'Foundations', topics: 18, pages: 19},
      {n: 3, slug: 'phase-3-ddl', name: 'DDL: tables, constraints, schema design', part: 'Foundations', topics: 20, pages: 22},
      {n: 4, slug: 'phase-4-crud', name: 'CRUD and DML', part: 'SQL', topics: 20, pages: 22},
      {n: 5, slug: 'phase-5-joins', name: 'Joins and set operations', part: 'SQL', topics: 13, pages: 16},
      {n: 6, slug: 'phase-6-aggregation', name: 'Aggregation, windows and CTEs', part: 'SQL', topics: 16, pages: 40},
      {n: 7, slug: 'phase-7-pg-driver', name: 'The pg driver, end to end', part: 'Node + raw pg', topics: 16, pages: 16},
      {n: 8, slug: 'phase-8-schema-from-node', name: 'Schema and data from Node', part: 'Node + raw pg', topics: 14, pages: 16},
      {n: 9, slug: 'phase-9-api-crud', name: 'CRUD patterns for a real API', part: 'Node + raw pg', topics: 18, pages: 24},
      {n: 10, slug: 'phase-10-indexes', name: 'Indexes and the query planner', part: 'Performance & production', topics: 18, pages: 18},
      {n: 11, slug: 'phase-11-mvcc', name: 'Transactions, MVCC and concurrency', part: 'Performance & production', topics: 16, pages: 16},
      {n: 12, slug: 'phase-12-beyond-tables', name: 'Beyond plain tables', part: 'Performance & production', topics: 19, pages: 21},
      {n: 13, slug: 'phase-13-ops', name: 'Security, operations and production', part: 'Performance & production', topics: 18, pages: 40},
    ],
  },
  redis: {
    label: 'Redis',
    updated: '2026-08-17 12:21',
    docsPath: '/docs/redis',
    pagesPath: '/docs/redis/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-redis-runs', name: 'How Redis runs', part: 'How Redis works', topics: 6, pages: 1, pagesPlanned: 6},
      {n: 1, slug: 'phase-1-keys-and-expiry', name: 'Keys, expiry and the keyspace', part: 'How Redis works', topics: 6, pages: 0},
      {n: 2, slug: 'phase-2-redis-cli', name: 'redis-cli, mastered', part: 'How Redis works', topics: 5, pages: 0},
      {n: 3, slug: 'phase-3-strings', name: 'Strings, numbers and bitmaps', part: 'Data types', topics: 6, pages: 0},
      {n: 4, slug: 'phase-4-collections', name: 'Hashes, lists, sets and sorted sets', part: 'Data types', topics: 8, pages: 0},
      {n: 5, slug: 'phase-5-streams', name: 'Streams', part: 'Data types', topics: 6, pages: 0},
      {n: 6, slug: 'phase-6-node-client', name: 'The Node client, end to end', part: 'From Node', topics: 7, pages: 0},
      {n: 7, slug: 'phase-7-caching', name: 'Caching, properly', part: 'From Node', topics: 8, pages: 0},
      {n: 8, slug: 'phase-8-patterns', name: 'Sessions, rate limits, locks and queues', part: 'From Node', topics: 8, pages: 0},
      {n: 9, slug: 'phase-9-memory-persistence', name: 'Memory, eviction and persistence', part: 'Production', topics: 7, pages: 0},
      {n: 10, slug: 'phase-10-operations', name: 'Operations', part: 'Production', topics: 7, pages: 0},
    ],
  },
  nginx: {
    label: 'Nginx',
    updated: '2026-08-15 07:28',
    docsPath: '/docs/nginx',
    pagesPath: '/docs/nginx/pages',
    phases: [
      {n: 0, slug: 'phase-0-process-model', name: 'The nginx process model', part: 'How nginx works', topics: 14, pages: 14},
      {n: 1, slug: 'phase-1-configuration-language', name: 'The configuration language', part: 'How nginx works', topics: 14, pages: 14},
      {n: 2, slug: 'phase-2-server-and-location', name: 'How nginx picks a server and a location', part: 'How nginx works', topics: 18, pages: 18},
      {n: 3, slug: 'phase-3-static-and-spa', name: 'Serving static files and SPAs', part: 'Serving and proxying', topics: 14, pages: 0},
      {n: 4, slug: 'phase-4-reverse-proxy', name: 'Reverse proxy to Node', part: 'Serving and proxying', topics: 30, pages: 0},
      {n: 5, slug: 'phase-5-tls', name: 'TLS, HTTP/2 and HTTP/3', part: 'Serving and proxying', topics: 16, pages: 0},
      {n: 6, slug: 'phase-6-caching', name: 'Caching at the edge', part: 'Speed and scale', topics: 20, pages: 0},
      {n: 7, slug: 'phase-7-compression-and-limits', name: 'Compression, limits and delivery', part: 'Speed and scale', topics: 13, pages: 0},
      {n: 8, slug: 'phase-8-load-balancing', name: 'Load balancing and upstream health', part: 'Speed and scale', topics: 14, pages: 0},
      {n: 9, slug: 'phase-9-hardening', name: 'Access control, rate limiting and hardening', part: 'Production', topics: 25, pages: 0},
      {n: 10, slug: 'phase-10-logs-and-metrics', name: 'Logs, metrics and debugging', part: 'Production', topics: 16, pages: 0},
      {n: 11, slug: 'phase-11-deployment', name: 'Deployment and operations', part: 'Production', topics: 16, pages: 0},
    ],
  },
  git: {
    label: 'Git',
    updated: '2026-08-14 18:12',
    docsPath: '/docs/git',
    pagesPath: '/docs/git/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-git-stores-things', name: 'How Git stores things', part: 'How Git works', topics: 14, pages: 14},
      {n: 1, slug: 'phase-1-everyday-loop', name: 'The everyday loop', part: 'How Git works', topics: 12, pages: 12},
      {n: 2, slug: 'phase-2-branching-merging', name: 'Branching, merging and rebasing', part: 'How Git works', topics: 10, pages: 10},
      {n: 4, slug: 'phase-4-remotes', name: 'Remotes and syncing', part: 'Working with other people', topics: 8, pages: 8},
      {n: 5, slug: 'phase-5-undo-recover', name: 'Undo, recover and rewrite', part: 'Working with other people', topics: 8, pages: 8},
    ],
  },
  docker: {
    label: 'Docker & Podman',
    updated: '2026-08-16 07:17',
    docsPath: '/docs/docker',
    pagesPath: '/docs/docker/pages',
    phases: [
      {n: 0, slug: 'phase-0-what-a-container-is', name: 'What a container actually is', part: 'How containers work', topics: 14, pages: 14},
      {n: 1, slug: 'phase-1-running-containers', name: 'Running containers', part: 'How containers work', topics: 16, pages: 16},
      {n: 2, slug: 'phase-2-images-and-registries', name: 'Images, layers and registries', part: 'How containers work', topics: 15, pages: 15},
      {n: 3, slug: 'phase-3-dockerfile', name: 'The Dockerfile', part: 'Building images', topics: 18, pages: 18},
      {n: 4, slug: 'phase-4-build-strategy', name: 'Build strategy: cache, multi-stage, BuildKit', part: 'Building images', topics: 16, pages: 16},
      {n: 5, slug: 'phase-5-image-quality', name: 'Image quality, size and supply chain', part: 'Building images', topics: 12, pages: 12},
      {n: 6, slug: 'phase-6-storage', name: 'Storage: volumes, mounts and data', part: 'Running a real stack', topics: 12, pages: 12},
      {n: 7, slug: 'phase-7-networking', name: 'Networking', part: 'Running a real stack', topics: 14, pages: 14},
      {n: 8, slug: 'phase-8-compose', name: 'Compose', part: 'Running a real stack', topics: 17, pages: 17},
      {n: 9, slug: 'phase-9-mern-pern-stack', name: 'The MERN/PERN stack in containers', part: 'Running a real stack', topics: 14, pages: 14},
      {n: 10, slug: 'phase-10-production', name: 'Running containers in production', part: 'Production and depth', topics: 16, pages: 16},
      {n: 11, slug: 'phase-11-podman-in-depth', name: 'Podman in depth', part: 'Production and depth', topics: 16, pages: 16},
      {n: 12, slug: 'phase-12-delivery-and-ci', name: 'Delivery, CI and orchestration', part: 'Production and depth', topics: 12, pages: 12},
    ],
  },
  storybook: {
    label: 'Storybook',
    updated: '2026-08-14 13:35',
    docsPath: '/docs/storybook',
    pagesPath: '/docs/storybook/pages',
    phases: [
      {n: 0, slug: 'phase-0-how-storybook-runs', name: 'How Storybook runs', part: 'How Storybook runs', topics: 6, pages: 6},
      {n: 1, slug: 'phase-1-story-format', name: 'The story format', part: 'How Storybook runs', topics: 6, pages: 6},
      {n: 2, slug: 'phase-2-args-and-controls', name: 'Args, argTypes and controls', part: 'How Storybook runs', topics: 6, pages: 6},
      {n: 3, slug: 'phase-3-decorators', name: 'Decorators and context', part: 'Composing stories', topics: 5, pages: 5},
      {n: 4, slug: 'phase-4-documentation', name: 'Documentation', part: 'Composing stories', topics: 5, pages: 0},
      {n: 5, slug: 'phase-5-theming', name: 'Theming, colors and fonts', part: 'Composing stories', topics: 6, pages: 0},
      {n: 6, slug: 'phase-6-interaction-testing', name: 'Interaction testing', part: 'Testing with Storybook', topics: 5, pages: 0},
      {n: 7, slug: 'phase-7-accessibility-testing', name: 'Accessibility testing', part: 'Testing with Storybook', topics: 4, pages: 0},
      {n: 8, slug: 'phase-8-visual-testing', name: 'Visual regression testing', part: 'Testing with Storybook', topics: 4, pages: 0},
      {n: 9, slug: 'phase-9-configuration', name: 'Configuration, builders and CI', part: 'Configuration and shipping', topics: 6, pages: 0},
      {n: 10, slug: 'phase-10-design-systems', name: 'Design systems and shipping', part: 'Configuration and shipping', topics: 5, pages: 0},
    ],
  },
  'vite': {
    label: "Vite",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/vite',
    pagesPath: '/docs/vite/pages',
    phases: [
      {n: 1, slug: '01-core-architecture', name: "Core architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-cli-and-scaffolding', name: "Cli and scaffolding", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-configuration', name: "Configuration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-dev-server-mechanics', name: "Dev server mechanics", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-build-system-rollup', name: "Build system rollup", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-asset-handling', name: "Asset handling", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-env-variables-and-modes', name: "Env variables and modes", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-plugin-system', name: "Plugin system", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-css-handling', name: "Css handling", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-ssr-support', name: "Ssr support", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-optimization-and-performance', name: "Optimization and performance", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-path-resolution-and-aliases', name: "Path resolution and aliases", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-worker-and-wasm-support', name: "Worker and wasm support", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-testing-integration', name: "Testing integration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-deployment-considerations', name: "Deployment considerations", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-migration-recipes', name: "Migration recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'webpack': {
    label: "Webpack",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/webpack',
    pagesPath: '/docs/webpack/pages',
    phases: [
      {n: 1, slug: '01-core-concepts', name: "Core concepts", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-configuration', name: "Configuration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-module-resolution', name: "Module resolution", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-loaders', name: "Loaders", part: 'Imported corpus', topics: 2, pages: 2},
      {n: 5, slug: '05-asset-modules', name: "Asset modules", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-plugins', name: "Plugins", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-code-splitting', name: "Code splitting", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-optimization', name: "Optimization", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-dev-server-and-hmr', name: "Dev server and hmr", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-caching-strategies', name: "Caching strategies", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-module-federation', name: "Module federation", part: 'Imported corpus', topics: 5, pages: 5},
      {n: 12, slug: '12-source-maps', name: "Source maps", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-multi-config-and-environment', name: "Multi config and environment", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-performance-analysis', name: "Performance analysis", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-advanced-custom-tooling', name: "Advanced custom tooling", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'babel': {
    label: "Babel",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/babel',
    pagesPath: '/docs/babel/pages',
    phases: [
      {n: 1, slug: '01-why-babel-and-the-compiler-landscape', name: "Why babel and the compiler landscape", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-core-compilation-pipeline', name: "Core compilation pipeline", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-configuration-system', name: "Configuration system", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-presets', name: "Presets", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-plugin-ecosystem', name: "Plugin ecosystem", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-authoring-custom-plugins', name: "Authoring custom plugins", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-typescript-and-jsx-handling', name: "Typescript and jsx handling", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-build-tool-integration', name: "Build tool integration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-linter-and-type-checker-interop', name: "Linter and type checker interop", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-source-maps-and-debugging', name: "Source maps and debugging", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-performance-and-caching', name: "Performance and caching", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-monorepo-and-multi-package-strategies', name: "Monorepo and multi package strategies", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-cli-and-programmatic-tooling', name: "Cli and programmatic tooling", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-nodejs-backend-usage', name: "Nodejs backend usage", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-migration-and-decision-recipes', name: "Migration and decision recipes", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'eslint-oxlint': {
    label: "ESLint & Oxlint",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/eslint-oxlint',
    pagesPath: '/docs/eslint-oxlint/pages',
    phases: [
      {n: 1, slug: '01-linting-landscape-and-tooling-decisions', name: "Linting landscape and tooling decisions", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-eslint-core-architecture', name: "Eslint core architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-eslint-flat-config', name: "Eslint flat config", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-eslint-language-options-globals-and-parsing', name: "Eslint language options globals and parsing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-eslint-rules-system', name: "Eslint rules system", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-eslint-plugin-ecosystem', name: "Eslint plugin ecosystem", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-typescript-eslint', name: "Typescript eslint", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-eslint-cli-output-cache-and-fixes', name: "Eslint cli output cache and fixes", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-eslint-suppressions-ignores-and-governance', name: "Eslint suppressions ignores and governance", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-custom-eslint-rules-and-processors', name: "Custom eslint rules and processors", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-eslint-editor-and-local-workflow', name: "Eslint editor and local workflow", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-oxlint-core-architecture', name: "Oxlint core architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-oxlint-installation-cli-and-config-files', name: "Oxlint installation cli and config files", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-oxlint-native-plugins-and-rule-coverage', name: "Oxlint native plugins and rule coverage", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-oxlint-type-aware-linting-and-multi-file-analysis', name: "Oxlint type aware linting and multi file analysis", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-oxlint-js-plugins-and-extensibility', name: "Oxlint js plugins and extensibility", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 17, slug: '17-oxlint-fixes-ignores-and-diagnostics', name: "Oxlint fixes ignores and diagnostics", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 18, slug: '18-coexistence-eslint-and-oxlint', name: "Coexistence eslint and oxlint", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 19, slug: '19-migration-paths', name: "Migration paths", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 20, slug: '20-ci-monorepos-and-performance-engineering', name: "Ci monorepos and performance engineering", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 21, slug: '21-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'jest-rtl': {
    label: "Jest & RTL",
    updated: '2026-08-19 20:59',
    docsPath: '/docs/jest-rtl',
    pagesPath: '/docs/jest-rtl/pages',
    phases: [
      {n: 1, slug: '01-jest-core-concepts', name: "Jest core concepts", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-assertions-and-matchers', name: "Assertions and matchers", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-mocking', name: "Mocking", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-async-testing', name: "Async testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-snapshot-testing', name: "Snapshot testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-coverage-and-configuration', name: "Coverage and configuration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-rtl-core-philosophy', name: "Rtl core philosophy", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-rtl-queries', name: "Rtl queries", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-user-interaction', name: "User interaction", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-async-utilities', name: "Async utilities", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-custom-render', name: "Custom render", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-mocking-network-requests', name: "Mocking network requests", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-testing-hooks', name: "Testing hooks", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-accessibility-testing', name: "Accessibility testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-debugging-tests', name: "Debugging tests", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'playwright': {
    label: "Playwright",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/playwright',
    pagesPath: '/docs/playwright/pages',
    phases: [
      {n: 1, slug: '01-core-architecture', name: "Core architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-test-runner', name: "Test runner", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-locators', name: "Locators", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-actions-and-interactions', name: "Actions and interactions", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-auto-waiting-and-assertions', name: "Auto waiting and assertions", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-navigation-and-network', name: "Navigation and network", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-authentication-and-state', name: "Authentication and state", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-fixtures-and-test-isolation', name: "Fixtures and test isolation", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-visual-and-screenshot-testing', name: "Visual and screenshot testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-debugging-tools', name: "Debugging tools", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-parallelism-and-sharding', name: "Parallelism and sharding", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-component-testing', name: "Component testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-api-testing', name: "Api testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-ci-integration', name: "Ci integration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-advanced-patterns', name: "Advanced patterns", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  nextjs: {
    label: 'Next.js',
    updated: '2026-09-03 03:20',
    docsPath: '/docs/nextjs',
    pagesPath: '/docs/nextjs/pages',
    phases: [
      {n: 1, slug: '01-introduction-to-next-js', name: "Introduction to Next.js", part: 'Imported corpus', topics: 9, pages: 9},
      {n: 2, slug: '02-routing-and-navigation', name: "Routing and navigation", part: 'Refreshed for 16.3', topics: 20, pages: 20},
      {n: 3, slug: '03-server-components-vs-client-components', name: "Server Components vs Client Components", part: 'Imported corpus', topics: 7, pages: 7},
      {n: 4, slug: '04-data-fetching-in-the-app-router', name: "Data fetching in the App Router", part: 'Refreshed for 16.3', topics: 39, pages: 39},
      {n: 5, slug: '05-caching-ppr-and-cache-components', name: "Caching, PPR and Cache Components", part: 'Imported corpus', topics: 16, pages: 16},
      {n: 6, slug: '06-ssg-isr-and-ssr-strategy', name: "SSG, ISR and SSR strategy", part: 'Imported corpus', topics: 7, pages: 7},
      {n: 7, slug: '07-error-handling-loading-states-and-resilience', name: "Error handling, loading states and resilience", part: 'Refreshed for 16.3', topics: 14, pages: 14},
      {n: 8, slug: '08-state-management-in-an-rsc-world', name: "State management in an RSC world", part: 'Refreshed for 16.3', topics: 10, pages: 10},
      {n: 9, slug: '09-styling-and-ui', name: "Styling and UI", part: 'Imported corpus', topics: 7, pages: 7},
      {n: 10, slug: '10-forms-authentication-and-security-hardening', name: "Forms, authentication and security hardening", part: 'Refreshed for 16.3', topics: 13, pages: 13},
      {n: 11, slug: '11-performance-optimization-turbopack', name: "Performance optimization and Turbopack", part: 'Refreshed for 16.3', topics: 10, pages: 10},
      {n: 12, slug: '12-seo-metadata-and-accessibility', name: "SEO, metadata and accessibility", part: 'Refreshed for 16.3', topics: 35, pages: 35},
      {n: 13, slug: '13-testing-and-developer-experience', name: "Testing and developer experience", part: 'Refreshed for 16.3', topics: 10, pages: 10},
      {n: 14, slug: '14-agent-driven-development', name: "Agent-driven development", part: 'Imported corpus', topics: 8, pages: 8},
      {n: 15, slug: '15-databases-apis-and-full-stack-patterns', name: "Databases, APIs and full-stack patterns", part: 'Refreshed for 16.3', topics: 12, pages: 12},
      {n: 16, slug: '16-deployment-scaling-and-observability', name: "Deployment, scaling and observability", part: 'Refreshed for 16.3', topics: 16, pages: 16},
      {n: 17, slug: '17-advanced-ecosystem-topics', name: "Advanced ecosystem topics", part: 'Imported corpus', topics: 5, pages: 5},
      {n: 18, slug: '18-capstone-decision-trees-and-outlook', name: "Capstone, decision trees and outlook", part: 'Imported corpus', topics: 5, pages: 5},
      {n: 19, slug: '19-appendices', name: "Appendices", part: 'Imported corpus', topics: 6, pages: 6},
    ],
  },
  'redux-toolkit': {
    label: "Redux Toolkit",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/redux-toolkit',
    pagesPath: '/docs/redux-toolkit/pages',
    phases: [
      {n: 1, slug: '01-store-setup', name: "Store setup", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-slices-and-actions', name: "Slices and actions", part: 'Imported corpus', topics: 2, pages: 2},
      {n: 3, slug: '03-async-thunks', name: "Async thunks", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-rtk-query', name: "Rtk query", part: 'Imported corpus', topics: 2, pages: 2},
      {n: 5, slug: '05-selectors-and-normalization', name: "Selectors and normalization", part: 'Imported corpus', topics: 2, pages: 2},
      {n: 6, slug: '06-middleware', name: "Middleware", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-react-redux-integration', name: "React redux integration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-immutability-and-immer', name: "Immutability and immer", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-typescript-integration', name: "Typescript integration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-devtools-and-debugging', name: "Devtools and debugging", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-code-splitting', name: "Code splitting", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-testing', name: "Testing", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-migration', name: "Migration", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'tanstack-query': {
    label: "TanStack Query",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/tanstack-query',
    pagesPath: '/docs/tanstack-query/pages',
    phases: [
      {n: 1, slug: '01-core-concepts', name: "Core concepts", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-usequery-deep-dive', name: "Usequery deep dive", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-query-states', name: "Query states", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-caching-and-invalidation', name: "Caching and invalidation", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-usemutation', name: "Usemutation", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-background-refetching', name: "Background refetching", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-pagination-and-infinite-queries', name: "Pagination and infinite queries", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-dependent-and-parallel-queries', name: "Dependent and parallel queries", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-prefetching-and-ssr', name: "Prefetching and ssr", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-suspense-integration', name: "Suspense integration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-devtools', name: "Devtools", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-query-cancellation', name: "Query cancellation", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-global-configuration', name: "Global configuration", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-optimistic-updates-patterns', name: "Optimistic updates patterns", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-testing-tanstack-query', name: "Testing tanstack query", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-migration-recipes', name: "Migration recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'framer-motion': {
    label: "Framer Motion",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/framer-motion',
    pagesPath: '/docs/framer-motion/pages',
    phases: [
      {n: 1, slug: '01-core-concepts', name: "Core concepts", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-basic-animation-props', name: "Basic animation props", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-transition-types', name: "Transition types", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-variants', name: "Variants", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-gestures', name: "Gestures", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-animatepresence', name: "Animatepresence", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-layout-animations', name: "Layout animations", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-scroll-linked-animations', name: "Scroll linked animations", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-motion-values', name: "Motion values", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-animation-controls', name: "Animation controls", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-keyframes', name: "Keyframes", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-svg-animations', name: "Svg animations", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-orchestration-and-staggering', name: "Orchestration and staggering", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-performance-considerations', name: "Performance considerations", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-advanced-patterns', name: "Advanced patterns", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'web-vitals-performance': {
    label: "Web Vitals & Performance",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/web-vitals-performance',
    pagesPath: '/docs/web-vitals-performance/pages',
    phases: [
      {n: 1, slug: '01-core-web-vitals', name: "Core web vitals", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-legacy-and-lab-measurement', name: "Legacy and lab measurement", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-real-user-monitoring', name: "Real user monitoring", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-lcp-optimization', name: "Lcp optimization", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-inp-optimization', name: "Inp optimization", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-cls-optimization', name: "Cls optimization", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-loading-and-rendering-performance', name: "Loading and rendering performance", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-bundle-and-media-optimization', name: "Bundle and media optimization", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-caching-and-production-monitoring', name: "Caching and production monitoring", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-budgets-and-advanced-diagnostics', name: "Budgets and advanced diagnostics", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 16, slug: '16-real-world-workflows-and-recipes', name: "Real world workflows and recipes", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  'frontend-architecture': {
    label: "Frontend Architecture",
    updated: '2026-08-14 13:35',
    docsPath: '/docs/frontend-architecture',
    pagesPath: '/docs/frontend-architecture/pages',
    phases: [
      {n: 1, slug: '01-project-structure-and-organization', name: "Project structure and organization", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 2, slug: '02-component-architecture', name: "Component architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 3, slug: '03-state-management-decision-tree', name: "State management decision tree", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 4, slug: '04-data-layer-and-api-architecture', name: "Data layer and api architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 5, slug: '05-routing-and-navigation-architecture', name: "Routing and navigation architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 6, slug: '06-styling-architecture', name: "Styling architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 7, slug: '07-monorepo-and-multi-app-strategy', name: "Monorepo and multi app strategy", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 8, slug: '08-environment-and-configuration-management', name: "Environment and configuration management", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 9, slug: '09-authentication-and-authorization-architecture', name: "Authentication and authorization architecture", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 10, slug: '10-error-handling-and-resilience', name: "Error handling and resilience", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 11, slug: '11-observability-and-monitoring', name: "Observability and monitoring", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 12, slug: '12-ci-cd-pipeline-design', name: "Ci cd pipeline design", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 13, slug: '13-testing-strategy', name: "Testing strategy", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 14, slug: '14-performance-and-scalability-patterns', name: "Performance and scalability patterns", part: 'Imported corpus', topics: 1, pages: 1},
      {n: 15, slug: '15-team-and-collaboration-practices', name: "Team and collaboration practices", part: 'Imported corpus', topics: 1, pages: 1},
    ],
  },
  realworld: {
    label: 'Real World',
    updated: '2026-09-02 20:45',
    docsPath: '/docs/real-world',
    pagesPath: '/docs/real-world/pages',
    phases: [
      {n: 0, slug: 'phase-0-the-app', name: 'The app', part: 'Backend spine', topics: 3, pages: 3},
      {n: 1, slug: 'phase-1-database', name: 'The database (raw SQL + pg)', part: 'Backend spine', topics: 12, pages: 12},
      {n: 2, slug: 'phase-2-node-services', name: 'Node services', part: 'Backend spine', topics: 10, pages: 10},
      {n: 3, slug: 'phase-3-express-api', name: 'The Express API', part: 'Backend spine', topics: 12, pages: 12},
      {n: 4, slug: 'phase-4-react-ui', name: 'The React UI and its hooks', part: 'Frontend', topics: 12, pages: 12},
      {n: 5, slug: 'phase-5-js-functions', name: 'JavaScript custom functions', part: 'Frontend', topics: 10, pages: 10},
      {n: 6, slug: 'phase-6-typescript', name: 'TypeScript across the stack', part: 'Frontend', topics: 8, pages: 8},
      {n: 7, slug: 'phase-7-css-recipes', name: 'CSS recipes', part: 'Completion', topics: 4, pages: 4},
      {n: 8, slug: 'phase-8-mongodb-mirror', name: 'The MongoDB mirror', part: 'Completion', topics: 6, pages: 5, pagesPlanned: 6},
    ],
  },
  java: {
    label: 'Java',
    updated: '2026-09-03 02:30',
    docsPath: '/docs/java',
    pagesPath: '/docs/java/pages',
    phases: [
      {n: 0, slug: 'phase-0-platform-jvm', name: 'The platform and the JVM', part: 'Foundations', topics: 13, pages: 13},
      {n: 1, slug: 'phase-1-language-core', name: 'Language core', part: 'Foundations', topics: 16, pages: 16},
      {n: 2, slug: 'phase-2-classes-objects', name: 'Classes and objects', part: 'Foundations', topics: 15, pages: 15},
      {n: 3, slug: 'phase-3-generics-collections', name: 'Generics and collections', part: 'Core library', topics: 16, pages: 16},
      {n: 4, slug: 'phase-4-lambdas-streams', name: 'Lambdas, streams and Optional', part: 'Core library', topics: 13, pages: 13},
      {n: 5, slug: 'phase-5-exceptions', name: 'Exceptions and failure design', part: 'Core library', topics: 8, pages: 8},
      {n: 6, slug: 'phase-6-concurrency', name: 'Concurrency', part: 'Core library', topics: 17, pages: 17},
      {n: 7, slug: 'phase-7-io-time-stdlib', name: 'I/O, time and the everyday stdlib', part: 'Application', topics: 13, pages: 13},
      {n: 8, slug: 'phase-8-build-dependencies', name: 'The build: Maven, Gradle, dependencies', part: 'Application', topics: 12, pages: 12},
      {n: 9, slug: 'phase-9-spring-boot', name: 'Spring Boot and the web', part: 'Application', topics: 16, pages: 16},
      {n: 10, slug: 'phase-10-data-access', name: 'Data access', part: 'Application', topics: 14, pages: 14},
      {n: 11, slug: 'phase-11-testing', name: 'Testing', part: 'Production', topics: 12, pages: 12},
      {n: 12, slug: 'phase-12-jvm-production', name: 'The JVM in production', part: 'Production', topics: 15, pages: 12, pagesPlanned: 15},
      {n: 13, slug: 'phase-13-oauth2-oidc', name: 'OAuth2, OIDC and service security', part: 'Distributed', topics: 14, pages: 3},
      {n: 14, slug: 'phase-14-microservice-architecture', name: 'Microservice architecture', part: 'Distributed', topics: 12, pages: 0},
      {n: 15, slug: 'phase-15-messaging-event-driven', name: 'Messaging and event-driven', part: 'Distributed', topics: 14, pages: 0},
      {n: 16, slug: 'phase-16-resilience-operations', name: 'Resilience and operating the fleet', part: 'Distributed', topics: 13, pages: 0},
    ],
  },
  python: {
    label: 'Python',
    updated: '2026-09-03 19:03',
    docsPath: '/docs/python',
    pagesPath: '/docs/python/pages',
    phases: [
      {n: 0, slug: 'phase-0-runtime', name: 'The runtime', part: 'Foundations', topics: 12, pages: 12},
      {n: 1, slug: 'phase-1-language-core', name: 'Language core', part: 'Foundations', topics: 16, pages: 14, pagesPlanned: 16},
      {n: 2, slug: 'phase-2-functions', name: 'Functions, closures and decorators', part: 'Foundations', topics: 10, pages: 2, pagesPlanned: 10},
      {n: 3, slug: 'phase-3-collections', name: 'Collections in depth', part: 'Data model', topics: 12, pages: 0},
      {n: 4, slug: 'phase-4-classes-data-model', name: 'Classes and the data model', part: 'Data model', topics: 15, pages: 0},
      {n: 5, slug: 'phase-5-iterators-generators', name: 'Iterators, generators, context managers', part: 'Data model', topics: 10, pages: 0},
      {n: 6, slug: 'phase-6-typing', name: 'Typing', part: 'Data model', topics: 12, pages: 0},
      {n: 7, slug: 'phase-7-packaging-tooling', name: 'Packaging, projects and tooling', part: 'Application', topics: 12, pages: 0},
      {n: 8, slug: 'phase-8-concurrency-async', name: 'Concurrency and async', part: 'Application', topics: 13, pages: 0},
      {n: 9, slug: 'phase-9-web-service', name: 'The web service', part: 'Application', topics: 14, pages: 0},
      {n: 10, slug: 'phase-10-data-files', name: 'Data, files and integrations', part: 'Application', topics: 13, pages: 0},
      {n: 11, slug: 'phase-11-rest-crud', name: 'REST APIs and CRUD, end to end', part: 'Application', topics: 17, pages: 0},
      {n: 12, slug: 'phase-12-testing', name: 'Testing with pytest', part: 'Production', topics: 12, pages: 0},
      {n: 13, slug: 'phase-13-production', name: 'Production and performance', part: 'Production', topics: 12, pages: 0},
    ],
  },
};

/** 'written' | 'writing' | 'parked' | 'planned' for one phase. */
export function phaseStatus(p) {
  if (p.parked) return 'parked';
  if (p.pages === 0) return 'planned';
  return p.pagesPlanned ? 'writing' : 'written';
}

/**
 * Totals for one language. A phase still being written counts pro rata —
 * `pages / pagesPlanned` of its topics — so the bar moves with every page
 * rather than jumping a whole phase at a time.
 */
export function summarise(langKey) {
  const lang = LANGUAGES[langKey];
  const phases = lang.phases;
  // Parked phases are out of the active queue, so they sit outside every
  // ratio here — otherwise a language whose scheduled work is finished can
  // never reach 100%. They are reported on their own instead.
  const active = phases.filter((p) => !p.parked);
  const parked = phases.filter((p) => p.parked);
  const finished = active.filter((p) => phaseStatus(p) === 'written');
  const topicsTotal = active.reduce((sum, p) => sum + p.topics, 0);
  const topicsDone = active.reduce((sum, p) => {
    const status = phaseStatus(p);
    if (status === 'written') return sum + p.topics;
    if (status === 'writing') return sum + (p.topics * p.pages) / p.pagesPlanned;
    return sum;
  }, 0);
  const pagesWritten = phases.reduce((sum, p) => sum + p.pages, 0);
  const inFlight = active.find((p) => phaseStatus(p) === 'writing') ?? null;
  return {
    ...lang,
    phases,
    phasesTotal: active.length,
    phasesDone: finished.length,
    topicsTotal,
    topicsDone: Math.round(topicsDone),
    pagesWritten,
    percent: Math.round((topicsDone / topicsTotal) * 100),
    parkedPhases: parked.length,
    parkedTopicsLeft: parked.reduce((sum, p) => sum + (p.topics - p.pages), 0),
    inFlight,
    nextPhase: inFlight ?? active.find((p) => p.pages === 0) ?? null,
  };
}

/**
 * The freshest `updated` stamp across every language, and which language it came
 * from — what the homepage prints so a reader can see how current the site is.
 *
 * The stamps are plain `'YYYY-MM-DD HH:MM'` local-time strings, so they sort
 * lexicographically and need no Date parsing. That matters: Docusaurus renders
 * this at build time, so anything relative ("3 hours ago") would be frozen at
 * whatever the build machine thought the time was. An absolute stamp stays true.
 */
export function lastUpdated() {
  return recentlyUpdated(1)[0] ?? null;
}

/**
 * The `count` most recently touched languages, freshest first, each already
 * summarised.
 *
 * This exists so the homepage can *derive* "what moved lately" instead of
 * carrying a hand-written paragraph about it. The hand-written version went
 * stale every single time: it still announced Docker and the React patterns
 * layer weeks after Java had become the thing actually being written. A stamp
 * that every session already updates as part of its cadence cannot drift.
 */
export function recentlyUpdated(count = 3) {
  return Object.entries(LANGUAGES)
    .filter(([, lang]) => lang.updated)
    // A corpus that was moved in wholesale carries the stamp of the day it was
    // imported, not of anyone writing it. Left in, the three freshest stamps
    // were "Jest & RTL, 100%, every scheduled phase written" — true of the
    // counter and false of the pages. Storybook survives this filter because
    // only some of its phases are imported and the rest were written here.
    .filter(([, lang]) => lang.phases.some((p) => p.part !== 'Imported corpus'))
    .sort((a, b) => (a[1].updated < b[1].updated ? 1 : -1))
    .slice(0, count)
    .map(([key, lang]) => {
      const [date, time] = lang.updated.split(' ');
      const stats = summarise(key);
      return {key, label: lang.label, stamp: lang.updated, date, time, ...stats};
    });
}
