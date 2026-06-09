module.exports = {
  apps: [
    {
      name: 'dav-backend',
      script: 'node',
      args: 'backend/server.js',
      cwd: './',
      env: { NODE_ENV: 'production', PORT: 5000 },
      autorestart: true,
      watch: false,
    },
    {
      name: 'dav-frontend',
      script: 'node',
      args: 'frontend/start-frontend.js',
      cwd: './',
      env: { NODE_ENV: 'production', PORT: 3000 },
      autorestart: true,
      watch: false,
    },
    {
      name: 'dav-docling',
      script: 'app.py',
      interpreter: 'python',
      cwd: './docling-service',
      autorestart: true,
      watch: false,
    },
  ],
};

