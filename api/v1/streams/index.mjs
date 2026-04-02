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
 * Verify NIP-98 Nostr HTTP Auth header.
 * @param {import('express').Request} req
 * @returns {{ pubkey: string } | null}
 */
function verifyNostrAuth(req) {
	const authHeader = req.headers['authorization']
	if (!authHeader?.startsWith('Nostr ')) return null
	try {
		const event = JSON.parse(Buffer.from(authHeader.slice(6), 'base64').toString())
		if (event.kind !== 27235) return null
		const now = Math.floor(Date.now() / 1000)
		if (Math.abs(now - event.created_at) > 60) return null
		const urlTag = event.tags.find((t) => t[0] === 'u')
		const methodTag = event.tags.find((t) => t[0] === 'method')
		if (!urlTag || !methodTag) return null
		const reqPath = req.originalUrl
		const reqFullUrl = `${req.protocol}://${req.get('host')}${reqPath}`
		if (urlTag[1] !== reqPath && urlTag[1] !== reqFullUrl) return null
		if (methodTag[1].toUpperCase() !== req.method.toUpperCase()) return null
		if (!verifyEvent(event)) return null
		return { pubkey: event.pubkey }
	} catch {
		return null
	}
}

/**
 * Middleware: require valid Nostr HTTP Auth, attach pubkey to req.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireNostrAuth(req, res, next) {
	const auth = verifyNostrAuth(req)
	if (!auth) return res.status(401).json({ error: 'Unauthorized' })
	req.pubkey = auth.pubkey
	next()
}

/**
 * Check stream ownership. Returns 'not_found', 'forbidden', or 'ok'.
 * @param {string} streamId
 * @param {string} pubkey
 * @returns {'not_found' | 'forbidden' | 'ok'}
 */
function checkStreamOwnership(streamId, pubkey) {
	const stream = LiveStream.get(streamId)
	if (!stream) return 'not_found'
	return stream.pubkey === pubkey ? 'ok' : 'forbidden'
}

/**
 * Apply ownership check to a response. Returns true if the check passed.
 * @param {string} streamId
 * @param {string} pubkey
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function assertStreamOwner(streamId, pubkey, res) {
	const result = checkStreamOwnership(streamId, pubkey)
	if (result === 'not_found') {
		res.status(404).json({ error: 'Stream not found' })
		return false
	}
	if (result === 'forbidden') {
		res.status(403).json({ error: 'Forbidden' })
		return false
	}
	return true
}

/**
 * GET /v1/streams
 * List the authenticated user's active streams (returns streamId for use in other endpoints).
 */
router.get('/', requireNostrAuth, (req, res) => {
	const userStreams = LiveStream.streaming
		.filter((s) => s.pubkey === req.pubkey)
		.map((s) => ({ streamId: s.name, id: s.id }))
	return res.status(200).json({ streams: userStreams })
})

/**
 * GET /v1/streams/:streamId/push
 * List all active push streams for a given stream.
 */
router.get('/:streamId/push', requireNostrAuth, async (req, res) => {
	try {
		const { streamId } = req.params
		if (!assertStreamOwner(streamId, req.pubkey, res)) return
		const pushStreams = await ome.api.listPushStreams(streamId)
		return res.status(200).json({ pushStreams })
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
})

/**
 * POST /v1/streams/:streamId/push
 * Start pushing a stream to an external platform (YouTube, Twitch, Facebook, or custom).
 *
 * Body:
 *   platform      {string} – "youtube" | "twitch" | "facebook" | "custom"
 *   streamKey     {string} – platform stream key
 *   rtmpUrl       {string} – required when platform is "custom"
 *   outputStreamName {string} – optional push ID override
 */
router.post('/:streamId/push', requireNostrAuth, async (req, res) => {
	try {
		const { streamId } = req.params
		if (!assertStreamOwner(streamId, req.pubkey, res)) return
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
 * Stop an active push stream.
 */
router.delete('/:streamId/push/:pushId', requireNostrAuth, async (req, res) => {
	try {
		const { streamId, pushId } = req.params
		if (!assertStreamOwner(streamId, req.pubkey, res)) return
		const result = await ome.api.stopPushStream(pushId)
		return res.status(200).json(result)
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
})

export const streams = router
