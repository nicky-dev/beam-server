import { Router } from 'express'
import { admission } from '#api/v1/admission/index.mjs'
import { streams } from '#api/v1/streams/index.mjs'

const router = Router()
router.use('/admission', admission)
router.use('/streams', streams)

export const v1 = router