const router = require("express").Router();
const productController = require("../controllers/admin/productController");
const categoryController = require("../controllers/admin/categoryController");
const subCategoryController = require("../controllers/admin/subCategoryController");
const customerController = require("../controllers/admin/customerController");
const adminController = require("../controllers/admin/adminAuthController");
const orderController = require("../controllers/admin/orderController")

const upload = require("../middleware/upload");

// Admin login page
router.get("/login", adminController.getLoginPage);
router.post("/login", adminController.postLogin);

// Admin logout
router.get("/logout", adminController.logout);

// Dashboard
router.get("/", (req, res) => res.render("admin/dashboard"));

// Products
router.get("/products", productController.listProducts);
router.get("/products/add", productController.getAddProduct);
router.post("/products/add", upload.array("productImage", 5), productController.postAddProduct);
router.get("/products/edit/:id", productController.getEditProduct);
router.post("/products/edit/:id", upload.array("productImage", 5), productController.postEditProduct);
router.post("/products/delete/:id", productController.deleteProduct);

// Categories
router.get("/categories", categoryController.listCategories);
router.get("/categories/add", categoryController.getAddCategory);
router.post("/categories/add", categoryController.postAddCategory);
router.get("/categories/edit/:id", categoryController.getEditCategory);
router.post("/categories/edit/:id", categoryController.postEditCategory);
router.post("/categories/delete/:id", categoryController.deleteCategory);


// SubCategories
router.get("/subcategories", subCategoryController.listSubCategories);
router.get("/subcategories/add", subCategoryController.getAddSubCategory);
router.post("/subcategories/add", subCategoryController.postAddSubCategory);
router.get("/subcategories/edit/:id", subCategoryController.getEditSubCategory);
router.post("/subcategories/edit/:id", subCategoryController.postEditSubCategory);
router.post("/subcategories/delete/:id", subCategoryController.deleteSubCategory);


// Customers
router.get("/customers", customerController.getCustomers);
router.post("/customers/toggle/:id", customerController.toggleBlock);
router.post("/customers/delete/:id", customerController.deleteCustomer);



// ================= ORDERS (NEW) =================
router.get("/orders", orderController.listOrders);
router.get("/orders/:id", orderController.getOrderDetails);
router.post("/orders/:id/status", orderController.updateOrderStatus);
router.post("/orders/:id/tracking", orderController.updateTracking);
router.post("/orders/:id/cancel", orderController.cancelOrder);
router.post("/orders/:id/items/:itemId/cancel", orderController.cancelItem);
router.post("/orders/:id/return/approve", orderController.approveReturn);
router.post("/orders/:id/return/reject", orderController.rejectReturn);
router.post("/orders/:id/refund", orderController.refund);

module.exports = router;
