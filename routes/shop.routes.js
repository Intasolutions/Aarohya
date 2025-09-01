const router = require('express').Router();
router.get('/', (req,res) => res.render('shop/home'));
router.get('/products', (req,res) => res.render('shop/products_details'));
module.exports = router;