# Pharos Applitools Helper

A tiny Windows helper that fetches Applitools batch results from a QA
laptop and uploads them to Pharos. Pharos itself can't reach the
Applitools API from Railway because corporate egress blocks it; this
helper is the workaround.

## Why this exists

```
QA laptop                Applitools API           Pharos / Railway
─────────                ──────────────           ────────────────
applitools-fetch ───GET──► batch/{id}
                 ◄────JSON──┘
                 ────────────POST results──────► /api/applitools
                                                 /upload-batch
```

The QA laptop is on the corporate network where the Applitools API is
allowlisted; Railway is not. So the helper does the fetch locally and
ships the rows over plain outbound HTTPS to Pharos — the same kind of
traffic every browser tab on a corporate machine already makes.

## For QA: how to use it

1. Download `applitools-fetch.exe` from the **Builds** page in Pharos
   (under "Applitools Configuration → Download helper").
2. Save it somewhere convenient, e.g. `C:\Tools\applitools-fetch.exe`.
3. Double-click it the first time. It will ask for:
   - **Applitools API key** — your `X-Eyes-Api-Key`.
   - **Pharos upload token** — ask Adam for the current value.
   - **Pharos URL** — accept the default unless you're testing a fork.
   These get saved to `config.ini` next to the exe; you'll never be
   prompted again.
4. For each release, run:

   ```cmd
   applitools-fetch.exe BATCH_ID_HERE
   ```

   …or just double-click and paste the batch id at the prompt. The
   helper prints `OK — uploaded N row(s)` on success.
5. In Pharos, type the same batch id into the Visual card and click
   **+ Sheet**. The Unresolved/Failed rows are folded in automatically.

You can re-run the helper for the same batch id any time — the latest
upload replaces the previous one. Cached uploads expire on the server
after 24 hours, so re-run if you let a release sit overnight.

## For developers: building the .exe

You need Python 3.11+ on your dev machine. QA machines do **not** need
Python — they only ever see the bundled `.exe`.

```cmd
cd tools\applitools_helper
build.bat
```

The output lands at `tools\applitools_helper\dist\applitools-fetch.exe`
(roughly 15–20 MB). To make Pharos serve it, drop a copy under
`frontend\public\downloads\applitools-fetch.exe` (or wherever the Vite
build picks up static assets); the Builds page links at
`/downloads/applitools-fetch.exe`.

The build script creates a local `.venv` so it doesn't pollute system
Python, and uses `--onefile` so the produced exe needs nothing on the
target machine.

## Server-side setup (one-time)

Set `APPLITOOLS_HELPER_TOKEN` to a random secret (e.g.
`openssl rand -hex 24`) in Railway env vars. Without it, the upload
endpoint returns 503 — that's intentional, so a misconfigured deploy
fails closed instead of silently accepting unauthenticated writes.

Hand the same value to QA so they can paste it into their helper's
first-run prompt.

## File layout

```
tools/applitools_helper/
├── applitools_fetch.py     # The helper itself (~250 lines)
├── requirements.txt        # `requests`
├── build.bat               # PyInstaller wrapper
├── README.md               # This file
└── .gitignore              # Excludes .venv/, build/, dist/
```
