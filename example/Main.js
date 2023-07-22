/*
Example sqlite server based on express and sqlite and sqlite-express
 */
import tempdebug from 'debug';
const debug = tempdebug('sqlite-express:Main');

import express from 'express'; // http://expressjs.com/
import morgan from 'morgan'; // https://www.npmjs.com/package/morgan - reasonable logging in syslog
//import { appContent, appSelect, validateId, validateAlias, tagCloud, atom, rss, openDB } from 'sqlite-express';
import { appContent, appSelect, validateId, validateAlias, tagCloud, atom, rss, openDB } from '../index.js';
//TODO-MAIN look into unused functions in import from sqlite-express
const config = {
  morgan: ':method :url :req[range] :status :res[content-length] :response-time ms :req[referer]',
  port: 4251,
  dbpath: './sqlite.db',
};
const optionsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Needs: GET, OPTIONS, probably HEAD, do not believe can do POST, PUT, DELETE yet but could be wrong about that.
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  // Needs: Range; User-Agent (for webtorrent); Not Needed: Authorization; Others are suggested in some online posts
  'Access-Control-Allow-Headers': 'Content-Type, Content-Length, Range, User-Agent, X-Requested-With',
};
// TODO-MAIN rewrite down - check which constants used and why
const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  server: 'express/sqlite-express',
  Connection: 'keep-alive',
  'Keep-Alive': 'timeout=5, max=1000', // Up to 5 seconds idle, 1000 requests max
};
// TODO-MAIN rewrite up - check which constants used and why

// Instantiate an instance of express
const app = express();

// Respond to https OPTIONS
app.options('/*', (req, res) => {
  res.set(optionsHeaders);
  res.sendStatus(200);
});

app.use(morgan(config.morgan)); // write logs to syslog
app.use(express.json()); // Allow JSON requests

// Things we do on all queries
app.use((req, res, next) => {
  res.set(responseHeaders);
  next();
});

// A useful debugging default to see exactly what headers express is seeing.
app.get('/echo', (req, res) => {
  res.status(200).json(req.headers);
});

// return a flat file
app.get('/:file', (req, res, next) => {
  debug(`Sending ${req.params.file}`)
  res.sendFile(req.params.file, {},
      (err) => { if (err) { res.status(404).send(err.message); } })
});

// Database access via sqlite
app.get('/content', appContent); // Returning just one
app.get('/select', appSelect); // Returning a list of items
app.get('/tagcloud', tagCloud);

// === Fire up the server and catch errors
openDB(config.dbpath, (err, res) => {
  if (err) {
    console.error(err);
  } else {
    const server = app.listen(config.port);
    debug('Server starting on port %s', config.port);
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        debug('A server, probably another copy of this, is already listening on port %s', config.apps.http.port);
      } else {
        debug('Server hit error %o', err);
        throw (err); // Will be uncaught exception
      }
    })
  }
});
