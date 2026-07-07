# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — run with `node --watch` (auto-restart on file change)
- `pnpm start` — run once (`node index.mjs`)
- `pnpm lint` / `pnpm lint:fix` — ESLint over the repo

Package manager is **pnpm** (`packageManager: pnpm@10.12.1`). There is no test suite. Node 22 (see Dockerfile). Both `biome.json` and `eslint.config.mjs` exist, but only ESLint is wired into npm scripts.

### Building the container image

Use Apple's **`container`** CLI, **not** Docker — e.g. `container build -t beam:latest .`. Do not run `docker` or start Docker Desktop.

The `#*` import alias maps to the repo root (`package.json` `imports`), so `#lib/ome.mjs`, `#api/v1/index.mjs`, etc. resolve from anywhere.

## What this is

Beam Server is the control plane between an **OvenMediaEngine (OME)** streaming server and the **Nostr** network. It does not touch media itself — OME ingests RTMP and egests LLHLS, and this server authorizes those connections, tracks live streams, and mirrors their state into Nostr as [NIP-53](https://github.com/nostr-protocol/nips/blob/master/53.md) live-event (kind `30311`) records.

`index.mjs` boots two independent subsystems:
- `#api/index.mjs` — Express server (default port 3000)
- `#worker/index.mjs` — on startup, queries OME for already-live streams and resumes viewer-count monitoring for each

## Architecture

### Two entry points into a stream's lifecycle

1. **OME admission webhook** (`api/v1/admission`) — the primary path. OME calls this server whenever an RTMP connection opens or closes. The handler decides `{ allowed, new_url }`. This is where streams are born and die.
2. **Push API** (`api/v1/streams`) — a REST API for an authenticated user to re-broadcast their live stream out to YouTube/Twitch/Facebook via OME's Push feature.

### `LiveStream` (`lib/live-stream.mjs`) — the core state object

An in-memory registry (`LiveStream.streaming` array) of active streams. **There is no database** — restart loses state, which is why the worker rehydrates from OME on boot.

- Constructor is overloaded: pass a **pubkey** (new stream, generates a UUID id and a name prefixed `local_`/`lgm_`/`remote_` based on `PUBKEY_LOCAL`/`PUBKEY_LGM` env matching) or pass an existing **name** like `local_<uuid>` (reconstructs from OME).
- `start()` — waits for OME to report the stream ready, ends any stale prior live event for that pubkey, merges title/summary/image from the user's Nostr config (kind `30078`, `d=beamlivestudio-config`) + last live event, then publishes a kind `30311` "live" event and begins the auto-update loop.
- `startAutoUpdateInterval()` — self-rescheduling 30s loop that republishes the live event with current/max viewer counts pulled from OME stats.
- `end()` — stops the loop and republishes the event with `status=ended` and a `recording` URL.

The **stream `name`** is the identity used everywhere (OME URLs, Nostr `d` tag, ownership checks) — not the raw UUID `id`.

### Nostr layer (`lib/nostr.mjs`)

Wraps `nostr-tools` SimplePool against hardcoded relays (damus, nostr.band, nos.lol). The server signs events with its **own** key (`NOSTR_PRIVATE_KEY`, nip19-encoded) — `pk` is the server's pubkey, distinct from a stream's owner pubkey. Live events are authored by the server (`pk`) with the owner referenced via a `p` tag.

### OME layer (`lib/ome.mjs`)

All OME REST calls and URL construction. `url.*` builds the many OME endpoint/playback URLs; `api.*` calls the OME REST API (Basic auth via `OME_API_KEY`). Push stream create/stop/list hit OME's `:startPush`/`:stopPush`/`:listPush` verbs.

### Authentication — two distinct schemes

- **Admission webhook**: HMAC-SHA1 of the JSON body against `OME_ADMISSION_SECRET_KEY`, checked in `x-ome-signature` (timing-safe). Additionally, the stream key itself is a **Beam Stream Key (BSK)** — a compact `pubkey.created_at.sig` triplet carried as the last path segment of the RTMP ingest URL. `verifyStreamKey` reconstructs a canonical kind-27700 Nostr event (fixed empty tags/content), recomputes its `id`, and verifies the schnorr signature to prove pubkey ownership. Spec: `docs/streamkey-nip.md`. A stream key of `test` triggers a preview-only path. (This replaces the earlier reuse of NIP-98 for ingest — NIP-98 now applies only to the Push REST API below.)
- **Push REST API**: `verifyNostrAuth` middleware expects `Authorization: Nostr <base64 kind-27235 event>` (NIP-98), validating signature, kind, 60s freshness, and that the event's `u`/`method` tags match the request. `checkStreamOwnership` then confirms `stream.pubkey === req.pubkey`.

Note: the admission endpoint always returns HTTP 200, signaling rejection via `{ allowed: false, reason }` in the body (OME's expected contract).

## Configuration

Env vars (see `.env.template`): `NOSTR_PRIVATE_KEY`, `OME_API_KEY`, `OME_ADMISSION_SECRET_KEY`, `OME_HOST`, `OME_IP`, `PUBKEY_LOCAL`, `PUBKEY_LGM`. Note `lib/ome.mjs` reads `OME_API_HOST` for the REST API host, while `.env.template` lists `OME_HOST_API` — reconcile this when configuring.
