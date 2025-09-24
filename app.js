require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const app = express();

/* ---------- DB ---------- */
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aarohya_jewelry')
  .then(() => console.log('Mongo connected'))
  .catch(console.error);

/* ---------- Razorpay webhook raw-body (route-scoped) ---------- */
/* Must be BEFORE json/urlencoded parsers and BEFORE routes */
app.use(
  '/razorpay/webhook',
  express.raw({ type: '*/*' }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8');
      try { req.body = JSON.parse(req.rawBody); } catch { /* leave raw */ }
    }
    next();
  }
);

/* ---------- Middlewares ---------- */
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ---------- Views ---------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---------- Routes ---------- */
app.use('/', require('./routes/shop.routes'));   // includes POST /razorpay/webhook
app.use('/admin', require('./routes/admin.routes'));
app.use('/auth', require('./routes/auth.routes'));

/* ---------- 404 ---------- */
app.use((req, res) => res.status(404).render('shop/404'));

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
