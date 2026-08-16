/**
 * Mô phỏng Dashboard (frontend) gọi REST API của Backend để:
 *  1. Kiểm tra trạng thái server (/health)
 *  2. Lấy dữ liệu mới nhất (/api/v1/latest)
 *  3. Lấy lịch sử đo (/api/v1/history)
 *  4. Điều khiển còi bật/tắt (/api/v1/device/buzzer)
 *  5. Kiểm tra trạng thái thiết bị (/api/v1/device/status)
 *  6. Lấy danh sách cảnh báo (/api/v1/alerts)
 *  7. Đọc/ghi ngưỡng cảnh báo riêng theo thiết bị
 *
 * Chạy: node test/test-frontend-api.js
 * (Nên chạy sau khi mock-esp32-simulator.js đã gửi ít nhất vài lô 5 mẫu.)
 */
const fetch = require('node-fetch');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.SIM_DEVICE_ID || 'esp32_001';

async function callApi(label, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  console.log(`\n[TEST] ${label}`);
  console.log(`  ${method} ${path}${body ? ' body=' + JSON.stringify(body) : ''}`);
  console.log(`  -> HTTP ${res.status}`, data);
  return { status: res.status, data };
}

async function run() {
  console.log(`=== Test REST API tại ${BASE_URL} (device=${DEVICE_ID}) ===`);

  await callApi('Health check', 'GET', '/health');

  await callApi('Lấy dữ liệu mới nhất', 'GET', `/api/v1/latest?deviceId=${DEVICE_ID}`);

  await callApi('Lấy lịch sử đo (10 bản ghi gần nhất)', 'GET', `/api/v1/history?deviceId=${DEVICE_ID}&limit=10`);

  await callApi('Bật còi báo động', 'POST', '/api/v1/device/buzzer', { state: true });
  await new Promise((r) => setTimeout(r, 300));
  await callApi('Tắt còi báo động', 'POST', '/api/v1/device/buzzer', { state: false });

  await callApi('Gửi yêu cầu điều khiển còi thiếu trường state (kỳ vọng lỗi 400)', 'POST', '/api/v1/device/buzzer', {});

  await callApi('Kiểm tra trạng thái kết nối thiết bị', 'GET', `/api/v1/device/status?deviceId=${DEVICE_ID}`);

  await callApi('Lấy danh sách cảnh báo đã ghi nhận', 'GET', `/api/v1/alerts?deviceId=${DEVICE_ID}`);

  await callApi('Đọc ngưỡng cảnh báo hiện tại của thiết bị', 'GET', `/api/v1/device/${DEVICE_ID}/thresholds`);

  await callApi(
    'Đặt ngưỡng cảnh báo riêng cho thiết bị (SpO2 cảnh báo sớm hơn: warnMin=97)',
    'PUT',
    `/api/v1/device/${DEVICE_ID}/thresholds`,
    { spo2: { warnMin: 97, criticalMin: 92 } }
  );

  await callApi(
    'Đặt lịch nhắn tin OLED',
    'POST',
    `/api/v1/device/${DEVICE_ID}/oled/message`,
    { message: 'UỐNG THUỐC', scheduleTime: '08:00' }
  );

  console.log('\n=== Hoàn tất test REST API ===');
}

run().catch((err) => {
  console.error('[TEST] Lỗi:', err);
  process.exit(1);
});
