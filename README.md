# 🌑 LunarGPS: Google Maps for the Moon

Drive a 3D rover across the **real lunar south pole**, with a phone-style GPS built entirely from NASA data. Search for water ice, craters and sunlit sites, get a route, and drive there.

<!-- Add a demo GIF here: ![LunarGPS demo](docs/demo.gif) -->

## What it does

- **Real terrain:** ~370,000 km² south of ~80°S, from NASA LRO/LOLA elevation at 80 m/px
- **Search:** water & ice, craters, sunlit sites and landmarks, with IAU names
- **Routing:** least-cost paths over the real slope grid, with slope hazards
- **"Where am I?":** elevation, slope, sunlight, shadow and the nearest known place
- **Cold traps:** permanently shadowed regions where ice is a candidate; only the LCROSS impact site is marked as confirmed
- **Sourced facts:** every place card cites its dataset

## Data

| Dataset | Source | Used for |
|---|---|---|
| LOLA elevation model (80 m/px) | NASA GSFC PGDA (Barker et al. 2021) | Terrain, slopes, crater depth |
| LOLA average solar visibility | NASA GSFC PGDA (Mazarico et al. 2011) | Sunlight, sunlit sites |
| LOLA permanently shadowed regions | NASA GSFC PGDA (Mazarico et al. 2011) | Cold traps |
| Robbins lunar crater database (2018) | USGS / NASA PDS | Crater positions and sizes |
| Gazetteer of Planetary Nomenclature | IAU / USGS | Place names |

Ground colour, textures, stars and the Sun's motion are generated, not measured. The in-app About page says so.

## Stack

**Data pipeline:** Python (downloads NASA data, builds tiles, grids and points of interest) · **Backend:** FastAPI (tiles, search, locate, routing) · **Frontend:** Next.js + React Three Fiber · **Deploy:** Docker

## Run it

**Windows:** build the data once (first command below), then run `start.bat`. It starts both servers and opens the game.

**Manual:**

```bash
cd lunar-rover/data-pipeline && pip install -r requirements.txt && python build.py --download   # ~400 MB, ~2 min
cd ../backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port 8000
cd ../frontend && npm install && npm run dev   # open http://localhost:3000
```

Drive with **W A S D / arrow keys**, or the on-screen pad on touch screens.

Full details, API reference and limits: [`lunar-rover/README.md`](lunar-rover/README.md) · Deployment: [`lunar-rover/docs/DEPLOYMENT.md`](lunar-rover/docs/DEPLOYMENT.md)

*Independent project, not affiliated with or endorsed by NASA, USGS, the IAU or IBM.*
