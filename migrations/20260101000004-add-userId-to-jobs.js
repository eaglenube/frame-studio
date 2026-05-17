'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('jobs', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('jobs', ['userId']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('jobs', ['userId']);
    await queryInterface.removeColumn('jobs', 'userId');
  },
};
