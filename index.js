const logger = require('./logger');

logger.info("Startup", "Loading third-party modules...");
const express = require('express');
const session = require('express-session');

logger.info("Startup", "Loading first-party modules...");
const auth = require('./auth');
const security = require('./security');
const scribe = require('./scribe');

logger.info("Startup", "Initialising Express...");
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
	secret: auth.genToken(),
	saveUninitialized: false,
	resave: false,
	cookie: {}
}));

db.init();

logger.info("Startup", "Initialising modules...");
app.use(security.logHTTPRequest).use(express.static("public")); // not sure if this will only trigger on static files? will have to check when auth implemented
app.use('/scribe/sites', express.static('sites'))
auth.init(app);
scribe.init(app);

app.listen(port, () => {
    logger.info("Startup", "Listening", {port:port});
});