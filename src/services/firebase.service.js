/**
 * Lớp trừu tượng thao tác dữ liệu, mô phỏng đúng cấu trúc Firebase Realtime
 * Database mô tả trong đặc tả (III.6):
 *   devices/{deviceId}      -> { name, online, lastSeen }
 *   telemetry/{deviceId}/{pushId} -> { timestamp, spo2, bpm, status }
 *   alerts/{pushId}         -> { deviceId, timestamp, type, message }
 *
 * FIREBASE_MODE=mock -> lưu trong bộ nhớ (và ghi tạm ra data/mock-db.json)
 *                        để có thể chạy demo/test mà không cần thật.
 * FIREBASE_MODE=real -> dùng firebase-admin (đã viết sẵn khung, chỉ cần
 *                        cấu hình FIREBASE_SERVICE_ACCOUNT + FIREBASE_DB_URL).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const MODE = process.env.FIREBASE_MODE || 'mock';
const MOCK_DB_PATH = path.join(__dirname, '..', '..', 'data', 'mock-db.json');

// ---------- MOCK IMPLEMENTATION ----------
function loadMockDb() {
  if (fs.existsSync(MOCK_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf-8'));
    } catch {
      /* fall through to fresh db */
    }
  }
  return { devices: {}, telemetry: {}, alerts: {} };
}

let mockDb = loadMockDb();
let pushCounter = 1;

function persist() {
  fs.mkdirSync(path.dirname(MOCK_DB_PATH), { recursive: true });
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(mockDb, null, 2));
}

function genPushId() {
  return `-N${String(pushCounter++).padStart(3, '0')}`;
}

const mockImpl = {
  async upsertDevice(deviceId, patch) {
    const current = mockDb.devices[deviceId] || {
      name: deviceId,
      online: false,
      lastSeen: null,
    };
    mockDb.devices[deviceId] = { ...current, ...patch };
    persist();
    return mockDb.devices[deviceId];
  },

  async getDevice(deviceId) {
    return mockDb.devices[deviceId] || null;
  },

  async addTelemetry(deviceId, record) {
    if (!mockDb.telemetry[deviceId]) mockDb.telemetry[deviceId] = {};
    const id = genPushId();
    mockDb.telemetry[deviceId][id] = record;
    persist();
    return id;
  },

  async getLatestTelemetry(deviceId) {
    const bucket = mockDb.telemetry[deviceId];
    if (!bucket) return null;
    const keys = Object.keys(bucket);
    if (!keys.length) return null;
    const lastKey = keys[keys.length - 1];
    return bucket[lastKey];
  },

  async getHistory(deviceId, limit = 50) {
    const bucket = mockDb.telemetry[deviceId];
    if (!bucket) return [];
    return Object.values(bucket).slice(-limit);
  },

  async addAlert(alert) {
    const id = genPushId().replace('-N', '-A');
    mockDb.alerts[id] = alert;
    persist();
    return id;
  },

  async getAlerts(deviceId, limit = 50) {
    const all = Object.values(mockDb.alerts);
    const filtered = deviceId ? all.filter((a) => a.deviceId === deviceId) : all;
    return filtered.slice(-limit);
  },

  _dump() {
    return mockDb;
  },
};

// ---------- REAL FIREBASE IMPLEMENTATION (khung sẵn, cần service account) ----------
function loadServiceAccount() {
  // Cách 1 (khuyên dùng): trỏ tới file JSON tải từ Firebase Console, tránh
  // lỗi copy JSON nhiều dòng vào .env (dotenv chỉ đọc được 1 dòng cho mỗi biến).
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fsSync = require('fs');
    const pathSync = require('path');
    const filePath = pathSync.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    const raw = fsSync.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  }
  // Cách 2: chuỗi JSON dán trực tiếp vào .env (phải đúng 1 dòng, hiếm khi
  // copy tay chuẩn được vì private_key có \n bên trong).
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  throw new Error(
    'Thiếu cấu hình Firebase: đặt FIREBASE_SERVICE_ACCOUNT_PATH=đường-dẫn-tới-file.json trong .env'
  );
}

// ---------- REAL FIREBASE IMPLEMENTATION (khung sẵn, cần service account) ----------
function buildRealImpl() {
  // firebase-admin v12+ dùng API dạng modular (import theo module con) thay
  // vì admin.apps / admin.database() như các phiên bản cũ.
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');

  if (!getApps().length) {
    const serviceAccount = loadServiceAccount();
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
  }
  const db = getDatabase();

  return {
    async upsertDevice(deviceId, patch) {
      const ref = db.ref(`devices/${deviceId}`);
      await ref.update(patch);
      const snap = await ref.get();
      return snap.val();
    },
    async getDevice(deviceId) {
      const snap = await db.ref(`devices/${deviceId}`).get();
      return snap.exists() ? snap.val() : null;
    },
    async addTelemetry(deviceId, record) {
      const ref = await db.ref(`telemetry/${deviceId}`).push(record);
      return ref.key;
    },
    async getLatestTelemetry(deviceId) {
      const snap = await db
        .ref(`telemetry/${deviceId}`)
        .orderByKey()
        .limitToLast(1)
        .get();
      if (!snap.exists()) return null;
      const val = snap.val();
      return Object.values(val)[0];
    },
    async getHistory(deviceId, limit = 50) {
      const snap = await db
        .ref(`telemetry/${deviceId}`)
        .orderByKey()
        .limitToLast(limit)
        .get();
      if (!snap.exists()) return [];
      return Object.values(snap.val());
    },
    async addAlert(alert) {
      const ref = await db.ref('alerts').push(alert);
      return ref.key;
    },
    async getAlerts(deviceId, limit = 50) {
      const snap = await db.ref('alerts').orderByChild('deviceId').equalTo(deviceId).limitToLast(limit).get();
      if (!snap.exists()) return [];
      return Object.values(snap.val());
    },
  };
}

const impl = MODE === 'real' ? buildRealImpl() : mockImpl;

module.exports = {
  mode: MODE,
  ...impl,
};
