const renderer = require('./renderer');
const logger = require('./logger');
const db = require('./db');
const fs = require('fs');
const bcrypt = require('bcrypt');
const bcrypt_saltrounds = 10;
const { v4: uuidv4 } = require('uuid');

module.exports = {
    init: function(app) {
        /*
         * Create authentication route
         */
        app.post("/auth", (req, res) => {
            if(!db.userExists(req.body.username)) {
                renderer.renderPage("loginFail.html", {"{message}":"Invalid username or password"}, req, res);
                logger.info("LoginFail", `User does not exist`, {username:req.body.username});
            } else {
                var userData = db.getUserData(req.body.username, "login");
                var key = otp(userData.key);
                if(req.body.key == key) {
                    bcrypt.compare(req.body.password, userData.password, (err, result) => {
                        if(err) {
                            renderer.renderPage("loginFail.html", {"{message}":"Internal server error"}, req, res);
                            logger.error("LoginFail", `User login error`, {username:req.body.username,error:err});
                        } else {
                            if(result) {
                                req.session.authenticated = true;
                                req.session.username = req.body.username;
                                res.redirect("back");
                                logger.info("LoginSuccess", `User login success`, {userData:userData});
                            } else {
                                req.session.authenticated = false;
                                req.session.username = "";
                                renderer.renderPage("loginFail.html", {"{message}":"Invalid username or password"}, req, res);
                                logger.info("LoginFail", `Password validation fail`, {username:req.body.username});
                            }
                        }
                    });
                } else {
                    req.session.authenticated = false;
                    req.session.username = "";
                    renderer.renderPage("loginFail.html", {"{message}":"Expired 2FA"}, req, res);
                    logger.info("LoginFail", `2FA validation fail`, {username:req.body.username});
                }
            }
        });

        /*
         * Create signup route
         */
        app.post("/signup", (req, res) => {
            if(req.body.username != "" && req.body.password != "") {
                var passwordHash = bcrypt.hashSync(req.body.password, bcrypt_saltrounds);
                var mfaKey = this.genToken();
                if(db.createUser(req.body.username, passwordHash, mfaKey)) {
                    renderer.renderPage("signupQR.html", {"{key}": mfaKey}, req, res);
                } else {
                    renderer.renderPage("signupFail.html", {"{message}":"Signup failed"}, req, res);
                }
            } else {
                renderer.renderPage("signupFail.html", {"{message}":"Username or password blank"}, req, res);
            }
        });
    },
    
    restrict: function(req, res, next) {
        if(req.session.authenticated) {
            next();
        } else {
            renderer.sendStaticPage("login.html");
        }
    },

    genToken: function() {
        return uuidv4().replace("-", "");
    }
}