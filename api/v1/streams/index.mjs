import { Router } from 'express'
import * as ome from '#lib/ome.mjs'

const router = Router()

const PLATFORM_RTMP_URLS = {
	youtube: 'rtmp://a.rtmp.youtube.com/live2',
	twitch: 'rtmp://live.twitch.tv/app',
	facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
}

/**
 * GET /v1/streams/:streamId/push
 * List all active push streams for a given stream
 */
router.get('/:streamId/push', async (req, res) => {
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
 * Start pushing a stream to an external platform (YouTube, Twitch, Facebook, or custom)
 *
 * Body:
 *   platform      {string} – "youtube" | "twitch" | "facebook" | "custom"
 *   streamKey     {string} – platform stream key
 *   rtmpUrl       {string} – required when platform is "custom"
 *   outputStreamName {string} – optional push ID override
 */
router.post('/:streamId/push', async (req, res) => {
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
 * Stop an active push stream
 */
router.delete('/:streamId/push/:pushId', async (req, res) => {
	try {
		const { pushId } = req.params
		const result = await ome.api.stopPushStream(pushId)
		return res.status(200).json(result)
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
})

export const streams = router
