import { Router } from "express";
import { admission } from "#api/v1/admission/index.mjs";
import { stream } from "#api/v1/stream/index.mjs";

const router = Router();
router.use('/admission', admission)
router.use('/stream', stream)

export const v1 = router;