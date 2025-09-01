require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const app = express();

// DB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aarohya_jewelry')
  .then(() => console.log('Mongo connected'))
  .catch(console.error);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));


// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/shop.routes'));
app.use('/admin', require('./routes/admin.routes'));

// 404 handler
app.use((req,res) => res.status(404).render('shop/404'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
