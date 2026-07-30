export const FUEL_SYNC_PARSER_VERSION = 2;

const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

export const fuelFilePeriodKey = name => {
  const normalized = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const year = Number(normalized.match(/20\d{2}/)?.[0] || 0);
  const month = MONTHS.findIndex(item => normalized.includes(item)) + 1;
  return year && month ? year * 100 + month : 0;
};

export const sortFuelFiles = (left, right) => fuelFilePeriodKey(left.name) - fuelFilePeriodKey(right.name)
  || left.name.localeCompare(right.name, 'pt-BR')
  || Number(left.stat?.mtimeMs || 0) - Number(right.stat?.mtimeMs || 0);

export const selectChangedFuelFiles = (files, config = {}) => {
  const previousHashes = Number(config.parserVersion) === FUEL_SYNC_PARSER_VERSION
    && config.fileHashes && typeof config.fileHashes === 'object'
    ? config.fileHashes
    : {};
  const changed = files.filter(file => previousHashes[file.name] !== file.hash);
  const currentNames = new Set(files.map(file => file.name));
  const fileWasRemoved = Object.keys(previousHashes).some(name => !currentNames.has(name));
  return fileWasRemoved && changed.length === 0 ? files : changed;
};

export const buildFuelFileHashMap = files => Object.fromEntries(files.map(file => [file.name, file.hash]));
