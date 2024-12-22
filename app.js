const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");
const { isLoggedin } = require("./middleware/authentication.js");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const User = require("./Models/usermodel.js");
const connectDB = require("./util/ConnectToDB.js");
const cloudinary = require("cloudinary").v2;
const cookieSender = require("./util/CookieSender.js");
const convertPassword = require("./util/ConvertPass.js");
const bcrypt = require("bcrypt");
const Game = require("./Models/GameMoveModel.js");
const dotenv = require("dotenv");
const Notification = require("./Models/NotificationModel.js");

dotenv.config();
const PORT = process.env.PORT;

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const chess = new Chess();
let players = { white: null, black: null };
let currentPlayer = "w";

app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
connectDB();
const storage = multer.memoryStorage();
const upload = multer({ storage });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
app.get("/", isLoggedin, async (req, res) => {
  if (req.isLoggedIn) {
    const user = await User.findById(req.user._id);
    const notifications = await Notification.find({ userId: req.user._id });

    const unreadNotifications = notifications.filter((n) => !n.isRead);
    if (unreadNotifications.length > 0) {
      res.render("index", {
        user,
        searchedUser: null,
        notifications: unreadNotifications,
      });
    } else {
      res.render("index", { user, searchedUser: null, notifications: [] });
    }
  } else {
    res.render("login");
  }
});
app.get("/signup", isLoggedin, (req, res) => {
  if (req.isLoggedIn) {
    res.redirect("/");
  } else {
    res.render("signup");
  }
});
app.get("/login", isLoggedin, (req, res) => {
  if (req.isLoggedIn) {
    res.redirect("/");
  } else {
    res.render("login");
  }
});
app.post("/loggedin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("User not found!"); // Create a 404 NotFound page
    }

    const compare_pass = await bcrypt.compare(password, user.password);

    if (compare_pass) {
      cookieSender(res, user);
      res.redirect("/");
    } else {
      res.send("Incorrect password!");
    }
  } catch (err) {
    console.error(err);
    res.send("Something went wrong!");
  }
});
app.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const { username, email, password, name, gender } = req.body;

    const result = await cloudinary.uploader.upload_stream(
      { folder: "avatars" },
      async (error, result) => {
        if (error) {
          console.error("Error uploading to Cloudinary:", error);
          return res.status(500).send("Failed to upload avatar.");
        }

        const avatarUrl = result.secure_url;

        const converted_password = await convertPassword(password);
        const user = new User({
          username,
          email,
          password: converted_password,
          avatar: avatarUrl,
          name,
          gender,
          vicitory: 0,
          defeat: 0,
          draw: 0,
        });
        await user.save();
        cookieSender(res, user);
        res.redirect("/");
      }
    );

    result.end(req.file.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while creating user.");
  }
});
app.get("/profile", isLoggedin, async (req, res) => {
  const user = await User.findById(req.user._id);
  user.games.forEach((game) => {
    if (game.type === "winner") {
      user.vicitory++;
    } else if (game.type === "loser") {
      user.defeat++;
    } else {
      user.draw++;
    }
  });
  res.render("Profile", { user });
});
app.get("/logout", (req, res) => {
  res.cookie("Token", "", { maxAge: 0 });
  res.redirect("/login");
});
app.get("/game/:id", isLoggedin, async (req, res) => {
  try {
    // Get the game ID from the request parameters
    const gameId = req.params.id;

    // Get the type from query parameters
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ message: "Type is required" });
    }

    // Fetch the logged-in user
    const user = await User.findById(req.user._id); // Assuming `req.user._id` contains the user's ID

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the game already exists in the user's games array
    const gameExists = user.games.some((game) => game.gameId === gameId);

    // Add the game ID and type if it doesn't already exist
    if (!gameExists) {
      user.games.push({ gameId, type });
    }

    // Save the updated user document
    await user.save();

    // Respond with success
    res.render("index", { searchedUser: null });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while adding the game" });
  }
});
app.get("/mygames", isLoggedin, async (req, res) => {
  const user = await User.findById(req.user._id);

  res.render("mygames", { games: user.games });
});
app.get("/watch/:gameId", async (req, res) => {
  try {
    res.render("watch");
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong.");
  }
});
app.get("/getrecording", isLoggedin, async (req, res) => {
  const user = await User.findById(req.user._id);
  const game = await Game.findById(user.games[0].gameId);
  const gamemoves = game.recording;
  res.json({ moves: gamemoves });
});
app.get("/delete/:gameId", isLoggedin, async (req, res) => {
  try {
    // Find the user by ID
    const user = await User.findById(req.user._id);

    // Use the pull method to remove the game object with the matching gameId
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { games: { gameId: req.params.gameId } } } // Pull the game object from the 'games' array
    );

    // Redirect to the /mygames page after deletion
    res.redirect("/mygames");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
app.get("/search", isLoggedin, async (req, res) => {
  const search = req.query.search;
  const me = await User.findById(req.user._id);
  if (me.username === search) {
    return res.json({ success: false, message: "You cannot search yourself" });
  }
  const users = await User.find({ username: search }).select(
    "_id username avatar"
  );
  if (me.friends.includes(users[0]._id.toString())) {
    return res.json({ type: "friend", users });
  }
  if (users && users.length > 0) {
    res.json({ success: true, users });
  } else {
    res.json({ success: false, message: "No user found" });
  }
});
app.get("/notifications", isLoggedin, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id });
  const users = await User.find({
    _id: { $in: notifications.map((notification) => notification.senderId) },
  }).select("_id username avatar");
  notifications.forEach(async (notification) => {
    if (notification.isRead === false) {
      notification.isRead = true;
      await notification.save();
    }
  });

  res.render("Notification", { notifications: users });
});
app.post("/notificationcreate", isLoggedin, async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }
  const notification = new Notification({
    senderId: req.user._id,
    userId: user._id,
  });
  await notification.save();
  res.json({ success: true });
});
app.post("/notificationaccept", isLoggedin, async (req, res) => {
  const { senderusername } = req.body;

  // Find the user with the given sender username
  const user = await User.findOne({ username: senderusername });

  if (!user) {
    console.log("User not found");
    return res.status(404).send("User not found");
  }

  // Find the notification for the sender
  const notification = await Notification.findOne({
    senderId: user._id.toString(),
    userId: req.user._id.toString(),
  });

  if (!notification) {
    console.log("Notification not found");
    return res.status(404).send("Notification not found");
  }
  const me = await User.findById(req.user._id);
  // Add the sender ID to the user's friends array
  user.friends.push(notification.userId);

  await user.save();
  me.friends.push(user._id);
  await me.save();
  // Delete the notification
  await notification.deleteOne(); // Correct method to delete a single document

  res.status(200).send("Notification accepted and processed");
});
app.post("/notificationreject", isLoggedin, async (req, res) => {
  const { senderusername } = req.body;

  // Find the user with the given sender username
  const user = await User.findOne({ username: senderusername });

  if (!user) {
    console.log("User not found");
    return res.status(404).send("User not found");
  }

  // Find the notification for the sender
  const notification = await Notification.findOneAndDelete({
    senderId: user._id.toString(),
    userId: req.user._id.toString(),
  });

  res.json({ success: true, message: "Notification Rejected" });
});
let userSocketMap = {}; // Object to store username and socket ID

