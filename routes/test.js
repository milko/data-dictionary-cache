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
 * Test validateObject()
 */
router.post(
    'validateObject',
    function (req, res){

        const validator = new Validator()

        validator.validateObject(req.body)

        res.send(validator.report)

    }, 'validateObject()')
    .summary('Test validateObject()')
    .description(dd`Validate provided object.`)
    .body(joi.alternatives().try(
        joi.array(),
        joi.object(),
        joi.string(),
        joi.number()
    ), dd`Accept any type of value to check validation.`)
    .response(
        joi.object(),
        'Validator record.'
    )

/**
 * Test validateObjects()
 */
router.post(
    'validateObjects',
    function (req, res){

        const validator = new Validator()

        validator.validateObjects(req.body)

        res.send(validator.report)

    }, 'validateObjects()')
    .summary('Test validateObjects()')
    .description(dd`Validate provided list of objects.`)
    .body(joi.alternatives().try(
        joi.array(),
        joi.object(),
        joi.string(),
        joi.number()
    ), dd`Accept any type of value to check validation.`)
    .response(
        joi.object(),
        'Validator record.'
    )

/**
 * Test validateObjectList()
 */
router.post(
    'validateObjectList',
    function (req, res){

        const validator = new Validator()
        const descriptor = req.queryParams.descriptor

        validator.validateObjectList(req.body, descriptor)

        res.send(validator.report)

    }, 'validateObjectList()')
    .summary('Test validateObjectList()')
    .description(dd`Validate provided list of objects against provided descriptor.`)
    .queryParam(
        'descriptor',
        joi.string(),
        "Descriptor global identifier"
    )
    .body(joi.alternatives().try(
        joi.array(),
        joi.object(),
        joi.string(),
        joi.number()
    ), dd`Accept any type of value to check validation.`)
    .response(
        joi.object(),
        'Validator record.'
    )
