'use strict';

module.exports = (sequelize, DataTypes) => {
  const Transcript = sequelize.define(
    'Transcript',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      originalFilename: { type: DataTypes.STRING, allowNull: false },
      videoPath: { type: DataTypes.STRING, allowNull: false },
      audioPath: { type: DataTypes.STRING, allowNull: true },
      language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'en',
      },
      summaryType: {
        type: DataTypes.ENUM('off', 'general', 'meeting', 'interview', 'podcast', 'news'),
        allowNull: false,
        defaultValue: 'off',
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'extracting_audio',
          'transcribing',
          'summarizing',
          'completed',
          'failed'
        ),
        allowNull: false,
        defaultValue: 'pending',
      },
      progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      durationSeconds: { type: DataTypes.FLOAT, allowNull: true },
      transcriptText: { type: DataTypes.TEXT, allowNull: true },
      transcriptSrt: { type: DataTypes.TEXT, allowNull: true },
      transcriptSegments: { type: DataTypes.JSONB, allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      userId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'transcripts' }
  );

  Transcript.associate = (models) => {
    Transcript.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'SET NULL',
    });
  };

  return Transcript;
};
