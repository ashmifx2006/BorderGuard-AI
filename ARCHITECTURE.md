# BorderGuard AI — Architecture

## Core principle

**AI detects. Rules interpret. Risk prioritizes. Humans decide.**

```text
Video Source
    |
    v
OpenCV -> YOLOv8 -> Centroid Tracking
                    |
          +---------+---------+
          |                   |
      Zone analysis      Movement analysis
          |                   |
          +---------+---------+
                    v
             Event Intelligence
                    |
             Contextual Risk 0–100
                    |
             Explainable Alert
                    |
              Evidence Capture
                    |
              Django REST API
                    |
              React Command Center
                    |
          Human Review / Resolution
                    |
                 Analytics
```

## Intelligence boundary

The project uses measurable video conditions such as zone entry, dwell time, movement speed, repeated events, object count, and temporal correlation. It does not perform face recognition, identity inference, ethnicity/emotion profiling, or unsupported criminal-intent prediction.

## Demo boundary

The border-sector map is a simulated visualization. `DEMO MODE` uses a real supplied video source through the same AI pipeline; it does not inject synthetic detections, alerts, or evidence.
