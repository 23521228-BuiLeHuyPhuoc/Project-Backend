const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["message", "newsletter"],
      default: "message"
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    fullName: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    subject: {
      type: String,
      trim: true,
      default: ""
    },
    message: {
      type: String,
      trim: true,
      default: ""
    },
    status: {
      type: String,
      enum: ["unread", "read", "resolved"],
      default: "unread"
    },
    readAt: Date,
    resolvedAt: Date,
    adminNotificationSentAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedBy: String,
    deletedAt: Date
  },
  {
    timestamps: true
  }
);

schema.index({type: 1, status: 1, deleted: 1, createdAt: -1});
schema.index({email: 1, type: 1, deleted: 1});

const Contact = mongoose.model('Contact', schema, "contacts");

module.exports = Contact;
