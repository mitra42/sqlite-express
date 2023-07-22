import yaml from 'js-yaml'; // https://www.npmjs.com/package/js-yaml
import fs from 'fs'; // https://nodejs.org/api/fs.html#file-descriptors

const inputFilePathOrDescriptor =  fs.openSync('example/data.yaml','r'); // 'content.yaml'; // Read from stdin
const outputFilePathOrDescriptor = fs.openSync('example/data.sql','w'); // Output
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

function write(text) {
  //console.log(text)
  fs.writeFileSync(outputFilePathOrDescriptor,text);
}

function obj_to_sqlite(o) {
  if (o !== null) { // It will be null if there is a trailing --- in the file
    // TODO parameterize this
    let { action='insert', id, title, alias, introtext, fulltext='', catid=1, created, metakey=''} = o;
    let inserting = ['insert', 'replace'].includes(action);
    let deleting = ['replace', 'delete'].includes(action);
    if (inserting && !(title && id && introtext && created)) { // TODO parameterize this
      console.error('Bad obj - need title & id & introtext & created', o); // TODO parameterize this
    } else if (deleting && !(id)) {
      console.error('Bad obj - need id to delete', o);
    } else {
      if (deleting) {
        write(`DELETE FROM ${contenttable} WHERE id = ${id};`);
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
        write(`INSERT INTO content VALUES (${id}, '${title}', '${alias}', '${introtext}', '${fulltext}', ${catid},'${created}','${metakey}');`);
      }
    }
  }
}
write(sqlstart);
const doc = yaml.loadAll(
  fs.readFileSync(inputFilePathOrDescriptor, 'utf8'),
  (obj) => obj_to_sqlite(obj),
  { onWarning: (warn) => console.log('Yaml warning:', warn) },
);
fs.closeSync(outputFilePathOrDescriptor);

//TODO feed this straight to sqlite3 not via a shell script


//TODO backport some of this to yaml2sqlite in mitra.biz