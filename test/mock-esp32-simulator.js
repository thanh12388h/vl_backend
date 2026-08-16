/**
 * Mô phỏng 1 thiết bị ESP32 thật:
 *  - Gửi dữ liệu SpO2/BPM lên topic device/data mỗi giây (1Hz theo đặc tả)
 *  - Gửi heartbeat lên topic device/status mỗi 30s (rút ngắn còn 3s để demo nhanh)
 *  - Lắng nghe lệnh điều khiển còi trên device/{id}/control/buzzer và log lại
 *
 * Kịch bản dữ liệu: 15 mẫu đầu bình thường, sau đó 15 mẫu SpO2 tụt thấp
 * liên tục (mô phỏng bất thường thật) để backend phải xác nhận & cảnh báo
 * sau 3 lần liên tiếp (mỗi lần = trung bình của 5 mẫu).
 *
 * Chạy: node test/mock-esp32-simulator.js  (đảm bảo backend đang chạy trước)
 */
const mqtt = require('mqtt');

const DEVICE_ID = process.env.SIM_DEVICE_ID || 'esp32_001';
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const SAMPLE_INTERVAL_MS = 1000; // 1Hz như đặc tả
const HEARTBEAT_INTERVAL_MS = 3000; // rút gọn để demo (thật là 30s)

const client = mqtt.connect(BROKER_URL, { clientId: `esp32-sim-${DEVICE_ID}` });

let sampleCount = 0;
const TOTAL_NORMAL_SAMPLES = 15;
const TOTAL_ABNORMAL_SAMPLES = 20;

function randomInRange(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function nextSample() {
  sampleCount += 1;
  if (sampleCount <= TOTAL_NORMAL_SAMPLES) {
    // dữ liệu bình thường
    return { spo2: randomInRange(96, 99), bpm: Math.round(randomInRange(70, 85)) };
  }
  if (sampleCount <= TOTAL_NORMAL_SAMPLES + TOTAL_ABNORMAL_SAMPLES) {
    // mô phỏng tụt SpO2 kéo dài -> phải kích hoạt cảnh báo
    return { spo2: randomInRange(84, 89), bpm: Math.round(randomInRange(95, 110)) };
  }
  // quay lại bình thường để thấy bộ đếm liên tiếp reset về 0
  return { spo2: randomInRange(96, 99), bpm: Math.round(randomInRange(70, 85)) };
}

client.on('connect', () => {
  console.log(`[ESP32-SIM] ${DEVICE_ID} đã kết nối tới ${BROKER_URL}`);

  const buzzerTopic = `device/${DEVICE_ID}/control/buzzer`;
  client.subscribe(buzzerTopic);
  client.on('message', (topic, payload) => {
    if (topic === buzzerTopic) {
      const { state } = JSON.parse(payload.toString());
      console.log(`[ESP32-SIM] 🔊 Nhận lệnh điều khiển còi: ${state ? 'BẬT' : 'TẮT'}`);
    }
  });

  // gửi dữ liệu sinh hiệu mỗi giây
  const dataTimer = setInterval(() => {
    const { spo2, bpm } = nextSample();
    const payload = {
      deviceId: DEVICE_ID,
      spo2,
      bpm,
      timestamp: Math.floor(Date.now() / 1000),
    };
    client.publish('device/data', JSON.stringify(payload));
    console.log(`[ESP32-SIM] -> device/data`, payload);

    if (sampleCount >= TOTAL_NORMAL_SAMPLES + TOTAL_ABNORMAL_SAMPLES + 10) {
      clearInterval(dataTimer);
      console.log('[ESP32-SIM] Kết thúc mô phỏng dữ liệu.');
    }
  }, SAMPLE_INTERVAL_MS);

  // gửi heartbeat định kỳ
  const heartbeatTimer = setInterval(() => {
    const payload = { deviceId: DEVICE_ID, status: 'online', timestamp: Math.floor(Date.now() / 1000) };
    client.publish('device/status', JSON.stringify(payload));
    console.log(`[ESP32-SIM] -> device/status`, payload);
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();
});

client.on('error', (err) => console.error('[ESP32-SIM] Lỗi MQTT:', err.message));
