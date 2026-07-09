(function () {
  "use strict";

  const DB_NAME = "card-stock-db";
  const DB_VERSION = 2;
  const STORES = {
    cards: "cards",
    companies: "companies",
    meta: "meta"
  };

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.cards)) {
          const store = db.createObjectStore(STORES.cards, { keyPath: "id" });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("companyId", "companyId", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        } else {
          const store = request.transaction.objectStore(STORES.cards);
          if (!store.indexNames.contains("companyId")) store.createIndex("companyId", "companyId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.companies)) {
          const store = db.createObjectStore(STORES.companies, { keyPath: "companyId" });
          store.createIndex("normalizedName", "normalizedName", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withStores(storeNames, mode, callback) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const stores = {};
      storeNames.forEach((name) => {
        stores[name] = tx.objectStore(name);
      });
      const result = callback(stores, tx);
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    }));
  }

  function getAll(storeName) {
    return withStores([storeName], "readonly", (stores) => requestToPromise(stores[storeName].getAll()));
  }

  function put(storeName, value) {
    return withStores([storeName], "readwrite", (stores) => stores[storeName].put(value));
  }

  function deleteOne(storeName, key) {
    return withStores([storeName], "readwrite", (stores) => stores[storeName].delete(key));
  }

  function clear(storeName) {
    return withStores([storeName], "readwrite", (stores) => stores[storeName].clear());
  }

  window.CardStockDB = {
    stores: STORES,
    getAllCards: () => getAll(STORES.cards),
    getAllCompanies: () => getAll(STORES.companies),
    getCard(id) {
      return withStores([STORES.cards], "readonly", (stores) => requestToPromise(stores.cards.get(id)));
    },
    getCompany(companyId) {
      return withStores([STORES.companies], "readonly", (stores) => requestToPromise(stores.companies.get(companyId)));
    },
    getMeta(key) {
      return withStores([STORES.meta], "readonly", (stores) => requestToPromise(stores.meta.get(key)));
    },
    saveCard: (card) => put(STORES.cards, card),
    saveCompany: (company) => put(STORES.companies, company),
    deleteCard: (id) => deleteOne(STORES.cards, id),
    deleteCompany: (companyId) => deleteOne(STORES.companies, companyId),
    clearCards: () => clear(STORES.cards),
    clearCompanies: () => clear(STORES.companies),
    replaceAll(cards, companies) {
      return withStores([STORES.cards, STORES.companies, STORES.meta], "readwrite", (stores) => {
        stores.cards.clear();
        stores.companies.clear();
        cards.forEach((card) => stores.cards.put(card));
        companies.forEach((company) => stores.companies.put(company));
        stores.meta.put({ key: "schemaVersion", value: 2, updatedAt: new Date().toISOString() });
      });
    },
    addAll(cards, companies) {
      return withStores([STORES.cards, STORES.companies, STORES.meta], "readwrite", (stores) => {
        companies.forEach((company) => stores.companies.put(company));
        cards.forEach((card) => stores.cards.put(card));
        stores.meta.put({ key: "schemaVersion", value: 2, updatedAt: new Date().toISOString() });
      });
    },
    setMeta(key, value) {
      return put(STORES.meta, { key, value, updatedAt: new Date().toISOString() });
    }
  };
})();
