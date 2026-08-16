/**
 * Chức năng 10 — Giám sát kết nối thiết bị (Luồng 5: ESP32 -> Backend Heartbeat).
 * ESP32 gửi status định kỳ (mặc định 30s). Nếu quá DEVICE_OFFLINE_TIMEOUT_SEC
 * (mặc định 90s - được định nghĩa trong config/thresholds.config) không nhận được, backend tự đánh dấu thiết bị offline.
 */
const { DEVICE_OFFLINE_TIMEOUT_SEC } = require('../config/thresholds.config');
const firebaseService = require('./firebase.service');

const lastSeenMap = new Map(); // deviceId -> epoch seconds
const offlineTimers = new Map(); // deviceId -> Timeout handle

function markOnline(deviceId, timestamp = Math.floor(Date.now() / 1000)) {
  lastSeenMap.set(deviceId, timestamp);
  firebaseService.upsertDevice(deviceId, { online: true, lastSeen: timestamp });
  _resetOfflineTimer(deviceId);
}

function _resetOfflineTimer(deviceId) {
  if (offlineTimers.has(deviceId)) {
    clearTimeout(offlineTimers.get(deviceId));
  }
  const timer = setTimeout(() => {
    firebaseService.upsertDevice(deviceId, { online: false });
    // eslint-disable-next-line no-console
    console.log(`[DeviceStatus] ⚠️  Thiết bị ${deviceId} mất kết nối (không có heartbeat > ${DEVICE_OFFLINE_TIMEOUT_SEC}s)`);
  }, DEVICE_OFFLINE_TIMEOUT_SEC * 1000);
  timer.unref?.(); // không giữ tiến trình sống chỉ vì timer này (hữu ích khi test)
  offlineTimers.set(deviceId, timer);
}

function getLastSeen(deviceId) {
  return lastSeenMap.get(deviceId) || null;
}

module.exports = { markOnline, getLastSeen };
