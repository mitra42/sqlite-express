// Script to turn sql into json
import sqlite3 from 'sqlite3';
import tempdebug from 'debug';
const debug = tempdebug('mitrabiz:sqllib');
import {waterfall, forEachSeries} from 'async';
import escapeHtml from 'escape-html';
import yaml from 'js-yaml'; // https://www.npmjs.com/package/js-yaml

// Variable that holds the open db, used by most functions.
let db = undefined;

function openDB(dbpath, cb) {
  db = new sqlite3.Database(dbpath, sqlite3.OPEN_READONLY, cb);
}


function updateObj(id, field, val, table, cb) {
  const sql = `UPDATE ${table} SET ${field} = '${val}' WHERE id = '${id}';`;
  //console.log(sql);
  db.all(sql, cb);
  //TODO figure out how to flush it - maybe make boolean and flush at caller if looping
}
function readObj(opts, cb) {
  /**
   * opts: {  Usually the parameters in the URL of the request
   *  q,      passed to "WHERE" clause of sql e.g. catid=27
   *  fl:     Field list to display - default "*" (as a string e.g. 'id,description')
   *  table,  Table to read from - defaults to jos_content
   *  sort:   Name of fl to sort sql by
   *  limit:   Max number of rows to return
   *  offset:  Starting row to return
   * } but not sure what they do
   * cb(err, rows)
   */
  const { q, fl = '*', table = 'jos_content', sort = '', limit = null, offset = 0 } = opts;
  let order;
  if (sort[0] === '-') {
    order = sort ? `ORDER BY ${sort.slice(1)} DESC` : '';
  } else {
    order = sort ? `ORDER BY ${sort} ASC` : '';
  }
  const sqlLimit = limit ? `LIMIT ${limit}` : '';
  const sqlOffset = offset ? `OFFSET ${offset}` : '';
  waterfall([
    (cb1) => {
      const sql = `SELECT ${fl} FROM ${table} ${q ? ('WHERE ' + q) : ''} ${order} ${sqlLimit} ${sqlOffset}`;
       debug(sql);
      db.all(sql, cb1);
    },
  ],
  (err, rows) => {
    if (!err) {
      debug('Found %s entries', rows.length);
    }
    cb(err, rows);
  });
}

/**
 * Read from the database, and respond with json query should return precisely one record. e.g.:
 * GET /content?table=jos_content&q=id%3D3029&fl=attribs%2Ccreated%2Cmodified%2Ctitle%2Cmetakey%2Cintrotext%2Cfulltext
 * query has the form documented in readObj
 **/
function appContent(req, res, next) {
  let format = req.query.format || 'json';
  readObj(req.query, (err, rows) => {
    if (err) {
      res.status(500).send(err.message);
    } else if (rows.length === 0) {
      if (next) {
        next();
      } else {
        res.status(404).send('Not found');
      }
    } else if (rows.length > 1) {
      res.status(500).send('Found more than 1 record');
    } else if (format === 'json') {
      // debug("returning", rows[0])
      res.json(
        rows[0],
      );
    } else if (format === 'yaml') {
      res.status(200).set('Content-Type','text/plain'); // TODO maybe should be yaml but not media type yet
      res.send(yaml.dump(rows[0]));
    }
  });
}

function validateId(id, cb) {
  readObj({ q: `id="${id}"`, fl: 'id,alias' }, (err, rows) => {
    if (err) {
      cb(err);
    } else if (rows.length > 1) {
      cb(new Error(`Found more than one record for id=${id}`));
    } else if (rows.length === 0) {
      cb(new Error(`Do not find any records for id=${id}`));
    } else {
      cb(err, rows[0]);
    }
  });
}

