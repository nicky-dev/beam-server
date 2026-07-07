# Beam Stream Key (BSK) — Ingest Authorization Event

## Abstract
A compact stream key that authenticates a broadcaster to the Beam ingest server (OvenMediaEngine
admission webhook) by proving control of a Nostr public key. Replaces the previous reuse of
NIP-98 (kind 27235) for RTMP ingest.

## Motivation
- NIP-98 is scoped to one HTTP request (`u`/`method` tags, 60s freshness) — wrong semantics for a
  static ingest credential pasted into OBS / TikTok Studio.
- Ingest platforms (TikTok Studio) cap the stream key length (~510 chars); a full base64 event is
  bulky.
- We need a compact, deterministic, self-verifiable token.

## The event
A kind-27700 Nostr event, signed per NIP-01:

    {
      "kind": 27700,
      "created_at": <unix seconds>,
      "pubkey": "<32-byte hex>",
      "tags": [],
      "content": "",
      "id": "<sha256 of the NIP-01 serialization>",
      "sig": "<64-byte schnorr hex>"
    }

- `tags` MUST be empty (`[]`).
- `content` MUST be the empty string.
- `id` = sha256 of `[0, pubkey, created_at, 27700, [], ""]` per NIP-01.

> Kind `27700` is **project-assigned**, not an officially registered NIP number. It sits in the
> ephemeral 20000–29999 range like NIP-98. Change it freely — but both client and server must
> agree, since it is part of the signed `id`.

## Wire format (the stream key string)
Compact triplet, dot-separated:

    <pubkey>.<created_at>.<sig>

- `pubkey`: 64 lowercase hex chars
- `created_at`: decimal unix seconds
- `sig`: 128 lowercase hex chars
- Total ≈ 204 chars (well under the 510 cap)
- `id` is NOT transmitted — the verifier recomputes it.

## Transport binding
- **RTMP**: the triplet is the stream key = last path segment: `rtmp://host/live/<triplet>`
- Reserved stream key `test` → local preview path (unchanged).

## Generation (client)

    import { finalizeEvent } from 'nostr-tools/pure'
    const evt = finalizeEvent(
      { kind: 27700, created_at: Math.floor(Date.now() / 1000), tags: [], content: "" },
      secretKey
    )
    const streamKey = `${evt.pubkey}.${evt.created_at}.${evt.sig}`

## Verification (server)

    import { verifyEvent, getEventHash } from 'nostr-tools'
    function verifyStreamKey(key) {
      const [pubkey, created_at, sig] = key.split('.')
      if (!pubkey || !created_at || !sig) return null
      const evt = { kind: 27700, created_at: +created_at, pubkey, tags: [], content: "", sig }
      evt.id = getEventHash(evt)              // id is not on the wire; recompute it
      return verifyEvent(evt) ? evt : null    // checks id == hash AND schnorr sig
    }

## Expiration (reserved)
`created_at` is part of the signed event. Implementations MAY reject keys older than a configured
max age (e.g. env `STREAMKEY_MAX_AGE_SEC`). **Default: disabled (no expiry).** Enabling it needs
no wire-format change.

## Security considerations
- Bearer credential: anyone holding the string can stream as that pubkey — treat like a password.
- RTMP transmits it in cleartext; prefer RTMPS where possible.
- No revocation list — rely on key rotation (and the reserved expiry mechanism).
