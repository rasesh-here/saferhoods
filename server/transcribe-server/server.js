const express = require("express");
const multer = require("multer");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");
const FormData = require("form-data");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

app.use(express.json());

// Simple MP3 check function
function isMP3(filePath, mimetype) {
  return path.extname(filePath).toLowerCase() === '.mp3' || mimetype === 'audio/mpeg';
}

// Health check
app.get("/health", (req, res) => {
  res.send("Server is up and running!");
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const inputPath = req.file.path;
  const mp3Path = path.join(os.tmpdir(), `${Date.now()}.mp3`);
  
  console.log(`Received file: ${inputPath} (${req.file.mimetype})`);
  
  try {
    let audioToProcess = inputPath;
    const isAlreadyMP3 = isMP3(inputPath, req.file.mimetype);
    
    // Only convert if not already MP3
    if (!isAlreadyMP3) {
      console.log(`Converting to MP3: ${mp3Path}`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioCodec("libmp3lame")
          .audioFrequency(16000)
          .audioChannels(1)
          .audioBitrate("64k")
          .output(mp3Path)
          .on("end", () => {
            console.log("MP3 conversion finished");
            resolve();
          })
          .on("error", err => {
            console.error("ffmpeg error:", err.message);
            reject(err);
          })
          .run();
      });
      
      audioToProcess = mp3Path;
    } else {
      console.log("File is already MP3, skipping conversion");
    }

    console.log("Sending to Whisper server...");
    
    const form = new FormData();
    form.append("file", fs.createReadStream(audioToProcess));

    const whisperResponse = await axios.post(
      "http://localhost:8080/inference",
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity
      }
    );

    console.log("Whisper transcription complete");
    res.json({ transcript: whisperResponse.data });
    
  } catch (error) {
    console.error("Transcription failed:", error.message);

    if (error.response) {
      console.error("Whisper server error:", error.response.status, error.response.data);
    } else if (error.request) {
      console.error("No response from Whisper server");
    } else {
      console.error("Error:", error.message);
    }

    res.status(500).json({
      error: "Transcription failed",
      details: error.message,
    });
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      if (!isMP3(inputPath, req.file.mimetype) && fs.existsSync(mp3Path)) {
        fs.unlinkSync(mp3Path);
      }
    } catch (cleanupError) {
      console.warn("Cleanup error:", cleanupError.message);
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Transcribe API running on port ${PORT}`);
});