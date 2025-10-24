// src/routes/index.js
'use strict';
const express = require('express');
const userRoutes = require('.routes/user.routes');

const router = express.Router();

// Health-check simples
router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Rotas de usuários (/api/usuarios)
router.use('/usuarios', userRoutes);

module.exports = router;