function validateAlias(alias, cb) {
  readObj({ q: `alias="${alias}"`, fl: 'id,alias' }, (err, rows) => {
    if (err) {
      cb(err);
    } else if (rows.length > 1) {
      cb(new Error(`Found more than one record for alias=${alias}`));
    } else if (rows.length === 0) {
      readObj({q: `title LIKE "${alias}%"`, fl: 'id,alias' }, (err, rows) => {
        if (err) {
          cb(err);
        } else if (rows.length > 1) {
          cb(new Error(`Found more than one record for alias=${alias}`));
        } else if (rows.length === 0) {
          cb(new Error(`Do not find any records for alias=${alias}`));
        } else {
          cb(err, rows[0]);
        }
      });
    } else {
      cb(err, rows[0]);
    }
  });
}
function appAlias(req, res, next) {
  req.query.q = `alias="${req.params.alias}"`;
  appContent(req, res, next);
}

// See same code in webcomponents.jsx and sqllib.js
const getKeywords = (field) => (!field ? [] :
  field.split(',')
    .map((k) => k.trim())
    .map((k) => k.startsWith('"') ? k.slice(1) : k)
    .map((k) => k.endsWith('"') ? k.slice(0, -1) : k)
    .filter((k) => !!k));

function countKeys(arrArr, { useCase } = {}) {
  const counted = {};
  for (const i in arrArr) {
    const arr = arrArr[i];
    for (const j in arr) {
      let key = arr[j];
      if (useCase === 'lower') { key = key.toLowerCase(); }
      else if (useCase === 'upper') { key = key.toUpperCase(); }
      if (!counted[key]) {
        counted[key] = 1;
      } else {
        counted[key]++;
      }
    }
  }
  return counted;
}

// e.g. /select?table=jos_content&q=catid%3D27
// TODO-UPNEXT add paging to some callers using limit and offset
// query as documented in readObj
function appSelect(req, res) {
  const query = req.query;
  readObj(query, (err, results) => {
    if (err) {
      res.status(500).send(err.message);
    } else {
      // TODO-UPNEXT - this is the wrong place for this, its specific to mitra.biz and should be elsewhere, maybe a post-process function passed in that adds fields or processes them etc
      const tagcloud = countKeys(results.map((r) => getKeywords(r.metakey)), { useCase: query.case });
      let format = query.format || "json";
      if (format === "json") {
        res.json({ results, tagcloud, query });
      } else if (format === "yaml") {
        res.status(200).set('Content-Type', 'text/plain'); // TODO type may not be valid
        res.send(results.map((result) => yaml.dump(result)).join('---\n'));
      }
    }
  });
}

// Could cache this - but not integrated in UI so won't be used much
function tagCloud(req, res) {
  readObj({ fl: 'metakey', table: 'jos_content', sort: 'metakey' }, (err, rows) => {
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.json(
        countKeys(rows.map((r) => getKeywords(r.metakey)), { useCase: req.query.case }),
      );
    }
  });
}
const atomHeaders = {
  'Access-Control-Allow-Origin': '*',
  'server': 'express/sqlite',
  'Connection': 'keep-alive',
  'Keep-Alive': 'timeout=5, max=1000', // Up to 5 seconds idle, 1000 requests max
  'Content-Type': 'application/xml',
};
const rssHeaders = {
  'Content-Type': 'application/rss+xml; charset=utf-8',
};

//TODO-UPNEXT RSS add a limit (means adding to query as well - see appSelect) need to understand how RSS represens limit and offset

function getUrl(domain, q) { // Same code in webcomponents.js
  const query = Object.entries(q).map((kv) => `${kv[0]}=${encodeURIComponent(kv[1])}`).join('&amp;');
  return query.length ? `${domain}?${query}` : domain;
}

// Combine functionality in Atom and RSS calls below
function rssRows(query, cb) {
  readObj(query, (err, rows) => {
    if (err) {
      cb(err);
    } else {
      rows.forEach((entry) => {
        entry.created = new Date(entry.created);
        entry.modified = entry.modified.startsWith('0000') ? entry.created : new Date(entry.modified);
      });
      //rows = [rows[0]]; Uncomment for testing
      const latestDate = new Date(Math.max(...rows.map((e) => e.modified)));
      const link = getUrl('http://mitra.biz/', query);
      cb(err, rows, link, latestDate);
    }
  });
}

