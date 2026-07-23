const router=require('express').Router();
const recommendationController=require(
  '../../controllers/client/recommendation.controller'
);
const recommendationValidate=require(
  '../../validates/client/recommendation.validate'
);

router.get('/personalized',recommendationController.personalized);
router.get('/similar/:tourId',recommendationController.similar);
router.get('/trending',recommendationController.trending);
router.get('/top-rated',recommendationController.topRated);
router.post(
  '/feedback',
  recommendationValidate.feedback,
  recommendationController.feedback
);
router.get('/model',recommendationController.model);
router.get('/model/weights.bin',recommendationController.weights);
router.get('/metadata',recommendationController.metadata);

module.exports=router;
