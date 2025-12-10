module.exports = {
  apps: [
    {
      name: "epi-backend",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production"
      },
      // Restart configuration
      max_memory_restart: "500M",
      min_uptime: "10s",
      max_restarts: 10,
      // Logging
      error_file: "~/.pm2/logs/epi-backend-error.log",
      out_file: "~/.pm2/logs/epi-backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Auto-restart on file changes (disabled for production)
      autorestart: true,
      // Kill timeout
      kill_timeout: 5000
    }
  ]
};
