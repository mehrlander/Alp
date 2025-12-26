// utils/memory-db.js - In-memory database fallback when IndexedDB is unavailable

/**
 * Check if IndexedDB is available and functional
 * @returns {Promise<boolean>} True if IndexedDB works, false otherwise
 */
export const isIndexedDBAvailable = async () => {
  // Check if indexedDB object exists
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    return false;
  }

  // Try to actually open a test database
  // This catches Safari data URL restrictions and other runtime issues
  try {
    const testName = '__alp_indexeddb_test__';
    const request = indexedDB.open(testName, 1);

    return new Promise((resolve) => {
      request.onerror = () => {
        resolve(false);
      };

      request.onsuccess = () => {
        // Clean up test database
        request.result.close();
        indexedDB.deleteDatabase(testName);
        resolve(true);
      };

      // Handle blocked event (shouldn't happen for test db, but be safe)
      request.onblocked = () => {
        resolve(false);
      };
    });
  } catch (e) {
    return false;
  }
};

/**
 * A chainable query builder for where().startsWith() pattern
 */
class WhereClause {
  constructor(table, field) {
    this.table = table;
    this.field = field;
  }

  startsWith(prefix) {
    return {
      toArray: async () => {
        const results = [];
        for (const record of this.table._data.values()) {
          const fieldValue = record[this.field];
          if (typeof fieldValue === 'string' && fieldValue.startsWith(prefix)) {
            results.push(record);
          }
        }
        return results;
      }
    };
  }
}

/**
 * In-memory table that mimics Dexie.Table interface
 * Uses 'name' as the primary key (matching Alp's schema)
 */
class MemoryTable {
  constructor(name) {
    this.name = name;
    this._data = new Map();
  }

  /**
   * Get a record by primary key
   * @param {string} key - The primary key value
   * @returns {Promise<any>} The record or undefined
   */
  async get(key) {
    return this._data.get(key);
  }

  /**
   * Insert or update a record
   * @param {Object} record - Record with 'name' as primary key
   * @returns {Promise<string>} The primary key
   */
  async put(record) {
    if (!record || typeof record.name === 'undefined') {
      throw new Error('Record must have a "name" property');
    }
    this._data.set(record.name, { ...record });
    return record.name;
  }

  /**
   * Delete a record by primary key
   * @param {string} key - The primary key value
   * @returns {Promise<void>}
   */
  async delete(key) {
    this._data.delete(key);
  }

  /**
   * Get all records as an array
   * @returns {Promise<Array>} All records
   */
  async toArray() {
    return Array.from(this._data.values());
  }

  /**
   * Start a where clause for filtering
   * @param {string} field - Field name to filter on
   * @returns {WhereClause} Chainable where clause
   */
  where(field) {
    return new WhereClause(this, field);
  }

  /**
   * Clear all records from the table
   * @returns {Promise<void>}
   */
  async clear() {
    this._data.clear();
  }

  /**
   * Count records in the table
   * @returns {Promise<number>}
   */
  async count() {
    return this._data.size;
  }
}

/**
 * In-memory database that mimics Dexie interface
 * Creates MemoryTable instances for each store name
 */
export class MemoryDb {
  constructor(name) {
    this.name = name;
    this._tables = new Map();
    this._version = 1;
    this._isOpen = false;
  }

  /**
   * Get the version number (for compatibility with Dexie)
   */
  get verno() {
    return this._version;
  }

  /**
   * Define database version and stores (Dexie compatibility)
   * @param {number} version - Version number
   * @returns {Object} Chain object with stores() method
   */
  version(version) {
    this._version = version;
    return {
      stores: (schema) => {
        // Create tables for each store in schema
        for (const storeName of Object.keys(schema)) {
          if (!this._tables.has(storeName)) {
            const table = new MemoryTable(storeName);
            this._tables.set(storeName, table);
            // Expose table as property on db instance
            this[storeName] = table;
          }
        }
        return this;
      }
    };
  }

  /**
   * Open the database (no-op for memory, but needed for API compatibility)
   * @returns {Promise<MemoryDb>}
   */
  async open() {
    this._isOpen = true;
    return this;
  }

  /**
   * Close the database (no-op for memory, but needed for API compatibility)
   */
  close() {
    this._isOpen = false;
  }

  /**
   * Check if database is open
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Delete the database (clears all data for memory db)
   * @param {string} name - Database name
   * @returns {Promise<void>}
   */
  static async delete(name) {
    // For memory databases, this is a no-op since they don't persist
    // The instance would need to be cleared separately
  }
}
