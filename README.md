# sqlite-express
Integration to make it easy to integrate sqlite into sites using express

## Major design goals
* Easy integration of sqlite into express
* Flexibility as to structure of sqlite databases etc 
* Works well with html-element-extended for single page websites

## Minor design goals
* Easy to port to other SQL variations - but untested
* East to port to other Javascript servers
* Simplicity and orthogonality
* Few dependencies

## Security
* This library is *not* intended to support permissions and the like, 
  its working from an assumption that the server developer really doesnt care
  if all the sql database is exposed, which is common for smaller sites.
  I would be happy to integrate PRs for security related features.

## Current status and top TODO's
See the repository issues for more detail

This library, in its original form is in active use on www.mitra.biz. 
It is in the process of being turned into a module that can be imported and used by others.

Library currently imports and runs in (not yet pushed) www.mitra.biz
yaml2sqlite runs on the example 

### TODO 
* Add package.json
  * Check if needs all dependencies and eliminate e.g. forEachSeries shouldn't be needed
  * Document index.js
* Build simple example 
* Yaml2sqlite should probably use stdin (file descriptor 0) instead of fixed path, should also delete existing sqlite.db 
* Testing
  * Test in mitra.biz e.g. http://localhost:4250/?catid=31