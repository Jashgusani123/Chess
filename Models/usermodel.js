const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username:{
        require:true,
        type:String,
        unique: true 
    },
    email:{
        type: String, 
        required: true, 
        unique: true
    },
    password:{
        type: String, 
        required: true
    },
    avatar: { type: String, 
        required: true },
},{ timestamps: true });
const User = mongoose.model("User", userSchema);
module.exports = User;