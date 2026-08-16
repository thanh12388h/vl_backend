/**
 * Demo end-to-end trong 1 tiến trình duy nhất (không cần mở nhiều terminal):
 *   1. Khởi động Backend (Express + MQTT broker nhúng)
 *   2. Khởi động mô phỏng ESP32 gửi dữ liệu (bao gồm kịch bản bất thường)
 *   3. Sau khi đã có vài lô dữ liệu, chạy test REST API mô phỏng Dashboard
 *   4. In tóm tắt dữ liệu đã lưu trong "Firebase" (mock) để kiểm chứng
 *
 * Chạy: npm run demo
 */
require('dotenv').config();
const mqtt = require('mqtt');

const { start } = require('../src/server');
const firebaseService = require('../src/services/firebase.service');

const DEVICE_ID = process.env.SIM_DEVICE_ID || 'esp32_001';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n========== BƯỚC 1: Khởi động Backend ==========');
  const { server, mqttClient } = start();
  await sleep(500);

  console.log('\n========== BƯỚC 2: Mô phỏng ESP32 gửi dữ liệu ==========');
  const simClient = mqtt.connect('mqtt://localhost:1883', { clientId: 'esp32-sim-demo' });

  await new Promise((resolve) => simClient.on('connect', resolve));

  // Gửi heartbeat trước
  simClient.publish(
    'device/status',
    JSON.stringify({ deviceId: DEVICE_ID, status: 'online', timestamp: Math.floor(Date.now() / 1000) })
  );

  // Kịch bản: 10 mẫu bình thường (2 lô x 5), rồi 15 mẫu SpO2 thấp liên tục (3 lô x 5 -> đủ kích hoạt cảnh báo)
  const samples = [];
  for (let i = 0; i < 10; i += 1) samples.push({ spo2: 97 + Math.random(), bpm: 75 + Math.round(Math.random() * 5) });
  for (let i = 0; i < 15; i += 1) samples.push({ spo2: 86 + Math.random(), bpm: 100 + Math.round(Math.random() * 5) });

  for (const s of samples) {
    simClient.publish(
      'device/data',
      JSON.stringify({ deviceId: DEVICE_ID, spo2: Math.round(s.spo2 * 10) / 10, bpm: s.bpm, timestamp: Math.floor(Date.now() / 1000) })
    );
    await sleep(120); // gửi nhanh hơn thực tế (1Hz) để demo không mất nhiều thời gian
  }

  console.log('\n... đợi Backend xử lý xong các lô moving-average ...');
  await sleep(500);

  console.log('\n========== BƯỚC 3: Test REST API (giả lập Dashboard) ==========');
  const fetch = require('node-fetch');
  const BASE = 'http://localhost:3000';

  const latest = await (await fetch(`${BASE}/api/v1/latest?deviceId=${DEVICE_ID}`)).json();
  console.log('GET /api/v1/latest ->', latest);

  const history = await (await fetch(`${BASE}/api/v1/history?deviceId=${DEVICE_ID}&limit=10`)).json();
  console.log(`GET /api/v1/history -> ${history.length} bản ghi, ví dụ:`, history[0]);

  const buzzerOn = await (
    await fetch(`${BASE}/api/v1/device/buzzer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: true }),
    })
  ).json();
  console.log('POST /api/v1/device/buzzer {state:true} ->', buzzerOn);

  const status = await (await fetch(`${BASE}/api/v1/device/status?deviceId=${DEVICE_ID}`)).json();
  console.log('GET /api/v1/device/status ->', status);

  const alerts = await (await fetch(`${BASE}/api/v1/alerts?deviceId=${DEVICE_ID}`)).json();
  console.log(`GET /api/v1/alerts -> ${alerts.length} cảnh báo:`, alerts);

  console.log('\n========== BƯỚC 4: Tóm tắt dữ liệu trong "Firebase" (mock) ==========');
  const dump = firebaseService._dump ? firebaseService._dump() : null;
  if (dump) {
    console.log('devices:', dump.devices);
    console.log('telemetry count:', Object.keys(dump.telemetry[DEVICE_ID] || {}).length);
    console.log('alerts count:', Object.keys(dump.alerts).length);
  }

  console.log('\n=== DEMO HOÀN TẤT — nhấn Ctrl+C để thoát (server vẫn đang chạy) ===');
  simClient.end();
  server.close();
  mqttClient.end(true);
  process.exit(0);
}

main().catch((err) => {
  console.error('[DEMO] Lỗi:', err);
  process.exit(1);
});
