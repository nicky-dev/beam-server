import * as ome from '#lib/ome.mjs'
import { getLiveConfig, getLastLiveEvent, getLiveEvent, publishNostrEvent, pk } from './nostr.mjs'

const pubkeyLocal = process.env.PUBKEY_LOCAL;

export class LiveStream {
    static generateStreamId = ome.generateStreamId

    /**
     * @type {LiveStream[]}
     */
    static streaming = []

    /**
     * 
     * @param {string} name 
     */
    static get(name) {
        return LiveStream.streaming.find(item => item.name === name)
    }

    /**
     * 
     * @param {string} name 
     */
    static getOrCreate(name) {
        return LiveStream.get(name) || new LiveStream(name)
    }

    /**
     * 
     * @param {string} name 
     */
    static remove(name) {
        LiveStream.streaming = LiveStream.streaming.filter(item => item.name !== name)
    }

    /**
     * @type {string}
     */
    id;

    /**
     * @type {string}
     */
    name;

    /**
     * @type {string}
     */
    pubkey;

    /**
     * @type {boolean}
     */
    autoUpdateIntervalEnabled = false

    /**
     * 
     * @param {string} id
     */
    constructor(pubkey) {
        this.id = LiveStream.generateStreamId();
        this.pubkey = pubkey;
        if (this.pubkey === pubkeyLocal) {
            this.name = `local_${this.id}`;
        } else {
            this.name = `remote_${this.id}`;
        }
        LiveStream.streaming.push(this)
    }

    async startAutoUpdateInterval() {
        console.log("Start Stream ID:", this.name)
        this.autoUpdateIntervalEnabled = true
        await this.updateViewers()
        await delay(60000)
        if (this.autoUpdateIntervalEnabled) {
            this.startAutoUpdateInterval()
        }
    }

    async stopAutoUpdateInterval() {
        this.autoUpdateIntervalEnabled = false
    }

    async updateViewers() {
        console.log('Update Viewers Stream ID:', this.name)
        const evt = await getLiveEvent(this.name);
        console.log('Update Viewers Event:', evt?.id);
        if (!evt) return;
        const isLive = !!evt?.tags.find((tag => tag[0] === "status" && tag[1] === "live"))
        if (!isLive) return;
        const { maxTotalConnections: totalParticipants, totalConnections: currentParticipants } = await ome.api.stats(this.name)
        console.log("Update Viewers Stream ID:", this.name, { totalParticipants, currentParticipants })
        const { id: _, sig: __, ...newEvent } = evt
        const newTags = newEvent.tags.filter(tag => !['current_participants', 'total_participants'].includes(tag[0]))
        const total_participants = newEvent.tags.find(tag => tag[0] === 'total_participants')
        newEvent.tags = [...newTags,
        ['current_participants', currentParticipants?.toString() || "0"],
        totalParticipants ? ['total_participants', totalParticipants.toString()] : total_participants]
        await publishNostrEvent(newEvent)
    }

    async start() {
        console.log('Start Stream Pubkey:', this.pubkey)
        const liveConfig = await getLiveConfig(this.pubkey)
        console.log('Live Config:', liveConfig?.id)
        const lastEvent = await getLastLiveEvent(this.pubkey)
        console.log('Last Event ID:', lastEvent?.id)
        const tag = lastEvent?.tags.find((tag) => tag[0] === 'status');
        if (tag?.[1] === 'live' && lastEvent.pubkey === pk) {
            const newTags = lastEvent.tags.filter(tag => !['ends', 'status', 'recording'].includes(tag[0]))
            lastEvent.tags = [...newTags, ['ends', Math.floor(Date.now() / 1000).toString()], ["status", "ended"]]
            await publishNostrEvent(lastEvent);
        }
        const config = JSON.parse(liveConfig?.content || "{}");
        const title = config.title || lastEvent.tags.find((t) => t[0] === 'title')?.[1]
        const summary = config.summary || lastEvent.tags.find((t) => t[0] === 'summary')?.[1]
        const image = config.image || lastEvent.tags.find((t) => t[0] === 'image')?.[1]
        const tags = config.tags || lastEvent.tags.filter((t) => t[0] === 't').map(t => t[1])
        const nostrEvent = {
            "kind": 30311,
            "tags": [
                ["d", this.name],
                ["title", title],
                ["summary", summary],
                ...tags.map(t => ['t', t]),
                ["streaming", ome.url.llhls(this.name)],
                ["starts", Math.floor(Date.now() / 1000).toString()],
                ["status", "live"],
                ["current_participants", "0"],
                ["total_participants", "0"],
                ["p", this.pubkey, "wss://relay.nostr.band", "host", ""],
                ["relays", "wss://relay.damus.io", "wss://nos.lol", "wss://relay.nostr.band"],
                ["image", image],
                ["image", ome.url.thumbnail(this.name)],
            ],
            "content": "",
        }
        await publishNostrEvent(nostrEvent);
        const params = encodeURIComponent(`{"playerOption":{"autoStart":true,"autoFallback":true,"mute":false,"sources":[{"type":"ll-hls","file":"${ome.url.local.llhls(this.name)}"}],"doubleTapToSeek":false,"parseStream":{"enabled":true}},"demoOption":{"autoReload":true,"autoReloadInterval":2000}}`)
        console.log(`Preview:`, `http://demo.ovenplayer.com/#${params}`)
        this.startAutoUpdateInterval();
        return true;
    }

    async end() {
        this.stopAutoUpdateInterval();
        console.log('End Stream ID:', this.name)
        const evt = await getLiveEvent(this.name);
        console.log('End Stream Event:', evt?.id);
        if (!evt) return;
        const newTags = evt.tags.filter(tag => !['ends', 'status', 'recording'].includes(tag[0]))
        evt.tags = [...newTags, ['ends', Math.floor(Date.now() / 1000).toString()], ["status", "ended"], ["recording", `${ome.url.llhls(this.name)}`]]
        await publishNostrEvent(evt)
    }
}

const delay = (milliseconds) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, milliseconds)
    })
}
