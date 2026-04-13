const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = process.env.npm_package_json
  ? path.dirname(path.resolve(process.env.npm_package_json))
  : path.resolve(__dirname, "..");

const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const args = process.argv.slice(2);

const child = spawn(process.execPath, [viteBin, ...args], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    INIT_CWD: projectRoot,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
