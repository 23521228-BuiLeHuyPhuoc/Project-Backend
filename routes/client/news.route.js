const router = require('express').Router();

const newsController = require('../../controllers/client/news.controller');

router.get('/', newsController.index);
router.get('/:slug', newsController.detail);

module.exports = router;
