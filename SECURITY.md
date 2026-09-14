# Security Notes

- Never commit `.env`, API tokens, passwords, model weights, databases, or evidence captures.
- Use a unique production `SECRET_KEY` and set `DEBUG=False` in deployment.
- Restrict `ALLOWED_HOSTS`, CORS, and CSRF trusted origins to known domains.
- Serve production traffic over HTTPS.
- Keep the AI worker private; authenticate its API requests with a service token.
- Do not enable face recognition, identity inference, ethnicity/emotion classification, or criminal-intent prediction as an unsupported feature.
- Evidence hashes provide integrity checking in this prototype; they are not by themselves a production forensic chain of custody.
- Review retention, access control, audit logging, and incident-export policies before operational use.
