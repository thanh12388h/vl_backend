/**
 * Xử lý message MQTT — tương ứng Luồng 2 (ESP32 -> Backend -> Firebase) và
 * Luồng 5 (Heartbeat), đồng thời cung cấp hàm điều khiển cho Luồng 1
 * (Dashboard -> Backend -> ESP32).
 */
const config = require('../config/mqtt.config');
const movingAverage = require('../services/movingAverage.service');
const alertDetection = require('../services/alertDetection.service');
const firebaseService = require('../services/firebase.service');
const deviceStatusService = require('../services/deviceStatus.service');
const notificationService = require('../services/notification.service');

function attachHandlers(mqttClient) {
  mqttClient.on('message', async (topic, payloadBuf) => {
    let payload;
    try {
      payload = JSON.parse(payloadBuf.toString());
    } catch {
      console.error(`[MQTT] Payload không phải JSON hợp lệ trên topic ${topic}`);
      return;
    }

    if (topic === config.TOPICS.DEVICE_DATA) {
      await handleDeviceData(payload);
    } else if (topic === config.TOPICS.DEVICE_STATUS) {
      await handleDeviceStatus(payload);
    }
  });
}

/**
 * Chức năng 3-7: nhận mẫu sinh hiệu -> tiền xử lý -> moving average
 * -> phân tích -> phát hiện & xác nhận bất thường -> lưu Firebase -> thông báo.
 */
async function handleDeviceData(payload) {
  const { deviceId, spo2, bpm, timestamp } = payload;
  if (!deviceId) {
    console.error('[MQTT] Thiếu deviceId trong payload device/data');
    return;
  }

  // Chức năng 4: tiền xử lý & kiểm tra hợp lệ
  const validation = alertDetection.validateSample({ spo2, bpm });
  if (!validation.valid) {
    console.warn(`[MQTT] Dữ liệu lỗi từ ${deviceId}: ${validation.errors.join('; ')} — bỏ qua`);
    return;
  }

  // Chức năng 5: bộ lọc trung bình trượt N=5
  const maResult = movingAverage.addSample(deviceId, spo2, bpm);
  if (!maResult.ready) {
    // chưa đủ mẫu để tính trung bình, chờ mẫu tiếp theo
    return;
  }

  const { spo2Avg, bpmAvg } = maResult;

  // Chức năng 5-6: phân tích & phát hiện bất thường (đã tích hợp cơ chế liên tiếp)
  const analysis = alertDetection.analyze(deviceId, spo2Avg, bpmAvg);

  const ts = timestamp || Math.floor(Date.now() / 1000);

  // Chức năng 7: lưu dữ liệu vào Firebase
  await firebaseService.addTelemetry(deviceId, {
    timestamp: ts,
    spo2: spo2Avg,
    bpm: bpmAvg,
    status: analysis.status, // NORMAL | WATCH | CRITICAL
  });

  console.log(
    `[Telemetry] ${deviceId} | SpO2=${spo2Avg}% BPM=${bpmAvg} -> ${analysis.status} ` +
      `(spo2Streak=${analysis.counters.spo2}, bpmStreak=${analysis.counters.bpm})`
  );

  // Chức năng 6 + 9: nếu đã xác nhận bất thường (đủ N lần liên tiếp) -> lưu alert + gửi thông báo
  if (analysis.confirmedAlert) {
    const alertRecord = {
      deviceId,
      timestamp: ts,
      type: analysis.confirmedAlert.type,
      message: analysis.confirmedAlert.message,
    };
    await firebaseService.addAlert(alertRecord);
    await notificationService.notifyAlert({ ...alertRecord, spo2: spo2Avg, bpm: bpmAvg });
  }
}

/**
 * Chức năng 10: heartbeat / trạng thái thiết bị.
 */
async function handleDeviceStatus(payload) {
  const { deviceId, status, timestamp } = payload;
  if (!deviceId) return;
  const ts = timestamp || Math.floor(Date.now() / 1000);
  if (status === 'online') {
    deviceStatusService.markOnline(deviceId, ts);
    console.log(`[Heartbeat] ${deviceId} online lúc ${new Date(ts * 1000).toISOString()}`);
  }
}

/**
 * Chức năng 2 — Backend gửi lệnh điều khiển tới ESP32 qua MQTT (buzzer/led/oled).
 */
function publishControl(mqttClient, deviceId, kind, payload) {
  const topicFn = {
    buzzer: config.TOPICS.DEVICE_CONTROL_BUZZER,
    led: config.TOPICS.DEVICE_CONTROL_LED,
    oled: config.TOPICS.DEVICE_CONTROL_OLED,
  }[kind];

  if (!topicFn) throw new Error(`Loại điều khiển không hỗ trợ: ${kind}`);

  const topic = topicFn(deviceId);
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
  console.log(`[MQTT] Đã gửi lệnh điều khiển tới ${topic}:`, payload);
  return topic;
}

module.exports = { attachHandlers, publishControl };
