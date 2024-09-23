const logger = require('./logger');

logger.info("Startup", "Loading third-party modules...");
const express = require('express');
const session = require('express-session');

logger.info("Startup", "Loading first-party modules...");
const auth = require('./auth');
const renderer = require('./renderer');

logger.info("Startup", "Initialising Express...");
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
	secret: auth.genToken(),
	saveUninitialized: false,
	resave: false,
	cookie: {}
}));

logger.info("Startup", "Initialising first-party modules...");
app.use((req, res, next) => {
    logger.verbose("HTTPRequest", "Request received", {
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        cookies: req.cookies,
        params: req.params,
        body: req.body
    });
    next();
});
auth.init(app);

logger.info("Startup", "Initialising routes...");
app.get("/", (req, res) => { 
    renderer.sendStaticPage("index.html", req, res);
});

app.listen(port, () => {
    logger.info("Startup", "Listening", {port:port});
});