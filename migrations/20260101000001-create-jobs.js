'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      originalFilename: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      videoPath: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fps: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 1,
      },
      quality: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      format: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'jpg',
      },
      resizeWidth: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      progress: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalImages: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('jobs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_jobs_status";');
  },
};
