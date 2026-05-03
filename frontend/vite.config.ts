import path from "path"
import fs from "node:fs"
import { defineConfig, loadEnv, type PluginOption } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Opt-in dev-only API mocking. With VITE_USE_MOCKS=1 (set in
// `frontend/.env.local`, which is gitignored by Vite default), requests
// to the endpoints listed in MOCK_MAP serve canned JSON from
// `dev-mocks/` instead of being proxied to the Flask backend on :5000.
// Lets us preview UI changes without running the Python stack locally.
//
// To enable mocks: create `frontend/.env.local` with
//   VITE_USE_MOCKS=1
// then `npm run dev` as usual.
//
// To refresh fixtures from production:
//   curl -s https://pagespeed-production.up.railway.app/api/dashboard/snapshots/history \
//     -o frontend/dev-mocks/snapshots-history.json
//
// Add new endpoints by extending MOCK_MAP and dropping the matching
// JSON file in `dev-mocks/`. Path matching ignores query strings so
// `?windowDays=7`-style variants resolve to the same fixture.
const MOCK_MAP: Record<string, string> = {
  "/api/dashboard/health": "health.json",
  "/api/dashboard/kpis": "kpis.json",
  "/api/dashboard/sources": "sources.json",
  "/api/dashboard/workstreams": "workstreams.json",
  "/api/dashboard/blockers": "blockers.json",
  "/api/dashboard/production-failures": "production-failures.json",
  "/api/dashboard/new-bugs": "new-bugs.json",
  "/api/dashboard/task-status": "task-status.json",
  "/api/dashboard/trend": "trend.json",
  "/api/dashboard/snapshots/history": "snapshots-history.json",
  "/api/dashboard/snapshots/diff": "snapshots-diff.json",
  "/api/dashboard/snapshots/latest": "snapshots-latest.json",
  "/api/sites": "sites.json",
  "/api/sites/1/urls": "sites-1-urls.json",
  "/api/sites/2/urls": "sites-2-urls.json",
  // Latest-results: query-string is stripped so both ?strategy=desktop
  // and ?strategy=mobile resolve to the same desktop fixture in mocks.
  // Strategy toggle won't reflect different data offline; that's fine
  // for UI iteration on table layout, tabs, etc.
  "/api/sites/1/latest-results": "sites-1-latest-desktop.json",
  "/api/sites/2/latest-results": "sites-2-latest-desktop.json",
}

function devMockPlugin(): PluginOption {
  return {
    name: "pharos-dev-mock-api",
    configureServer(server) {
      // Resolve VITE_USE_MOCKS from `.env.local` etc. via Vite's loader,
      // so it doesn't depend on the surrounding shell environment.
      const env = loadEnv(server.config.mode, server.config.root, "VITE_")
      const enabled = env.VITE_USE_MOCKS === "1"
      if (!enabled) return
      const mocksDir = path.resolve(__dirname, "dev-mocks")
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const pathOnly = req.url.split("?")[0]
        const fixture = MOCK_MAP[pathOnly]
        if (!fixture) return next()
        const filePath = path.join(mocksDir, fixture)
        try {
          const body = fs.readFileSync(filePath)
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.setHeader("X-Pharos-Mock", fixture)
          res.end(body)
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: `mock fixture missing: ${fixture}`, detail: String(err) }))
        }
      })
      server.config.logger.info(
        `[pharos-dev-mock-api] enabled — serving ${Object.keys(MOCK_MAP).length} endpoints from dev-mocks/`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devMockPlugin()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
  build: {
    outDir: "dist",
  },
})
