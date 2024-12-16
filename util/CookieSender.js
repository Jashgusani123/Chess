const jwt = require("jsonwebtoken")

const cookieSender = (res , user)=>{
    const token = jwt.sign({ user }, process.env.JWT_SECREAT);
    res.status(200).cookie("Token" , token)
}

module.exports = cookieSender