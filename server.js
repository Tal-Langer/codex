const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
  })
);

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function loadJson(file, defaultValue) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (err) {
    return defaultValue;
  }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let products = loadJson(PRODUCTS_FILE, []);
let orders = loadJson(ORDERS_FILE, []);

function ensureAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin/login');
}

app.get('/', (req, res) => {
  res.render('index', { products });
});

app.get('/product/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).send('Not found');
  res.render('product', { product });
});

app.post('/cart/add/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).send('Not found');
  if (!req.session.cart) req.session.cart = [];
  const item = { productId: product.id, fields: {} };
  product.customFields.forEach((f) => {
    item.fields[f] = req.body[f] || '';
  });
  req.session.cart.push(item);
  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  const cart = (req.session.cart || []).map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return { product, fields: item.fields };
  });
  res.render('cart', { cart });
});

app.post('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  const order = {
    id: Date.now().toString(),
    items: cart,
    status: 'Pending',
  };
  orders.push(order);
  saveJson(ORDERS_FILE, orders);
  req.session.cart = [];
  res.render('order_success', { order });
});

app.get('/admin/login', (req, res) => {
  res.render('admin_login');
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin_login', { error: 'Invalid credentials' });
});

app.get('/admin', ensureAdmin, (req, res) => {
  res.render('admin_dashboard', { products, orders });
});

app.post('/admin/logout', ensureAdmin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/admin/products', ensureAdmin, (req, res) => {
  const { title, description, price, customFields } = req.body;
  const product = {
    id: Date.now().toString(),
    title,
    description,
    price,
    customFields: customFields.split(',').map((f) => f.trim()).filter(Boolean),
  };
  products.push(product);
  saveJson(PRODUCTS_FILE, products);
  res.redirect('/admin');
});

app.post('/admin/orders/:id/status', ensureAdmin, (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).send('Not found');
  order.status = req.body.status;
  saveJson(ORDERS_FILE, orders);
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
