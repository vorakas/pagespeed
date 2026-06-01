# Deploy Reference — Pharos Operations Hub

Detail moved out of `CLAUDE.md`. Read this when deploying.

## Production
- **URL:** `https://pagespeed-production.up.railway.app/`
  - `/` — React frontend (primary, all pages)
  - `/legacy/` — Archived Flask/template frontend (read-only, do NOT update)
- **Branch:** `master` (only active branch; new work directly on master or a fresh feature branch off it)
- **Builder:** Dockerfile (multi-stage: node:20-alpine for React build → python:3.11-slim for Flask)
- **PORT:** Railway sets `$PORT`; networking currently 5000.

## Railway IDs
- Project `a6cb2ea4-df71-4b99-b162-38571eea72fa`
- Service `0b3030d3-7c70-4d6a-a4ab-47d84a58b123`
- Environment `0226ddd8-058c-4d74-a18a-e4d831d1a195`

## ⚠️ Deploy gotchas
- **GitHub webhook is broken** — auto-deploy on push does not work. Always deploy manually.
- The GraphQL `serviceInstanceDeploy` mutation **often redeploys the previously-built image** instead of building the just-pushed commit (reuses Docker cache, serves stale frontend bundles). Prefer the CLI, or verify the commit hash after the mutation.
- Railway CLI requires the token under `RAILWAY_API_TOKEN` (account-scoped). `RAILWAY_TOKEN` is project-scoped and fails CLI auth with "Invalid RAILWAY_TOKEN".
- On Windows, `railway up .` (with the `.` path argument) fails at the "Indexing..." phase (exit 1); the same command without the path argument succeeds.

## Quick deploy
```
git push
RAILWAY_API_TOKEN="$RAILWAY_TOKEN" npx @railway/cli up -m "$(git log -1 --pretty=%s)"
```
`railway up` uploads the local working tree and forces a fresh Docker build, bypassing the image cache.

## "Push to GitHub and deploy to Railway" workflow
1. Push to GitHub (`git push` from `C:/pagespeed-monitor`).
2. Read `RAILWAY_TOKEN` from `C:/pagespeed-monitor/.env`.
3. Trigger a deploy via GraphQL:
   ```bash
   source /c/pagespeed-monitor/.env && curl -s -X POST https://backboard.railway.app/graphql/v2 \
     -H "Authorization: Bearer $RAILWAY_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "mutation { serviceInstanceDeploy(environmentId: \"0226ddd8-058c-4d74-a18a-e4d831d1a195\", serviceId: \"0b3030d3-7c70-4d6a-a4ab-47d84a58b123\") }"}'
   ```
4. Verify the deploy used the new commit:
   ```bash
   curl -s -X POST https://backboard.railway.app/graphql/v2 \
     -H "Authorization: Bearer $RAILWAY_TOKEN" -H "Content-Type: application/json" \
     -d '{"query": "query { deployments(first: 1, input: { serviceId: \"0b3030d3-7c70-4d6a-a4ab-47d84a58b123\", environmentId: \"0226ddd8-058c-4d74-a18a-e4d831d1a195\" }) { edges { node { status meta } } } }"}'
   ```
   If `meta.commitHash` is not the HEAD you just pushed, fall back to the CLI (step 5).
5. **Fallback — force a fresh build via CLI:**
   ```bash
   cd /c/pagespeed-monitor && source .env && RAILWAY_API_TOKEN="$RAILWAY_TOKEN" npx @railway/cli up -m "$(git log -1 --pretty=%s)"
   ```

## "Update and Commit" workflow
1. Update `CLAUDE.md`.
2. Update `README.md`.
3. Commit and push all recent changes to GitHub.

## Commit convention
Include trailer: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
