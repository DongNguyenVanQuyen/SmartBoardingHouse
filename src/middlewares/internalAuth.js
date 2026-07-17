// src/middlewares/internalAuth.js
module.exports = function internalAuth(req, res, next) {
  const key = req.headers["x-internal-key"];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
};