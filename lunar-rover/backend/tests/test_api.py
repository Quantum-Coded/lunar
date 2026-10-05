"""API smoke tests against the processed data (run the data pipeline first)."""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings

settings = Settings()
pytestmark = pytest.mark.skipif(not (settings.data_dir / "region.json").exists(), reason="processed data not built")


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app(settings))


def test_region_declares_real_data_coverage(client):
    region = client.get("/api/region").json()
    assert region["coverage"]["area_km2"] > 0
    assert {d["id"] for d in region["datasets"]} >= {"dem", "illumination", "psr", "craters", "nomenclature"}


def test_poi_search_orders_by_distance(client):
    rows = client.get("/api/pois", params={"near_x": 0, "near_y": 0, "limit": 10}).json()
    distances = [r["distance_m"] for r in rows]
    assert distances == sorted(distances)


def test_locate_inside_permanent_shadow(client):
    shackleton = client.get("/api/pois", params={"q": "Shackleton cold trap", "limit": 1}).json()[0]
    info = client.get("/api/locate", params={"x": shackleton["x"], "y": shackleton["y"]}).json()
    assert info["in_coverage"] and info["in_shadow_region"] and info["sun_visibility_pct"] == 0


def test_locate_outside_coverage(client):
    assert client.get("/api/locate", params={"x": 9e6, "y": 9e6}).json()["in_coverage"] is False


def test_route_connects_two_points(client):
    a = client.get("/api/pois", params={"category": "sunlit", "limit": 1}).json()[0]
    b = client.get("/api/pois", params={"category": "sunlit", "near_x": a["x"], "near_y": a["y"], "limit": 2}).json()[1]
    route = client.post("/api/route", json={"start": [a["x"], a["y"]], "goal": [b["x"], b["y"]]}).json()
    assert route["waypoints"][0] == [round(a["x"], 1), round(a["y"], 1)]
    assert route["distance_m"] >= route["straight_line_m"] * 0.99


def test_route_rejects_points_outside_zone(client):
    r = client.post("/api/route", json={"start": [9e6, 9e6], "goal": [0, 0]})
    assert r.status_code == 422


def test_rejects_non_finite_and_out_of_range_coordinates(client):
    assert client.get("/api/locate", params={"x": "nan", "y": 0}).status_code == 422
    assert client.get("/api/locate", params={"x": "inf", "y": 0}).status_code == 422
    assert client.get("/api/locate", params={"x": 1e12, "y": 0}).status_code == 422
    assert client.post("/api/route", content='{"start":[NaN,0],"goal":[0,0]}', headers={"Content-Type": "application/json"}).status_code == 422


def test_security_headers_present(client):
    headers = client.get("/api/zone-facts").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"


def test_unknown_overview_layer_and_tile_traversal_blocked(client):
    assert client.get("/api/overview/../../etc/passwd.png").status_code in (404, 422)
    assert client.get("/api/tiles/../grids/elevation.npy").status_code == 404
    assert client.get("/api/tiles/%2e%2e/grids/elevation.npy").status_code in (404, 400)


def test_route_is_rate_limited():
    limited = TestClient(create_app(Settings(route_rate_limit=(2, 60.0))))
    body = {"start": [9e6, 9e6], "goal": [0, 0]}
    codes = [limited.post("/api/route", json=body).status_code for _ in range(4)]
    assert codes[:2] == [422, 422] and codes[-1] == 429
