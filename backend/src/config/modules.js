/**
 * Runtime module configuration for the unified backend.
 */

const VALID_MODULES = new Set(['leadtool', 'voice']);

function parseModules(rawValue = process.env.APP_MODULES || 'leadtool') {
  const requested = String(rawValue)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const modules = new Set();
  for (const value of requested) {
    if (VALID_MODULES.has(value)) modules.add(value);
  }

  if (modules.size === 0) {
    modules.add('leadtool');
  }

  return modules;
}

function getEnabledModules(rawValue) {
  return Array.from(parseModules(rawValue));
}

function isModuleEnabled(moduleName, rawValue) {
  return parseModules(rawValue).has(moduleName);
}

module.exports = { VALID_MODULES, getEnabledModules, isModuleEnabled };
