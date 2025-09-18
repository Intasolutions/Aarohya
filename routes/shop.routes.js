const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')
const cartController = require('../controllers/shop/cartController')

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)
router.get('/wishlist',(req,res)=>{res.render('shop/whislist')})
router.get('/cart',(req,res)=>{res.render('shop/cart')})
router.get('/profile',(req,res)=>{res.render('shop/profile')})
router.get('/order',(req,res)=>{res.render('shop/OrderDetails')})
router.get('/ManageAddress',(req,res)=>{res.render('shop/ManageAddress.ejs')})
//cart
router.get('/cart',cartController.getCart)
module.exports = router;