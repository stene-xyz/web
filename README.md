# stene.xyz web services
Web services infrastructure for stene.xyz

## Project Layout
- `public` - Static files
- `renderable` - Files that can be rendered by the rendering engine
- `sites` - Scribe mini-sites
- `test.js` - (runnable) Runs all tests
- `index.js` - (runnable) Start the web server on port 3000
- `config.js` - Configuration for feature availability
- `auth.js` - Authentication library
- `db.js` - "Database" (to be replaced with `postgres` at some point)
- `drop.js` - Drop, a 48-hour file upload tool
- `logger.js` - Logging library
- `renderer.js` - Page renderer
- `scribe.js` - Scribe, a static site generator
- `security.js` Currently just logs HTTP requests
