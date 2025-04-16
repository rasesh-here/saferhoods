const express = require('express');
const {
    createIncident,
    getUserIncidents,
    getAllIncidents,
    getIncidentById
} = require('../controllers/incidents.controller');

const router = express.Router();


// POST /api/incidents - Create a new incident report
router.post('/', createIncident);

// GET /api/incidents/user/:id - Get incidents reported by specific user
router.get('/user/:id', getUserIncidents);

// GET /api/incidents - Get all incidents (admin only)
router.get('/', getAllIncidents);


module.exports = router;