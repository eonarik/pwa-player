module.exports = {
  apps: [
    {
      name: 'cuei-backend',
      script: 'src/index.mjs',
      cwd: '/var/www/cuei-player/pwa-player/server',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
