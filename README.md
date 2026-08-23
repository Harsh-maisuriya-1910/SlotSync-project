# SlotSync

SlotSync is a full-stack counselling appointment management platform for educational institutions. Students discover and book counselling slots, counsellors publish availability and mark attendance outcomes, and administrators monitor utilization, audit activity, and manage the platform through a protected dashboard.

## Project Overview

- **Students** browse available slots, book seats inside a 30-minute-to-start booking window, cancel up to 2 hours before start, and track waitlists they have joined.
- **Counsellors** create capacity-managed slots, view bookings for their own slots only, and finalize outcomes (`ATTENDED` / `NO_SHOW`).
- **Admins** register counsellors, query paginated audit logs, and consume single-aggregation analytics for seat utilization, booking distribution, busiest slots, lead-time buckets, and 14-day trends.
- **Waitlist** automatically promotes the first waiting student (FIFO) when a booked seat is cancelled, inside the same database transaction as the cancellation.

## Tech Stack

### Backend
- Node.js + Express.js 5
- MongoDB + Mongoose
- JWT access tokens (Bearer) with httpOnly refresh cookies planned via auth module
- Joi request validation
- Jest + Supertest + mongodb-memory-server integration tests

### Frontend
- React + Vite
- Redux Toolkit + RTK Query
- React Router
- Tailwind CSS

## Architecture Overview

```
├── client/                     React SPA (Vite)
│   └── src/
│       ├── api/                RTK Query API slices
│       ├── store/              Redux store + uiSlice
│       ├── routes/             Role-aware route guards
│       ├── layouts/            Shared layout shells
│       └── pages/              Feature pages per role
└── server/
    └── src/
        ├── app.js              Express app wiring + middleware order
        ├── config/             env loader, Mongo connection
        ├── constants/          roles, statuses, audit actions
        ├── middleware/         auth, RBAC roles, validation, central error handler
        ├── modules/            domain modules (auth, users, slots, bookings,
        │                       counsellor, waitlist, audit, analytics)
        │   ├── *.routes.js     route definitions
        │   ├── *.controller.js thin HTTP layer
        │   ├── *.service.js    business rules
        │   ├── *.repository.js data access
        │   ├── *.model.js      Mongoose schemas/indexes
        │   └── *.validation.js Joi schemas
        ├── seed/               deterministic production dataset generator
        └── utility/            ApiError, ApiResponse, asyncHandler, jwt
```

Request flow: `route → auth middleware → RBAC middleware → Joi validation → controller → service → repository/model`. Errors are thrown as `ApiError(statusCode, message, code)` and mapped to a consistent JSON envelope by the central error middleware.

## Feature Matrix

| Feature | Status | Notes |
| --- | --- | --- |
| Auth (register/login/logout/me) | Done | JWT bearer, bcrypt cost 12 |
| RBAC (ADMIN / COUNSELLOR / STUDENT) | Done | Route-level role middleware |
| Counsellor registration | Done | Admin-only endpoint |
| Slot CRUD + listing pagination | Done | Overlap protection per counsellor |
| Booking with window rule | Done | Bookable until T-30 minutes |
| Cancellation cutoff | Done | Forbidden once < 120 min to start (422 `CANCELLATION_WINDOW_CLOSED`) |
| Overlap protection | Done | Student cannot hold overlapping active bookings |
| Duplicate booking guard | Done | Unique index `(student, slot)` + service check |
| Atomic seat reservation | Done | `findOneAndUpdate` guard against overbooking |
| Waitlist FIFO promotion | Done | Promoted in the cancellation transaction |
| Audit logging | Done | BOOKING_CREATED / CANCELLED / WAITLIST_PROMOTED / OUTCOME_UPDATED / SLOT_CREATED |
| Admin analytics dashboard | Done | Users/slots/bookings/utilization rollup |
| Counsellor analytics (admin view) | Done | Single `$facet` aggregation; admin-only |
| Status machine enforcement | Done | Invalid transitions → 422 `INVALID_STATUS_TRANSITION` |
| Ownership enforcement | Done | Counsellors see/mutate only their own slots' bookings |

## API Summary

