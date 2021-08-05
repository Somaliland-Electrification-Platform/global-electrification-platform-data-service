exports.up = function (knex) {
  return knex.schema.alterTable('models', function (t) {
    t.string('country', 3);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('models', function (t) {
    t.dropColumn('country');
  });
};
