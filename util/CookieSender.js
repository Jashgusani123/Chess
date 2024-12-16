const jwt = require("jsonwebtoken")

const cookieSender = (res , user , message)=>{
    const token = jwt.sign({ _id:user._id }, process.env.JWT_SECREAT);
    const cookieOptions = {
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
        sameSite: "None",
        httpOnly: true,
        secure: true, // Use secure cookies in production
      };
    res.status(200).cookie("Token" , token , cookieOptions).json({
        success: true,
      message,
      user,
    })
}

module.exports = cookieSender