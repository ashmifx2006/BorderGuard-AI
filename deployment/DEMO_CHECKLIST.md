# Final Demo Checklist

### 30 minutes before judging

- Backend starts and `/api/health/` returns `status: ok`.
- React starts and login works.
- Demo camera/zone data is seeded.
- `media/videos/test.mp4` is present and approved.
- YOLO model weights are available locally.
- AI token is configured only in `ai_engine/.env`.
- AI preflight passes.
- Browser shows CAM-01 as AI active after the worker starts.

### Judge sequence

1. Login
2. Command Center
3. CAM-01 telemetry
4. YOLO detection + track ID
5. Restricted zone
6. Event classification
7. 0–100 contextual risk
8. Explainable factors
9. Evidence frame
10. Integrity verification
11. Acknowledge
12. Investigate + notes
13. Resolve
14. Analytics update

### Recovery

If the video window is unavailable, use the saved annotated recording path only if it was produced by the real AI pipeline. Never manually inject an alert for the presentation.
