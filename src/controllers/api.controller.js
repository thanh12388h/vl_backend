/**
 * Controllers cho REST API (mục III.2 "Chi tiết REST API"), phục vụ Luồng 1
 * (Dashboard -> Backend -> ESP32) và Luồng 3 (Backend -> Dashboard).
 */
const firebaseService = require('../services/firebase.service');
const { validateBuzzerRequest, validateThresholdRequest } = require('../utils/validators');
const { setThresholdsForDevice, getThresholdsForDevice } = require('../config/thresholds.config');
const { publishControl } = require('../mqtt/mqttHandlers');

const DEFAULT_DEVICE_ID = process.env.DEFAULT_DEVICE_ID || 'esp32_001';

function makeControllers(mqttClient) {
  return {
    // GET /api/v1/latest
    async getLatest(req, res) {
      const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
      const latest = await firebaseService.getLatestTelemetry(deviceId);
      if (!latest) {
        return res.status(404).json({ error: 'Chưa có dữ liệu cho thiết bị này' });
      }
      res.json({ spo2: latest.spo2, bpm: latest.bpm, status: latest.status });
    },

    // GET /api/v1/history?deviceId=...&limit=...
    async getHistory(req, res) {
      const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
      const limit = Number(req.query.limit) || 50;
      const history = await firebaseService.getHistory(deviceId, limit);
      res.json(
        history.map((h) => ({
          time: new Date(h.timestamp * 1000).toISOString(),
          spo2: h.spo2,
          bpm: h.bpm,
          status: h.status,
        }))
      );
    },

    // POST /api/v1/device/buzzer   { state: true|false }
    async setBuzzer(req, res) {
      const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
      const validation = validateBuzzerRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }
      try {
        publishControl(mqttClient, deviceId, 'buzzer', { state: req.body.state });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    },

    // GET /api/v1/device/status?deviceId=...
    async getDeviceStatus(req, res) {
      const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
      const device = await firebaseService.getDevice(deviceId);
      res.json({ online: !!(device && device.online) });
    },

    // GET /api/v1/alerts?deviceId=...
    async getAlerts(req, res) {
      const deviceId = req.query.deviceId;
      const alerts = await firebaseService.getAlerts(deviceId, Number(req.query.limit) || 50);
      res.json(alerts);
    },

    // PUT /api/v1/device/:deviceId/thresholds  — tính năng bổ sung: ngưỡng riêng theo đối tượng
    async setThresholds(req, res) {
      const { deviceId } = req.params;
      const validation = validateThresholdRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }
      const updated = setThresholdsForDevice(deviceId, req.body);
      res.json({ success: true, thresholds: updated });
    },

    // GET /api/v1/device/:deviceId/thresholds
    async getThresholds(req, res) {
      const { deviceId } = req.params;
      res.json(getThresholdsForDevice(deviceId));
    },

    // POST /api/v1/device/:deviceId/oled/message — tính năng bổ sung: hẹn giờ nhắn tin OLED
    async setOledMessage(req, res) {
      const { deviceId } = req.params;
      const { message, scheduleTime } = req.body || {};
      if (!message) return res.status(400).json({ success: false, error: "Thiếu trường 'message'" });
      try {
        publishControl(mqttClient, deviceId, 'oled', { message, scheduleTime: scheduleTime || null });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  };
}

module.exports = { makeControllers, DEFAULT_DEVICE_ID };
