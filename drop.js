const fileLife = 172800000; // 48 hours
const autoDeleteInterval = 60000; // 1 hour

const renderer = require("./renderer");
const logger = require("./logger");
const path = require("path");
const fs = require("fs");

module.exports = {
	init: function(app) {
		app.post("/drop/upload", (req, res) => {
			try {
				logger.info("DropUpload", "Someone is attempting to upload a file to Drop");
				if(!req.files) {
					req.session.drop_link = "No file uploaded";
					logger.warn("DropFailure", "No file uploaded in Drop upload request");
				} else {
					let uploaded = req.files.uploaded;
					let file_id = Math.floor(Math.random() * 1E16);
					let target_path = path.join(__dirname, "files", `${file_id}`, uploaded.name);
					uploaded.mv(target_path);
					req.session.drop_link = `https://stene.xyz/drop/files/${file_id}/${uploaded.name}`;
					logger.info("DropUpload", "Uploaded file", {"size": uploaded.name});
				}
				res.redirect("/drop/uploaded");
			} catch(e) {
				req.session.drop_error = e.message;
				logger.error("DropFailure", "Error occurred", e);
				res.redirect("/drop/failure");
			}
		});

		app.get("/drop/uploaded", (req, res) => {
			renderer.renderPage("dropUploadSuccess.html", {"{url}":req.session.drop_link}, req, res);
		});

		app.get("/drop/failure", (req, res) => {
			renderer.renderPage("dropUploadFailure.html", {"{err}":req.session.drop_error}, req, res);
		})
		
		setInterval(doFileAutodelete, autoDeleteInterval);
		doFileAutodelete();
	}
};

function doFileAutodelete() {
	logger.info("DropCleanup", "Running autodelete for dropped files");

	fs.readdir(path.join(__dirname, "files"), (err, files) => {
		if(err) logger.error("DropCleanupFailure", "Failed to get file list", err);
		else {
			files.forEach((file) => {
				var filePath = path.join(__dirname, "files", file);

				logger.info("DropCleanup", "Checking file creation time", {"file": file});
				fs.stat(filePath, (err, stats) => {
					if(err) logger.error("DropCleanupFailure", "Failed to get file creation time", {"file": file});
					else {
						if(Date.now() - stats.ctimeMs >= fileLife) {
							logger.info("DropCleanup", "File has existed for too long! Deleting...", {"file": file, "ctime": stats.ctimeMs});
							fs.rmdir(filePath, {recursive: true}, (err) => {
								if(err) logger.error("DropCleanupFailure", "Failed to delete file", {"file": file, "err": err});
							});
						} else logger.info("DropCleanup", "File has not yet reached deletion timestamp", {"file": file, "ctime": stats.ctimeMs});
					}
				});
			});
		}
	});
}

