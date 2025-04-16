const express = require('express');
const router = express.Router();
const {
    handleIncomingCall,
    handleRecordingComplete,
    handleRecordingStatus,
    fetchRecording,
    playRecording,
} = require('../controllers/twilio.controller');

// Voice webhook - Twilio will call this when a call comes in to the Twilio number
router.post('/voice', handleIncomingCall);

// Recording complete webhook
router.post('/recording-complete', handleRecordingComplete);

// Recording status webhook
router.post('/recording-status', handleRecordingStatus);

// Get recording by SID
router.get('/recordings/:recordingSid', fetchRecording);

// Play recording in browser
router.get('/play/:recordingSid', playRecording);

module.exports = router; 