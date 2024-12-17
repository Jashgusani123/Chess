const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema({
  recording: [
    {
      color: String,
      piece: String,
      from: String,
      to: String,
      san: String,
      flags: String,
      lan: String,
      before: String,
      after: String,
    }
  ],
  winner: String,
  loser: String,
  result: String,
  date: { type: Date, default: Date.now },
});

const Game = mongoose.model("Game", GameSchema);

module.exports = Game;
