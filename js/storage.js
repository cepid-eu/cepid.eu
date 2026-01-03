/**
 * CEPID Infoviz IndexedDB Storage
 * Provides offline-first data persistence
 */

const Storage = (function() {
  const DB_NAME = 'CepidInfovizDB';
  const DB_VERSION = 1;

  let db = null;

  // Store names
  const STORES = {
    OFFERS: 'offers',
    DEPARTMENTS: 'departments',
    META: 'meta',
    PREFERENCES: 'preferences'
  };

  /**
   * Initialize the database
   */
  async function init() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[Storage] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        console.log('[Storage] Database opened successfully');
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        console.log('[Storage] Upgrading database schema');

        // Offers store with indexes
        if (!database.objectStoreNames.contains(STORES.OFFERS)) {
          const offersStore = database.createObjectStore(STORES.OFFERS, { keyPath: 'id' });
          offersStore.createIndex('jobFamily', 'jobFamily', { unique: false });
          offersStore.createIndex('department', 'department', { unique: false });
          offersStore.createIndex('contractType', 'contractType', { unique: false });
          offersStore.createIndex('date', 'date', { unique: false });
        }

        // Departments store
        if (!database.objectStoreNames.contains(STORES.DEPARTMENTS)) {
          database.createObjectStore(STORES.DEPARTMENTS, { keyPath: 'code' });
        }

        // Meta store (for dates, version, dataSource)
        if (!database.objectStoreNames.contains(STORES.META)) {
          database.createObjectStore(STORES.META, { keyPath: 'key' });
        }

        // Preferences store (for user settings)
        if (!database.objectStoreNames.contains(STORES.PREFERENCES)) {
          database.createObjectStore(STORES.PREFERENCES, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save all offers to IndexedDB
   */
  async function saveOffers(offers) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFERS], 'readwrite');
      const store = transaction.objectStore(STORES.OFFERS);

      // Clear existing offers first
      store.clear();

      let count = 0;
      offers.forEach((offer) => {
        store.put(offer);
        count++;
      });

      transaction.oncomplete = () => {
        console.log(`[Storage] Saved ${count} offers`);
        resolve(count);
      };

      transaction.onerror = () => {
        console.error('[Storage] Failed to save offers:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Get all offers from IndexedDB
   */
  async function getOffers() {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFERS], 'readonly');
      const store = transaction.objectStore(STORES.OFFERS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[Storage] Failed to get offers:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get offers by job family
   */
  async function getOffersByJobFamily(jobFamily) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFERS], 'readonly');
      const store = transaction.objectStore(STORES.OFFERS);
      const index = store.index('jobFamily');
      const request = index.getAll(jobFamily);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get offers by department
   */
  async function getOffersByDepartment(department) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.OFFERS], 'readonly');
      const store = transaction.objectStore(STORES.OFFERS);
      const index = store.index('department');
      const request = index.getAll(department);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save departments mapping
   */
  async function saveDepartments(departments) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.DEPARTMENTS], 'readwrite');
      const store = transaction.objectStore(STORES.DEPARTMENTS);

      store.clear();

      Object.entries(departments).forEach(([code, name]) => {
        store.put({ code, name });
      });

      transaction.oncomplete = () => {
        console.log('[Storage] Saved departments');
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get departments mapping
   */
  async function getDepartments() {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.DEPARTMENTS], 'readonly');
      const store = transaction.objectStore(STORES.DEPARTMENTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = {};
        request.result.forEach((dept) => {
          result[dept.code] = dept.name;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save metadata
   */
  async function saveMeta(key, value) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.META], 'readwrite');
      const store = transaction.objectStore(STORES.META);

      store.put({ key, value, updatedAt: new Date().toISOString() });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get metadata by key
   */
  async function getMeta(key) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.META], 'readonly');
      const store = transaction.objectStore(STORES.META);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save all metadata from aggregated.json
   */
  async function saveAllMeta(meta) {
    await saveMeta('generatedAt', meta.generatedAt);
    await saveMeta('dataSource', meta.dataSource);
    await saveMeta('totalOffers', meta.totalOffers);
    await saveMeta('offersWithSalary', meta.offersWithSalary);
    await saveMeta('dateRange', meta.dateRange);
  }

  /**
   * Get all metadata
   */
  async function getAllMeta() {
    return {
      generatedAt: await getMeta('generatedAt'),
      dataSource: await getMeta('dataSource'),
      totalOffers: await getMeta('totalOffers'),
      offersWithSalary: await getMeta('offersWithSalary'),
      dateRange: await getMeta('dateRange')
    };
  }

  /**
   * Save user preference
   */
  async function savePreference(key, value) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PREFERENCES], 'readwrite');
      const store = transaction.objectStore(STORES.PREFERENCES);

      store.put({ key, value });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get user preference
   */
  async function getPreference(key, defaultValue = null) {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PREFERENCES], 'readonly');
      const store = transaction.objectStore(STORES.PREFERENCES);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : defaultValue);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save complete data from aggregated.json
   */
  async function saveAggregatedData(data) {
    console.log('[Storage] Saving aggregated data...');
    const startTime = Date.now();

    await saveOffers(data.offers);
    await saveDepartments(data.departments);
    await saveAllMeta(data.meta);
    await saveMeta('dates', data.dates);
    await saveMeta('byContractType', data.byContractType);
    await saveMeta('byJobFamily', data.byJobFamily);

    const elapsed = Date.now() - startTime;
    console.log(`[Storage] Saved aggregated data in ${elapsed}ms`);
  }

  /**
   * Load complete data from IndexedDB
   */
  async function loadAggregatedData() {
    console.log('[Storage] Loading aggregated data from IndexedDB...');
    const startTime = Date.now();

    try {
      const offers = await getOffers();

      if (!offers || offers.length === 0) {
        console.log('[Storage] No cached data found');
        return null;
      }

      const data = {
        meta: await getAllMeta(),
        dates: await getMeta('dates'),
        departments: await getDepartments(),
        offers: offers,
        byContractType: await getMeta('byContractType'),
        byJobFamily: await getMeta('byJobFamily')
      };

      const elapsed = Date.now() - startTime;
      console.log(`[Storage] Loaded ${offers.length} offers from IndexedDB in ${elapsed}ms`);

      return data;
    } catch (error) {
      console.error('[Storage] Failed to load data:', error);
      return null;
    }
  }

  /**
   * Check if we have cached data
   */
  async function hasData() {
    try {
      await init();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORES.OFFERS], 'readonly');
        const store = transaction.objectStore(STORES.OFFERS);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result > 0);
        };

        request.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Get data version (generatedAt timestamp)
   */
  async function getDataVersion() {
    return getMeta('generatedAt');
  }

  /**
   * Clear all data
   */
  async function clearAll() {
    await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.OFFERS, STORES.DEPARTMENTS, STORES.META],
        'readwrite'
      );

      transaction.objectStore(STORES.OFFERS).clear();
      transaction.objectStore(STORES.DEPARTMENTS).clear();
      transaction.objectStore(STORES.META).clear();

      transaction.oncomplete = () => {
        console.log('[Storage] All data cleared');
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get storage estimate
   */
  async function getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
      };
    }
    return null;
  }

  // Public API
  return {
    init,
    saveOffers,
    getOffers,
    getOffersByJobFamily,
    getOffersByDepartment,
    saveDepartments,
    getDepartments,
    saveMeta,
    getMeta,
    saveAllMeta,
    getAllMeta,
    savePreference,
    getPreference,
    saveAggregatedData,
    loadAggregatedData,
    hasData,
    getDataVersion,
    clearAll,
    getStorageEstimate,
    STORES
  };
})();

// Export for use in other modules
window.Storage = Storage;
