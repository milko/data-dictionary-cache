'use strict';
const dd = require('dedent');
const joi = require('joi');
const httpError = require('http-errors');
const status = require('statuses');
const { errors } = require('@arangodb');
const { context } = require('@arangodb/locals');
const createRouter = require('@arangodb/foxx/router');
const Model = require('../models/test');

const collection = context.collection('test');
const keySchema = joi.string().required()
.description('The key of the test');

const ARANGO_NOT_FOUND = errors.ERROR_ARANGO_DOCUMENT_NOT_FOUND.code;
const ARANGO_DUPLICATE = errors.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED.code;
const ARANGO_CONFLICT = errors.ERROR_ARANGO_CONFLICT.code;
const HTTP_NOT_FOUND = status('not found');
const HTTP_CONFLICT = status('conflict');

const TermCache = require('../library/TermsCache')
const Cache = new TermCache()

const router = createRouter();
module.exports = router;

router.tag('test');

router.get(function (req, res){
  const key = req.queryParams.GID
  res.send(Cache.getTerm(key));
}, 'getTerm')
    .summary('Get a term')
    .description(dd`Retrieves term from cache or database.`)
    .queryParam('GID', joi.string().required(), "Term global identifier")
    .response([Model], 'Test cache getTerm().')

router.post(function (req, res){
  const keys = req.body
  res.send(Cache.getTerms(keys));
}, 'getTerm')
    .summary('Get a list of terms')
    .description(dd`Retrieves list of terms from cache or database.`)
    .body(joi.array().required(), "List of term global identifiers")
    .response([Model], 'Test cache getTerms().')


// router.post(function (req, res) {
//   const doc = req.body;
//   let meta;
//   try {
//     meta = collection.save(doc);
//   } catch (e) {
//     if (e.isArangoError && e.errorNum === ARANGO_DUPLICATE) {
//       throw httpError(HTTP_CONFLICT, e.message);
//     }
//     throw e;
//   }
//   res.status(201);
//   res.set('location', req.makeAbsolute(
//     req.reverse('detail', { key: doc._key })
//   ));
//   res.send({ ...doc, ...meta });
// }, 'create')
// .body(Model, 'The test to create.')
// .response(201, Model, 'The created test.')
// .error(HTTP_CONFLICT, 'The test already exists.')
// .summary('Create a new test')
// .description(dd`
//   Creates a new test from the request body and
//   returns the saved document.
// `);
//
// router.get(':key', function (req, res) {
//   const key = req.pathParams.key;
//   let doc;
//   try {
//     doc = collection.document(key);
//   } catch (e) {
//     if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
//       throw httpError(HTTP_NOT_FOUND, e.message);
//     }
//     throw e;
//   }
//   res.send(doc);
// }, 'detail')
// .pathParam('key', keySchema)
// .response(Model, 'The test.')
// .summary('Fetch a test')
// .description(dd`
//   Retrieves a test by its key.
// `);
//
// router.put(':key', function (req, res) {
//   const key = req.pathParams.key;
//   const doc = req.body;
//   let meta;
//   try {
//     meta = collection.replace(key, doc);
//   } catch (e) {
//     if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
//       throw httpError(HTTP_NOT_FOUND, e.message);
//     }
//     if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
//       throw httpError(HTTP_CONFLICT, e.message);
//     }
//     throw e;
//   }
//   res.send({ ...doc, ...meta });
// }, 'replace')
// .pathParam('key', keySchema)
// .body(Model, 'The data to replace the test with.')
// .response(Model, 'The new test.')
// .summary('Replace a test')
// .description(dd`
//   Replaces an existing test with the request body and
//   returns the new document.
// `);
//
// router.patch(':key', function (req, res) {
//   const key = req.pathParams.key;
//   const patchData = req.body;
//   let doc;
//   try {
//     collection.update(key, patchData);
//     doc = collection.document(key);
//   } catch (e) {
//     if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
//       throw httpError(HTTP_NOT_FOUND, e.message);
//     }
//     if (e.isArangoError && e.errorNum === ARANGO_CONFLICT) {
//       throw httpError(HTTP_CONFLICT, e.message);
//     }
//     throw e;
//   }
//   res.send(doc);
// }, 'update')
// .pathParam('key', keySchema)
// .body(joi.object().description('The data to update the test with.'))
// .response(Model, 'The updated test.')
// .summary('Update a test')
// .description(dd`
//   Patches a test with the request body and
//   returns the updated document.
// `);
//
// router.delete(':key', function (req, res) {
//   const key = req.pathParams.key;
//   try {
//     collection.remove(key);
//   } catch (e) {
//     if (e.isArangoError && e.errorNum === ARANGO_NOT_FOUND) {
//       throw httpError(HTTP_NOT_FOUND, e.message);
//     }
//     throw e;
//   }
// }, 'delete')
// .pathParam('key', keySchema)
// .response(null)
// .summary('Remove a test')
// .description(dd`
//   Deletes a test from the database.
// `);
