import { LiveStream } from "#lib/live-stream.mjs"
import * as ome from '#lib/ome.mjs'

const streams = await ome.api.listStreams().catch(() => null)
if (streams) {
    for (const item of streams) {
        LiveStream.getOrCreate(item).startAutoUpdateInterval();
    }
}
