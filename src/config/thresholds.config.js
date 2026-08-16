/**
 * Ngưỡng cảnh báo mặc định (theo mô tả III.4 trong tài liệu đặc tả).
 * Có thể bị override theo từng thiết bị (Chức năng bổ sung: "điều chỉnh
 * ngưỡng cảnh báo riêng cho từng đối tượng") thông qua deviceThresholdStore.
 */
require('dotenv').config();

const DEFAULT_THRESHOLDS = {
  spo2: {
    warnMin: Number(process.env.SPO2_WARN_MIN || 95),      // 90-94: theo dõi
    criticalMin: Number(process.env.SPO2_CRITICAL_MIN || 90), // < 90: bất thường
  },
  bpm: {
    min: Number(process.env.BPM_MIN_NORMAL || 50),   // < 50: thấp (bất thường)
    max: Number(process.env.BPM_MAX_NORMAL || 120),  // > 120: cao (bất thường)
  },
};

const ALERT_CONSECUTIVE_COUNT = Number(process.env.ALERT_CONSECUTIVE_COUNT || 3);
const MOVING_AVERAGE_WINDOW = Number(process.env.MOVING_AVERAGE_WINDOW || 5);
const DEVICE_OFFLINE_TIMEOUT_SEC = Number(process.env.DEVICE_OFFLINE_TIMEOUT_SEC || 90);

// Ngưỡng tùy chỉnh theo từng thiết bị (in-memory; có thể thay bằng bảng DB thật)
const deviceThresholdOverrides = new Map();

function getThresholdsForDevice(deviceId) {
  return deviceThresholdOverrides.get(deviceId) || DEFAULT_THRESHOLDS;
}

function setThresholdsForDevice(deviceId, thresholds) {
  const merged = {
    spo2: { ...DEFAULT_THRESHOLDS.spo2, ...(thresholds.spo2 || {}) },
    bpm: { ...DEFAULT_THRESHOLDS.bpm, ...(thresholds.bpm || {}) },
  };
  deviceThresholdOverrides.set(deviceId, merged);
  return merged;
}

module.exports = {
  DEFAULT_THRESHOLDS,
  ALERT_CONSECUTIVE_COUNT,
  MOVING_AVERAGE_WINDOW,
  DEVICE_OFFLINE_TIMEOUT_SEC,
  getThresholdsForDevice,
  setThresholdsForDevice,
};
