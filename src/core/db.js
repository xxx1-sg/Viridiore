/**
 * IndexedDB 轻封装（Promise）
 * 数据库：mossy-dawn
 */

const DB_NAME = 'mossy-dawn';
const DB_VERSION = 2;

const SCHEMA = {
  trails: { keyPath: 'id', indexes: [['startedAt', 'startedAt']] },
  roadbooks: { keyPath: 'id', indexes: [['createdAt', 'createdAt']] },
  gear: { keyPath: 'id', indexes: [['group', 'group']] },
  contacts: { keyPath: 'id', indexes: [] },
  pressure: { keyPath: 'id', indexes: [['ts', 'ts']] },
  cache: { keyPath: 'key', indexes: [['expireAt', 'expireAt']] },
  /* 追光结果反馈：用户"看到了 / 白跑一趟"是校准概率的唯一真实标签 */
  feedback: { keyPath: 'id', indexes: [['mountainId', 'mountainId'], ['ts', 'ts']] }
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(SCHEMA)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: def.keyPath });
          for (const [idxName, idxKey] of def.indexes) {
            store.createIndex(idxName, idxKey, { unique: false });
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    transaction.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const idb = {
  async put(store, value) {
    await tx(store, 'readwrite', (s) => s.put(value));
    return value;
  },

  async bulkPut(store, values) {
    await tx(store, 'readwrite', (s) => {
      values.forEach((v) => s.put(v));
    });
    return values;
  },

  async get(store, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async all(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(store, key) {
    await tx(store, 'readwrite', (s) => s.delete(key));
  },

  async clear(store) {
    await tx(store, 'readwrite', (s) => s.clear());
  },

  async count(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};

/** 列表类数据的安全读取：环境异常时返回空数组，不阻断页面 */
export async function safeAll(store) {
  try {
    return await idb.all(store);
  } catch (err) {
    console.warn('[db] 读取失败', store, err);
    return [];
  }
}

export async function safePut(store, value) {
  try {
    return await idb.put(store, value);
  } catch (err) {
    console.warn('[db] 写入失败', store, err);
    return null;
  }
}
