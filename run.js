const { spawn } = require("child_process");
const path = require("path");

function runService(name, command, args, cwd, colorCode) {
  console.log(`[System] Launching ${name} service...`);
  const proc = spawn(command, args, { cwd, shell: true });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`\x1b[${colorCode}m[${name}]\x1b[0m ${line}`);
      }
    });
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`\x1b[31m[${name} ERROR]\x1b[0m ${line}`);
      }
    });
  });

  proc.on("close", (code) => {
    console.log(`\x1b[33m[System] ${name} service exited with code ${code}\x1b[0m`);
  });

  return proc;
}

// 1. Docling Service (Python FastAPI, Port 8000)
const docling = runService("Docling", "python", ["-u", "app.py"], path.join(__dirname, "docling-service"), "32"); // Green

// 2. Node Backend API (Port 5000)
const backend = runService("Backend", "npm", ["start"], path.join(__dirname, "backend"), "36"); // Cyan

// 3. React Frontend Dashboard (Port 3000)
const frontend = runService("Frontend", "npm", ["start"], path.join(__dirname, "frontend"), "35"); // Magenta

// Handle graceful termination of all sub-processes
process.on("SIGINT", () => {
  console.log("\n[System] Shutting down all services gracefully...");
  docling.kill();
  backend.kill();
  frontend.kill();
  setTimeout(() => process.exit(0), 1000);
});
