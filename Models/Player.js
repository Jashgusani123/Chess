const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    players: {
      white: { type: String },
      black: { type: String },
    },
  },
  { timestamps: true }
);

const Player = mongoose.model("Player", playerSchema);
module.exports = Player;
