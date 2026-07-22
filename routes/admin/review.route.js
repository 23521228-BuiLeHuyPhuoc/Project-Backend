const router=require("express").Router();
const controller=require("../../controllers/admin/review.controller");

router.get("/list",controller.list);
router.patch("/status/:id",controller.statusPatch);
router.patch("/delete/:id",controller.deletePatch);

module.exports=router;
