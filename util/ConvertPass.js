const bcrypt = require("bcrypt");

const convertPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(10); // Use async/await here
        const hashedPassword = await bcrypt.hash(password, salt); // Use async/await here
        return hashedPassword; // Return the hashed password
    } catch (err) {
        console.error("Error hashing password:", err);
        throw new Error("Failed to hash password");
    }
};

module.exports = convertPassword;
