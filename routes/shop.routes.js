const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')
const cartController = require('../controllers/shop/cartController')
const wishlistController = require('../controllers/shop/wishlistController')
const profileController = require('../controllers/shop/profileController');
const checkoutController =require('../controllers/shop/checkoutController');
const orderController = require('../controllers/shop/orderController')
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");


router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)
router.get('/order',(req,res)=>{res.render('shop/OrderDetails')})
// router.get('/ManageAddress',(req,res)=>{res.render('shop/ManageAddress.ejs')})

// //profile
// router.get("/profile", protect, profileController.loadProfile);
// router.post("/profile/update", protect, profileController.editProfile);
// router.post("/profile/change-password", protect, profileController.changePassword);

router.get("/profile", protect, profileController.loadProfile);
router.post("/profile/update", protect, profileController.editProfile);
router.post(
  "/profile/upload",
  protect,
  upload.single("avatar"),
  profileController.uploadProfilePicture
);
router.post(
  "/profile/change-password",
  protect,
  profileController.changePassword
);

// addresses
router.post("/profile/addresses", protect, profileController.addAddress);
router.post("/profile/addresses/edit", protect, profileController.editAddress);
router.post(
  "/profile/addresses/delete",
  protect,
  profileController.deleteAddress
);

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

// -------------------- CHECKOUT --------------------
router.get("/checkout", protect, checkoutController.getCheckout);
router.post("/checkout/validate", protect, checkoutController.validateCheckout);
router.post("/checkout/place-order", protect, checkoutController.placeOrder);
router.post("/checkout/razorpay/verify", protect, checkoutController.verifyRazorpay);

// order success/failure
router.get("/order/success", protect, checkoutController.orderSuccess);
router.get("/order/failure", protect, checkoutController.orderFailure);


router.get("/orders", protect, orderController.listOrders);
router.get("/orders/:id", protect, orderController.getOrderDetails);
router.get("/orders/:id/invoice", protect, orderController.getInvoice);


module.exports = router;