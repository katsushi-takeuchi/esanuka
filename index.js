const remote = require('./lib/remote.js');
const { validateDefinition, validateConfig } = require('./lib/validate.js');
const { generateResources } = require('./lib/resource.js');
const { generateAlarms } = require('./lib/alarm.js');
const { setStore, purgeStore, wait } = require('./lib/util.js');
const yaml = require('js-yaml');
const fs = require('fs');

const defaultConfig = {
  onIntegrationParameters: () => ({}),
  onMethodRequestParameters: () => ({}),
  useLambdaWithStage: false,
  lambdaAliases: [],
  baseDomain: '',
  restApiId: '',
  deploymentStage: ''
};

const esanuka = async (defs, options = {}, dryRun = false) => {
  const config = Object.assign({dryRun}, defaultConfig, options);
  validateConfig(config);

  Object.keys(config).forEach(key => {
    setStore(key, config[key]);
  });

  const result = await validateDefinition(config.restApiId, defs);
  if (!result.valid) {
    throw new Error(`Invalid definition: ${result.message}`)
  }

  if (dryRun) {
    console.log('---------------------------------------------------------');
    console.log('|                       DRY RUN                         |');
    console.log('---------------------------------------------------------');
    await wait(1);
  }

  const resources = await remote(config.restApiId);
  await generateResources(config.restApiId, defs, resources);
  console.log('\n======================= ALARM GENERATION =========================');
  await generateAlarms(config.restApiId, defs);
  purgeStore();
};

const factory = (files, binds) => {
  const source = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  return yaml.safeLoad(source.replace(/\$\{(.+)\}/g, (match, name) => {
    if (binds.hasOwnProperty(name)) {
      return binds[name];
    } else if (name in process.env) {
      return process.env[name];
    }
    throw new Error(`Binding name ${name} is not defined`);
  }));
};

module.exports = (defs, options) => esanuka(defs, options);
module.exports.dryRun = (defs, options) => esanuka(defs, options, true);
module.exports.factory = factory;
