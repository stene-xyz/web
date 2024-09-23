const logger = require('./logger');
module.exports = {
    logHTTPRequest: function(req, res, next) {
        logger.verbose("HTTPRequest", "Request received", {
            ip: req.ip,
            method: req.method,
            path: req.originalUrl,
            cookies: req.cookies,
            session: req.session,
            params: req.params,
            body: req.body
        });
        next();
    }
};