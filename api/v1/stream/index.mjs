import { Router } from "express";
import { generateStreamKey } from "#lib/ome.mjs";

const router = Router();

router.get('/key', async (req, res) => {
    const streamKey = generateStreamKey()
    res.status(200).json({
        data: streamKey
    })
})

export const stream = router;