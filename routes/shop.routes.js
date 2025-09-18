const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')
const cartController = require('../controllers/shop/cartController')

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)

//cart
router.get('/cart',cartController.getCart)
module.exports = router;