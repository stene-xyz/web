const fs = require('fs');
const path = require('path');
const logger = require('./logger');

module.exports = {
    userExists: function(username) {
        if(fs.existsSync(path.join(__dirname, "users", username))) { // Check if user folder exists
            var loginData = this.getUserData(username, "login"); // Read user login data
            if(loginData) {
                return !loginData.banned; // Return true if not banned
            } else return false;
        }
        return false;
    },
    createUser: function(username, passwordHash, mfaKey) {
        if(!this.userExists(username)) {
            var userData = {};
            userData.banned = false;
            userData.username = username;
            userData.password = passwordHash;
            userData.key = mfaKey;
            fs.mkdirSync(path.join(__dirname, "users", username));
            this.setUserData(username, "login", userData);
            logger.info("UserCreated", `User created`, {userData:userData});
            return true;
        }

        logger.error("UserCreationFail", "User already exists", {username:username});
        return false;
    },
    getUserData: function(username, entry) {
        if(this.userExists(username)) {
            if(fs.existsSync(path.join(__dirname, "users", `${entry}.json`))) {
                return JSON.parse(fs.readFileSync(path.join(__dirname, "users", `${entry}.json`)));
            }

            return false;
        }

        return false;
    },
    setUserData: function(username, entry, data) {
        try {
            if(this.userExists(username)) {
                fs.writeFileSync(path.join(__dirname, "users", username, `${entry}.json`), JSON.stringify(data));
                logger.info("UserUpdate", `User data updated`, {username:username,userEntry:entry,data:data});
                return true;
            }
        } catch(e) {
            logger.error("UserUpdateFailure", "Failed to update user data", {username:username,userEntry:entry,data:data,error:e});
            return false;
        }

        logger.error("UserUpdateFailure", "Failed to update user data", {username:username,userEntry:entry,data:data,error:"User does not exist"});
        return false;
    }
};