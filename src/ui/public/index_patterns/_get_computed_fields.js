import _ from 'lodash';
// Takes a hit, merges it with any stored/scripted fields, and with the metaFields
// returns a flattened version
export function getComputedFields() {
  const self = this;
  const scriptFields = {};
  // kibi: use const for 'docvalueFields' instead of let
  const docvalueFields = _.map(_.reject(self.fields.byType.date, 'scripted'), 'name');

  _.each(self.getScriptedFields(), function (field) {
    scriptFields[field.name] = {
      script: {
        inline: field.script,
        lang: field.lang
      }
    };
  });

  return {
    storedFields: ['*'],
    scriptFields: scriptFields,
    docvalueFields: docvalueFields
  };

}
