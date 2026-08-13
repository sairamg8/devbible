# PostgreSQL Phase 0 measurements

Container:
```bash
podman run -d --name devbible-pg \
  -e POSTGRES_PASSWORD=devbible -e POSTGRES_USER=devbible -e POSTGRES_DB=devbible \
  -p 55432:5432 docker.io/library/postgres:18-alpine
```

Connect: `127.0.0.1:55432` user/db `devbible` password `devbible`.
Use `pg` from this folder (`npm install pg`).
