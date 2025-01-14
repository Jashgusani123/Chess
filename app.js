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
const Player = require("./Models/Player.js");

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
      { folder: "avatar" },
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
app.post("/search", isLoggedin, async (req, res) => {
  const { username } = req.body;
  const me = await User.findById(req.user._id);
  if (me.username === username) {
    return res.json({ success: false, message: "You cannot search yourself" });
  }
  const users = await User.find({ username: username }).select(
    "_id username avatar"
  );
  if (users.length === 0) {
    return res.json({ success: false, message: "No user found" });
  }
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
    return res.status(404).send("User not found");
  }

  // Find the notification for the sender
  const notification = await Notification.findOne({
    senderId: user._id.toString(),
    userId: req.user._id.toString(),
  });

  if (!notification) {
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
    return res.status(404).send("User not found");
  }

  // Find the notification for the sender
  const notification = await Notification.findOneAndDelete({
    senderId: user._id.toString(),
    userId: req.user._id.toString(),
  });

  res.json({ success: true, message: "Notification Rejected" });
});
app.get("/waiting", isLoggedin, (req, res) => {
  res.render("waiting");
});
// Set game
app.post("/api/v1/set", async (req, res) => {
  try {
    const { id } = req.body;

    // Retrieve all Player documents and select only the players field
    const wholeData = await Player.find().select("players");
    
    // Find the first object where either white or black is empty or missing
    const emptyObject = wholeData.find(
      (i) =>
        !i.players.white || // Check if white is missing or empty
        !i.players.black || // Check if black is missing or empty
        i.players.white.trim() === "" || // Check if white is only whitespace
        i.players.black.trim() === "" // Check if black is only whitespace
    );

    let players;
    if (!emptyObject) {
      // If no empty object is found, create a new Player document
      if (id) {
        players = await Player.create({
          players: { white: id },
        });
      }
    } else {
      // If an empty object is found, update its white or black field
      if (
        (!emptyObject.players.white ||
          emptyObject.players.white.trim() === "") &&
        id
      ) {
        emptyObject.players.white = id;
      } else if (
        (!emptyObject.players.black ||
          emptyObject.players.black.trim() === "") &&
        id
      ) {
        emptyObject.players.black = id;
      }

      // Save the updated document
      await emptyObject.save();
    }

    // Send response
    res.status(201).json({
      message: "Players processed successfully",
      data: players || emptyObject,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.post("/api/v1/give" , async(req , res)=>{
  const {id} = req.body;
  const data = await Player.findById({_id:id})

  res.status(201).json({
    message: "Players get successfully",
    data,
  });
});
app.post("/api/v1/setwithfriend" , async(req,res)=>{
  const {id , socketId} = req.body;
  const data = await Player.findById({_id:id})

  data.players.black = socketId;
  data.save();
  res.status(201).json({
    message: "Players get successfully",
    data,
  });
});
app.post("/api/v1/createforfriend" , async(req,res)=>{
  const {socketId} = req.body;
  const data = await Player.create({
    players:{
      white:socketId,
      black:""
    }
  })

  res.status(201).json({
    message: "Players get successfully",
    data,
  });
});
app.delete("/api/v1/deleteinobj" , async(req , res)=>{
  const {role , id} = req.body;
  const data = await Player.findById({_id:id});
  if(role === "w"){
    data.players.black = ""
  }else{
    data.players.white = ""
  }
  data.save()
  res.status(201).json({
    message:"Player Remove Successfully!!",
    data
  })
})

let userSocketMap = {}; // Object to store username and socket ID
const games = {};

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
    if (userSocketMap[username]) {
      callback(null, userSocketMap[username]);
    } else {
      callback("User not found", null);
    }
  });
  socket.on("notificationcreate", function (username) {
    io.to(userSocketMap[username]).emit("comingnotification");
  });
  socket.on("Invite", function (sender, who , gameId) {
    io.to(userSocketMap[who]).emit("Invite", sender,gameId);
  });
  socket.on("InviteAccepted", function (sender, me , gameId , players) {
    io.to(userSocketMap[sender]).emit("InviteAccepted", me ,gameId , players);
  });

  socket.on("gamestart", function (gameId, players , role) {
    // When a new game starts, store it in the 'games' object
    console.log(`Starting game: ${gameId} between ${players.white} (White) and ${players.black} (Black)`);
    
    if (players.white && players.black) {
      // Create the game object and store it with the gameId
      games[gameId] = {
        players: {
          white: players.white,
          black: players.black
        },
        chess: new Chess(),  // Assuming you are using the Chess library for the game state
        status: "started"
      };
        // Emit player roles and game start event
        io.to(players.white).emit("playerRole", "w");
        if(role === "w"){
          io.to(players.black).emit("cometogame");
        }else{
          io.to(players.white).emit("cometogame");
        }
        io.to(players.black).emit("playerRole", "b");
      console.log(`Game instance stored for ${gameId}:`, games[gameId]);
    } else {
      socket.emit("waiting");
    }
  });
  
  socket.on("move", function (gameId, move) {
    // Log the received gameId to ensure it's correct
    console.log("Received gameId:", gameId);
  
    const game = games[gameId]; // Look up the game in the games object
    console.log("Game found:", game);
  
    if (!game) {
      socket.emit("error", "Game not found");
      return;
    }
  
    const { chess,players  } = game;
    const {white , black} = players
    
    try {
      // Ensure only the correct player can make the move
      if (chess.turn() === "w" && socket.id !== white) {
        return;
      }
      if (chess.turn() === "b" && socket.id !== black) {
        return;
      }
  
      const result = chess.move(move);
  
      if (result) {
        const currentPlayer = chess.turn();
        const opponentSocket = socket.id === white ? black : white;
  
        console.log("Current player:", currentPlayer, "Opposing socket ID:", opponentSocket);
  
        io.to(opponentSocket).emit("boardState", chess.fen());
        io.to(opponentSocket).emit("move", move);
      } else {
        socket.emit("InvalidMove", move);
      }
    } catch (err) {
      socket.emit("Invalid Move:", move);
      console.error("Error occurred during move: ", err);
    }
  });
  
  
  socket.on("gameOver", async ({ winner }) => {
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
  socket.on("disconnect", function () {
    console.log("User disconnected:", socket.id);
  
    // Remove the user from the userSocketMap
    for (let username in userSocketMap) {
      if (userSocketMap[username] === socket.id) {
        delete userSocketMap[username];
        console.log(`User ${username} has been removed from userSocketMap`);
        break;
      }
    }
  
    // Remove the user from the game they are part of
    for (let gameId in games) {
      const game = games[gameId];
      console.log(game);
      
      // Check if the disconnected socket is a player in the game
      if (game.players.white === socket.id) {
        game.players.white = "";
        io.to(game.players.black).emit("wait_Your_Opponent_disconected" , "b" , gameId)
        console.log(`Socket ${socket.id} removed as White from game ${gameId}`);
      } else if (game.players.black === socket.id) {
        game.players.black = "";
        io.to(game.players.white).emit("wait_Your_Opponent_disconected" , "w" , gameId)
        console.log(`Socket ${socket.id} removed as Black from game ${gameId}`);
      }
  
      // Optional: Remove the game if no players are left
      if (!game.players.white && !game.players.black) {
        delete games[gameId];
        console.log(`Game ${gameId} has been removed as it has no players`);
      }
    }
  });
  
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT} 👍🏼`);
});
