# VERA — Environmental Data-Trust Engine

VERA (Verified Environmental Rainfall Assessment & Data-Trust System) is a production-ready, full-stack application for evaluating, screening, and cross-validating local weather station telemetry against CHIRPS satellite precipitation estimates.

---

## 🎯 Production Core Journey

1. **CONDUIT DATA** → Ingestion of live Conduit API or imported station telemetry.
2. **QUALITY CHECK** → Deterministic screening across 8 physical QC rules.
3. **CONFIDENCE** → Explainable confidence rating (`HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`).
4. **SATELLITE COMPARISON** → Quality-gated comparison against CHIRPS v2.0 Daily satellite grid.
5. **EXPLANATION** → Scientific rationale using neutral discrepancy terminology.
6. **DECISION SUPPORT** → Action recommendations based on quality-screened ground evidence.
7. **OPERATOR ACTION LOG** → Persistent audit trail saving operator actions and decision rationale.

---

## 🔒 Scientific Safety & Wording

VERA strictly adheres to physical measurement principles:
* **No Speculative Blame**: Gauge disagreement never claims a sensor is "definitely broken" or "satellite is wrong". It uses objective language: *"Potential observation-quality issue"*, *"Gauge disagreement detected"*, and *"Review recommended"*.
* **Quality Gating**: Ground observations with `LOW` or `INSUFFICIENT` confidence are deferred from satellite comparison: *"Satellite comparison deferred because local observation quality is insufficient."*
* **Zero Fake Metrics**: No "AI scores", no fake counters, no decorative maps, no unverified predictions. All metrics originate directly from stored SQLite database rows or documented mathematical calculations.

---

## 🛠️ Environment Variables Configuration (`.env`)

```env
# Application Server & Database
NODE_ENV="production"
PORT=3000
DATABASE_URL="file:./vera.db"

# Station Location Coordinates
STATION_ID="JKUAT_MAIN_STATION"
STATION_NAME="JKUAT Conduit Weather Station"
STATION_LAT="-1.1018"
STATION_LON="37.0144"

# Quality Control Engine Thresholds
GAUGE_DISAGREEMENT_TOLERANCE="0.25"    # 25% relative discrepancy threshold
GAUGE_EPSILON="0.1"                   # Division by zero protection epsilon
GAUGE_MIN_DIFF_MM="1.0"               # Minimum absolute difference (mm) to flag
SPIKE_THRESHOLD_MM="40.0"             # Isolated spike threshold (mm)
STALE_STREAM_MIN_RECORDS="4"          # Flatline stream consecutive record limit
TEMPORAL_MAX_DELTA_MM="30.0"          # Maximum allowable step change (mm)
CUMULATIVE_MISMATCH_TOLERANCE_RATIO="0.3" # Daily accumulation mismatch ratio

# Conduit Live Provider Credentials (Optional)
CONDUIT_ENDPOINT=""
CONDUIT_API_KEY=""
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint (application, database, conduit, satellite status) |
| `GET` | `/api/quality/latest` | Latest observation confidence rating & explainable evidence |
| `GET` | `/api/quality/history` | Historical timeline of quality evaluations |
| `GET` | `/api/quality/:timestamp` | Query quality evaluation by timestamp or observation ID |
| `GET` | `/api/comparison/daily` | Quality-screened daily ground vs CHIRPS satellite comparison |
| `GET` | `/api/comparison/summary` | Statistical summary metrics (Bias, MAE, RMSE, Pearson Correlation) |
| `GET` | `/api/actions` | Fetch persistent operator action audit log |
| `POST` | `/api/actions` | Record persistent operator action (`ACCEPT_OBSERVATION`, `MARK_FOR_REVIEW`, `REQUEST_INSPECTION`, `ACKNOWLEDGE_MISMATCH`) |

---

## 💻 Local Commands

```bash
# Install dependencies
npm install

# Run automated unit test suite (22 unit tests)
npm test

# Build production bundle
npm run build

# Start production server
npm start

# Run development server
npm run dev
```

---

## 🚢 Deployment Steps (Vercel / Node.js Host)

1. **Clone & Environment Setup**:
   ```bash
   git clone <repo-url>
   cd VERA
   cp .env.example .env
   ```
2. **Build Production Application**:
   ```bash
   npm run build
   ```
3. **Run Production Server**:
   ```bash
   npm start
   ```
4. **Health Check Verification**:
   ```bash
   curl http://localhost:3000/api/health
   ```
