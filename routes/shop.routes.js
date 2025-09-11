const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)
module.exports = router;