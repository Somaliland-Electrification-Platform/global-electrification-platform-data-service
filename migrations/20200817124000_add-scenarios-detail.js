exports.up = function (knex) {
  return knex.schema.createTable('scenario_detail', function (t) {
    t.string('scenarioId');
    t.specificType('filters', 'json ARRAY');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('scenario_detail');
};
