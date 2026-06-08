'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('transcripts', 'detectedLanguage', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('transcripts', 'detectedLanguage');
  },
};
