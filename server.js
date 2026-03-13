const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
// ===== CORS ===== cho phep frontend truy cap backend
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ROUTES =====
// Ví dụ: const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');

// ===== API ROUTES =====
// Ví dụ: app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);


// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'BE-TheLiemsShoes API is running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'API endpoint not found'
  });
});

// ===== START SERVER =====
app.listen(PORT, HOST, () => {
  console.log(`Server đang chạy tại http://${HOST}:${PORT}`);
});

module.exports = app;