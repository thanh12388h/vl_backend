/**
 * Test kết nối Firebase THẬT một cách độc lập — không qua MQTT/ESP32 —
 * để dễ phát hiện lỗi (sai service account, sai FIREBASE_DB_URL, sai loại
 * database...) mà không bị nhiễu bởi log của MQTT/Moving Average.
 *
 * Chạy: node test/test-firebase-connection.js
 * (Yêu cầu .env đã có FIREBASE_MODE=real, FIREBASE_DB_URL, FIREBASE_SERVICE_ACCOUNT
 *  và đã `npm install firebase-admin`)
 */
require('dotenv').config();
const firebaseService = require('../src/services/firebase.service');

const TEST_DEVICE_ID = 'test_connection_device';

async function run() {
  console.log(`=== Test kết nối Firebase (mode=${firebaseService.mode}) ===`);
  if (firebaseService.mode !== 'real') {
    console.log('⚠️  FIREBASE_MODE hiện không phải "real" — sửa trong .env rồi chạy lại.');
    return;
  }

  try {
    console.log('\n[1/4] Ghi thử 1 thiết bị (devices/) ...');
    const device = await firebaseService.upsertDevice(TEST_DEVICE_ID, {
      name: 'Test Connection',
      online: true,
      lastSeen: Math.floor(Date.now() / 1000),
    });
    console.log('   ✅ Ghi thành công:', device);

    console.log('\n[2/4] Ghi thử 1 bản ghi telemetry (telemetry/) ...');
    const telemetryId = await firebaseService.addTelemetry(TEST_DEVICE_ID, {
      timestamp: Math.floor(Date.now() / 1000),
      spo2: 98,
      bpm: 75,
      status: 'NORMAL',
    });
    console.log('   ✅ Ghi thành công, id:', telemetryId);

    console.log('\n[3/4] Đọc lại dữ liệu vừa ghi ...');
    const latest = await firebaseService.getLatestTelemetry(TEST_DEVICE_ID);
    console.log('   ✅ Đọc được:', latest);

    console.log('\n[4/4] Ghi thử 1 cảnh báo (alerts/) ...');
    const alertId = await firebaseService.addAlert({
      deviceId: TEST_DEVICE_ID,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'TEST',
      message: 'Đây là cảnh báo test kết nối, có thể xoá trên Firebase Console',
    });
    console.log('   ✅ Ghi thành công, id:', alertId);

    console.log('\n=== KẾT NỐI FIREBASE THÀNH CÔNG ===');
    console.log('Mở Firebase Console > Realtime Database để xem 3 node: devices, telemetry, alerts');
    console.log(`Nhớ xoá node "${TEST_DEVICE_ID}" trong devices/telemetry/alerts sau khi test xong.`);
  } catch (err) {
    console.error('\n=== LỖI KẾT NỐI FIREBASE ===');
    console.error(err.message);
    console.error('\nGợi ý kiểm tra:');
    console.error('- FIREBASE_SERVICE_ACCOUNT có phải JSON hợp lệ, đúng 1 dòng, không thiếu dấu ngoặc?');
    console.error('- FIREBASE_DB_URL có đúng định dạng https://<project-id>-default-rtdb.<region>.firebasedatabase.app không?');
    console.error('- Đã tạo Realtime Database trong Firebase Console chưa (khác với Firestore)?');
    console.error('- Đã chạy npm install firebase-admin chưa?');
  }
}

run();