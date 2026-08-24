# SlotSync Architecture Decisions

## Project Goal

SlotSync is a role-based counselling appointment management platform designed to support high-volume booking workflows while preventing overbooking, ensuring fair waitlist promotion, and providing operational analytics for administrators and counsellors.

---

## Technology Stack

### Backend

**Chosen Stack**

* Node.js
* Express.js
* MongoDB
* Mongoose

### Why

The application requires rapid CRUD operations, aggregation-heavy analytics, and transactional booking workflows.

MongoDB provides:

* Flexible document modeling
* Strong aggregation capabilities
* Multi-document transactions
* Horizontal scalability

### Tradeoff

Compared with PostgreSQL, MongoDB provides less strict relational enforcement, therefore domain constraints are enforced at the application and schema levels.

---

## Authentication Strategy

### Chosen Approach

JWT Access Tokens + Refresh Token Rotation

### Why

Access tokens remain stateless and scalable across multiple API instances.

Refresh token rotation provides:

* Session continuity
* Token theft detection
* Session family revocation

### Configuration

| Token         | Duration   |
| ------------- | ---------- |
| Access Token  | 15 minutes |
| Refresh Token | 7 days     |

### Tradeoff

JWT revocation is more complex than server-side sessions and requires refresh-token tracking.

---

## Authorization Strategy

### Role Based Access Control (RBAC)

Supported roles:

* ADMIN
* COUNSELLOR
* STUDENT

### Why

Business rules differ significantly between roles.

Examples:

* Students create bookings
* Counsellors manage outcomes
* Admins manage analytics and audits

### Security Principle

Routes are protected using:

* Authentication Middleware
* Role Middleware
* Ownership Validation

---

## Booking Architecture

### Chosen Model

Separate Booking Collection

### Why

Avoid storing large embedded arrays inside User or Slot documents.

Benefits:

* Better scalability
* Easier indexing
* Simpler analytics queries
* Cleaner transaction handling

### Tradeoff

Additional joins (populate/lookups) are required for reporting.

---

## Concurrency Strategy

### Problem

Multiple students may attempt to book the same slot simultaneously.

### Solution

MongoDB Transactions + Atomic Updates

Implemented protections:

* Capacity enforcement
* Double-booking prevention
* Overlap prevention
* FIFO waitlist promotion

### Result

Stress-tested with concurrent booking requests without overbooking.

---

## Waitlist Strategy

### Chosen Approach

FIFO Queue

### Why

Provides predictable and fair promotion ordering.

### Promotion Rules

When:

* Booking cancelled
* Capacity becomes available

Then:

* First eligible waitlisted student is promoted automatically

---

## Analytics Architecture

### Chosen Approach

MongoDB Aggregation Framework

### Implementation

Single `$facet` pipeline for counsellor analytics.

Returns:

* Seat utilization
* Booking status distribution
* Lead time buckets
* Busiest slots
* 14-day trend series

### Why

Reduces database round trips and ensures consistency across metrics.

---

## Pagination Strategy

### Chosen Approach

Cursor Pagination

### Why

Avoids MongoDB `skip()` performance degradation on large datasets.

### Benefits

* Stable ordering
* Better scalability
* Consistent response times

---

## Frontend Architecture

### Stack

* React
* Vite
* Redux Toolkit
* RTK Query
* TailwindCSS

### Why

Provides:

* Fast development
* Predictable state management
* Automatic caching
* Responsive UI architecture

---

## Containerization Strategy

### Containers

* MongoDB
* API
* Frontend

### Why

Provides:

* Environment consistency
* Reproducible deployments
* Easier onboarding
* Simplified CI/CD integration

---

## Key Architectural Principles

1. Security First
2. Transactional Consistency
3. Predictable User Experience
4. Scalable Query Patterns
5. Clear Separation of Concerns
6. Automated Validation Through Testing
