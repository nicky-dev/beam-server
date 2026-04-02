import { Router } from "express";
import { admission } from "#api/v1/admission/index.mjs";

const router = Router();
router.use('/admission', admission)

export const v1 = router;