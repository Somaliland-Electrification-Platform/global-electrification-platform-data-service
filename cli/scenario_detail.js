const path = require('path');
const _ = require('lodash');

const { print } = require('./utils');

/**
 * Prepares the scenario detail for database insertion
 *
 * @param {object} db The current database transaction
 * @param {object} model The model
 * @param {string} scenarioFilePath Path to the scenario
 *
 * @return object
 */
async function prepareScenarioDetailRecord (db, model, scenarioFilePath) {
  const { name: scenarioId } = path.parse(scenarioFilePath);
  const hasTimesteps = model.timesteps && model.timesteps.length;

  let filters = [];

  // If filters are defined, perform validation
  if (Array.isArray(model.filters) && model.filters.length > 0) {
    // Range filters need min/max values, which are calculated from
    // scenarios output. The block below generate a query to fetch these values.
    const rangeFilters = model.filters.filter(f => f.type === 'range');
    if (rangeFilters.length > 0) {
      let filterMinMaxSelectStrings = [];
      let filterKeys = {};

      for (let filter of rangeFilters) {
        // Filter is time-stepped?
        filter.timestep = hasTimesteps ? filter.timestep === true : false;

        let filterCastStrings = [];
        if (filter.timestep) {
          // When range filter is time-stepped, min/max values should be
          // calculated using all timesteps available.
          for (const timestep of model.timesteps) {
            const key = filter.key + timestep;
            filterCastStrings.push(`CAST("filterValues" ->> :${key} AS FLOAT)`);
            filterKeys[key] = key;
          }
        } else {
          // When not time-stepped, use a filter key unmodified
          filterCastStrings.push(
            `CAST("filterValues" ->> :${filter.key} AS FLOAT)`
          );
          filterKeys[filter.key] = filter.key;
        }

        // Keep filter list
        filterMinMaxSelectStrings.push(`
          MIN(LEAST(${filterCastStrings.join(',')})) as "${filter.key}min",
          MAX(GREATEST(${filterCastStrings.join(',')})) as "${filter.key}max"
        `);
      }
      // Build min/max query. Ranged filters are queried at the same time to
      // avoid reading all scenario records each time.
      const minMaxQuery = `
        SELECT
          ${filterMinMaxSelectStrings.join(',')}
        FROM scenarios
        WHERE "scenarioId" = :scenarioId
      `;

      // Get results
      const res = (await db.raw(minMaxQuery, { scenarioId: scenarioId, ...filterKeys }))
        .rows[0];

      // Validate results. Will not include filters with invalid ranges.
      for (let filter of rangeFilters) {
        const min = res[filter.key + 'min'];
        const max = res[filter.key + 'max'];

        if (min === null || max === null) {
          print(
            `Invalid (min) and/or (max) for filter [${
              filter.key
            }] of model [${id}]... skipping`
          );
          continue;
        }

        filters = filters.concat({
          ...filter,
          range: {
            min: parseFloat(Math.floor(min)),
            max: parseFloat(Math.ceil(max))
          }
        });
      }
    }

    // Parse non-range filters
    for (const filter of model.filters) {
      // Filter is time-stepped?
      filter.timestep = hasTimesteps ? filter.timestep === true : false;

      if (filter.type === 'options') {
        filters = filters.concat({ ...filter });
      } else if (filter.type !== 'range') {
        // Show error message if filter type is not "options" or "range"
        print(
          `Invalid type [${filter.type}] for filter [${
            filter.key
          }] of model [${id}]... skipping`
        );
      }
    }
  }

  filters = _.sortBy(filters, 'id');
  return {
    scenarioId: scenarioId,
    filters: filters
  };
}

module.exports = {
  prepareScenarioDetailRecord
};