All responses use the envelope `{ success, message, data }`; errors add `code`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register student account |
| POST | `/api/auth/login` | Public | Obtain JWT access token |
| POST | `/api/auth/logout` | Authenticated | Invalidate current session token server-side |
| GET | `/api/auth/me` | Authenticated | Current user profile |
| POST | `/api/users/counsellors` | Admin | Register new counsellor |
| POST | `/api/slots` | Counsellor | Create slot (overlap-checked) |
| GET | `/api/slots` | Authenticated | List slots (pagination/sorting supported) |
| POST | `/api/bookings` | Student | Book a slot (window + overlap + capacity guards) |
| PATCH | `/api/bookings/:id/cancel` | Student (owner) | Cancel booking ≥ 2h before start, triggers waitlist promotion |
| GET | `/api/bookings/my-bookings` | Student | Own bookings with populated slot/counsellor |
| GET | `/api/counsellor/slots` | Counsellor | Own slots sorted by start time |
| GET | `/api/counsellor/bookings` | Counsellor | Bookings across own slots |
| PATCH | `/api/counsellor/bookings/:id/outcome` | Counsellor (owner) | Mark ATTENDED / NO_SHOW |
| GET | `/api/counsellor/dashboard` | Counsellor | Personal KPI rollup |
| POST | `/api/waitlist` | Student | Join waitlist on FULL slot |
| GET | `/api/waitlist/my-waitlist` | Student | Own waitlist entries with populated slot |
| GET | `/api/analytics/admin` | Admin | Platform-wide stats + utilization % |
| GET | `/api/analytics/counsellor/:id` | Admin | Per-counsellor analytics via one `$facet` pipeline |
| GET | `/api/admin/audit-logs` | Admin | Paginated + filtered audit trail |

## Testing Summary

- 20 test suites / 79 tests, all passing (`cd server && npm test`).
- Integration coverage spans auth, RBAC, ownership, slots (create/update/pagination), bookings (window, cutoff, overlap, capacity, concurrency), waitlist (join, FIFO promotion, rollback, race conditions), audit logging, and analytics (admin + counsellor facets).
- Tests run against an in-memory MongoDB replica set (`mongodb-memory-server`) so multi-document transactions are exercised for real.
- Coverage (statements/branches/functions/lines): 96.39% / 74.22% / 97% / 96.86%.

## Setup Instructions

### Prerequisites
- Node.js ≥ 18
- MongoDB 4.2+ (replica set required for transactions), or the provided docker-compose

### Server
```bash
cd server
npm install
cp .env.example .env       # fill MONGO_URI, JWT_SECRET, ADMIN_* values
npm run dev                # http://localhost:5000
```

Environment variables: `PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES_IN`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, optional `CLIENT_URL` for CORS origin.

### Client
```bash
cd client
npm install
npm run dev                # http://localhost:5173
```

## Seed Instructions

Generate a realistic demo dataset (deterministic, reproducible):

```bash
cd server
npm run seed
```

The seeder wipes `users`, `slots`, `bookings`, and `waitlists`, then generates and verifies directly against MongoDB:

| Entity | Count |
| --- | --- |
| Admins | 1 (`admin@slotsync.dev`) |
| Counsellors | 5 (`counsellor1..5@slotsync.dev`) |
| Students | 200 (`student1..200@slotsync.dev`) |
| Slots | 300 (spanning -30 to +21 days, non-overlapping per counsellor) |
| Bookings | ~5,000 (realistic status mix by time) |
| Waitlist entries | ~800 (on full slots, FIFO queue positions) |

All demo accounts use password `Password123!`. The seeder prints a count report plus integrity checks (orphans = 0, duplicate booking pairs = 0, `bookedCount` mismatches = 0) and exits non-zero on any failure.

## Screenshots

> Screenshots to be captured from the running app (`docs/screenshots/`):
>
> - `student-slots.png` — student slot browser with filters
> - `student-bookings.png` — student bookings manager with cancel actions
> - `counsellor-schedule.png` — counsellor slot scheduling view
> - `counsellor-outcomes.png` — counsellor bookings outcome marking
> - `admin-dashboard.png` — admin analytics dashboard
> - `admin-audit-logs.png` — admin audit log table with pagination

## Known Limitations

- Refresh token rotation is not yet implemented; access tokens expire per `JWT_ACCESS_TOKEN_EXPIRES_IN` and clients re-login.
- Slot listing uses offset pagination; cursor pagination is planned for large datasets.
- Audit log records are append-only by convention at the service layer; DB-level immutability triggers are not enforced.
- Rate limiting is not yet applied to authentication endpoints.
- Analytics endpoints aggregate live on request; there is no pre-materialized cache for very large datasets.
- The seed script targets development/demo environments and wipes existing collections when run.
