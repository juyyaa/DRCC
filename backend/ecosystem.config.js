
module.exports = {
  apps: [
    {
      name: 'drcc-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
