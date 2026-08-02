module.exports = {
  apps: [
    {
      name: 'erp-facom',
      port: process.env.PORT || 3000,
      script: './.output/server/index.mjs',
      node_args: '--harmony',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
