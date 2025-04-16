const express = require('express');
const {
    processNewIncident,
    incidentWebhook
} = require('../controllers/incidentProcessing.controller');

const router = express.Router();

// Webhook for Supabase realtime updates
router.post('/webhook', incidentWebhook);

// Process a specific incident manually
router.post('/process/:incidentId', processNewIncident);

module.exports = router;