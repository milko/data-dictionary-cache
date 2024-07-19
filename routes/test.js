'use strict'

///
// Modules.
///
const dd = require('dedent')
const joi = require('joi')
const createRouter = require('@arangodb/foxx/router')

///
// Cache.
///
const TermCache = require('../library/TermsCache')
const Cache = new TermCache()


///
// Router.
///
const router = createRouter()
module.exports = router
router.tag('test')


/**
 * Test TermsCache::getTerm()
 */
router.get(function (req, res){

  const key = req.queryParams.GID
  res.send(Cache.getTerm(key))

}, 'getTerm')
    .summary('Test getTerm()')
    .description(dd`Retrieves term record from cache or database.`)
    .queryParam(
        'GID',
        joi.string().required(),
        "Term global identifier"
    )
    .response(
        joi.object(),
        'Object containing the term record. The term global identifier is not returned.'
    )

/**
 * Test TermsCache::getTerms()
 */
router.post(function (req, res){

  const keys = req.body
  res.send(Cache.getTerms(keys))

}, 'getTerms')
    .summary('Test getTerms()')
    .description(dd`Retrieves list of term records from cache or database.`)
    .body(
        joi.array().items(joi.string()),
        "List of term global identifiers"
    )
    .response(
        joi.object(),
        'key/value dictionary where key is term global identifier and value is term record.'
    )
