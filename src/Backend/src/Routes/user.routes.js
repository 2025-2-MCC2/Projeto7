// src/routes/user.routes.js
'use strict';
const express = require('express');
const ctrl = require('../controllers/user.controller');

const router = express.Router();

router.get('/', ctrl.listUsers);
router.get('/:id', ctrl.getUserById);
router.post('/', ctrl.createUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', ctrl.deleteUser);

module.exports = router;