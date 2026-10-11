# AeroJudge mobile

Expo app for live public results. It reads published competitions from the existing API and follows standings over the public Socket.IO channel. Scoring, administration, and registration stay on the website.

## Requirements

- Node.js 22.13 or newer (Expo SDK 57). The rest of the monorepo still allows Node 20.
- The AeroJudge API, local or production.

## Local development

From the repository root:

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env
npm run db:generate && npm run db:migrate
npm run start --workspace=@aero-judge/mobile
```

`EXPO_PUBLIC_API_URL` is the API origin, for example `http://localhost:4000`. On a device, use the computer's LAN address. The development API already allows private-network origins.

`npm run dev` at the repository root does not start this app. The mobile package has no `dev` script, so Turbo leaves it out of the website workflow.

```bash
npm run ios --workspace=@aero-judge/mobile
npm run android --workspace=@aero-judge/mobile
npm run web --workspace=@aero-judge/mobile
npm run test --workspace=@aero-judge/mobile
npm run typecheck --workspace=@aero-judge/mobile
```

After changing `@aero-judge/shared`, `@aero-judge/utils`, or `@aero-judge/scoring-engine`, rebuild that package. Metro reads the built `dist` output.

## What this version does

1. Lists published competitions from `GET /api/v1/public/competitions`.
2. Opens a competition from `GET /api/v1/public/:id`.
3. Shows standings from `GET /api/v1/public/:id/results`.
4. Joins the public socket room and reloads standings when scores, rankings, or publish events arrive.
5. Pull to refresh. A failed refresh keeps the last loaded list or standings and does not call them live.
6. `layout=top10` shows the first ten overall rows.

A venue link such as:

`https://aerojudge.nepalabs.com/display/competition/:id?layout=top10`

maps to `/competition/:id?layout=top10`. The custom scheme is `aerojudge://`.

Universal Links and Android App Links are not active. Hosting `apple-app-site-association` and `assetlinks.json` would be a production change, and website links continue to open in the browser until that is approved.

## Builds

[EAS Build](https://docs.expo.dev/build/setup/) profiles are in `eas.json`.

| Profile     | API                              |
| ----------- | -------------------------------- |
| development | `http://localhost:4000`          |
| preview     | `https://aerojudge.nepalabs.com` |
| production  | `https://aerojudge.nepalabs.com` |

Do not run a store submission from this repository without approval. Bundle identifiers are `com.nepalabs.aerojudge`. The icon is the current AeroJudge logo on a square field; replace it with a 1024px store icon before release.

## Shared code

The app imports `@aero-judge/shared` and `@aero-judge/utils`. Official rankings are calculated on the server. `@aero-judge/scoring-engine` is covered by the mobile unit tests so the phone and the API resolve the same package. The app does not import `@aero-judge/ui`, Prisma, or the PDF engine.

## Out of scope

The app shows public published data only. Sign-in, score entry, registration, and admin tools stay on the website.
