"""
zone_detector.py — checks whether a tracked object's centroid falls
inside one or more configured restricted zones.

Zones are polygons of points normalized to 0-1 so they scale with any
frame resolution. Point-in-polygon uses the standard ray-casting
algorithm (no extra geometry library needed).
"""


def point_in_polygon(point, polygon):
    x, y = point
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


class ZoneDetector:
    def __init__(self, zones):
        """
        zones: list of dicts {name, severity, polygon: [[x,y],...] normalized 0-1}
        """
        self.zones = zones

    def check(self, centroid, frame_w, frame_h):
        """Returns the first zone dict whose polygon contains this point, or None."""
        norm_point = (centroid[0] / frame_w, centroid[1] / frame_h)
        for zone in self.zones:
            if point_in_polygon(norm_point, zone["polygon"]):
                return zone
        return None
