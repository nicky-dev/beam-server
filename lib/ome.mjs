import { v7 as uuid } from 'uuid'

const apiKey = process.env.OME_API_KEY
const ip = process.env.OME_IP
const host = process.env.OME_HOST
const app = 'live'

const defaultFetchOptions = { headers: { authorization: "Basic " + apiKey } }

const rtmpBaseUrl = `rtmp://${ip}:1935/${app}`
const srtBaseUrl = `srt://${ip}:9999/${app}`
const apiUrl = `http://${ip}`
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
}

export const api = {
    async _fetch(url, options) {
        return fetch(url, { ...defaultFetchOptions, ...options });
    },
    /**
     * 
     * @param {string} streamId 
     * @returns {Promise<{totalConnections: number; maxTotalConnections: number}>}
     */
    async stats(streamId) {
        return this._fetch(url.stats(streamId)).then(res => res.json()).then(res => {
            return {
                totalConnections: res?.response?.connections?.llhls || 0,
                maxTotalConnections: res?.response?.maxTotalConnections
            }
        })
    },
    /**
     * 
     * @returns {Promise<string[]>}
     */
    async listStreams() {
        return this._fetch(url.streams()).then(res => res.json()).then(res => res?.response || [])
    }
}