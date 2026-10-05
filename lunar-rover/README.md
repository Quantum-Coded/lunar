# Lunar Rover — drive the real Moon

A 3D rover game built from real NASA data. Drive across the lunar south pole with a phone-style GPS beside the view: pick
**water & ice**, **craters**, **sunlit sites** or **landmarks**, get a route, and let the rover guide you there.
**Information poles** explain each notable place in plain language, with sourced facts.

> Independent project. Not affiliated with or endorsed by NASA, USGS, the IAU, IBM or Apple.

## What is real

Everything on the map comes from these products (full list with citations in [`data-pipeline/sources.yaml`](data-pipeline/sources.yaml) and on the in-app About page):

| Data | Source | Used for |
|---|---|---|
| LOLA elevation model, 80 m/px | NASA GSFC PGDA / LRO LOLA team (Barker et al. 2021) | terrain, slopes, crater depths |
| LOLA average solar visibility | NASA GSFC PGDA (Mazarico et al. 2011) | sunlight %, sunlit sites |
| LOLA permanently shadowed regions | NASA GSFC PGDA (Mazarico et al. 2011) | cold traps, shadowed terrain |
| Robbins lunar crater database (2018) | USGS / NASA PDS | crater positions and sizes |
| IAU Gazetteer of Planetary Nomenclature | IAU / USGS | names and namesakes |
| LCROSS water detection, cited facts | `data-pipeline/references/*.yaml` | the only hand-transcribed items, each cited |

**Coverage is about 1% of the Moon** (≈369,664 km² south of ~80°S). It is computed from the dataset footprints, and the app
refuses to render outside it. Ground colour, texture, stars and the Sun's motion are generated; the About page says so.

## Layout

```
data-pipeline/   Python. Downloads NASA data, builds terrain tiles, grids and points of interest.
backend/         FastAPI. Tiles, place search, "where am I", least-cost route planning. Knows nothing about the UI.
frontend/        Next.js + React Three Fiber. 3D world, HUD, phone GPS, About page.
deploy/          Docker + bundle script for free hosting.   docs/ deployment guide and launch post draft.
data/processed/  Pipeline output (git-ignored).
```

## Run locally

Windows, from the folder that contains `lunar-rover` (or inside it): run `start.bat` — it starts both servers and opens the game.

Manually:

```bash
# 1. Build the data once (downloads ~400 MB from NASA/USGS, ~2 min to process)
cd data-pipeline && pip install -r requirements.txt && python build.py --download
# 2. Backend
cd ../backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port 8000
# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev      # http://localhost:3000
```

Stop the backend before re-running the pipeline on Windows (it memory-maps the grids).
Tests: `cd backend && pip install -r requirements-dev.txt && python -m pytest`.

## Controls

`W A S D` / arrow keys + `Space` to drive; on touch screens use the on-screen pad. Turn a phone sideways for a bigger view.

## Backend API

| Endpoint | Purpose |
|---|---|
| `GET /api/region` | coverage, projection, tile layout, dataset credits |
| `GET /api/pois?category=&q=&near_x=&near_y=&radius_m=&poles_only=&limit=` | search; nearest-first with `near_*` |
| `GET /api/pois/{id}` | full detail with facts and sources |
| `GET /api/locate?x=&y=` | elevation, slope, sunlight, shadow, enclosing features, nearest known place |
| `POST /api/route` | least-cost path over the real slope grid |
| `GET /api/tiles/{z}/{x}/{y}/{height,data}.png`, `GET /api/overview/{relief,shadow,sunlight}.png` | map imagery |

Coordinates are south-polar stereographic metres (`x` east, `y` north of the pole). Settings are environment variables prefixed `LUNAR_`
(see `backend/app/settings.py`).

## Security notes

Inputs are validated (finite, bounded coordinates; length-limited text), route planning is rate limited per client, responses carry
security headers, the production frontend ships a strict Content-Security-Policy, user-facing text is rendered through React (no raw HTML),
and the interactive API docs can be disabled (`LUNAR_ENABLE_DOCS=false`). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the free hosting guide.

## Limits

- Terrain is 80 m/px: smooth at rover scale. Slope hazards are derived at that scale and understate rock-level risk.
- "Cold trap" means permanently shadowed — ice is a candidate there, not confirmed (only the LCROSS site is marked confirmed).
- The pipeline downloads data over HTTPS but does not verify checksums.
- The rover model is a third-party asset: add its author and licence in `frontend/src/lib/credits.ts`.
