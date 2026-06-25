//src/utils/response.js
const success = (
  res,
  data = null,
  message = "Thành công",
  statusCode = 200,
) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const error = (
  res,
  message = "Lỗi server",
  statusCode = 500,
  errors = null,
) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

module.exports = { success, error };
