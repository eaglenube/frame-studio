require('dotenv').config();

const common = {
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: { ...common },
  test: {
    ...common,
    database: (process.env.DB_NAME || 'vdo_to_img_web') + '_test',
  },
  production: {
    ...common,
    logging: false,
  },
};
