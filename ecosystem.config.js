module.exports = {
  apps: [
    {
      name: 'studydrive-api',
      script: './src/server.js', // Chemin vers le dossier src
      instances: 1,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: '500M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
    },
  ],
};