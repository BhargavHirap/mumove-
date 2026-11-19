# Security policy

## Reporting a vulnerability

Please do not publish exploitable security details in a public issue or discussion.

If GitHub's private vulnerability reporting is enabled for this repository, use the repository's **Security → Report a vulnerability** flow. Otherwise, contact the maintainer privately through https://github.com/BhargavHirap.

Include the affected component, impact, reproduction steps and any relevant logs. Avoid sending real user data, credentials or secrets.

## Supported versions

MUMOVE is an early-stage prototype. Security fixes are currently applied to the latest code on the default branch; no older release series is formally supported.

## Secret-handling rules

- Never commit Supabase service-role keys, database passwords, access tokens or bot credentials.
- Frontend variables must contain only values intended to be public, such as a Supabase anon/publishable key.
- Keep ingestion credentials in protected server-side secrets.
- If a secret is exposed, revoke or rotate it immediately; deleting it from a later commit is not sufficient.
