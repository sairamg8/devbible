---
title: "App factory createApp"
sidebar_label: "01 · createApp"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`createApp(deps)` returns `app` without listening. Inject db/redis/queue clients.**

```js
export function createApp({userService, config}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: config.bodyLimit}));
  app.use('/api/users', usersRouter({userService}));
  app.use(notFound);
  app.use(errorMiddleware);
  return app;
}
```

## Interview questions

**★ Why not listen inside createApp?**  
Tests and serverless adapters need the app without binding a port.


---

← Index: [Phase 10](README.md) · Next → [Request id middleware](02-request-id.md)
