/**
 * Bọc 1 async controller (req, res) => Promise để tự động bắt lỗi.
 * Không có wrapper này, nếu 1 controller bị lỗi (throw) mà không tự
 * try/catch, Express KHÔNG tự bắt lỗi từ hàm async — lỗi trở thành
 * "unhandled rejection" và (từ Node 15+) làm SẬP TOÀN BỘ tiến trình.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(`[API] Lỗi xử lý ${req.method} ${req.originalUrl}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ nội bộ' });
      }
    });
  };
}

module.exports = { asyncHandler };