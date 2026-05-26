module.exports = {
  apps: [{
    name: 'timecraft-server',
    script: 'server/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
      PORT: 5001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    // Graceful shutdown
    kill_timeout: 10000,
    listen_timeout: 8000,
    // Logging
    log_file: './logs/combined.log',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Auto restart
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    exp_backoff_restart_delay: 100
  }]
};
