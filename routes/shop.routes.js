const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')
const cartController = require('../controllers/shop/cartController')
const { protect } = require("../middleware/authMiddleware");

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)
router.get('/wishlist',(req,res)=>{res.render('shop/whislist')})
router.get('/profile',(req,res)=>{res.render('shop/profile')})
router.get('/order',(req,res)=>{res.render('shop/OrderDetails')})
router.get('/ManageAddress',(req,res)=>{res.render('shop/ManageAddress.ejs')})


//cart
router.get("/cart",protect, cartController.getCart);
router.post("/cart/add/:id", protect, cartController.addToCart);
router.post("/cart/update",protect, cartController.updateQuantity);
router.post("/cart/remove",protect, cartController.removeItem);
router.post("/cart/clear",protect, cartController.clearCart);

module.exports = router;