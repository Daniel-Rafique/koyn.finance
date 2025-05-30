// frontend/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'frontend',
      script: 'npm',
      args: 'run start',
      cwd: '/Users/danielrafique/Sites/koyn.ai/frontend', // Update this path for production
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};