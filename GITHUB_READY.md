# GitHub Submission Checklist

## Before pushing

- [ ] Remove all real `.env` files from the working tree.
- [ ] Confirm no API tokens, passwords, secret keys, or private URLs are committed.
- [ ] Keep model weights (`*.pt`) out of Git; document where judges can obtain them.
- [ ] Keep real CCTV/video/evidence files out of Git unless explicitly approved for release.
- [ ] Run Django migrations and tests locally.
- [ ] Run `npm install` and `npm run build` locally.
- [ ] Run the AI preflight with the approved demo clip.
- [ ] Verify the complete judge flow from login through resolution and analytics.
- [ ] Review `SECURITY.md` before any public deployment.

## Repository presentation

Recommended top-level reading order:

1. `README.md`
2. `ARCHITECTURE.md`
3. `DEMO_MODE.md`
4. `JUDGE_PITCH.md`
5. `SECURITY.md`
6. `deployment/README.md`

## What not to claim

Do not describe the prototype as live national-border surveillance, autonomous threat identification, criminal-intent prediction, identity recognition, or production forensic chain of custody. Describe it as an explainable decision-support prototype operating on configurable video events.