// Safe version of toISOString as otherwise crashes server
function safeToISO(date, id) {
  try {
    return date.toISOString();
  } catch (err) {
    console.log('MALFORMED DATE toISOString fail on row:', id, 'value:', date);
    return 'MALFORMED DATE';
    //console.error(err);
  }
}
function escapeHtmlForAtom(str) {
  return escapeHtml(str)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // There is at least one case of a ^L in content
      .replace(/&lt;br \/&gt;/g, '&lt;br /&gt;\n')
      // TODO-UPNEXT TEST need to make sure sec replaces the src= if its there try on fancy 2816 and plain one 2802
      .replace(/<pdf-link href="([^"]*)" title="([^"]*)" *(src="([^"]*)" *)?(style="([^"]*)" *)?(\/>|><\/pdf-link>)/g, '<a href="$1" target="_self" title="$2"><img src="/images/pdf icon.jpg" border="0" alt="$2" width="48" height="48" style="float: right;" /></a>');
}
// Simpler than Atom because inside CDATA
function escapeHtmlForRss(str) {
  return `<![CDATA[${
    str
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // There is at least one case of a ^L in content
      // This line should match that in webcomponents - note order of href & title is important
      // <pdf-link href="/files/ijccr_mitra_final.pdf" title="IJCCR paper"/>
      .replace(/<pdf-link href="([^"]*)" title="([^"]*)" *\/>/g,
        '<a href="$1" target="_self" title="$2"><img src="/images/pdf icon.jpg" border="0" alt="$2" width="48" height="48" style="float: right;" /></a>')
      .replace(/<content-video src="(http[s]?:\/\/www.youtube.com[^"]*)" *><\/content-video>/g,
        '<div style="width: 480px; height: 390px"><object width="100%" height="100%"><param name="movie" value="$1"/><param name="allowFullScreen" value="true"/><param name="allowscriptaccess" value="always"/></object></div>')
      .replace(/<content-video src="(http[s]?:\/\/www.archive.org[^"]*)" *><\/content-video>/g,
        '<div style="width: 480px; height: 390px"><iframe src="$1" width="640" height="480" frameborder="0" webkitallowfullscreen="true" mozallowfullscreen="true" allowfullscreen></iframe></div>')
      .replace(/<content-video src="([^"]*)" *><\/content-video>/g,
        '<div style="width: 480px; height: 390px"><video width="100%" height="100%" controles="true"><source src="$1" type="video/mp4"/></video></div>')
    //TODO add content-link here
  }]]`;
}
// Example of query q=catid%3D29&sort=-created
function atom(req, res) { // Setting to atomFull should work - but is dummy ...
  rssRows(req.query, (err, rows, link, latestDate) => {
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.status(200);
      res.set(atomHeaders);
      let r = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"  xml:lang="en-gb">
\t<title type="text">Mitra Ardron's blog - Natural Innovation ${req.query.title ? req.query.title : ''}</title>
\t<subtitle type="text">Mitra Ardron - passionate about scaling clean technologies to meet human needs.</subtitle>
\t<link rel="alternate" type="text/html" href="${link}"/>
\t<id>${link}</id>
\t<updated>${safeToISO(latestDate,'latest')}</updated>
<link rel="self" type="application/atom+xml" href="${getUrl('http://www.mitra.biz/atom.xml', req.query)}"/>`;
      r += rows.map((entry) => (`<entry>
<title>${escapeHtmlForAtom(entry.title)}</title>
<link rel="alternate" type="text/html" href="/?id=${entry.id}"/>
<published>${safeToISO(entry.created, entry.id)}</published>
<updated>${safeToISO(entry.modified, entry.id)}</updated>
<id>http://www.mitra.biz/${entry.alias ? entry.id + '-' + entry.alias : entry.id}</id>
<author>
<name>Mitra Ardron</name>
<email>mitra@mitra.biz</email>
</author>
<summary type="html">${escapeHtmlForAtom(entry.introtext)}</summary>
<content type="html">${escapeHtmlForAtom(entry.fulltext.length ? entry.fulltext : entry.introtext)}</content>
          </entry>`)).join('\n');
      r += '</feed>';
      console.log('Sending atom length', r.length);
      res.send(r);
    }
  });
}

function rss(req, res) { // Setting to atomFull should work - but is dummy ...
  rssRows(req.query, (err, rows, link, latestDate) => {
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.status(200);
      res.set(rssHeaders);
      // RSS wants Tue, 13 Jul 2010 09:39:05 +0000 for dates
      const rssMiddle = rows.map((entry) => (`  <item>
    <title>${entry.title}</title>
    <link>/?id=${entry.id}</link>
    <guid isPermaLink="true">http://www.mitra.biz/${entry.alias ? entry.id + '-' + entry.alias : entry.id}</guid>
    <description>${escapeHtmlForRss(entry.fulltext.length ? entry.fulltext : entry.introtext)}</description>
    <author>mitra@mitra.biz (Mitra Ardron)</author>
    <category>misc</category>
    <pubDate>${entry.created.toUTCString()}</pubDate>
  </item>`)).join('\n');
      //console.log("Sending atom length", rssTop + rssMiddle + rssBottom);
      res.send(`<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Mitra Ardron - Natural Innovation - ${req.query.title ? req.query.title : ''}</title>
  <description>Mitra Ardron - passionate about scaling clean technologies to meet human needs.</description>
  <link>${link}</link>
  <lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>
  <generator>Mitra Ardron sqllib</generator>
  <language>en-gb</language>
` + rssMiddle + `
  </channel>
</rss>
`);
    }
  });
}
/*
function test() {
  readObj({ catid: 27 }, (err, data) => {
    if (err) {
      debug('ERROR: %s', err.message);
    } else {
      const len = canonicaljson.stringify(data).length;
      debug('COMPLETED');
    }
  });
}
*/
// Some stuff to run ONCE on the joomla import
// Fix up metakeys remove some spaces
function fixup_joomla(dbpath) {
  //console.log("FIXING JOOMLA");
  let activerows;
  waterfall([
    (cb) => {
      db = new sqlite3.Database(dbpath, sqlite3.OPEN_READWRITE, cb); // Open db in a global
    },
    (cb) =>   readObj({ fl: 'id, metakey, alias' }, cb),
    (rows, cb) => {
      //console.log("Found rows", rows.length);
      activerows = rows.filter((row) => !!row.metakey);
      //console.log("Found active rows", activerows.length);
      activerows.forEach((row) => {
        row.newmetakey = row.metakey.split(',').map((k) => `"${k.trim()}"`).join(',');
        //console.log(row.metakey, row.newmetakey);
      });
      //console.log('Keys munged');
      forEachSeries(activerows,
        (row, cb1) => updateObj(row.id, 'metakey', row.newmetakey, 'jos_content', cb1),
        cb);
    },
    (cb) =>   readObj({ fl: 'id, title, alias' }, cb),
    (rows, cb) => {
      const aliases = rows.map((row) => row.alias);
      console.log("found unique aliases: ", aliases.length);
      activerows = rows.filter((row) => !row.alias);
      forEachSeries(activerows,
        (row, cb1) => {
          let alias = row.title;
          alias = alias.replace(/[-_,"'$.:+=/]/g, '');
          alias = alias.replace(/  +/, ' ').toLowerCase().split(/ +/).join('_').slice(0,15).replace(/_$/,'')
          if (aliases.includes(alias)) {
            console.log("Trying to set", row.id, row.title, 'to duplicate:', alias)
            cb1(null); // Report and skip error
          } else {
            updateObj(row.id, 'alias', alias, 'jos_content', cb1);
            aliases.push(alias); // Remember new alias
          }
        },
        cb);
    },
  ], (err) => {
    if (err) {
      console.log('fixup failed', err);
    } else {
      //console.log("fixup success", err);
    }
  });
}
// test()
export { appContent, appSelect, appAlias, validateId, validateAlias, tagCloud, atom, rss,
  openDB, fixup_joomla, readObj };
