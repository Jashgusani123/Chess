const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      require: true,
      type: String,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      required: false,
    },
    games:{
      type: Array,
      default: [],
    },
    avatar: { type: String, required: true },
    vicitory: { type: Number, required: true },
    defeat: { type: Number, required: true },
    draw: { type: Number, required: true },
    friends: { type: Array, default: [] },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);
module.exports = User;
