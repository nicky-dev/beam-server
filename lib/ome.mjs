import { v7 as uuid } from 'uuid'

const apiKey = process.env.OME_API_KEY
const ip = process.env.OME_IP
const apiHost = process.env.OME_API_HOST
const host = process.env.OME_HOST
const app = 'live'

const defaultFetchOptions = { headers: { authorization: `Basic ${apiKey}` } }

const rtmpBaseUrl = `rtmp://${ip}:1935/${app}`
const srtBaseUrl = `srt://${ip}:9999/${app}`
const apiUrl = `http://${apiHost}`
export const generateStreamId = uuid;
export const generateStreamKey = uuid;
export const url = {
    local: {
        llhls: (streamId) => `http://${ip}/live/${streamId}/llhls.m3u8`,
        thumbnail: (streamId) => `http://${ip}/thumbnail/preview_${streamId}/thumb.jpg`,
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    rtmp(streamId) {
        return `${rtmpBaseUrl}/${streamId}`
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    srt(streamId) {
        return `${srtBaseUrl}/${streamId}`
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    llhls(streamId) {
        return `${host}/live/${streamId}/llhls.m3u8`
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    recordings(streamId) {
        return `${host}/recordings/default/live/${streamId}/video.mp4`
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    thumbnail(streamId) {
        return `${host}/thumbnail/preview_${streamId}/thumb.jpg`
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    stats(streamId) {
        return `${apiUrl}/v1/stats/current/vhosts/default/apps/${app}/streams/${streamId}`
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {string}
     */
    streams() {
        return `${apiUrl}/v1/vhosts/default/apps/${app}/streams`
    },
    /**
     * @returns {string}
     */
    pushStream() {
        return `${apiUrl}/v1/vhosts/default/apps/${app}`
    },
    /**
     * @returns {string}
     */
    listPush() {
        return `${apiUrl}/v1/vhosts/default/apps/${app}:listPush`
    },
}

export const api = {
    _fetch(url, options) {
        return fetch(url, { ...defaultFetchOptions, ...options });
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {Promise<{status: number; totalConnections: number; maxTotalConnections: number}>}
     */
    async stats(streamId) {
        console.log('Fetching stats for Stream ID:', url.stats(streamId))
        const res = await this._fetch(url.stats(streamId))
        console.log('Stats response for Stream ID:', streamId, res.status)
        const res_1 = await res.json().catch(() => null)
        return {
            status: res.status,
            totalConnections: res_1?.response?.connections?.llhls || 0,
            maxTotalConnections: res_1?.response?.maxTotalConnections || 0,
        }
    },
    /**
     * 
     * @returns {Promise<string[]>}
     */
    async listStreams() {
        const res = await this._fetch(url.streams())
        const res_1 = await res.json()
        return res_1?.response || []
    },
    /**
     * Create a push stream to external platforms (YouTube, Facebook, Twitch, etc.)
     * @param {string} streamId - The source stream ID
     * @param {Object} config - Push configuration
     * @param {string} config.platform - Platform name (youtube, facebook, twitch, custom)
     * @param {string} config.rtmpUrl - RTMP URL for the platform
     * @param {string} config.streamKey - Stream key for the platform
     * @param {string} [config.outputStreamName] - Optional output stream name
     * @returns {Promise<{id: string; state: string}>}
     */
    async createPushStream(streamId, config) {
        const { platform, rtmpUrl, streamKey, outputStreamName } = config;

        const payload = {
            id: outputStreamName || `${platform}_${streamId}_${Date.now()}`,
            stream: {
                name: streamId,
                trackIds: []
            },
            protocol: "rtmp",
            url: rtmpUrl,
            streamKey: streamKey
        };

        const res = await this._fetch(`${url.pushStream()}:startPush`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        const res_1 = await res.json()
        if (res_1?.statusCode === 200 || res_1?.statusCode === 201) {
            return {
                id: res_1?.response?.id || payload.id,
                state: res_1?.response?.state || 'created'
            }
        }
        throw new Error(res_1?.message || 'Failed to create push stream')
    },
    /**
     * Stop a push stream
     * @param {string} streamId - The source stream ID
     * @param {string} pushId - The push stream ID to stop
     * @returns {Promise<{success: boolean}>}
     */
    async stopPushStream(pushId) {
        const payload = {
            id: pushId
        };
        const res = await this._fetch(`${url.pushStream()}:stopPush`, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        const res_1 = await res.json()
        return {
            success: res_1?.statusCode === 200
        }
    },
    /**
     * List all active push streams for a stream ID
     * @param {string} streamId - The source stream ID
     * @returns {Promise<Array>}
     */
    async listPushStreams(streamId) {
        const queryString = streamId ? `?stream.name=${encodeURIComponent(streamId)}` : ''
        const res = await this._fetch(`${url.listPush()}${queryString}`)
        const res_1 = await res.json()
        return res_1?.response || []
    }
}