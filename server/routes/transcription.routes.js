const express = require('express');
const multer = require('multer');
const path = require('path');
const { processAudioRecording, extractIncidentData } = require('../controllers/transcription.controller');

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../uploads/'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fs = require('fs');
const uploadDir = path.join(__dirname, '../uploads/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    }
});

// POST /api/recordings/process - Process audio recording to create incident
router.post('/process', upload.single('audio'), processAudioRecording);

// POST /api/recordings/extract - Extract incident data from transcribed text (for testing)
router.post('/extract', (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Transcribed text is required' });
    }

    const extractionResult = extractIncidentData(text);
    return res.status(200).json(extractionResult);
});

module.exports = router;