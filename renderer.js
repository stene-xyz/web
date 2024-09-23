const fs = require('fs');
const path = require('path');
const logger = require('./logger');

module.exports = {
    sendStaticPage: function(filename, req, res) {
        logger.info("RenderPage", "Sending static page", {filename:filename});
        fs.readFile(path.join(__dirname, "public", filename), (err, data) => {
            if(err) {
                logger.error("RenderError", "Failed to send static page", {filename:filename,error:err});
                res.sendStatus(500);
            } else {
                res.set('Content-Type', 'text/html');
                res.send(data);
            }
        });
    },
    renderPage: function(filename, data, req, res) {
        logger.info("RenderPage", "Rendering page", {filename:filename,data:data});
        fs.readFile(path.join(__dirname, "renderable", filename), (err, data) => {
            // TODO: Render page
            if(err) {
                logger.error("RenderError", "Failed to render page", {filename:filename,error:err});
                res.sendStatus(500);
            } else {
                res.set('Content-Type', 'text/html');
                res.send(data);
            }
        });
    }
};