// controllers/shop/listController.js
const mongoose = require("mongoose");
const Product = require("../../models/Product");
const Category = require("../../models/Category");
const SubCategory = require("../../models/SubCategory");

/**
 * GET /shop
 * Query params:
 *  - category: ObjectId
 *  - subcategory: ObjectId
 *  - color: "Silver" | "Gold" | "Rose Gold"
 *  - minPrice, maxPrice: numbers (filter by effective price = salePrice ?? regularPrice)
 *  - inStock: "true" to filter quantity > 0
 *  - sort: "newest" | "oldest" | "priceAsc" | "priceDesc"
 *  - page: number (default 1)
 *  - view: number per page (12 | 24 | 48 | 96; default 12)
 */
exports.getShopProducts = async (req, res, next) => {
  try {
    const q = req.query || {};

    const category    = q.category || "";
    const subcategory = q.subcategory || "";
    const color       = q.color || "";
    const inStock     = q.inStock === "true";

    const minPrice = Number.isFinite(parseInt(q.minPrice)) ? parseInt(q.minPrice) : 0;
    const maxPrice = Number.isFinite(parseInt(q.maxPrice)) ? parseInt(q.maxPrice) : 1000000;

    const sort = q.sort || "newest";
    const page = Math.max(1, parseInt(q.page) || 1);
    const pageSize = Math.max(1, parseInt(q.view) || 12);

    // Base match
    const match = { isBlocked: false };
    if (category && mongoose.isValidObjectId(category)) {
      match.category = new mongoose.Types.ObjectId(category);
    }
    if (subcategory && mongoose.isValidObjectId(subcategory)) {
      match.subcategory = new mongoose.Types.ObjectId(subcategory);
    }
    if (color) match.color = color;
    if (inStock) match.quantity = { $gt: 0 };

    // Sorting
    const sortStage = (() => {
      switch (sort) {
        case "oldest":
          return { createdAt: 1 };
        case "priceAsc":
          return { effectivePrice: 1, createdAt: -1 };
        case "priceDesc":
          return { effectivePrice: -1, createdAt: -1 };
        default:
          return { createdAt: -1 }; // newest
      }
    })();

    // Aggregate to filter on effective price (salePrice ?? regularPrice)
    const pipeline = [
      {
        $addFields: {
          effectivePrice: { $ifNull: ["$salePrice", "$regularPrice"] },
        },
      },
      { $match: match },
      {
        $match: {
          effectivePrice: { $gte: minPrice, $lte: maxPrice },
        },
      },
      { $sort: sortStage },
      {
        $facet: {
          rows: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [agg, categories, subcategories] = await Promise.all([
      Product.aggregate(pipeline),
      Category.find({}, "_id name").lean(),
      SubCategory.find({}, "_id name").lean(),
    ]);

    const rows = (agg[0] && agg[0].rows) || [];
    const totalCount = (agg[0] && agg[0].total && agg[0].total[0]?.count) || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return res.render("shop/list", {
      products: rows,
      categories,
      subcategories,
      filters: {
        category,
        subcategory,
        color,
        minPrice,
        maxPrice,
        sort,
        inStock: inStock ? "true" : "",
        page,
        view: pageSize,
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        pageSize,
      },
    });
  } catch (err) {
    next(err);
  }
};
