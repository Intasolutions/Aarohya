const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
module.exports = router;