// PM2 Ecosystem Configuration
// Использование: pm2 start ecosystem.config.js --only staging

module.exports = {
  apps: [
    {
      name: 'workout-tracker-staging',
      script: 'npm',
      args: 'start -- -p 3001',
      cwd: '/home/c/cu797814/staging',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/staging-error.log',
      out_file: './logs/staging-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'workout-tracker-production',
      script: 'npm',
      args: 'start',
      cwd: '/home/c/cu797814/production',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/production-error.log',
      out_file: './logs/production-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
