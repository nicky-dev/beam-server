import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { nip19, SimplePool } from 'nostr-tools'

const pool = new SimplePool()
const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol']

const { data: sk } = nip19.decode(process.env.NOSTR_PRIVATE_KEY)
export const pk = getPublicKey(sk)

export const getLiveConfig = async (pubkey) => {
    const events = await pool.querySync(relays, {
        limit: 1,
        kinds: [30078],
        "#d": ['beamlivestudio-config'],
        authors: [pubkey]
    })
    return events[0];
}

export const getLastLiveEvent = async (pubkey) => {
    const events = await pool.querySync(relays, {
        limit: 1,
        kinds: [30311],
        "#p": [pubkey]
    })
    return events[0];
}

export const getLiveEvent = async (tagId) => {
    const events = await pool.querySync(relays, {
        limit: 1,
        kinds: [30311],
        "#d": [tagId],
        authors: [pk]
    })
    return events[0];
}

export const publishNostrEvent = async (evt) => {
    const { id: _, sig: __, ...nostrEvent } = evt
    const signedEvent = finalizeEvent({
        ...nostrEvent, pubkey: pk, created_at: Math.floor(Date.now() / 1000)
    }, sk)
    await Promise.any(pool.publish(relays, signedEvent))
}

function exitHandler(options, exitCode) {
    if (options.cleanup) pool.close(relays);
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));