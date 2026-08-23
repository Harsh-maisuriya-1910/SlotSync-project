# SlotSync

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Joi

### Frontend
- React
- Redux Toolkit
- RTK Query
- React Router

## Project Structure

- client/
- server/
- tests/

## Setup

### Server

```bash
cd server
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

## Docker

Production-style containers for the whole stack (Mongo replica set, API, Nginx-served web).

```bash
# Development / demo stack (JWT secret is a placeholder — do not use in production)
docker compose build
docker compose up -d

docker compose ps        # mongo + api should show (healthy)
docker compose logs -f api

# Tear down (add -v to drop the mongo volume)
docker compose down
```

Services:

| Service | Port | Notes |
|---|---|---|
| mongo | 27017 | single-node replica set `rs0` (required for transactions), persistent volume `mongo_data`, self-initializing healthcheck |
| api | 5000 | multi-stage Node LTS build, non-root user, wget healthcheck on `/` |
| web | 8080→80 | Vite build served by Nginx; proxies `/api` to the api service |

For production, use the override file and provide real secrets from your environment:

```bash
JWT_SECRET=$(openssl rand -hex 32) \
ADMIN_PASSWORD='Str0ng!Passw0rd' \
docker compose -f docker-compose.prod.yml up -d --build
```

## Postman

Import both files from `postman/`:

1. `SlotSync.postman_collection.json`
2. `SlotSync.postman_environment.json`

Select the **SlotSync Local** environment, then run requests top-to-bottom:

- Register/Login requests auto-save `accessToken`, `refreshToken`, and per-role tokens into the environment via test scripts.
- The Refresh request rotates tokens automatically (family revocation is exercised by replaying an old token).
- Create Slot auto-stores `slotId`/`slotVersion`; Book Slot auto-stores `bookingId`.
- The **Failure Cases** folder demonstrates 401, 403, 409, and 422 error envelopes.

## Architecture

```
┌──────────┐   /api (HTTP)   ┌─────────────┐   Mongoose   ┌────────────────────┐
│  Client  │ ──────────────► │  Express    │ ───────────► │  MongoDB           │
│  React   │                 │  API        │              │  (replica set rs0) │
│  (Vite)  │ ◄────────────── │  :5000      │ ◄─────────── │  transactions      │
└──────────┘   JWT Bearer   └─────────────┘   sessions    └────────────────────┘
     Nginx serves dist/       helmet · CORS allowlist · rate limiting
     + proxies /api           refresh rotation · idempotency keys
                              optimistic concurrency · audit log
```

Domain modules: `auth`, `users`, `slots`, `bookings`, `waitlist`, `counsellor`,
`analytics`, `audit` — each with routes → validation → controller → service → repository layers.

## Testing

```bash
cd server
$env:MONGOMS_STARTUP_TIMEOUT='60000'; npm test -- --maxWorkers=4   # PowerShell
MONGOMS_STARTUP_TIMEOUT=60000 npm test -- --maxWorkers=4           # bash
```

Jest + Supertest against an in-memory MongoDB replica set (`mongodb-memory-server`);
112 tests across 25 suites cover auth, RBAC/ownership, booking lifecycle,
cancellation cutoffs, waitlist promotion, analytics, security hardening, and P1 features.

```bash
cd client
npm run lint
npm run build
```