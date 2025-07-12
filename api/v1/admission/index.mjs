import { Router } from "express";
import crypto from 'crypto';
import * as ome from '#lib/ome.mjs';
import { LiveStream } from '#lib/live-stream.mjs';
import { verifyEvent } from 'nostr-tools'

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

router.post('/', async (req, res) => {
    try {
        if (!validatePayload(req.body, req.headers['x-ome-signature'])) {
            return res.status(200).json({ allowed: false, reason: "INVALID_REQUEST" });
        }
        const { request } = req.body;
        const protocol = request?.protocol?.toLowerCase();
        const url = request?.url;
        const status = request?.status;
        const newUrl = request?.new_url;

        if (!url) {
            return res.status(200).json({ allowed: false, reason: "INVALID_URL" });
        }
        if (!['rtmp', 'llhls', 'srt'].includes(protocol)) {
            return res.status(200).json({ allowed: false, reason: "INVALID_PROTOCOL" });
        }

        // if (protocol === 'srt' && status === 'opening') {
        //     if (!streamKey) {
        //         return res.status(200).json({ allowed: false, reason: "INVALID_STREAM_KEY" });
        //     }
        // }
        if (protocol === 'rtmp' && status === 'opening') {
            const urls = url.split('/')
            const streamKey = urls.pop()
            if (!streamKey) {
                return res.status(200).json({ allowed: false, reason: "INVALID_STREAM_KEY" });
            }
            const streamPath = urls.pop()
            const authEvent = JSON.parse(Buffer.from(streamKey, 'base64').toString())
            const isValid = verifyEvent(authEvent)
            if (!isValid) {
                return res.status(200).json({ allowed: false, reason: "INVALID_STREAM_KEY" });
            }

            if (streamPath === 'test') {
                const id = LiveStream.generateStreamId()
                const params = encodeURIComponent(`{"playerOption":{"autoStart":true,"autoFallback":true,"mute":false,"sources":[{"type":"ll-hls","file":"${ome.url.local.llhls('test_' + id)}"}],"doubleTapToSeek":false,"parseStream":{"enabled":true}},"demoOption":{"autoReload":true,"autoReloadInterval":2000}}`)
                console.log(`Preview:`, `http://demo.ovenplayer.com/#${params}`)
                return res.status(200).json({
                    "allowed": true,
                    "new_url": ome.url.rtmp('test_' + id),
                    "lifetime": 0,
                });
            }

            const live = new LiveStream(authEvent.pubkey)
            await live.start();
            return res.status(200).json({
                "allowed": true,
                "new_url": ome.url.rtmp(live.name),
                "lifetime": 0,
            });
        }
        if (protocol === 'rtmp' && status === 'closing') {
            const id = newUrl.split('/').pop()
            const live = LiveStream.get(id)
            await live?.end()
            return res.status(200).json({});
        }
        return res.status(200).json({
            allowed: false,
            reason: "INVALID_REQUEST"
        })
    } catch (err) {
        return res.status(200).json({
            allowed: false,
            reason: err.message
        })
    }
})

export const admission = router;