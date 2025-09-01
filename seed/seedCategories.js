const mongoose = require('mongoose');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Collection = require('../models/Collection');
const { slugify } = require('../utils/slugify');

const CATEGORIES = [
  { name: 'Necklaces', isPrivate: false },
  { name: 'Earrings', isPrivate: false },
  { name: 'Bracelets', isPrivate: false },
  { name: 'Rings', isPrivate: false },
  { name: 'Jewelry Sets', isPrivate: false },
  { name: 'Anklets', isPrivate: false },
  { name: 'Hair Accessories', isPrivate: true }
];

const SUBCATEGORIES = {
  Necklaces: ['Chokers', 'Pendants', 'Long Necklaces'],
  Earrings: ['Studs', 'Hoops', 'Dangler', 'Jhumkas'],
  Bracelets: ['Bangles', 'Cuffs', 'Chains'],
  Rings: ['Adjustable', 'Statement', 'Cocktail'],
  'Jewelry Sets': ['Necklace & Earring Sets']
};

const COLLECTIONS = [
  { name: 'Bridal', isPrivate: true },
  { name: 'Everyday Wear', isPrivate: true },
  { name: 'Festive', isPrivate: true },
  { name: 'Office Wear', isPrivate: true }
];

async function run(mongoUri){
  await mongoose.connect(mongoUri);
  const catMap = {};

  for(const c of CATEGORIES){
    const doc = await Category.findOneAndUpdate(
      { name: c.name },
      { $set: { name: c.name, slug: slugify(c.name), isPrivate: c.isPrivate } },
      { upsert: true, new: true }
    );
    catMap[c.name] = doc._id;
  }

  for(const [catName, subs] of Object.entries(SUBCATEGORIES)){
    for(const s of subs){
      await SubCategory.findOneAndUpdate(
        { name: s, category: catMap[catName] },
        { $set: { name: s, slug: slugify(s), category: catMap[catName] } },
        { upsert: true, new: true }
      );
    }
  }

  for(const col of COLLECTIONS){
    await Collection.findOneAndUpdate(
      { name: col.name },
      { $set: { name: col.name, slug: slugify(col.name), isPrivate: col.isPrivate } },
      { upsert: true, new: true }
    );
  }

  console.log('Seeding complete.');
  await mongoose.disconnect();
}

if (require.main === module) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/tyrex_jewelry';
  run(uri).catch(err => { console.error(err); process.exit(1); });
}
