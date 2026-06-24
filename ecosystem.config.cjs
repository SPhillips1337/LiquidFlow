/** PM2: LAN + local web access (Vite dev = full API: ingest, create-story, lore) */
module.exports = {
  apps: [
    {
      name: 'liquidflow',
      cwd: '/home/stephen/projects/LiquidFlow/reader',
      script: 'npm',
      args: 'run dev',
      env: {
        LIQUIDFLOW_PORT: '9325',
        NODE_ENV: 'development',
      },
      max_memory_restart: '512M',
      autorestart: true,
    },
  ],
}