'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('transcripts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      originalFilename: { type: Sequelize.STRING, allowNull: false },
      videoPath: { type: Sequelize.STRING, allowNull: false },
      audioPath: { type: Sequelize.STRING, allowNull: true },
      language: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'en' },
      summaryType: {
        type: Sequelize.ENUM('off', 'general', 'meeting', 'interview', 'podcast', 'news'),
        allowNull: false,
        defaultValue: 'off',
      },
      status: {
        type: Sequelize.ENUM(
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
      progress: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      durationSeconds: { type: Sequelize.FLOAT, allowNull: true },
      transcriptText: { type: Sequelize.TEXT, allowNull: true },
      transcriptSrt: { type: Sequelize.TEXT, allowNull: true },
      transcriptSegments: { type: Sequelize.JSONB, allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('transcripts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transcripts_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transcripts_summaryType";');
  },
};
