import { Router } from "express";
import { api } from "#lib/ome.mjs";

const router = Router();

// Platform configurations
const PLATFORMS = {
    youtube: {
        name: 'YouTube',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2'
    },
    facebook: {
        name: 'Facebook',
        rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp'
    },
    twitch: {
        name: 'Twitch',
        rtmpUrl: 'rtmp://live.twitch.tv/app'
    }
};

/**
 * POST /v1/push/start
 * Start pushing stream to external platform
 * Body: {
 *   streamId: string,
 *   platform: 'youtube' | 'facebook' | 'twitch' | 'custom',
 *   streamKey: string,
 *   rtmpUrl?: string (required for custom platform)
 * }
 */
router.post('/start', async (req, res) => {
    try {
        const { streamId, platform, streamKey, rtmpUrl, outputStreamName } = req.body;

        if (!streamId || !platform || !streamKey) {
            return res.status(400).json({
                error: 'Missing required fields: streamId, platform, streamKey'
            });
        }

        let platformRtmpUrl;
        
        if (platform === 'custom') {
            if (!rtmpUrl) {
                return res.status(400).json({
                    error: 'rtmpUrl is required for custom platform'
                });
            }
            platformRtmpUrl = rtmpUrl;
        } else if (PLATFORMS[platform]) {
            platformRtmpUrl = PLATFORMS[platform].rtmpUrl;
        } else {
            return res.status(400).json({
                error: `Invalid platform. Supported: ${Object.keys(PLATFORMS).join(', ')}, custom`
            });
        }

        const result = await api.createPushStream(streamId, {
            platform,
            rtmpUrl: platformRtmpUrl,
            streamKey,
            outputStreamName
        });

        res.status(200).json({
            success: true,
            data: result,
            message: `Started pushing stream to ${PLATFORMS[platform]?.name || platform}`
        });
    } catch (error) {
        console.error('Error starting push stream:', error);
        res.status(500).json({
            error: 'Failed to start push stream',
            message: error.message
        });
    }
});

/**
 * POST /v1/push/stop
 * Stop pushing stream to external platform
 * Body: {
 *   streamId: string,
 *   pushId: string
 * }
 */
router.post('/stop', async (req, res) => {
    try {
        const { streamId, pushId } = req.body;

        if (!streamId || !pushId) {
            return res.status(400).json({
                error: 'Missing required fields: streamId, pushId'
            });
        }

        const result = await api.stopPushStream(streamId, pushId);

        res.status(200).json({
            success: result.success,
            message: result.success ? 'Push stream stopped successfully' : 'Failed to stop push stream'
        });
    } catch (error) {
        console.error('Error stopping push stream:', error);
        res.status(500).json({
            error: 'Failed to stop push stream',
            message: error.message
        });
    }
});

/**
 * GET /v1/push/list/:streamId
 * List all active push streams for a stream
 */
router.get('/list/:streamId', async (req, res) => {
    try {
        const { streamId } = req.params;

        if (!streamId) {
            return res.status(400).json({
                error: 'streamId is required'
            });
        }

        const pushStreams = await api.listPushStreams(streamId);

        res.status(200).json({
            success: true,
            data: pushStreams,
            count: pushStreams.length
        });
    } catch (error) {
        console.error('Error listing push streams:', error);
        res.status(500).json({
            error: 'Failed to list push streams',
            message: error.message
        });
    }
});

/**
 * GET /v1/push/platforms
 * Get list of supported platforms
 */
router.get('/platforms', (req, res) => {
    const platforms = Object.entries(PLATFORMS).map(([key, value]) => ({
        id: key,
        name: value.name,
        rtmpUrl: value.rtmpUrl
    }));

    res.status(200).json({
        success: true,
        data: platforms
    });
});

export const push = router;
