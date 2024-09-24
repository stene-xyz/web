const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const sanitizeHtml = require('sanitize-html');

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
        try {
            fs.readFile(path.join(__dirname, "renderable", filename), (err, pageData) => {
                if(err) {
                    logger.error("RenderError", "Failed to render page", {filename:filename,error:err});
                    res.sendStatus(500);
                } else {
                    var finalData = pageData.toString();
                    for(var key in data) {
                        finalData = finalData.replaceAll(key, sanitizeHtml(data[key]));
                    }
                    res.set('Content-Type', 'text/html');
                    res.send(finalData);
                }
            });
        } catch(e) {
            logger.error("RenderError", "Renderer crashed", {filename:filename,error:e})
        }
    }
};