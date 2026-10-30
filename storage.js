/* IndexedDB is the sole data store. Transactions make each save atomic. */
(function (root) {
  let db;
  function connect() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('courtside', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('app');
      request.onsuccess = () => {
        db = request.result;
        db.onversionchange = () => db.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Courtside tabs and reload to finish updating storage.'));
    });
  }
  function transaction(action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app', 'readwrite');
      const store = tx.objectStore('app');
      let result, failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('Save canceled.'));
      tx.onerror = () => { /* onabort handles request and quota failures */ };
      const request = store.get('state');
      request.onsuccess = () => {
        try { result = action(request.result, store); }
        catch (error) { failure = error; tx.abort(); }
      };
    });
  }
  async function load(validate, prepare = () => false) {
    await connect();
    return transaction((existing, store) => {
      if (existing) {
        const updated = prepare(existing.data);
        if (!validate(existing.data) || !Number.isSafeInteger(existing.revision) || existing.revision < 0) throw new Error('Saved data could not be read. Existing data has been preserved.');
        if (updated) {
          existing.revision++;
          store.put(existing, 'state');
        }
        return existing;
      }
      const data = { roster: [], teams: [], games: [], active: null };
      const record = { revision: 0, data };
      store.put(record, 'state');
      return record;
    });
  }
  function save(data, revision) {
    return transaction((existing, store) => {
      if (!existing || existing.revision !== revision) throw new Error('Data changed in another tab. Reload before recording more plays.');
      const next = revision + 1;
      store.put({ data, revision: next }, 'state');
      return next;
    });
  }
  root.CourtStorage = { load, save };
})(globalThis);
