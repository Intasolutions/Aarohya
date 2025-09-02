const Product = require("../../models/Product");

const getHome = async (req,res) => {

    const products= await Product.find({isBlocked:false});
    console.log(products)
    res.render('shop/home',{products})
}

module.exports ={getHome}