# Contributing to MUMOVE

Thanks for considering a contribution. MUMOVE is an early-stage mobility project, so small, focused improvements are especially valuable.

## Before you start

1. Read the project [README](README.md), especially the coverage and data-honesty notes.
2. Search existing [issues](https://github.com/BhargavHirap/mumove-/issues) and pull requests to avoid duplicate work.
3. For a major feature or architectural change, open an issue or discussion first.
4. Never commit API keys, service-role keys, passwords, personal data or private operator datasets.

## Good areas to contribute

- Reproducible bug fixes and automated tests.
- Mobile usability, accessibility and performance.
- Journey-planning accuracy and interchange handling.
- Documentation and setup improvements.
- Verified public transport datasets, with source, licence, validity dates and service calendars documented.
- Better handling of missing, stale or uncertain data.

## Development workflow

```bash
npm install
npm run dev
npm run build
```

Create a focused branch from the current default branch, make your change, and open a pull request with:

- A clear summary of the problem and solution.
- Screenshots or a short recording for UI changes.
- Test steps and build results.
- Data-source and licensing details for transport-data changes.
- Any known limitations or follow-up work.

## Transport-data requirements

Do not invent routes, departures, fares, alerts or vehicle positions. A data contribution should identify the publisher, source URL, licence/permission, retrieval date, effective period and relevant service calendar. Clearly label estimates and community-submitted reports.

## Pull requests

Keep pull requests small and reviewable. Update documentation when behaviour changes. The project maintainer may request changes or decline a contribution that cannot be verified or safely maintained.

By participating, you agree to follow the project's [Code of Conduct](CODE_OF_CONDUCT.md).
