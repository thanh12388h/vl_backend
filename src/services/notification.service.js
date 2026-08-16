/**
 * Chức năng 9 — Gửi thông báo khi Backend xác nhận bất thường.
 * Mặc định NOTIFY_*_ENABLED=false để chạy demo/test không cần tài khoản
 * Email/Telegram thật — khi đó chỉ log ra console (dễ quan sát trong test).
 */
require('dotenv').config();

const EMAIL_ENABLED = process.env.NOTIFY_EMAIL_ENABLED === 'true';
const TELEGRAM_ENABLED = process.env.NOTIFY_TELEGRAM_ENABLED === 'true';

async function sendEmail(subject, text) {
  if (!EMAIL_ENABLED) return { skipped: true, channel: 'email' };
  // eslint-disable-next-line global-require
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
  return { skipped: false, channel: 'email' };
}

async function sendTelegram(text) {
  if (!TELEGRAM_ENABLED) return { skipped: true, channel: 'telegram' };
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const fetch = require('node-fetch');
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
  });
  return { skipped: false, channel: 'telegram' };
}

/**
 * Gửi thông báo cảnh báo bất thường — nội dung gồm thời gian, SpO2, BPM,
 */
async function notifyAlert({ deviceId, timestamp, spo2, bpm, type, message }) {
  const time = new Date(timestamp * 1000).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour12: false,
  });
  const subject = `[CẢNH BÁO] Thiết bị ${deviceId} - ${type}`;
  const text = [
    `Thời gian: ${time}`,
    `Thiết bị: ${deviceId}`,
    `SpO2: ${spo2}%`,
    `BPM: ${bpm}`,
    `Nội dung: ${message}`,
  ].join('\n');

  const results = await Promise.all([sendEmail(subject, text), sendTelegram(text)]);

  // Luôn log ra console để dễ quan sát khi chạy test/demo
  console.log(`[Notification] 🔔 ${subject}\n${text}`);

  return results;
}

module.exports = { notifyAlert };
