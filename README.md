# Final Album Details

Vercel-ready Next.js app for assigning albums to producers and collecting final album metadata.

## Local setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Add your Airtable personal access token and base ID.
4. Run the development server.

```bash
npm install
npm run dev
```

The app runs with demo data until `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` are set.

Add Album stores the Box folder link with the album. Producers can drop local audio files on the final-details page to populate track names and preview playback while completing the form.

## Airtable permissions

Use a personal access token with access to the `Final Album Details` base and record read/write permissions. The app expects these tables:

- `Producers`
- `Albums`
- `Tracks`
- `Art References`
- `Submissions`

## Vercel environment variables

Set these in Vercel before deploying:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `NEXT_PUBLIC_APP_URL`

Optional table overrides are listed in `.env.example`. Album statuses are fixed to `Assigned` and `Completed`.
