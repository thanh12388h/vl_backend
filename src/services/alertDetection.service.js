/**
 * Chức năng 4-6: Tiền xử lý, phân tích dữ liệu và phát hiện bất thường.
 * Chức năng bổ sung III.5: xác nhận bất thường sau N lần liên tiếp
 * (mặc định 3 lần) để tránh báo động giả do nhiễu / cử động tay mạnh.
 */
const { getThresholdsForDevice, ALERT_CONSECUTIVE_COUNT } = require('../config/thresholds.config');

// Giới hạn sinh lý hợp lệ — dùng ở bước tiền xử lý (Chức năng 4)
const PHYSIO_LIMITS = {
  spo2: { min: 50, max: 100 },
  bpm: { min: 30, max: 220 },
};

// Đếm số lần bất thường liên tiếp theo từng thiết bị + loại chỉ số
const consecutiveCounters = new Map(); // deviceId -> { spo2: n, bpm: n }

function getCounters(deviceId) {
  if (!consecutiveCounters.has(deviceId)) {
    consecutiveCounters.set(deviceId, { spo2: 0, bpm: 0 });
  }
  return consecutiveCounters.get(deviceId);
}

/**
 * Chức năng 4 — Tiền xử lý & kiểm tra tính hợp lệ.
 * Giá trị ngoài giới hạn sinh lý bị coi là dữ liệu lỗi, loại bỏ.
 */
function validateSample({ spo2, bpm }) {
  const errors = [];
  if (typeof spo2 !== 'number' || spo2 < PHYSIO_LIMITS.spo2.min || spo2 > PHYSIO_LIMITS.spo2.max) {
    errors.push(`spo2 ngoài giới hạn sinh lý: ${spo2}`);
  }
  if (typeof bpm !== 'number' || bpm < PHYSIO_LIMITS.bpm.min || bpm > PHYSIO_LIMITS.bpm.max) {
    errors.push(`bpm ngoài giới hạn sinh lý: ${bpm}`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Phân loại 1 chỉ số theo ngưỡng cảnh báo (mục III.4).
 */
function classifySpo2(spo2, thresholds) {
  if (spo2 < thresholds.spo2.criticalMin) return 'LOW_SPO2';
  if (spo2 < thresholds.spo2.warnMin) return 'WATCH_SPO2';
  return 'NORMAL';
}

function classifyBpm(bpm, thresholds) {
  if (bpm < thresholds.bpm.min) return 'LOW_BPM';
  if (bpm > thresholds.bpm.max) return 'HIGH_BPM';
  return 'NORMAL';
}

/**
 * Chức năng 5 & 6 — Phân tích dữ liệu (sau moving average) và xác nhận
 * bất thường dựa trên số lần liên tiếp.
 *
 * Trả về:
 *  status: 'NORMAL' | 'WATCH' | 'CRITICAL'
 *  confirmedAlert: null hoặc { type, message } khi đã đủ N lần liên tiếp
 */
function analyze(deviceId, spo2Avg, bpmAvg) {
  const thresholds = getThresholdsForDevice(deviceId);
  const counters = getCounters(deviceId);

  const spo2Class = classifySpo2(spo2Avg, thresholds);
  const bpmClass = classifyBpm(bpmAvg, thresholds);

  const isSpo2Abnormal = spo2Class !== 'NORMAL';
  const isBpmAbnormal = bpmClass !== 'NORMAL';

  // cập nhật bộ đếm liên tiếp — 1 lần bình thường thì reset về 0
  counters.spo2 = isSpo2Abnormal ? counters.spo2 + 1 : 0;
  counters.bpm = isBpmAbnormal ? counters.bpm + 1 : 0;

  let confirmedAlert = null;
  if (counters.spo2 >= ALERT_CONSECUTIVE_COUNT) {
    confirmedAlert = {
      type: spo2Class === 'LOW_SPO2' ? 'LOW_SPO2' : 'WATCH_SPO2',
      message: `SpO2 ${spo2Class === 'LOW_SPO2' ? 'dưới ngưỡng nguy hiểm' : 'dưới ngưỡng theo dõi'} (${spo2Avg}%) trong ${ALERT_CONSECUTIVE_COUNT} lần đo liên tiếp`,
    };
  } else if (counters.bpm >= ALERT_CONSECUTIVE_COUNT) {
    confirmedAlert = {
      type: bpmClass, // LOW_BPM | HIGH_BPM
      message: `Nhịp tim ${bpmClass === 'LOW_BPM' ? 'quá thấp' : 'quá cao'} (${bpmAvg} bpm) trong ${ALERT_CONSECUTIVE_COUNT} lần đo liên tiếp`,
    };
  }

  let status = 'NORMAL';
  if (spo2Class === 'LOW_SPO2' || bpmClass === 'LOW_BPM' || bpmClass === 'HIGH_BPM') status = 'CRITICAL';
  else if (spo2Class === 'WATCH_SPO2') status = 'WATCH';

  return {
    status,
    spo2Class,
    bpmClass,
    counters: { ...counters },
    confirmedAlert,
  };
}

module.exports = { validateSample, analyze, PHYSIO_LIMITS };
