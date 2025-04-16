const express = require('express');
const router = express.Router();
const callService = require('../services/call.service');

router.get('/active-authorities', (req, res) => {
    const authorities = callService.getActiveAuthorities();
    res.json({ authorities });
});

module.exports = router; 