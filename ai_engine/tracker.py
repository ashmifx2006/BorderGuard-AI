"""
tracker.py — lightweight centroid tracker.

This is intentionally simple (no external tracking library) so the
project has zero extra dependencies beyond OpenCV + Ultralytics. It's
good enough to give each detected object a stable ID across frames for
zone-dwell-time and prolonged-presence logic.
"""
import math


class CentroidTracker:
    def __init__(self, max_distance=80, max_missed=15):
        self.next_id = 1
        self.objects = {}       # id -> {centroid, bbox, label, missed}
        self.max_distance = max_distance
        self.max_missed = max_missed

    @staticmethod
    def _centroid(bbox):
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    def update(self, detections):
        input_centroids = [self._centroid(d["bbox"]) for d in detections]

        if not self.objects:
            for i, det in enumerate(detections):
                self._register(det, input_centroids[i])
            return self._as_result()

        object_ids = list(self.objects.keys())
        object_centroids = [self.objects[oid]["centroid"] for oid in object_ids]

        unmatched_inputs = set(range(len(detections)))
        unmatched_objects = set(range(len(object_ids)))

        pairs = []
        for oi, oc in enumerate(object_centroids):
            for ii, ic in enumerate(input_centroids):
                dist = math.dist(oc, ic)
                pairs.append((dist, oi, ii))
        pairs.sort(key=lambda p: p[0])

        for dist, oi, ii in pairs:
            if oi not in unmatched_objects or ii not in unmatched_inputs:
                continue
            if dist > self.max_distance:
                continue
            oid = object_ids[oi]
            det = detections[ii]
            self.objects[oid].update({
                "centroid": input_centroids[ii],
                "bbox": det["bbox"],
                "label": det["label"],
                "confidence": det["confidence"],
                "missed": 0,
            })
            unmatched_objects.discard(oi)
            unmatched_inputs.discard(ii)

        for oi in unmatched_objects:
            oid = object_ids[oi]
            self.objects[oid]["missed"] += 1
            if self.objects[oid]["missed"] > self.max_missed:
                del self.objects[oid]

        for ii in unmatched_inputs:
            self._register(detections[ii], input_centroids[ii])

        return self._as_result()

    def _register(self, det, centroid):
        self.objects[self.next_id] = {
            "centroid": centroid, "bbox": det["bbox"], "label": det["label"],
            "confidence": det["confidence"], "missed": 0,
        }
        self.next_id += 1

    def _as_result(self):
        return {
            oid: {k: v for k, v in obj.items() if k != "missed"}
            for oid, obj in self.objects.items()
        }
