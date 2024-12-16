const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");
const {isLoggedin} = require("./middleware/authentication.js")
const cookieParser = require("cookie-parser")
const multer = require("multer")
const User = require("./Models/usermodel.js");
const connectDB = require("./util/ConnectToDB.js"); 
const cloudinary = require("cloudinary").v2;
const cookieSender = require("./util/CookieSender.js")
const bcrypt = require("bcrypt");
const convertPassword = require("./util/ConvertPass.js");

require("dotenv").config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const chess = new Chess();
let players = {};
let currentPlayer = "w"; 

app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname, "public")));
connectDB();
const storage = multer.memoryStorage();
const upload = multer({ storage }); 

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/",isLoggedin , (req, res) => {
    
    if (req.isLoggedIn) {
        res.render("index");
    } else{
        res.render("login")
    }
});
app.get("/signup" , isLoggedin , (req , res)=>{
    if(req.isLoggedIn){
        res.redirect("/")
    }else{
        res.render("signup")
    }
})
app.get("/login" ,isLoggedin, (req , res)=>{
    if(req.isLoggedIn){
        res.redirect("/")
    }else{
        res.render("login")
    }
})
app.post("/createuser", upload.single("avatar"), async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const result = await cloudinary.uploader.upload_stream(
            { folder: "avatars" },
            async (error, result) => {
                if (error) {
                    console.error("Error uploading to Cloudinary:", error);
                    return res.status(500).send("Failed to upload avatar.");
                }

                const avatarUrl = result.secure_url;

                const converted_password = await convertPassword(password); 
                console.log(converted_password); 
                const user = new User({ username, email, password: converted_password, avatar: avatarUrl });
                await user.save(); 
                cookieSender(res, user , "User Created Sucessfully!!");
                res.redirect("/");
            }
        );

        result.end(req.file.buffer);
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while creating user.");
    }
});


io.on("connection" , function(socket){
    console.log("Connected" );
    if(!players.white){
        players.white = socket.id
        socket.emit("playerRole" , "w")
    }else if(!players.black){
        players.black = socket.id;
        socket.emit("playerRole" , "b")
    }else{
        socket.emit("spectatorRole")
    }

    socket.on("move" , function(move){
        try{
            if(chess.turn() == "w" && socket.id !== players.white ){
                return;
            }
            if(chess.turn() == "b" && socket.id !== players.black){
                return ;
            }

            const result = chess.move(move);
            if(result){
                currentPlayer = chess.turn();
                io.emit("move" , move)
                io.emit("boardState" , chess.fen())
            }else{
                console.log("Invaild Move: " , move);
                socket.emit("InvaildMove" , move)
            }
        }
        catch(err){
            console.log(err);
            socket.emit("Invaild Move : " , move)
        }
    })
    socket.on("gameOver", ({ winner }) => {
        if (winner) {
          console.log(`${winner} wins the game!`);
        } else {
          console.log("The game ended in a draw.");
        }
        chess.reset(); // Reset the game for a new match
        io.emit("reset" , winner);
      });
    
    socket.on("disconnect" , function (){
        if(socket.id ==  players.white){
            delete players.white //Here We need to close Game 
        }else if(socket.id == players.black){
            delete players.black
        }
    })
})

server.listen(3000, () => {
  console.log("Server started on port 3000 👍🏼");
});
