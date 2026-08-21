/**
 * Chức năng 9 — Gửi thông báo khi Backend xác nhận bất thường.
 * Mặc định NOTIFY_*_ENABLED=false để chạy demo/test không cần tài khoản
 * Email/Telegram thật — khi đó chỉ log ra console (dễ quan sát trong test).
 */
require('dotenv').config();

const EMAIL_ENABLED = process.env.NOTIFY_EMAIL_ENABLED === 'true';
const TELEGRAM_ENABLED = process.env.NOTIFY_TELEGRAM_ENABLED === 'true';

async function sendEmail(subject, text) {
  if (!EMAIL_ENABLED) {
    console.log('[Notification] 📧 Email disabled (skipped)');
    return { skipped: true, channel: 'email' };
  }
  
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL_TO,
      subject,
      text,
    });
    console.log('[Notification] 📧 Email sent successfully');
    return { skipped: false, channel: 'email' };
  } catch (error) {
    console.error('[Notification] ❌ Email error:', error.message);
    return { skipped: false, channel: 'email', error: error.message };
  }
}

async function sendTelegram(text) {
  if (!TELEGRAM_ENABLED) {
    console.log('[Notification] 📱 Telegram disabled (skipped)');
    return { skipped: true, channel: 'telegram' };
  }
  
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const fetch = require('node-fetch');
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
    console.log('[Notification] 📱 Telegram sent successfully');
    return { skipped: false, channel: 'telegram' };
  } catch (error) {
    console.error('[Notification] ❌ Telegram error:', error.message);
    return { skipped: false, channel: 'telegram', error: error.message };
  }
}

/**
 * Gửi thông báo cảnh báo bất thường
 * @param {Object} params
 * @param {string} params.deviceId - ID thiết bị
 * @param {number|string} params.timestamp - Unix timestamp (giây) hoặc ISO string
 * @param {number} params.spo2 - Chỉ số SpO2
 * @param {number} params.bpm - Nhịp tim
 * @param {number} params.temperature - Nhiệt độ cơ thể
 * @param {string} params.type - Loại cảnh báo (LOW_SPO2, HIGH_BPM, HIGH_TEMP, ...)
 * @param {string} params.message - Nội dung cảnh báo
 */
async function notifyAlert({ deviceId, timestamp, spo2, bpm, temperature, type, message }) {
  // ✅ VALIDATION - Kiểm tra tham số bắt buộc
  if (!deviceId) {
    console.error('[Notification] ❌ Thiếu deviceId');
    return { error: 'Missing deviceId' };
  }

  if (!type) {
    console.error('[Notification] ❌ Thiếu type');
    return { error: 'Missing type' };
  }

  if (!message) {
    console.error('[Notification] ❌ Thiếu message');
    return { error: 'Missing message' };
  }

  // ✅ XỬ LÝ TIMESTAMP
  let dateObj;
  if (timestamp) {
    if (typeof timestamp === 'number') {
      // Unix timestamp (giây)
      dateObj = new Date(timestamp * 1000);
    } else if (typeof timestamp === 'string') {
      // ISO string hoặc các định dạng khác
      dateObj = new Date(timestamp);
    } else {
      dateObj = new Date(timestamp);
    }
  } else {
    // Fallback: dùng thời gian hiện tại
    dateObj = new Date();
    console.warn('[Notification] ⚠️ Không có timestamp, dùng thời gian hiện tại');
  }

  // Kiểm tra valid date
  if (isNaN(dateObj.getTime())) {
    console.error('[Notification] ❌ Timestamp không hợp lệ:', timestamp);
    dateObj = new Date(); // Fallback
  }

  // ✅ ĐỊNH DẠNG THỜI GIAN
  const time = dateObj.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // ✅ TẠO NỘI DUNG THÔNG BÁO
  const subject = `[CẢNH BÁO SỨC KHỎE] Thiết bị ${deviceId} - ${type}`;
  
  // Format nhiệt độ (có độ C)
  const tempDisplay = temperature !== undefined && temperature !== null 
    ? `${temperature.toFixed(1)}°C` 
    : 'N/A';

  const text = [
    `════════════════════════════════════════`,
    `🔔 CẢNH BÁO SỨC KHỎE`,
    `════════════════════════════════════════`,
    `📅 Thời gian: ${time}`,
    `📟 Thiết bị: ${deviceId}`,
    `🫀 SpO2: ${spo2 !== undefined && spo2 !== null ? spo2.toFixed(1) : 'N/A'}%`,
    `💓 BPM: ${bpm !== undefined && bpm !== null ? Math.round(bpm) : 'N/A'}`,
    `🌡️ Nhiệt độ: ${tempDisplay}`,
    `📝 Loại: ${type}`,
    `────────────────────────────────────────`,
    `📌 ${message}`,
    `════════════════════════════════════════`,
  ].join('\n');

  // ✅ LOG RA CONSOLE
  console.log(`[Notification] 🔔 ${subject}`);
  console.log(text);

  // ✅ GỬI THÔNG BÁO (Email + Telegram)
  const results = await Promise.all([
    sendEmail(subject, text),
    sendTelegram(text)
  ]);

  // ✅ TRẢ VỀ KẾT QUẢ
  return {
    success: true,
    deviceId,
    timestamp: dateObj.toISOString(),
    type,
    message,
    spo2,
    bpm,
    temperature,
    results
  };
}

module.exports = { notifyAlert };