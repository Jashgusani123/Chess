const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, default: "pending" },
  isRead: { type: Boolean, default: false },
} , {timestamps: true});

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;