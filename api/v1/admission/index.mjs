import { Router } from "express";
import crypto from 'node:crypto';
import * as ome from '#lib/ome.mjs';
import { LiveStream } from '#lib/live-stream.mjs';
import { verifyEvent, getEventHash } from 'nostr-tools'

const router = Router();

function generateHmacSha1(message) {
    const hmac = crypto.createHmac('sha1', process.env.OME_ADMISSION_SECRET_KEY);
    hmac.update(message);
    return hmac.digest('base64url');
}

function validateHmacSha1(message, receivedHmac) {
    const generatedHmac = generateHmacSha1(message);
    return crypto.timingSafeEqual(Buffer.from(generatedHmac), Buffer.from(receivedHmac));
}

function validatePayload(payload, signature) {
    return validateHmacSha1(JSON.stringify(payload), signature)
}

const STREAM_KEY_KIND = 27700

/**
 * Verify a Beam Stream Key (BSK) compact triplet `pubkey.created_at.sig`.
 * Reconstructs the canonical kind-27700 event (fixed empty tags / content),
 * recomputes its id, and verifies the schnorr signature.
 * See docs/streamkey-nip.md.
 * @param {string} key
 * @returns {object|null} the verified event, or null if invalid
 */
function verifyStreamKey(key) {
    const [pubkey, created_at, sig] = (key || '').split('.')
    if (!pubkey || !created_at || !sig) return null
    const event = { kind: STREAM_KEY_KIND, created_at: +created_at, pubkey, tags: [], content: "", sig }
    event.id = getEventHash(event)
    if (!verifyEvent(event)) return null
    // Reserved: default-off expiry. Enable by setting STREAMKEY_MAX_AGE_SEC.
    const maxAge = Number(process.env.STREAMKEY_MAX_AGE_SEC) || 0
    if (maxAge > 0 && Math.floor(Date.now() / 1000) - event.created_at > maxAge) return null
    return event
}

function handleRtmpTest() {
    const id = LiveStream.generateStreamId()
    const params = encodeURIComponent(
        `{"playerOption":{"autoStart":true,"autoFallback":true,"mute":false,"sources":[{"type":"ll-hls","file":"${ome.url.local.llhls('test_' + id)}"}],"doubleTapToSeek":false,"parseStream":{"enabled":true}},"demoOption":{"autoReload":true,"autoReloadInterval":2000}}`
    )
    console.log(`Preview:`, `http://demo.ovenplayer.com/#${params}`)
    return { allowed: true, new_url: ome.url.rtmp('test_' + id), lifetime: 0 }
}

function handleRtmpOpening(url) {
    const urls = url.split('/')
    const streamKey = urls.pop()
    if (!streamKey) {
        return { allowed: false, reason: "INVALID_STREAM_KEY" }
    }
    if (streamKey === 'test') {
        return handleRtmpTest()
    }
    const authEvent = verifyStreamKey(streamKey)
    if (!authEvent) {
        return { allowed: false, reason: "INVALID_STREAM_KEY" }
    }
    const live = new LiveStream(authEvent.pubkey)
    live.start()
    return { allowed: true, new_url: ome.url.rtmp(live.name), lifetime: 0 }
}

function handleClosing(newUrl) {
    const id = newUrl.split('/').pop()
    const live = LiveStream.get(id)
    live?.end()
    return {}
}

router.post('/', (req, res) => {
    try {
        console.log('[admission] incoming request', {
            signature: req.headers['x-ome-signature'],
            body: JSON.stringify(req.body),
        })
        if (!validatePayload(req.body, req.headers['x-ome-signature'])) {
            return res.status(200).json({ allowed: false, reason: "INVALID_REQUEST" });
        }
        const { request } = req.body;
        const protocol = request?.protocol?.toLowerCase();
        const url = request?.url;
        const status = request?.status;
        const newUrl = request?.new_url;

        console.log('[admission] parsed', { protocol, status, url, newUrl })

        if (!url) {
            return res.status(200).json({ allowed: false, reason: "INVALID_URL" });
        }
        if (!['rtmp', 'llhls'].includes(protocol)) {
            return res.status(200).json({ allowed: false, reason: "INVALID_PROTOCOL" });
        }

        if (protocol === 'rtmp' && status === 'opening') {
            return res.status(200).json(handleRtmpOpening(url));
        }
        if (protocol === 'rtmp' && status === 'closing') {
            return res.status(200).json(handleClosing(newUrl));
        }
        return res.status(200).json({ allowed: false, reason: "INVALID_REQUEST" })
    } catch (err) {
        return res.status(200).json({ allowed: false, reason: err.message })
    }
})

export const admission = router;