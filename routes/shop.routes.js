const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')
const cartController = require('../controllers/shop/cartController')
const wishlistController = require('../controllers/shop/wishlistController')
const profileController = require('../controllers/shop/profileController')
const { protect } = require("../middleware/authMiddleware");

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)
router.get('/order',(req,res)=>{res.render('shop/OrderDetails')})
router.get('/ManageAddress',(req,res)=>{res.render('shop/ManageAddress.ejs')})

//profile
router.get("/profile", protect, profileController.loadProfile);
router.post("/profile/update", protect, profileController.editProfile);
router.post("/profile/change-password", protect, profileController.changePassword);

//cart
router.get("/cart",protect, cartController.getCart);
router.post("/cart/add/:id", protect, cartController.addToCart);
router.post("/cart/update",protect, cartController.updateQuantity);
router.post("/cart/remove",protect, cartController.removeItem);
router.post("/cart/clear",protect, cartController.clearCart);

//wishlist
router.get("/wishlist", protect, wishlistController.loadWishlist);
router.post("/wishlist/:id", protect, wishlistController.addToWishlist);
router.delete("/wishlist/:id", protect, wishlistController.removeFromWishlist);

module.exports = router;