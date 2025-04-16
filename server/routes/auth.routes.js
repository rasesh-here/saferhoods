const express = require('express');
const { register, login } = require('../controllers/auth.controller');
const { validateRegisterData, validateLoginData } = require('../middlewares/validation.middleware');

const router = express.Router();

// POST /api/auth/register - Register new reporters
router.post('/register', validateRegisterData, register);

// POST /api/auth/login - Login for reporters
router.post('/login', validateLoginData, login);

module.exports = router;