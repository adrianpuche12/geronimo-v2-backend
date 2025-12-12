require("dotenv").config();

module.exports = {
  apps: [{
    name: "geronimo-v2-api",
    script: "./dist/main.js",
    cwd: "/opt/geronimo-v2/backend",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env_file: ".env",
    env: process.env
  }]
};
