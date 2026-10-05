"""Lunar Rover backend - serves real lunar data, point-of-interest search and route planning.

Run from the backend folder:  uvicorn app.main:app --port 8000
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.routes import router
from .security import RateLimitMiddleware, SecurityHeadersMiddleware
from .data.store import DataStore
from .settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    docs = "/docs" if settings.enable_docs else None
    app = FastAPI(title="Lunar Rover API", version="1.0", docs_url=docs, redoc_url=None, openapi_url="/openapi.json" if docs else None)
    app.state.settings = settings

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        # Default handler echoes the rejected input, which breaks JSON encoding for NaN/inf. Report fields only.
        errors = [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]
        return JSONResponse({"detail": "Invalid request", "errors": errors}, status_code=422)
    app.state.store = DataStore(settings.data_dir)

    rules = [
        ("/api/route", *settings.route_rate_limit),
        ("/api/tiles", 10**9, 1.0),  # static tiles are unlimited
        ("/api/", *settings.query_rate_limit),
    ]
    # Middleware added last runs first: CORS answers pre-flights before rate limiting sees them.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, rules=rules, trust_proxy=settings.trust_proxy)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    app.include_router(router)
    # Terrain tiles produced by the pipeline (static PNGs).
    app.mount("/api/tiles", StaticFiles(directory=settings.data_dir / "tiles"), name="tiles")
    return app


app = create_app()
