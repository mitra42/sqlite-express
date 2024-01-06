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

This library, is in active use from www.mitra.biz.
However it is not yet generic - that is work in progress.

yaml2sqlite runs on the example 

### TODO 
* Document index.js
* Build simple example 
* Yaml2sqlite should use stdin (file descriptor 0) instead of fixed path, should also delete existing sqlite.db 
* Testing
