"""Request bodies (responses are plain JSON documents built by the services)."""
from typing import Annotated

from pydantic import BaseModel, Field

# Projected metres. The Moon is ~10,900 km round, so anything beyond 1e7 m is garbage; NaN/inf are rejected.
Metres = Annotated[float, Field(allow_inf_nan=False, ge=-1e7, le=1e7)]


class RouteRequest(BaseModel):
    start: tuple[Metres, Metres]
    goal: tuple[Metres, Metres]
