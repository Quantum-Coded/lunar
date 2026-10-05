"""Small planar geometry helpers shared by the services."""
import math


def distance_m(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot(x2 - x1, y2 - y1)


def bearing_deg(x1: float, y1: float, x2: float, y2: float) -> float:
    """Map bearing: 0 = +y (map north), 90 = +x (map east), clockwise."""
    return math.degrees(math.atan2(x2 - x1, y2 - y1)) % 360.0
