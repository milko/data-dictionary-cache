'use strict'

///
// Modules.
///
const dd = require('dedent')
const joi = require('joi')
const createRouter = require('@arangodb/foxx/router')

///
// Classes.
///
const ValidationReport = require('../library/ValidationReport')
const TermsCache = require('../library/TermsCache')
const Validator = require('../library/Validator')


///
// Router.
///
const router = createRouter()
module.exports = router
router.tag('test')


// /**
//  * Test TermsCache::getTerm()
//  */
// router.get(
//     function (req, res){
//
//         res.send("Hello!")                                    // ==>
//
//     }, 'test')
//     .summary('Test')
//     .description(dd`Simple test.`)
//     .response(
//         joi.string(),
//         'Hello!'
//     )

/**
 * Test TermsCache::getTerm()
 */
router.get(
    'getTerm',
    function (req, res){

        const cache = new TermsCache()
        const key = req.queryParams.GID

        res.send(cache.getTerm(key))                                    // ==>

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
router.post(
    'getTerms',
    function (req, res){

        const cache = new TermsCache()
        const keys = req.body

        res.send(cache.getTerms(keys))

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

/**
 * Test TermsCache::QueryEnumIdentifierByCode()
 */
router.get(
    'QueryEnumIdentifierByCode',
    function (req, res){

        const field = req.queryParams.field
        const code = req.queryParams.code
        const type = req.queryParams.type

        res.send(TermsCache.QueryEnumIdentifierByCode(field, code, type))

    }, 'QueryEnumIdentifierByCode')
    .summary('Test QueryEnumIdentifierByCode()')
    .description(dd`Retrieve enumeration term global identifier given local identifier and enumeration path.`)
    .queryParam(
        'field',
        joi.string().required(),
        "Term code section property name"
    )
    .queryParam(
        'code',
        joi.string().required(),
        "Term code section field value"
    )
    .queryParam(
        'type',
        joi.string().required(),
        "Enumeration type global identifier"
    )
    .response(
        joi.array(),
        'List of matching term global identifiers.'
    )

/**
 * Test TermsCache::QueryEnumTermByCode()
 */
router.get(
    'QueryEnumTermByCode',
    function (req, res){

        const field = req.queryParams.field
        const code = req.queryParams.code
        const type = req.queryParams.type

        res.send(TermsCache.QueryEnumTermByCode(field, code, type))

    }, 'QueryEnumTermByCode')
    .summary('Test QueryEnumTermByCode()')
    .description(dd`Retrieve enumeration term global identifier given local identifier and enumeration path.`)
    .queryParam(
        'field',
        joi.string().required(),
        "Term code section property name"
    )
    .queryParam(
        'code',
        joi.string().required(),
        "Term code section field value"
    )
    .queryParam(
        'type',
        joi.string().required(),
        "Enumeration type global identifier"
    )
    .response(
        joi.array(),
        'List of matching term records.'
    )

/**
 * Test ValidationReport()
 */
router.get(
    'newValidationReport',
    function (req, res){

        const status = req.queryParams.status
        const descriptor = req.queryParams.descriptor
        const report = new ValidationReport(status, descriptor)

        res.send(report)

    }, 'new ValidationReport()')
    .summary('Test ValidationReport()')
    .description(dd`Create and inspect a validation report.`)
    .queryParam(
        'status',
        joi.string(),
        "Validation status ID"
    )
    .queryParam(
        'descriptor',
        joi.string(),
        "Descriptor global identifier"
    )
    .response(
        joi.array(),
        'ValidationStatus record.'
    )

/**
 * Test Validator::constructor()
 */
router.post(
    'validator',
    function (req, res){

        const validator =
            new Validator(
                req.body,
                req.queryParams.descriptor,
                req.queryParams.doZip,
                req.queryParams.doResolve,
                req.queryParams.resolveCode
            )

        res.send(validator)

    }, 'Validator::constructor()')
    .summary('Test Validator::constructor()')
    .description(dd`Test the Validator class constructor.`)
    .queryParam(
        'descriptor',
        joi.string(),
        "Descriptor global identifier"
    )
    .queryParam(
        'doZip',
        joi.boolean().default(false),
        "Associate descriptor to array of values"
    )
    .queryParam(
        'doResolve',
        joi.boolean().default(false),
        "Resolve codes and preferred enumerations"
    )
    .queryParam(
        'resolveCode',
        joi.string().default("_lid"),
        "Code section property for resolving"
    )
    .body(joi.alternatives().try(
        joi.array(),
        joi.object(),
        joi.string(),
        joi.number(),
        joi.boolean()
    ), dd`Accept any type of value..`)
    .response(
        joi.object(),
        'Validator record.'
    )

/**
 * Test Validator::validate()
 */
router.post(
    'validate',
    function (req, res){

        const validator =
            new Validator(
                req.body,
                req.queryParams.descriptor,
                req.queryParams.doZip,
                req.queryParams.doResolve,
                req.queryParams.resolveCode
            )

        res.send(validator)

    }, 'Validator::validate()')
    .summary('Test Validator::validate()')
    .description(dd`Test the validate() method.`)
    .queryParam(
        'descriptor',
        joi.string(),
        "Descriptor global identifier"
    )
    .queryParam(
        'doZip',
        joi.boolean().default(false),
        "Associate descriptor to array of values"
    )
    .queryParam(
        'doResolve',
        joi.boolean().default(false),
        "Resolve codes and preferred enumerations"
    )
    .queryParam(
        'resolveCode',
        joi.string().default("_lid"),
        "Code section property for resolving"
    )
    .body(joi.alternatives().try(
        joi.array(),
        joi.object(),
        joi.string(),
        joi.number(),
        joi.boolean()
    ), dd`Accept any type of value..`)
    .response(
        joi.object(),
        'Validator record.'
    )
