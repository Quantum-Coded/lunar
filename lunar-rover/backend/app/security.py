"""Security middleware: response headers and a small in-memory per-client rate limiter."""
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Resource-Policy": "cross-origin",  # tiles and images are meant to be loaded by the frontend
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            # The interactive docs page needs scripts and styles, so it keeps the browser defaults.
            if name == "Content-Security-Policy" and request.url.path.startswith(("/docs", "/redoc", "/openapi")):
                continue
            response.headers.setdefault(name, value)
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window limiter. `rules` maps a path prefix to (max_requests, window_seconds); first match wins.

    Terrain tiles are static files that a fast-moving rover legitimately requests in bursts, so they are not limited.
    """

    def __init__(self, app, rules: list[tuple[str, int, float]], trust_proxy: bool = False):
        super().__init__(app)
        self.rules = rules
        self.trust_proxy = trust_proxy
        self.hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._last_prune = time.monotonic()

    def _client(self, request: Request) -> str:
        if self.trust_proxy:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        for prefix, limit, window in self.rules:
            if path.startswith(prefix):
                now = time.monotonic()
                key = (self._client(request), prefix)
                q = self.hits[key]
                while q and now - q[0] > window:
                    q.popleft()
                if len(q) >= limit:
                    retry = max(1, int(window - (now - q[0])))
                    return JSONResponse({"detail": "Too many requests, please slow down."}, status_code=429, headers={"Retry-After": str(retry)})
                q.append(now)
                self._prune(now, window)
                break
        return await call_next(request)

    def _prune(self, now: float, window: float) -> None:
        if now - self._last_prune < 60:
            return
        self._last_prune = now
        for key in [k for k, q in self.hits.items() if not q or now - q[-1] > window]:
            del self.hits[key]
