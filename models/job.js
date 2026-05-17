'use strict';

module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define(
    'Job',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      originalFilename: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      videoPath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fps: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1,
      },
      quality: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      format: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'jpg',
      },
      resizeWidth: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      progress: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      totalImages: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'jobs',
    }
  );

  Job.associate = (models) => {
    Job.hasMany(models.Image, {
      foreignKey: 'jobId',
      as: 'images',
      onDelete: 'CASCADE',
    });
  };

  return Job;
};
