/**
 * Bộ lọc trung bình trượt (Moving Average), N = 5 mẫu (mục III.3).
 * ESP32 lấy mẫu 1Hz -> mỗi thiết bị có 1 buffer riêng (FIFO kích thước N).
 * Khi buffer đầy, tính trung bình cộng và trả kết quả để đưa vào bước
 * phát hiện bất thường; buffer sau đó reset để chờ lô mẫu tiếp theo.
 */
const { MOVING_AVERAGE_WINDOW } = require('../config/thresholds.config');

class MovingAverageBuffer {
  constructor(windowSize = MOVING_AVERAGE_WINDOW) {
    this.windowSize = windowSize;
    this.buffers = new Map(); // deviceId -> { spo2: [], bpm: [] }
  }

  _getBuffer(deviceId) {
    if (!this.buffers.has(deviceId)) {
      this.buffers.set(deviceId, { spo2: [], bpm: [] });
    }
    return this.buffers.get(deviceId);
  }

  /**
   * Thêm 1 mẫu mới. Trả về { ready, spo2Avg, bpm Avg } — ready=true khi
   * buffer đã đủ N mẫu và đã tính xong trung bình (đồng thời reset buffer).
   * Thực tế không phải trung bình trượt dạng 12345 -> xóa 1 -> 23456 mà là theo từng khối 12345 -> chờ -> 678910
   */
  addSample(deviceId, spo2, bpm) {
    const buf = this._getBuffer(deviceId);
    buf.spo2.push(spo2);
    buf.bpm.push(bpm);

    if (buf.spo2.length < this.windowSize) {
      return { ready: false, count: buf.spo2.length, windowSize: this.windowSize };
    }

    const spo2Avg = average(buf.spo2);
    const bpmAvg = average(buf.bpm);

    // reset để chờ lô mẫu tiếp theo
    buf.spo2 = [];
    buf.bpm = [];

    return {
      ready: true,
      spo2Avg: round1(spo2Avg),
      bpmAvg: round1(bpmAvg),
      windowSize: this.windowSize,
    };
  }
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = new MovingAverageBuffer();
module.exports.MovingAverageBuffer = MovingAverageBuffer;
