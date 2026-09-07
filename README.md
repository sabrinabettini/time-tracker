# Time Tracker

A responsive time-tracking web app for recording work by task and client, attaching evidence, and producing a weekly hours and value report.

## Current capabilities

- Start and stop a live timer
- Record client and hourly rate
- Attach commit and screenshot links with an outcome note
- Persist entries in a D1/SQLite database
- Show weekly hours, estimated billable value, client count and weekday totals
- Export the current week as CSV
- Delete incorrect completed or running entries with confirmation
- Use the app in desktop and mobile browsers

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

## Validate

```bash
npm run db:generate
npm run build
```

## Current boundaries

This first version has no accounts, direct file uploads, GitHub API integration, invoicing, or completed-entry editing. Screenshot evidence is captured as a URL. Do not deploy it for multiple users until authentication and record ownership are implemented.
