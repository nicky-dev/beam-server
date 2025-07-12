import { LiveStream } from '#lib/live-stream.mjs'
import * as ome from '#lib/ome.mjs'

const streams = await ome.api.listStreams().catch(() => null)
streams?.forEach((item) => {
    LiveStream.getOrCreate(item).startAutoUpdateInterval()
});