io.on("connection", function (socket) {
  console.log("Connected ", socket.id);

  // Store socket ID with username when user provides a username
  socket.on("setUsername", (username) => {
    if (!username) {
      console.error("Username is undefined!");
      return;
    }
    userSocketMap[username] = socket.id;
    console.log(`Username ${username} mapped to socket ID ${socket.id}`);
  });

  socket.on("getSocketId", (username, callback) => {
    // Log the current userSocketMap to check its contents
    console.log(userSocketMap[username]);
    // If the username exists in the userSocketMap object
    if (userSocketMap[username]) {
      callback(null, userSocketMap[username]); // Return the socket ID for the username
    } else {
      callback("User not found", null); // User not found
    }
  });
  socket.on("Invite", function (sender , who) {
    io.to(userSocketMap[who]).emit("Invite",  sender);
  });
 
  socket.on("InviteAccepted", function (sender,me) {
    console.log(sender);
    io.to(userSocketMap[sender]).emit("InviteAccepted", me);
  });

  socket.on("gamestart", function (username, opponent) {
    console.log(username , opponent);
    let game = null; // To store the game document
    let me = userSocketMap[username];
    let opponentt = userSocketMap[opponent];
    let recording = [];

    if (!players.white) {
      players.white = me ? me : socket.id;
      socket.emit("playerRole", "w");
    } 
    else if (!players.black) {
      players.black = opponentt ? opponentt : socket.id;
      socket.emit("playerRole", "b");
    } else {
      socket.emit("spectatorRole");
    }

    console.log(players);
    
    socket.on("move", function (move) {
      try {
        if (chess.turn() === "w" && socket.id !== players.white) {
          return;
        }
        if (chess.turn() === "b" && socket.id !== players.black) {
          return;
        }

        const result = chess.move(move);
        if (result) {
          currentPlayer = chess.turn();
          // Record the move
          const latestMove = chess.history({ verbose: true });
          // Clear the recording array to ensure no duplicates from previous games
          recording = [];
          // Iterate over each move one by one
          latestMove.forEach((move, index) => {
            // Push the 'from' and 'to' of each move to the recording array
            recording.push({
              color: move.color,
              piece: move.piece,
              from: move.from,
              to: move.to,
            });

            // Log each move's from and to for debugging purposes
          });

          io.emit("move", move);
          io.emit("boardState", chess.fen());
        } else {
          console.log("Invalid Move:", move);
          socket.emit("InvalidMove", move);
        }
      } catch (err) {
        console.log(err);
        socket.emit("Invalid Move:", move);
      }
    });

    socket.on("gameOver", async ({ winner }) => {
      console.log("Game Over. Winner:", winner);

      // Identify the loser based on the turn
      const loser = chess.turn() === "b" ? players.black : players.white;
      const result = winner ? "Win" : "Draw";

      // Save the game data into the Game model
      const game = new Game({
        recording: recording, // Store the recorded moves
        winner: winner,
        loser: loser,
        result: result,
      });

      try {
        await game.save(); // Save the game document

        if (loser === players.white) {
          io.to(players.white).emit("sendRecording", game._id, "loser");
          io.to(players.black).emit("sendRecording", game._id, "winner");
        } else {
          io.to(players.black).emit("sendRecording", game._id, "loser");
          io.to(players.white).emit("sendRecording", game._id, "winner");
        }

        // Reset the chess game for a new match
        chess.reset();
        io.emit("reset", winner); // Notify clients to reset the board
      } catch (error) {
        console.error("Error saving game data:", error);
      }
    });

    socket.on("newmessage", function (message) {
      socket.emit("comenewmessage", socket.id, message);
      socket.broadcast.emit("comenewmessage", socket.id, message);
    });
  });

  socket.on("disconnect", function () {
    console.log("User disconnected:", socket.id);
    if (socket.id === players.white) {
      players.white = null;
    } else if (socket.id === players.black) {
      players.black = null;
    }

    // Remove user from the userSocketMap when they disconnect
    for (let username in userSocketMap) {
      if (userSocketMap[username] === socket.id) {
        delete userSocketMap[username];
        console.log(`User ${username} has been removed from userSocketMap`);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT} 👍🏼`);
});
