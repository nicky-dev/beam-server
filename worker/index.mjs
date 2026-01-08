import { LiveStream } from "#lib/live-stream.mjs"
import * as ome from '#lib/ome.mjs'

const streams = await ome.api.listStreams().catch(() => null)
console.log('Existing streams on startup:', streams)
if (streams && streams.length > 0) {
    for (const item of streams) {
        const live = LiveStream.getOrCreate(item)
        console.log('Resuming live stream monitoring for Stream ID:', item)
        live.startAutoUpdateInterval();
    }
}
