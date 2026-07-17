// Ánh xạ giá trị enum số (Admin C# lưu) sang chuỗi (Node/Android dùng).
// Bên C#: MaintenanceStatus { Pending=0, InProgress=1, Completed=2, Canceled=3 }
//         PriotyRequest    { Low=0, Medium=1, High=2, Immediate=3 }
//         MaintenanceCategory { Electrical=0, Plumbing=1, Furniture=2, Other=3 }

const STATUS_MAP = { "0": "pending", "1": "processing", "2": "completed", "3": "cancelled" };
// Lưu ý: Node/Android hiện chỉ có low/medium/high (3 mức), không có "Immediate" riêng.
// Tạm gộp Immediate(3) vào "high" để không mất dữ liệu — báo lại nếu cần tách riêng.
const PRIORITY_MAP = { "0": "low", "1": "medium", "2": "high", "3": "high" };
const CATEGORY_MAP = { "0": "electrical", "1": "plumbing", "2": "furniture", "3": "other" };

const VALID_STATUSES = ["pending", "processing", "completed", "cancelled"];
const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_CATEGORIES = ["electrical", "plumbing", "furniture", "other"];

const normalize = (raw, map, validValues) => {
  if (raw == null) return raw;
  if (validValues.includes(raw)) return raw; // đã là chuỗi hợp lệ (do Node tự ghi) -> giữ nguyên
  return map[String(raw)] || raw; // raw là số (Admin ghi) -> map sang chuỗi
};

const normalizeMaintenanceRequest = (doc) => {
  if (!doc) return doc;
  doc.status = normalize(doc.status, STATUS_MAP, VALID_STATUSES);
  doc.priority = normalize(doc.priority, PRIORITY_MAP, VALID_PRIORITIES);
  doc.category = normalize(doc.category, CATEGORY_MAP, VALID_CATEGORIES);
  return doc;
};

module.exports = { normalizeMaintenanceRequest };