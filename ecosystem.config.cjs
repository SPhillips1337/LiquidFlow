/** PM2 production: public web app only. Do not expose the Vite reader dev server. */
module.exports = {
  apps: [
    {
      name: 'liquidflow-web',
      cwd: '/home/stephen/projects/LiquidFlow/web',
      script: 'npm',
      args: 'run start -- -p 3000',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      autorestart: true,
    },
  ],
}
