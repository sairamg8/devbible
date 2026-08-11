---
title: "Dependency injection without a framework"
sidebar_label: "04 · DI without framework"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Pass dependencies into router factories. Do not import a global `db` singleton from every file if you care about tests.**

```js
export function usersRouter({userService}) {
  const r = express.Router();
  r.get('/', async (req, res) => {
    res.json(await userService.list());
  });
  return r;
}

// createApp({userService}).use('/users', usersRouter({userService}))
```

Phase 10 completes composition with `createApp(deps)`.

## Interview questions

**★ Why inject the DB instead of importing it?**  
Tests substitute fakes; boot order stays explicit.


---

← Prev: [Fat controllers](03-fat-controllers.md) · Next → [Jobs from routes](05-jobs-from-routes.md)
