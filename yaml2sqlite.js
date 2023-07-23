import yaml from 'js-yaml'; // https://www.npmjs.com/package/js-yaml
import fs from 'fs'; // https://nodejs.org/api/fs.html#file-descriptors
import {} from './index.js';
import sqlite3 from 'sqlite3'; // https://github.com/TryGhost/node-sqlite3/wiki/API
import async from 'async';

const inputFilePathOrDescriptor =  fs.openSync('example/data.yaml','r'); // 'content.yaml'; // Read from stdin
//const outputFilePathOrDescriptor = fs.openSync('example/data.sql','w'); // Output
const dbpath = 'example/sqlite.db'
const contenttable = 'content';
/*
See https://stackabuse.com/reading-and-writing-json-files-with-node-js/
https://www.json2yaml.com/
https://www.cloudbees.com/blog/yaml-tutorial-everything-you-need-get-started
*/

const sqlstart = `
CREATE TABLE \`content\` (
  \`id\` INTEGER PRIMARY KEY AUTOINCREMENT,
  \`title\` varchar(255) NOT NULL DEFAULT '',
  \`alias\` varchar(255) UNIQUE,
  \`introtext\` mediumtext NOT NULL,
  \`fulltext\` mediumtext NOT NULL,
  \`catid\` int(11) NOT NULL DEFAULT '0',
  \`created\` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  \`metakey\` text NOT NULL COLLATE NOCASE
);
`;

function obj_to_sqlite(o,cb) {
  if (o == null) { // It will be null if there is a trailing --- in the file
    cb(null);
  } else {
    // TODO parameterize this
    let { action='insert', id, title, alias, introtext, fulltext='', catid=1, created, metakey=''} = o;
    let inserting = ['insert', 'replace'].includes(action);
    let deleting = ['replace', 'delete'].includes(action);
    if (inserting && !(title && id && introtext && created)) { // TODO parameterize this
      console.error('Bad obj - need title & id & introtext & created', o); // TODO parameterize this
    } else if (deleting && !(id)) {
      console.error('Bad obj - need id to delete', o);
    } else {
      let x = ''
      if (deleting) {
        x += `DELETE FROM ${contenttable} WHERE id = ${id};`;
      }
      if (inserting) {
        // TODO handle blank lines and turn into paragraphs
        // Escape some characters in weird ways SQL/sqlite wants them
        // And create defaults where applicable
        title = title.replace(/'/g, "''");
        alias = alias || title.toLowerCase().replace(/[ ']+/g, ' ').substring(0, 20).trimEnd()
          .replace(/ /g, '_');
        introtext = introtext.replace(/'/g, "''");
        fulltext = fulltext.replace(/'/g, "''");
        created = typeof(created) === 'string' ? created : created.toISOString();
        // TODO need a function in sqllib that produces this INSERT statement
        // Note fields in this write must match in order those in the CREATE statement above
        x += `INSERT INTO content VALUES (${id}, '${title}', '${alias}', '${introtext}', '${fulltext}', ${catid},'${created}','${metakey}');`;
      }
      console.log(x);
      db.exec(x, cb);
    }
  }
}
let db;
let obj;
async.waterfall([
    (cb) => { db = new sqlite3.Database(dbpath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, cb)},
    (cb) => {
      console.log(sqlstart);
      db.exec(sqlstart,cb)},
    (cb) => fs.readFile(inputFilePathOrDescriptor, 'utf8', cb),
    (yamldata,cb) => cb(null, yaml.loadAll(yamldata,{ onWarning: (warn) => console.log('Yaml warning:', warn) })),
    (objdata,cb) => async.forEachSeries(objdata, obj_to_sqlite, cb ),
  ],
    (err) => { if (err) console.error(err); }
);


//TODO feed this straight to sqlite3 not via a shell script
//TODO move some of this INTO index.js


//TODO backport some of this to yaml2sqlite in mitra.biz