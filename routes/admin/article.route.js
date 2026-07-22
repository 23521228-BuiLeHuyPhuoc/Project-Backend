const router=require("express").Router();
const controller=require("../../controllers/admin/article.controller");

router.get("/list",controller.list);
router.get("/create",controller.create);
router.post("/create",controller.createPost);
router.get("/edit/:id",controller.edit);
router.patch("/edit/:id",controller.editPatch);
router.patch("/delete/:id",controller.deletePatch);

module.exports=router;
