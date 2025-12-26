// utils/db-manager.js - Multi-database management for Alp

import { DEFAULT_DB, DEFAULT_STORE } from './path.js';

/**
 * Registry of open Dexie database instances
 * @type {Map<string, Dexie>}
 */
const databases = new Map();

/**
 * Registry of stores per database
 * @type {Map<string, Set<string>>}
 */
const storeRegistry = new Map();

/**
 * Create and register a new database with specified stores
 * @param {string} name - Database name
 * @param {string[]} storeNames - Array of store names to create
 * @returns {Promise<Dexie>} The created database instance
 */
const createDb = async (name, storeNames = [DEFAULT_STORE]) => {
  if (databases.has(name)) {
    throw new Error(`Database '${name}' already exists. Use getDb('${name}') to access it.`);
  }

  if (!storeNames.length) {
    storeNames = [DEFAULT_STORE];
  }

  const db = new Dexie(name);
  const storeSchema = {};
  for (const store of storeNames) {
    storeSchema[store] = 'name';
  }

  db.version(1).stores(storeSchema);
  await db.open();

  databases.set(name, db);
  storeRegistry.set(name, new Set(storeNames));

  console.log(`📦 Created database '${name}' with stores: ${storeNames.join(', ')}`);
  return db;
};

/**
 * Add a store to an existing database
 * Requires closing and reopening with a new version
 * @param {string} dbName - Database name
 * @param {string} storeName - New store name
 * @returns {Promise<Dexie>} The updated database instance
 */
const createStore = async (dbName, storeName) => {
  const db = databases.get(dbName);
  if (!db) {
    throw new Error(`Database '${dbName}' not found. Use alp.createDb('${dbName}', ['${storeName}']) to create it.`);
  }

  const stores = storeRegistry.get(dbName);
  if (stores.has(storeName)) {
    throw new Error(`Store '${storeName}' already exists in database '${dbName}'.`);
  }

  // Close current connection
  db.close();

  // Get current version and increment
  const currentVersion = db.verno;
  const newVersion = currentVersion + 1;

  // Build new schema with all existing stores plus new one
  const storeSchema = {};
  for (const store of stores) {
    storeSchema[store] = 'name';
  }
  storeSchema[storeName] = 'name';

  // Create new instance with updated schema
  const newDb = new Dexie(dbName);
  newDb.version(newVersion).stores(storeSchema);
  await newDb.open();

  // Update registries
  databases.set(dbName, newDb);
  stores.add(storeName);

  console.log(`📦 Added store '${storeName}' to database '${dbName}' (v${newVersion})`);
  return newDb;
};

/**
 * Register an existing Dexie instance (used for the default AlpDB)
 * @param {string} name - Database name
 * @param {Dexie} db - Existing Dexie instance
 * @param {string[]} storeNames - Store names in this database
 */
const registerDb = (name, db, storeNames = [DEFAULT_STORE]) => {
  databases.set(name, db);
  storeRegistry.set(name, new Set(storeNames));
};

/**
 * Get a database instance by name
 * @param {string} name - Database name
 * @returns {Dexie} The database instance
 * @throws {Error} If database doesn't exist
 */
const getDb = (name) => {
  const db = databases.get(name);
  if (!db) {
    throw new Error(`Database '${name}' not found. Use alp.createDb('${name}', ['storeName']) to create it.`);
  }
  return db;
};

/**
 * Get a store (table) from a database
 * @param {string} dbName - Database name
 * @param {string} storeName - Store name
 * @returns {Dexie.Table} The store/table instance
 * @throws {Error} If database or store doesn't exist
 */
const getStore = (dbName, storeName) => {
  const db = getDb(dbName);
  const stores = storeRegistry.get(dbName);

  if (!stores || !stores.has(storeName)) {
    throw new Error(`Store '${storeName}' not found in database '${dbName}'. Use alp.createStore('${dbName}', '${storeName}') to create it.`);
  }

  return db[storeName];
};

/**
 * Check if a database exists
 * @param {string} name - Database name
 * @returns {boolean}
 */
const hasDb = (name) => databases.has(name);

/**
 * Check if a store exists in a database
 * @param {string} dbName - Database name
 * @param {string} storeName - Store name
 * @returns {boolean}
 */
const hasStore = (dbName, storeName) => {
  const stores = storeRegistry.get(dbName);
  return stores ? stores.has(storeName) : false;
};

/**
 * Check if a database and store combination exists
 * @param {string} dbName - Database name
 * @param {string} storeName - Store name
 * @returns {boolean}
 */
const has = (dbName, storeName) => hasDb(dbName) && hasStore(dbName, storeName);

/**
 * List all registered database names
 * @returns {string[]}
 */
const listDbs = () => Array.from(databases.keys());

/**
 * List all stores in a database
 * @param {string} dbName - Database name
 * @returns {string[]}
 */
const listStores = (dbName) => {
  const stores = storeRegistry.get(dbName);
  return stores ? Array.from(stores) : [];
};

/**
 * Close and remove a database from the registry
 * Does NOT delete the IndexedDB - just closes connection
 * @param {string} name - Database name
 */
const closeDb = (name) => {
  const db = databases.get(name);
  if (db) {
    db.close();
    databases.delete(name);
    storeRegistry.delete(name);
    console.log(`📦 Closed database '${name}'`);
  }
};

/**
 * Delete a database entirely (removes from IndexedDB)
 * @param {string} name - Database name
 * @returns {Promise<void>}
 */
const deleteDb = async (name) => {
  closeDb(name);
  await Dexie.delete(name);
  console.log(`🗑️ Deleted database '${name}'`);
};

export const dbManager = {
  createDb,
  createStore,
  registerDb,
  getDb,
  getStore,
  hasDb,
  hasStore,
  has,
  listDbs,
  listStores,
  closeDb,
  deleteDb
};
