---
description: how to start the geo-fence alert project (backend + frontend)
---

# Geo-Fence Alert — Startup Workflow

## First Time Only (run once ever)

```bash
# 1. Start databases
cd "/home/aps/Desktop/New Folder/Geo-fence-ALERT-api"
sudo docker compose up postgres redis -d

# 2. Run database migrations (only needed once)
sudo docker exec -i geofence_postgres psql -U postgres -d geofence_db < migrations/001_init.sql
sudo docker exec -i geofence_postgres psql -U postgres -d geofence_db < migrations/002_indexes.sql
```

## Every Time You Want to Develop

Open **3 separate terminals**:

### Terminal 1 — Start databases
```bash
cd "/home/aps/Desktop/New Folder/Geo-fence-ALERT-api"
sudo docker compose up postgres redis -d
```
> Skip this if containers are already running. Check with: `sudo docker ps`

### Terminal 2 — Start backend API
```bash
cd "/home/aps/Desktop/New Folder/Geo-fence-ALERT-api"
npm run dev
```
> Runs on http://localhost:3000
> Wait until you see: `🚀 Geo-Fence Alert API running on port 3000`
> Redis errors stop automatically once docker containers are healthy (~10s)

### Terminal 3 — Start frontend
```bash
cd "/home/aps/Desktop/New Folder/Geo-fence-ALERT-api/frontend"
npm start
```
> Opens http://localhost:3001 in your browser automatically
> All /api/v1/* requests are proxied to backend on :3000

## To Stop Everything

```bash
# Stop frontend — Ctrl+C in Terminal 3
# Stop backend  — Ctrl+C in Terminal 2

# Stop database containers (data is preserved in Docker volumes)
cd "/home/aps/Desktop/New Folder/Geo-fence-ALERT-api"
sudo docker compose down
```

## Quick Health Check

```bash
# Check containers are running
sudo docker ps

# Test backend is up
curl -H "Authorization: Bearer your-secret-api-key-change-this" http://localhost:3000/api/v1/health

# Test fence creation
curl -X POST http://localhost:3000/api/v1/fences \
  -H "Authorization: Bearer your-secret-api-key-change-this" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Zone","type":"circle","center":{"lat":28.6139,"lng":77.2090},"radius_meters":200,"events":["ENTER","EXIT"]}'
```
