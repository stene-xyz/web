const renderer = require('./renderer');
const logger = require('./logger');
const db = require('./db');
const bcrypt = require('bcrypt');
const bcrypt_saltrounds = 10;
const otp = require("totp-generator");

module.exports = {
    init: function(app) {
        /*
         * Create authentication route
         */
        app.post("/auth", this.authRoute);

        /*
         * Create signup route
         */
        app.post("/signup", this.signupRoute);

        /*
         * Create signup 2FA verfication route
         */
        app.post("/signupVerify", (req, res) => {
            if(req.session.authenticated) {
                var userData = db.getUserData(req.session.username, "login");
                if(userData) {
                    var key = otp(userData.key);
                    if(req.body.key == key) {
                        logger.info("SignupVerifySuccess", "A user successfully verified signup");
                        res.redirect("/signupSuccess.html");
                    } else {
                        logger.info("SignupVerifyFailure", "A user tried to verify signup with an invalid MFA code");
                        renderer.renderPage("signupQR.html", {"{key}": mfaKey, "{reason}": "Code expired or invalid<br><br>"}, req, res);
                    }
                } else {
                    logger.error("SignupVerifyFailure", "userData is false, can't verify user", req.session);
                    renderer.renderPage("signupFail.html", {"{message}": "An unknown error occurred<br><br>"}, req, res);
                }
            } else {
                logger.info("SignupVerifyFailure", "A user tried to verify signup without being authenticated");
            }
        });
    },
    
    restrict: function(req, res, next) {
        if(req.session.authenticated) {
            next();
        } else {
            renderer.sendStaticPage("login.html", req, res);
        }
    },

    restrict_admin: function(req, res, next) {
        if(req.session.authenticated) {
            if(db.getUserData(req.session.username, "login").admin == false) {
                logger.warn("AdminPageUnauthorized", "A non-admin user has attempted to access an admin-only page", {username:req.session.username,page:req.originalUrl});
                res.redirect("/");
            } else next();
        } else {
            logger.warn("AdminPageUnauthenticated", "A unauthenticated user has attempted to access an admin-only page", {page:req.originalUrl});
            renderer.sendStaticPage("login.html", req, res);
        }
    },

    authRoute: function(req, res) {
        if(!db.userExists(req.body.username)) {
            renderer.renderPage("loginFail.html", {"{message}":"Invalid username or password"}, req, res);
            logger.info("LoginFail", `User does not exist`, {username:req.body.username});
        } else {
            var userData = db.getUserData(req.body.username, "login");
            if(userData.banned) {
                res.redirect("/banned.html");
            } else {
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
        }
    },

    signupRoute: function(req, res) {
        if(req.body.username != "" && req.body.password != "") {
            var passwordHash = bcrypt.hashSync(req.body.password, bcrypt_saltrounds);
            var mfaKey = "";
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            for (let i = 0; i < 16; i++) {
                mfaKey += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            if(db.createUser(req.body.username, passwordHash, mfaKey)) {
                req.session.authenticated = true;
                req.session.username = req.body.username;
                renderer.renderPage("signupQR.html", {"{key}": mfaKey, "{reason}": ""}, req, res);
            } else {
                renderer.renderPage("signupFail.html", {"{message}":"Signup failed"}, req, res);
            }
        } else {
            renderer.renderPage("signupFail.html", {"{message}":"Username or password blank"}, req, res);
        }
    }
}