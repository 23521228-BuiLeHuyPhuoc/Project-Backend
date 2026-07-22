const router=require("express").Router();
const controller=require("../../controllers/admin/notification.controller");

router.get("/list",controller.list);
router.get("/create",controller.create);
router.post("/create",controller.createPost);
router.patch("/delete/:id",controller.deletePatch);

module.exports=router;
