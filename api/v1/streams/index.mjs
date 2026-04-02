import { Router } from 'express'
import { verifyEvent } from 'nostr-tools'
import * as ome from '#lib/ome.mjs'
import { LiveStream } from '#lib/live-stream.mjs'

const router = Router()

const PLATFORM_RTMP_URLS = {
	youtube: 'rtmp://a.rtmp.youtube.com/live2',
	twitch: 'rtmp://live.twitch.tv/app',
	facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
}

/**
 * Middleware: Verify Nostr HTTP Auth (NIP-98).
 * Expects `Authorization: Nostr <base64-encoded-kind-27235-event>` header.
 * On success, sets `req.pubkey` to the authenticated public key.
 */
function verifyNostrAuth(req, res, next) {
	const authHeader = req.headers['authorization']
	if (!authHeader?.startsWith('Nostr ')) {
		return res.status(401).json({ error: 'Missing or invalid Authorization header' })
	}
	try {
		const base64 = authHeader.slice(6)
		const event = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))

		if (!verifyEvent(event)) {
			return res.status(401).json({ error: 'Invalid Nostr event signature' })
		}
		if (event.kind !== 27235) {
			return res.status(401).json({ error: 'Invalid event kind for HTTP auth' })
		}

		const now = Math.floor(Date.now() / 1000)
		if (Math.abs(now - event.created_at) > 60) {
			return res.status(401).json({ error: 'Authorization event expired' })
		}

		const urlTag = event.tags.find((t) => t[0] === 'u')
		if (!urlTag) {
			return res.status(401).json({ error: 'Missing URL tag in authorization event' })
		}
		// Support both full URLs and path-only values in the u tag
		let tagPath = urlTag[1]
		try {
			tagPath = new URL(urlTag[1]).pathname
		} catch {
			// already a path
		}
		const reqPath = req.originalUrl.split('?')[0]
		if (reqPath !== tagPath) {
			return res.status(401).json({ error: 'URL mismatch in authorization event' })
		}

		const methodTag = event.tags.find((t) => t[0] === 'method')
		if (!methodTag || methodTag[1].toUpperCase() !== req.method.toUpperCase()) {
			return res.status(401).json({ error: 'Method mismatch in authorization event' })
		}

		req.pubkey = event.pubkey
		next()
	} catch {
		return res.status(401).json({ error: 'Invalid authorization token' })
	}
}

/**
 * Middleware: Verify that the stream identified by `:streamId` belongs to the
 * authenticated user (`req.pubkey`).  Must be used after `verifyNostrAuth`.
 */
function checkStreamOwnership(req, res, next) {
	const { streamId } = req.params
	const stream = LiveStream.get(streamId)
	if (!stream) {
		return res.status(404).json({ error: 'Stream not found' })
	}
	if (stream.pubkey !== req.pubkey) {
		return res.status(403).json({ error: 'Forbidden: stream does not belong to you' })
	}
	next()
}

/**
 * GET /v1/streams
 * List all active streams belonging to the authenticated user.
 */
router.get('/', verifyNostrAuth, (req, res) => {
	const userStreams = LiveStream.streaming
		.filter((s) => s.pubkey === req.pubkey)
		.map((s) => ({ streamId: s.name }))
	return res.status(200).json({ streams: userStreams })
})

/**
 * GET /v1/streams/:streamId/push
 * List all active push streams for a given stream (owner only).
 */
router.get('/:streamId/push', verifyNostrAuth, checkStreamOwnership, async (req, res) => {
	try {
		const { streamId } = req.params
		const pushStreams = await ome.api.listPushStreams(streamId)
		return res.status(200).json({ pushStreams })
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
})

/**
 * POST /v1/streams/:streamId/push
 * Start pushing a stream to an external platform (YouTube, Twitch, Facebook, or custom).
 * Owner only.
 *
 * Body:
 *   platform      {string} – "youtube" | "twitch" | "facebook" | "custom"
 *   streamKey     {string} – platform stream key
 *   rtmpUrl       {string} – required when platform is "custom"
 *   outputStreamName {string} – optional push ID override
 */
router.post('/:streamId/push', verifyNostrAuth, checkStreamOwnership, async (req, res) => {
	try {
		const { streamId } = req.params
		const { platform, streamKey, rtmpUrl, outputStreamName } = req.body

		if (!platform) {
			return res.status(400).json({ error: 'platform is required' })
		}
		if (!streamKey) {
			return res.status(400).json({ error: 'streamKey is required' })
		}

		const resolvedRtmpUrl = platform === 'custom' ? rtmpUrl : PLATFORM_RTMP_URLS[platform]
		if (!resolvedRtmpUrl) {
			return res.status(400).json({
				error: `Unsupported platform "${platform}". Supported platforms: youtube, twitch, facebook, custom`,
			})
		}

		const result = await ome.api.createPushStream(streamId, {
			platform,
			rtmpUrl: resolvedRtmpUrl,
			streamKey,
			outputStreamName,
		})

		return res.status(201).json(result)
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
})

/**
 * DELETE /v1/streams/:streamId/push/:pushId
 * Stop an active push stream (owner only).
 */
router.delete('/:streamId/push/:pushId', verifyNostrAuth, checkStreamOwnership, async (req, res) => {
	try {
		const { pushId } = req.params
		const result = await ome.api.stopPushStream(pushId)
		return res.status(200).json(result)
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
})

export const streams = router
