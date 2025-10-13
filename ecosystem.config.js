module.exports = {
  apps: [
    {
      name: 'stoyanography-backend',
      script: './app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'cleanup-collections',
      script: './scripts/cleanupCollections.js',
      cron_restart: '0 0 * * *', // Run daily at midnight
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'cleanup-tokens',
      script: './scripts/cleanupTokens.js',
      cron_restart: '0 2 * * *', // Run daily at 2 AM
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
