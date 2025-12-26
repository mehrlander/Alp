// utils/path.js - Path parsing and building utilities for multi-db/store paths

/**
 * Path format: [database/][store:]recordPath
 *
 * Examples:
 *   bills.jan           → { db: 'AlpDB', store: 'alp', record: 'bills.jan' }
 *   data:bills.jan      → { db: 'AlpDB', store: 'data', record: 'bills.jan' }
 *   Work/data:bills.jan → { db: 'Work', store: 'data', record: 'bills.jan' }
 *   Work/:bills.jan     → { db: 'Work', store: 'alp', record: 'bills.jan' }
 */

export const DEFAULT_DB = 'AlpDB';
export const DEFAULT_STORE = 'alp';

// Re-export path module for convenient access
export const path = {
  DEFAULT_DB,
  DEFAULT_STORE,
  parse: null,      // Set below after function definitions
  build: null,
  buildFull: null,
  display: null,
  getRecord: null,
  equals: null
};

/**
 * Parse a path string into its components
 * @param {string} input - The path to parse
 * @returns {{ db: string, store: string, record: string, full: string, isDefaultDb: boolean, isDefaultStore: boolean }}
 */
export const parsePath = (input) => {
  if (!input || typeof input !== 'string') {
    return {
      db: DEFAULT_DB,
      store: DEFAULT_STORE,
      record: '',
      full: '',
      isDefaultDb: true,
      isDefaultStore: true
    };
  }

  const trimmed = input.trim();
  let db = DEFAULT_DB;
  let store = DEFAULT_STORE;
  let record = trimmed;

  // Check for database prefix (contains /)
  const slashIdx = trimmed.indexOf('/');
  if (slashIdx !== -1) {
    db = trimmed.slice(0, slashIdx) || DEFAULT_DB;
    record = trimmed.slice(slashIdx + 1);
  }

  // Check for store prefix (contains :)
  const colonIdx = record.indexOf(':');
  if (colonIdx !== -1) {
    store = record.slice(0, colonIdx) || DEFAULT_STORE;
    record = record.slice(colonIdx + 1);
  }

  return {
    db,
    store,
    record,
    full: buildPath(db, store, record),
    isDefaultDb: db === DEFAULT_DB,
    isDefaultStore: store === DEFAULT_STORE
  };
};

/**
 * Build a full path from components, omitting defaults for brevity
 * @param {string} db - Database name
 * @param {string} store - Store name
 * @param {string} record - Record path
 * @returns {string} The constructed path
 */
export const buildPath = (db, store, record) => {
  const useDefaultDb = !db || db === DEFAULT_DB;
  const useDefaultStore = !store || store === DEFAULT_STORE;

  if (useDefaultDb && useDefaultStore) {
    return record;
  }
  if (useDefaultDb) {
    return `${store}:${record}`;
  }
  if (useDefaultStore) {
    return `${db}/:${record}`;
  }
  return `${db}/${store}:${record}`;
};

/**
 * Build a canonical full path (always includes db and store)
 * @param {string} db - Database name
 * @param {string} store - Store name
 * @param {string} record - Record path
 * @returns {string} The full canonical path
 */
export const buildFullPath = (db, store, record) => {
  return `${db || DEFAULT_DB}/${store || DEFAULT_STORE}:${record}`;
};

/**
 * Get a display-friendly version of the path
 * Shows full path only when non-default db/store
 * @param {string} input - The path to format
 * @returns {string} Display-friendly path
 */
export const displayPath = (input) => {
  const { db, store, record } = parsePath(input);
  return buildPath(db, store, record);
};

/**
 * Extract just the record portion from any path format
 * @param {string} input - The path to extract from
 * @returns {string} The record path only
 */
export const getRecordPath = (input) => {
  return parsePath(input).record;
};

/**
 * Check if two paths refer to the same location
 * @param {string} path1
 * @param {string} path2
 * @returns {boolean}
 */
export const pathsEqual = (path1, path2) => {
  const p1 = parsePath(path1);
  const p2 = parsePath(path2);
  return p1.db === p2.db && p1.store === p2.store && p1.record === p2.record;
};

// Assign functions to path object for convenient grouped access
path.parse = parsePath;
path.build = buildPath;
path.buildFull = buildFullPath;
path.display = displayPath;
path.getRecord = getRecordPath;
path.equals = pathsEqual;
