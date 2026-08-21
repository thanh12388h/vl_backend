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
  // lắng nghe liên tục mqtt để nhận topic, payload khi cần  
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
      await handleDeviceStatus(payload, topic);
    }
  });
}

/**
 * Chức năng 3-7: nhận mẫu sinh hiệu -> tiền xử lý -> moving average
 * -> phân tích -> phát hiện & xác nhận bất thường -> lưu Firebase -> thông báo.
 */
async function handleDeviceData(payload) {
  const { device_id, deviceId, spo2, bpm, temperature, timestamp } = payload;
  const actualDeviceId = deviceId || device_id;

  if (!actualDeviceId) {
    console.error('[MQTT] Thiếu deviceId trong payload device/data');
    return;
  }

  // Chức năng 4: tiền xử lý & kiểm tra hợp lệ
  const validation = alertDetection.validateSample({ spo2, bpm, temperature });
  if (!validation.valid) {
    console.warn(`[MQTT] Dữ liệu lỗi từ ${actualDeviceId}: ${validation.errors.join('; ')} — bỏ qua`);
    return;
  }

  // Chức năng 5: bộ lọc trung bình trượt N=5
  const maResult = movingAverage.addSample(actualDeviceId, spo2, bpm, temperature);
  if (!maResult.ready) {
    // chưa đủ mẫu để tính trung bình, chờ mẫu tiếp theo
    return;
  }

  const { spo2Avg, bpmAvg, temperatureAvg } = maResult;

  // Chức năng 5-6: phân tích & phát hiện bất thường (đã tích hợp cơ chế liên tiếp)
  const analysis = alertDetection.analyze(actualDeviceId, spo2Avg, bpmAvg, temperatureAvg);

  // ***có thể tính toán thời gian này thành ngày giờ cụ thể 
  const ts = timestamp || Math.floor(Date.now() / 1000);

  // Chức năng 7: lưu dữ liệu vào Firebase
  await firebaseService.addTelemetry(actualDeviceId, {
    timestamp: ts,
    spo2: spo2Avg,
    bpm: bpmAvg,
    temperature: temperatureAvg,
    status: analysis.status, // NORMAL | WATCH | CRITICAL
  });

  console.log(
    `[Telemetry] ${actualDeviceId} | SpO2=${spo2Avg}% BPM=${bpmAvg} -> ${analysis.status} ` +
      `(spo2Streak=${analysis.counters.spo2}, bpmStreak=${analysis.counters.bpm})`
  );

  // Chức năng 6 + 9: nếu đã xác nhận bất thường (đủ N lần liên tiếp) -> lưu alert + gửi thông báo
  if (analysis.confirmedAlert) {
    const alertRecord = {
      deviceId: actualDeviceId,
      timestamp: ts,
      type: analysis.confirmedAlert.type,
      message: analysis.confirmedAlert.message,
    };
    await firebaseService.addAlert(alertRecord);
    await notificationService.notifyAlert({ ...alertRecord, spo2: spo2Avg, bpm: bpmAvg, temperature: temperatureAvg });
  }
}

/**
 * Chức năng 10: heartbeat / trạng thái thiết bị.
 */
async function handleDeviceStatus(payload, topic) {
    const parts = topic.split('/');
    const deviceId = parts[2];

    const ts = payload.last_seen
        ? Math.floor(new Date(payload.last_seen).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

    if (payload.online === true) {
        deviceStatusService.markOnline(deviceId, ts);
    }
}

/**
 * Chức năng 2 — Backend gửi lệnh điều khiển tới ESP32 qua MQTT (buzzer/led/oled).
 */
function publishControl(mqttClient, actualDeviceId, kind, payload) {
  const topicFn = {
    buzzer: config.TOPICS.DEVICE_CONTROL_BUZZER,
    led: config.TOPICS.DEVICE_CONTROL_LED,
    oled: config.TOPICS.DEVICE_CONTROL_OLED,
  }[kind];

  if (!topicFn) throw new Error(`Loại điều khiển không hỗ trợ: ${kind}`);

  const topic = topicFn(actualDeviceId);
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
  console.log(`[MQTT] Đã gửi lệnh điều khiển tới ${topic}:`, payload);
  return topic;
}

module.exports = { attachHandlers, publishControl };
