const DB_NAME = "FairFareOffline";
const DB_VERSION = 1;
const STORE_NAME = "dashboard";
let databasePromise;

const openDashboardDb = () => {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("IndexedDB upgrade is blocked"));
    };
  });

  return databasePromise;
};

const runRead = (key) =>
  openDashboardDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(String(key));

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );

const runWrite = (values) =>
  openDashboardDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        values.forEach(({ key, value }) => store.put(value, String(key)));

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );

export const getDashboardSnapshot = async (userId) => {
  if (!userId) return null;

  try {
    const direct = await runRead(userId);
    if (direct?.user) return direct.user;
    return null;
  } catch (error) {
    console.error("Failed to read dashboard cache:", error);
    return null;
  }
};

export const saveDashboardSnapshot = async (userId, user) => {
  if (!userId || !user || typeof user !== "object") return false;

  try {
    const snapshot = {
      user,
      cachedAt: Date.now(),
      userId: String(userId),
      serverUserId: user._id ? String(user._id) : null,
    };

    const values = [{ key: String(userId), value: snapshot }];
    if (user._id && String(user._id) !== String(userId)) {
      values.push({ key: String(user._id), value: snapshot });
    }

    await runWrite(values);
    return true;
  } catch (error) {
    console.error("Failed to save dashboard cache:", error);
    return false;
  }
};

export const updateDashboardSnapshot = async (userId, patch) => {
  if (!userId || !patch || typeof patch !== "object") return false;
  const cachedUser = await getDashboardSnapshot(userId);
  if (!cachedUser) return false;
  return saveDashboardSnapshot(userId, { ...cachedUser, ...patch });
};

export const clearDashboardSnapshot = async (userId) => {
  if (!userId) return false;

  try {
    const direct = await runRead(userId);
    const db = await openDashboardDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.delete(String(userId));
      if (direct?.serverUserId) {
        store.delete(direct.serverUserId);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch (error) {
    console.error("Failed to clear dashboard cache:", error);
    return false;
  }
};

