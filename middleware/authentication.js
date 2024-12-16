 const isLoggedin = (req, res, next) => {
    const token = req.cookies["Token"]; // Access the token from cookies
    if (token) {
        req.isLoggedIn = true; // Attach a flag to `req` for downstream use
        next(); // Proceed to the next middleware or route handler
    } else {
        req.isLoggedIn = false; // Flag as not logged in
        next(); // Redirect to login page
    }
};

module.exports = {isLoggedin}
