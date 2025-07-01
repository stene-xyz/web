const logger = require('./logger');

logger.info("Startup", "Loading third-party modules...");
const express = require('express');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const crypto = require("crypto");
const ratelimit = require("express-rate-limit");
const csrf = require("lusca").csrf;

logger.info("Startup", "Loading first-party modules...");
const auth = require('./auth');
const security = require('./security');
const config = require('./config');
const scribe = require('./scribe');
const drop = require('./drop');

logger.info("Startup", "Initialising Express...");
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
	secret: crypto.randomBytes(20).toString('hex'),
	saveUninitialized: false,
	resave: false,
	cookie: {}
}));
app.use(ratelimit({ // Protect against DoS
	windowMs:1000,
	max:20
}));
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 1 * 1024 * 1024 * 1024 * 1024
    },
}));
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
var csrf_secret = "";
for (let i = 0; i < 16; i++) {
	csrf_secret += characters.charAt(Math.floor(Math.random() * characters.length));
}
app.use(csrf({
        cookie: {name: '_csrf'},
        secret: csrf_secret,
		blocklist: [{path: '/drop', type: 'startsWith'}, {path: '/scribe', type: 'startsWith'}]
})); // Protect against CSRF

logger.info("Startup", "Initialising modules...");
const db = require('./db');
db.init(); 
app.use(security.logHTTPRequest).use(express.static("public")); // not sure if this will only trigger on static files? will have to check when auth implemented
app.use('/scribe/sites', express.static('sites'))
app.use('/drop/files', express.static('files'))
auth.init(app);
if(config.ENABLE_SCRIBE) scribe.init(app);
if(config.ENABLE_DROP) drop.init(app);

app.listen(port, () => {
    logger.info("Startup", "Listening", {port:port});
});
