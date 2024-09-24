const logger = require('./logger');
const auth = require('./auth');
const security = require('./security');
const scribe = require('./scribe');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const otp = require("totp-generator");

function logStart(message) { logger.info("TestStarting", message); }
function logSuccess(message) { logger.info("TestSuccess", message); }
function logFailure(message, data={}) { logger.error("TestFailure", message, data); process.exit(-1); }
function cleanupTestUser() {
    logger.info("TestUserCleanup", "Wiping test user");
    try {
        if(fs.existsSync(path.join(__dirname, "users", "TEST"))) {
            fs.rmSync(path.join(__dirname, "users", "TEST"), {recursive: true});
            logger.info("TestUserCleanup", "Wiped test user");
        } else logger.info("TestUserCleanup", "Test user did not exist");
    } catch(e) {
        logFailure("Test suite error, failed to cleanup test user", e);
    }
}

/*
 * DB Tests
 */
function dbTest() {
    logStart("Database Test");
    cleanupTestUser();
    try {
        if(!db.createUser("TEST", "TEST", "TEST")) logFailure("User creation failed, see log for details");
        if(!db.userExists("TEST")) logFailure("Created user does not exist");
        var userInfo = db.getUserData("TEST", "login");
        var correctUserInfo = {
            "banned":false,
            "admin":false,
            "username":"TEST",
            "password":"TEST",
            "key":"TEST"
        };
        if(!userInfo) logFailure("User login info is false");
        for(var key in correctUserInfo) {
            if(userInfo[key] != correctUserInfo[key]) logFailure("Created user has wrong login data", {"expected":correctUserInfo,"actual":userInfo});
        }
        if(!db.setUserData("TEST", "TEST", {"TEST": true})) logFailure("User TEST data set failed, see log for details");
        if(!db.getUserData("TEST", "TEST")["TEST"]) logFailure("TEST data set succeeded but data is invalid");
        logSuccess("Database Test");
    } catch(e) {
        logFailure("Error occurred during test", e);
    }
}

/*
 * AUTH TEST
 */
function authTest() { // Part 1: Signup user
    cleanupTestUser();
    logStart("[async] Auth Signup Test");
    try {
        var req = {};
        req.body = {};
        req.body.username = "TEST";
        req.body.password = "TEST";
        req.session = {};
        var res = {};
        res.sendStatus = (value) => {
            logFailure("res.sendStatus called", value);
        };
        res.set = (key, value) => {};
        res.send = (data) => {
            if(data.includes("Signup failed")) logFailure("Auth returned signup failure, see log for details", {"req": req, "res": res});
            if(data.includes("Username or password blank")) logFailure("Auth returned username or password blank", {"req": req, "res": res});
            logSuccess("Auth signup test");
            authTest2();
        };
        auth.signupRoute(req, res);
    } catch(e) {
        logFailure("Error occurred during test", e);
    }
}

function authTest2() { // Part 2: Login user successfully
    logStart("[async] Auth Login Test 1/3");
    try {
        var userData = db.getUserData("TEST", "login");
        var req = {};
        req.body = {};
        req.body.username = userData.username;
        req.body.password = "TEST";
        req.body.key = otp(userData.key)
        req.session = {};
        req.session.authenticated = false
        var res = {};
        res.sendStatus = (value) => {
            logFailure("res.sendStatus called", value);
        };
        res.set = (key, value) => {};
        res.send = (data) => {
            if(data.includes("Internal server error")) logFailure("Auth returned server error, see log for details", {"req": req, "res": res});
            if(data.includes("Invalid username or password")) logFailure("Auth returned invalid username or password", {"req": req, "res": res});
            if(data.includes("Expired 2FA")) logFailure("Auth returned expired/invalid 2FA", {"req": req, "res": res});
            logFailure("Wrong page data sent", data);
        };
        res.redirect = (path) => {
            if(path != "back") logFailure("Unknown redirect", path);
            else {
                req.session.authenticated = true;
                logSuccess("Auth Login test 1/3");
                authTest3();
            }
        };
        auth.authRoute(req, res);
    } catch(e) {
        logFailure("Error occurred during test", e);
    }
}

function authTest3() { // Part 3: Wrong Password
    logStart("[async] Auth Login Test 2/3");
    try {
        var userData = db.getUserData("TEST", "login");
        var req = {};
        req.body = {};
        req.body.username = userData.username;
        req.body.password = "WRONG";
        req.body.key = otp(userData.key)
        req.session = {};
        req.session.authenticated = false
        var res = {};
        res.sendStatus = (value) => {
            logFailure("res.sendStatus called", value);
        };
        res.set = (key, value) => {};
        res.send = (data) => {
            logSuccess("Auth Login test 2/3");
            authTest4();
        };
        res.redirect = (path) => {
            logFailure("User allowed to authenticate with wrong password");
        };
        auth.authRoute(req, res);
    } catch(e) {
        logFailure("Error occurred during test", e);
    }
}

function authTest4() { // Part 4: Wrong 2FA
    logStart("[async] Auth Login Test 2/3");
    try {
        var userData = db.getUserData("TEST", "login");
        var req = {};
        req.body = {};
        req.body.username = userData.username;
        req.body.password = "WRONG";
        req.body.key = otp(userData.key) + 1;
        req.session = {};
        req.session.authenticated = false
        var res = {};
        res.sendStatus = (value) => {
            logFailure("res.sendStatus called", value);
        };
        res.set = (key, value) => {};
        res.send = (data) => {
            logSuccess("Auth Login test 3/3");
        };
        res.redirect = (path) => {
            logFailure("User allowed to authenticate with wrong MFA Key");
        };
        auth.authRoute(req, res);
    } catch(e) {
        logFailure("Error occurred during test", e);
    }
}

/*
 * Run those tests
 */
db.init();
dbTest();
authTest();
