const logger = require('./logger');

logger.info("Startup", "Loading third-party modules...");
const express = require('express');
const session = require('express-session');
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
	max:5
}));
app.use(csrf()); // Protect against CSRF

logger.info("Startup", "Initialising modules...");
const db = require('./db');
db.init(); 
app.use(security.logHTTPRequest).use(express.static("public")); // not sure if this will only trigger on static files? will have to check when auth implemented
app.use('/scribe/sites', express.static('sites'))
auth.init(app);
if(config.ENABLE_SCRIBE) scribe.init(app);
if(config.ENABLE_DROP) drop.init(app);

app.listen(port, () => {
    logger.info("Startup", "Listening", {port:port});
});
