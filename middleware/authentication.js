const jwt = require("jsonwebtoken");

const isLoggedin = (req, res, next) => {
    const token = req.cookies["Token"]; 
    if(token){
        const decoded = jwt.verify(token , process.env.JWT_SECREAT);
        req.user = decoded;
        req.isLoggedIn = true;
        next();
    } else {
        req.isLoggedIn = false;
        next();
    }
};

module.exports = {isLoggedin}
