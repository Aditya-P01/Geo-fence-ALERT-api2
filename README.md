# 🌐 Geo-Fence Alert API

A distributed backend system that detects the exact moment a GPS device crosses a virtual geographic boundary and fires real-time alerts.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue) ![Redis](https://img.shields.io/badge/Redis-7-red) ![Docker Compose](https://img.shields.io/badge/Docker-Compose-blue)

## What It Does

GPS devices send their coordinates to the API. The system checks whether the device is inside or outside each registered geo-fence, then compares that result against the device's **previous state** stored in Redis. If the state changed — outside → inside or inside → outside — an alert event is created and dispatched to all registered webhooks.

This state-comparison pattern is what makes it an intelligent event-driven system rather than a simple location logger. It fires only at the **moment of boundary crossing**, not on every ping.

**Real-world use cases:** child safety (school zone exit alert), delivery tracking (market area entry), hostel attendance, fleet management, vehicle theft detection.

## How It Works

```text
Device sends lat/lng
        ↓
Load active fences (Redis cache → PostgreSQL fallback)
        ↓
Evaluate each fence with Turf.js
  • Circle → turf.distance()
  • Polygon → turf.booleanPointInPolygon()
        ↓
Compare result vs. previous state in Redis
  device:{id}:fence:{id} → "inside" | "outside"
        ↓
State changed? → Save alert to PostgreSQL → POST to all webhooks
        ↓
Return JSON: events fired + fences currently inside
```

## Backend Architecture Detail

The backend is built as an **Express.js API** coupled with **Socket.IO** for real-time capabilities. 

*   **Location Ingestion Pipeline**: When a device POSTs its location, the `locationController` orchestrates an entirely asynchronous flow. It checks Redis for cached fences, falls back to Postgres if needed, and uses `evaluator.js` (Turf.js) to do the complex geospatial geometry checks. 
*   **State Tracker (Redis)**: To avoid spamming the database, `stateTracker.js` stores the device's last known state inside Redis with a 24-hour TTL. It only triggers an alert if the state transitions across the boundary line. 
*   **Webhook & Alert Dispatching**: The `alertDispatcher.js` saves the precise crossing event permanently to PostgreSQL. It then retrieves all registered endpoints from the `webhooks` table and executes concurrent, non-blocking HTTP POSTs natively using Axios, secured via active HMAC SHA-256 signatures. It simultaneously fires a `geo_fence_alert` packet over Socket.IO to connected frontends.
*   **Security & Safety**: Enforces a strict 300 requests-per-minute IP limits via `express-rate-limit`, handles strict token authentication, and utilizes Morgan + Winston for deep but redacted application logging. 

## Frontend Architecture Detail

The frontend is a **Vite + React 18** Single Page Application designed around multi-tenancy and real-time Socket.IO subscriptions.

*   **Admin Dashboard**: The master control view. It features a `<MapView>` for interacting with the global Leaflet/Mapbox canvas, allowing administrators to click-and-drag drawing tools to synthesize new polygons or circles. It lists all system fences and streams the global alert feed via Socket.IO instantly.
*   **Personal Dashboard**: Protected by an `<OwnerContext>`, this view acts as a multi-tenant isolation layer. Individual users (owners) only see the map markers, geo-fences, and real-time Socket.IO alerts directly belonging to their `owner_id`. 
*   **Device Dashboard**: A dedicated tracking view bound to a singular device endpoint. Uses custom hooks (`useGeolocation`, `useSocket`) to automatically poll the host system's GPS coordinates, visually representing the point-in-polygon math in real time as the device moves across the map.

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Runtime** | Node.js 18+ | Async I/O server |
| **API Framework** | Express.js | HTTP routing & middleware |
| **Geospatial** | Turf.js | Circle & polygon spatial math |
| **Primary Database** | PostgreSQL | Persistent storage — fences, alerts, webhooks |
| **Cache & State** | Redis (ioredis) | Fence list cache + device state memory |
| **Webhook Delivery** | Axios | HTTP POST to registered endpoints |
| **Validation** | Joi | Request schema validation |
| **Logging** | Winston + Morgan | Structured application logs |
| **Containers** | Docker Compose | Local development environment |
| **Cloud** | Render.com | Production deployment |

## Project Structure

```text
src/
├── config/
│   ├── db.js                 # PostgreSQL connection pool (pg library)
│   └── redis.js              # Redis client (ioredis)
├── middleware/
│   ├── auth.js               # API key authentication (Bearer token)
│   ├── validate.js           # Joi request validation
│   └── errorHandler.js       # Global error handler
├── routes/                   # Express route definitions (fences, locations, alerts, webhooks)
├── controllers/
│   ├── fenceController.js    # Fence CRUD logic
│   ├── locationController.js # Orchestrates the full detection flow ⭐
│   ├── alertController.js    # Alert history queries
│   └── webhookController.js  # Webhook management
└── services/
    ├── evaluator.js          # Turf.js spatial calculations ⭐
    ├── fenceCache.js         # Redis fence caching (5-min TTL)
    ├── stateTracker.js       # Redis device state tracking (24-hr TTL) ⭐
    └── alertDispatcher.js    # Save alert to DB + fire webhooks
```

Also includes: `migrations/` (SQL schema), `tests/` (unit + integration with Jest), `scripts/` (seed data, migrations, demo), `docs/` (API.md, swagger.yaml).

## Database Schema

- `geo_fences` — Fence definitions: name, type (circle/polygon), geometry (coordinates or center+radius), active flag
- `alert_events` — Every ENTER/EXIT event: device ID, fence ID, coordinates, timestamp, webhook delivery status
- `webhooks` — Registered HTTP endpoints that receive alert payloads on each event

## Key Design Decisions

- **Redis serves two roles:** fence list caching (avoids repeated DB queries) and device state memory (enables transition detection). These are the two most performance-critical operations.
- **State unknown = outside:** a device seen for the first time is treated as outside, so its first entry into any fence correctly triggers an ENTER event.
- **Turf.js for geospatial math:** circles use `turf.distance()` compared against `radius_meters`; polygons use `turf.booleanPointInPolygon()`. Both handle edge cases correctly at scale.
- **Async webhook delivery:** webhook HTTP POSTs are dispatched after the API response is returned to the device, keeping response times under 200ms.
- **Auto cache invalidation:** any fence create/update/delete immediately purges the `fences:active` Redis key so devices always evaluate against current boundaries.

## Core Endpoint

```http
POST /api/v1/locations/:deviceId
Body: { "lat": 28.6139, "lng": 77.2090 }

Response:
{
  "events_fired": [{ "fence_name": "School Zone", "event_type": "ENTER" }],
  "currently_inside": [{ "fence_name": "School Zone" }],
  "processing_time_ms": 45
}
```

State transitions detected:

| Was | Is Now | Event |
|---|---|---|
| outside / unknown | inside | `ENTER` |
| inside | outside | `EXIT` |
| inside | inside | *(none)* |
| outside | outside | *(none)* |
