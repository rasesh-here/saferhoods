const { spawn, execSync } = require("child_process");
const os = require("os");
const fs = require("fs");
const http = require("http");
const isWindows = os.platform() === "win32";

// Paths
const whisperPath = isWindows
  ? ".\\llamafile\\whisper-tiny.exe"
  : "./llamafile/whisper-tiny.llamafile";

// Check if Whisper is already running
function isWhisperRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/',
      method: 'HEAD',
      timeout: 500
    }, () => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Start Whisper server
async function startWhisper() {
  // Skip if already running
  const running = await isWhisperRunning();
  if (running) {
    console.log("Whisper is already running on port 8080");
    return null;
  }

  // Check if whisper binary exists
  if (!fs.existsSync(whisperPath)) {
    console.error(`Whisper binary not found at ${whisperPath}`);
    process.exit(1);
  }

  // Give execution permission on non-Windows
  if (!isWindows) {
    try {
      execSync(`chmod +x ${whisperPath}`);
    } catch (err) {
      console.error("Failed to chmod whisper binary:", err.message);
      process.exit(1);
    }
  }

  // Start whisper with optimized parameters
  const whisperArgs = [
    "--server",
    "-t 4",  // Using fewer threads for lower resource usage
  ];

  console.log(`Starting Whisper: ${whisperPath} ${whisperArgs.join(' ')}`);
  
  const whisper = spawn(whisperPath, whisperArgs, {
    stdio: "inherit",
    shell: true,
  });

  whisper.on("error", (err) => {
    console.error("Failed to start Whisper:", err.message);
    process.exit(1);
  });

  whisper.on("exit", (code) => {
    console.log(`Whisper exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.error(`Whisper crashed with code ${code}`);
      process.exit(1);
    }
  });

  // Wait for Whisper to initialize
  console.log("Waiting for Whisper server to initialize...");
  let attempts = 0;
  while (attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const running = await isWhisperRunning();
    if (running) {
      console.log("Whisper server is running");
      break;
    }
    attempts++;
  }
  
  return whisper;
}

// Start API server
function startServer() {
  console.log("Starting API server");
  
  const server = spawn('node', ['server.js'], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      NODE_OPTIONS: "--max-old-space-size=256" // Lower memory limit for free tier
    }
  });

  server.on("exit", (code) => {
    console.log(`Node server exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.error(`Server crashed with code ${code}`);
      process.exit(1);
    }
  });

  return server;
}

// Main function
async function main() {
    try {
      console.log(`Running on ${os.platform()}, Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB, CPUs: ${os.cpus().length}`);
      
      await startWhisper();
      startServer();
  
    } catch (error) {
      console.error("Startup error:", error.message);
      process.exit(1);
    }
  }
  

main();