/**
 * Bộ lọc trung bình trượt (Moving Average), N = 4 mẫu (giống ESP32).
 * ESP32 lấy mẫu 1Hz -> mỗi thiết bị có 1 buffer riêng.
 * Khi buffer đầy, tính trung bình cộng và trả kết quả.
 * Buffer sau đó reset để chờ lô mẫu tiếp theo.
 */
class MovingAverageBuffer {
  constructor(windowSize = 4) {
    this.windowSize = windowSize;
    this.buffers = new Map();
  }

  /**
   * Lấy buffer của thiết bị, tạo mới nếu chưa có
   */
  _getBuffer(deviceId) {
    if (!this.buffers.has(deviceId)) {
      this.buffers.set(deviceId, {
        spo2: [],
        bpm: [],
        temperature: []
      });
    }
    return this.buffers.get(deviceId);
  }

  /**
   * Thêm mẫu dữ liệu mới
   * @param {string} deviceId - ID thiết bị
   * @param {number} spo2 - Chỉ số SpO2
   * @param {number} bpm - Nhịp tim
   * @param {number} temperature - Nhiệt độ
   * @returns {Object} { ready, count, spo2Avg, bpmAvg, temperatureAvg }
   */
  addSample(deviceId, spo2, bpm, temperature) {
    const buf = this._getBuffer(deviceId);

    // Thêm mẫu mới
    buf.spo2.push(spo2);
    buf.bpm.push(bpm);
    buf.temperature.push(temperature);

    // Chưa đủ mẫu
    if (buf.spo2.length < this.windowSize) {
      return {
        ready: false,
        count: buf.spo2.length,
        windowSize: this.windowSize
      };
    }

    // Đủ mẫu → Tính trung bình
    const spo2Avg = average(buf.spo2);
    const bpmAvg = average(buf.bpm);
    const temperatureAvg = average(buf.temperature);

    // Reset buffer (giống ESP32)
    buf.spo2 = [];
    buf.bpm = [];
    buf.temperature = [];

    return {
      ready: true,
      spo2Avg: round1(spo2Avg),
      bpmAvg: round1(bpmAvg),
      temperatureAvg: round1(temperatureAvg),
      windowSize: this.windowSize
    };
  }

  /**
   * Reset buffer của thiết bị
   */
  reset(deviceId) {
    if (this.buffers.has(deviceId)) {
      this.buffers.delete(deviceId);
    }
  }

  /**
   * Lấy số mẫu hiện tại trong buffer
   */
  getCount(deviceId) {
    const buf = this.buffers.get(deviceId);
    if (!buf) return 0;
    return buf.spo2.length;
  }
}

/**
 * Tính trung bình cộng
 */
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Làm tròn 1 số thập phân
 */
function round1(n) {
  return Math.round(n * 10) / 10;
}

// Export singleton và class
module.exports = new MovingAverageBuffer();
module.exports.MovingAverageBuffer = MovingAverageBuffer;