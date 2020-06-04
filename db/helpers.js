const _ = require('lodash');

module.exports = {};

module.exports.update = (tableName, conditions = {}, data = {}) => {
  const dKeys = Object.keys(data);
  const dataTuples = dKeys.map((k, index) => `${k} = $${index + 1}`);
  const updates = dataTuples.join(', ');
  const len = Object.keys(data).length;

  var text = `UPDATE ${tableName} SET ${updates}`;

  if (!_.isEmpty(conditions)) {
    const keys = Object.keys(conditions);
    const condTuples = keys.map((k, index) => `${k} = $${index + 1 + len} `);
    const condPlaceholders = condTuples.join(' AND ');

    text += ` WHERE ${condPlaceholders} RETURNING *`;
  }

  const values = [];
  Object.keys(data).forEach(key => {
    values.push(data[key]);
  });
  Object.keys(conditions).forEach(key => {
    values.push(conditions[key]);
  });

  return { text, values };
};

module.exports.insert = (tableName, data) => {
  if(!_.isArray(data)) {
    data = [data];
  }
  const dKeys = Object.keys(data[0]);
  const dataTuples = dKeys.map(k => `${k}`);
  const columnNames = dataTuples.join(', ');

  var text = `INSERT INTO ${tableName} ${columnNames} VALUES `;

  const values = [];
  data.forEach(item => {
    values.push(`(${Object.values(item).join(', ')})`);
  });

  text += values.join(', ');

  return text;
};