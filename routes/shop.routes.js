const wrap = (fn, label) => {
  if (typeof fn !== 'function') {
    console.error(`Route handler missing at load: ${label} is ${typeof fn}`);
    // Return a function so Express can register the route without crashing.
    return (req, res, next) => {
      next(new Error(`Route handler not available: ${label}`));
    };
  }
  return (req, res, next) => fn(req, res, next);
};

const router = require('express').Router();
const homeController = require('../controllers/shop/homeController');
const productController = require('../controllers/shop/productController')
const shopController = require('../controllers/shop/listController')
const cartController = require('../controllers/shop/cartController')
const wishlistController = require('../controllers/shop/wishlistController')
const profileController = require('../controllers/shop/profileController');
const checkoutController =require('../controllers/shop/checkoutController');
const orderController = require('../controllers/shop/orderController')
const paymentController = require('../controllers/shop/paymentController')

const payoutController = require("../controllers/shop/payoutController");

const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
console.log('protect typeof:', typeof protect);
console.log('payoutController keys:', payoutController && Object.keys(payoutController));
console.log('payoutController.getForm typeof:', payoutController && typeof payoutController.getForm);

router.get('/', homeController.getHome);
router.get('/product/:id',productController.getproductDetails );
router.get('/shop',shopController.getShopProducts)
router.get('/order',(req,res)=>{res.render('shop/OrderDetails')})

// Profile
router.get("/profile", protect, profileController.loadProfile);
router.post("/profile/update", protect, profileController.editProfile);
router.post("/profile/upload", protect, upload.single("avatar"), profileController.uploadProfilePicture);
router.post("/profile/change-password", protect, profileController.changePassword);

// Addresses
router.post("/profile/addresses", protect, profileController.addAddress);
router.post("/profile/addresses/edit", protect, profileController.editAddress);
router.post("/profile/addresses/delete", protect, profileController.deleteAddress);

// Cart
router.get("/cart", protect, cartController.getCart);
router.post("/cart/add/:id", protect, cartController.addToCart);
router.post("/cart/update", protect, cartController.updateQuantity);
router.post("/cart/remove", protect, cartController.removeItem);
router.post("/cart/clear", protect, cartController.clearCart);

// Wishlist
router.get("/wishlist", protect, wishlistController.loadWishlist);
router.post("/wishlist/:id", protect, wishlistController.addToWishlist);
router.delete("/wishlist/:id", protect, wishlistController.removeFromWishlist);

// Checkout / payments
router.get("/checkout", protect, checkoutController.getCheckout);
router.post("/checkout/validate", protect, checkoutController.validateCheckout);
router.post("/checkout/place-order", protect, checkoutController.placeOrder);
router.post("/checkout/razorpay/verify", protect, checkoutController.verifyRazorpay);

router.get("/order/success", protect, checkoutController.orderSuccess);
router.get("/order/failure", protect, checkoutController.orderFailure);

router.post("/create-order", protect, paymentController.createRazorpayOrder);
router.post("/verify", protect, paymentController.verifyRazorpayPayment);
router.get("/checkout/pay/:orderId", protect, paymentController.repayWithNewRazorpayOrder);
router.post("/razorpay/webhook", paymentController.razorpayWebhook);


router.get("/orders", protect, wrap(orderController.listOrders, 'orderController.listOrders'));
router.get("/orders/:id", protect, wrap(orderController.getOrderDetails, 'orderController.getOrderDetails'));
router.get("/orders/:id/invoice", protect, wrap(orderController.getInvoice, 'orderController.getInvoice'));
router.get("/orders/:id/return", protect, wrap(orderController.getReturnForm, 'orderController.getReturnForm'));
router.post("/orders/:id/return", protect, upload.array("images", 5), wrap(orderController.submitReturn, 'orderController.submitReturn'));

// COD payout (customer)
router.get("/orders/:id/payout", protect, wrap(payoutController.getForm, 'payoutController.getForm'));
router.post("/orders/:id/payout", protect, wrap(payoutController.saveDestination, 'payoutController.saveDestination'));

module.exports = router;
