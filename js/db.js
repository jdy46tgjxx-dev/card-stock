(function () {
  "use strict";

  const DB_NAME = "card-stock-db";
  const DB_VERSION = 1;
  const STORE_NAME = "cards";

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withStore(mode, callback) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = callback(store);

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

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  window.CardStockDB = {
    getAllCards() {
      return withStore("readonly", (store) => requestToPromise(store.getAll()));
    },

    getCard(id) {
      return withStore("readonly", (store) => requestToPromise(store.get(id)));
    },

    saveCard(card) {
      return withStore("readwrite", (store) => store.put(card));
    },

    deleteCard(id) {
      return withStore("readwrite", (store) => store.delete(id));
    },

    clearCards() {
      return withStore("readwrite", (store) => store.clear());
    },

    replaceCards(cards) {
      return withStore("readwrite", (store) => {
        store.clear();
        cards.forEach((card) => store.put(card));
      });
    },

    addCards(cards) {
      return withStore("readwrite", (store) => {
        cards.forEach((card) => store.put(card));
      });
    }
  };
})();
