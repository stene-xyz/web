/*
 * Scribe 2.0
 */

const logger = require("./logger");

const fs = require('fs');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const marked = require('marked');
const sanitizePath = require('sanitize-filename');

module.exports = {
    init: function(app) {
        app.post("/scribe/create", (req, res) => {
            logger.info("ScribeCreate", "User is creating new Scribe microsite", {data:req.body});
            fs.readFile(path.join(__dirname, "renderable", "scribe-template.html"), (err, data) => {
                if(err) {
                    logger.error("ScribeCreateError", "Failed to create Scribe microsite", {error:err,data:req.body});
                    res.redirect("/scribe/error.html");
                } else {
                    var content = sanitizeHtml(marked.parse(req.body.body)); // Parse the markdown from the body into HTML
                    data = data.toString().replaceAll("[TITLE]", sanitizeHtml(req.body.title)).replaceAll("[CONTENT]", content); // Replace the [TITLE] and [CONTENT] tags with website content
        
                    // For loop to keep repeating in the off chance we try to do two at once
                    for(var i = 0; i < 1000; i++) {
                        // A random ID gets put in front of the title to allow for duplicate titles
                        var filename = `${Math.floor(Math.random() * 1E6)}-${sanitizePath(req.body.title.replaceAll(" ", "-"))}`;
                        
                        // Write the file & redirect the user
                        if(!fs.existsSync(path.join(__dirname, "sites", `${filename}.html`))) {
                            fs.writeFileSync(path.join(__dirname, "sites", `${filename}.html`), data);
                            logger.info("ScribeCreateSuccess", "Scribe site created", {path: path.join(__dirname, "sites", `${filename}.html`)});
                            res.redirect(`/scribe/sites/${filename}.html`);
                            return;
                        }
                    }
                    
                    logger.error("ScribeCreateError", "Failed to create Scribe microsite", {error:err,data:req.body});
                    res.redirect("/scribe/error.html");
                }
            });
        });

        app.get("/scribe/random", (req, res) => {
            fs.readdir(path.join(__dirname, "sites"), (err, files) => {
                if(err) logger.error("ScribeRandomError", "Failed to load file list", {error:err});
                else {
                    var file = files[Math.floor(Math.random()*files.length)];
                    res.redirect(`/scribe/sites/${file}`);
                }
            });
        });
    }
};
