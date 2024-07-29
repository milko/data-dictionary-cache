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
 * Test TermsCache.queryEnumIdentifierByCode()
 */
router.get(
    'queryEnumIdentifierByCode',
    function (req, res){

        const cache = new TermsCache()

        const field = req.queryParams.field
        const code = req.queryParams.code
        const type = req.queryParams.type

        res.send(cache.queryEnumIdentifierByCode(field, code, type))

    }, 'queryEnumIdentifierByCode')
    .summary('Test queryEnumIdentifierByCode()')
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
router.post(
    'newValidationReport',
    function (req, res){

        const status = req.queryParams.statusCode
        const descriptor = req.queryParams.descriptor
        const language = req.queryParams.language

        const report = new ValidationReport(status, descriptor, req.body, language)

        res.send(report)

    }, 'new ValidationReport()')
    .summary('Test ValidationReport()')
    .description(dd`Create and inspect a validation report.`)
    .queryParam(
        'statusCode',
        joi.string().default('kOK'),
        "Validation status ID"
    )
    .queryParam(
        'descriptor',
        joi.string(),
        "Descriptor global identifier"
    )
    .queryParam(
        'language',
        joi.string().default('iso_639_3_eng'),
        "Status message language"
    )
    .body(joi.alternatives().try(
        joi.array(),
        joi.object(),
        joi.string(),
        joi.number(),
        joi.boolean()
    ), dd`Incorrect value.`)
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
                req.queryParams.doCache,
                req.queryParams.doMissing,
                req.queryParams.doOnlyTerms,
                req.queryParams.doDataType,
                req.queryParams.doResolve,
                req.queryParams.useDefNamespace,
                req.queryParams.resolveCode
            )

        res.send(validator)

    }, 'Validator::constructor()')
    .summary('Test Validator::constructor()')
    .description(dd`Test the Validator class constructor.`)
    .queryParam(
        'descriptor',
        joi.string().default(''),
        "Descriptor global identifier"
    )
    .queryParam(
        'doZip',
        joi.boolean().default(false),
        "Associate descriptor to array of values"
    )
    .queryParam(
        'doCache',
        joi.boolean().default(true),
        "Cache resolved terms"
    )
    .queryParam(
        'doMissing',
        joi.boolean().default(false),
        "Cache unresolved terms"
    )
    .queryParam(
        'doOnlyTerms',
        joi.boolean().default(false),
        "All properties must be terms"
    )
    .queryParam(
        'doDataType',
        joi.boolean().default(false),
        "All descriptors must have the data type"
    )
    .queryParam(
        'doResolve',
        joi.boolean().default(false),
        "Try resolving enumeration codes"
    )
    .queryParam(
        'useDefNamespace',
        joi.boolean().default(false),
        "Use default namespace"
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
    ), dd`Accept any type of value.`)
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
                req.queryParams.doCache,
                req.queryParams.doMissing,
                req.queryParams.doOnlyTerms,
                req.queryParams.doDataType,
                req.queryParams.doResolve,
                req.queryParams.useDefNamespace,
                req.queryParams.resolveCode
            )

        const status = validator.validate()

        // res.send({
        //     "status": status,
        //     "validator": validator
        // })
        res.send(validator)

    }, 'Validator::validate()')
    .summary('Test Validator::validate()')
    .description(dd`Test the validate() method.`)
    .queryParam(
        'descriptor',
        joi.string().default(''),
        "Descriptor global identifier"
    )
    .queryParam(
        'doZip',
        joi.boolean().default(false),
        "Associate descriptor to array of values"
    )
    .queryParam(
        'doCache',
        joi.boolean().default(true),
        "Cache resolved terms"
    )
    .queryParam(
        'doMissing',
        joi.boolean().default(false),
        "Cache unresolved terms"
    )
    .queryParam(
        'doOnlyTerms',
        joi.boolean().default(false),
        "All properties must be terms"
    )
    .queryParam(
        'doDataType',
        joi.boolean().default(false),
        "All descriptors must have the data type"
    )
    .queryParam(
        'doResolve',
        joi.boolean().default(false),
        "Try resolving enumeration codes"
    )
    .queryParam(
        'useDefNamespace',
        joi.boolean().default(false),
        "Use default namespace"
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
    ), dd`Accept any type of value.`)
    .response(
        joi.object(),
        'Validator record.'
    )
