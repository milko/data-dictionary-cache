'use strict'

/**
 * TermsCache.js
 *
 * This file contains the TermsCache class which implements a data dictionary
 * database cache and interface for accessing terms.
 *
 * All names are defined in the service settings, except default names, such as
 * the document key in ArangoDB, _key.
 */

/**
 * Modules.
 */
const {db, aql} = require('@arangodb')

/**
 * Collections and Views.
 */
const terms_view_object = db._view(module.context.configuration.viewTerm)
const collection_terms = db._collection(module.context.configuration.collectionTerm)
const collection_edges = db._collection(module.context.configuration.collectionEdge)
const collection_links = db._collection(module.context.configuration.collectionLink)
const collection_topos = db._collection(module.context.configuration.collectionTopo)
const view_terms = {
    isArangoCollection: true,
    name: () => terms_view_object.name()
}


/**
 * Class: TermsCache
 *
 * This class functions as an interface between the database and the caller,
 * in which term queries can be cached in order to minimise database access.
 *
 * The class features a static `cache` member. When caching terms the class will
 * check if there is an edge containing the term as the relationship origin with
 * a predicate indicating that the term is an enumeration element: in that case
 * the `_path` property of the edge will be copied in the term top level.
 * Note that this cache is generally used for validation purposes, so stored
 * terms will only feature the `_key`, `_data`, `_rule` and the `_path`
 * properties, this to minimise the size of the cache.
 *
 * The class features a local `batch` member, this is a cache that isused to
 * store terms and edges *before these are stored in the database*.
 * We use this cache to perform validation on a series of terms and edges, and
 * only submit the transaction if all elements are valid. The terms stored in
 * this cache are expected to have all their components: after committing
 * transactions these complete terms will be reduced to the same format as the
 * cache and stored there.
 * The fact that this member is not static means that each instance of this
 * class will have its own batch cache version.
 */
class TermsCache
{
    ///
    // Static cache.
    ///
    static cache = null

    ///
    // List of top level term properties to keep.
    ///
    static props = [
        '_key',
        module.context.configuration.sectionData,
        module.context.configuration.sectionRule,
        module.context.configuration.sectionPath
    ]

    ///
    // Local batch cache.
    ///
    batch = {}

    /**
     * constructor
     * Here we initialise the cache as an empty dictionary.
     */
    constructor()
    {
        ///
        // Initialise cache if not already done.
        ///
        if(TermsCache.cache === null) {
            TermsCache.cache = {}
        }

    } // constructor()

    /**
     * getTerm
     *
     * This method can be used to retrieve a partial term record given the term
     * identifier.
     *
     * The method expects the term global identifier in the `theTermGID`
     * parameter.
     *
     * The method features two flags: `doCache`, and `doBatch`.
     * If `doCache` is true, the method will check if it can find the term in
     * the cache, in that case it will return it. If the `doBatch` flag is set
     * and the term was not found in the cache, the method will try to locate it
     * in the batch cache: if found, the method will return the term record.
     *
     * If the term cannot be found in either the cache or the batch cache, the
     * method will query the database. If the term was found, it will be
     * stripped of all top level properties, except `_key`, `_data` and `_rule`,
     * and the method will check if an edge exists with the term as the `_from`
     * property and the `_predicate_enum-of` as the predicate: in that case the
     * `_path` property of the edge will be added to the term's top level. This
     * is the record that will be returned by the method.
     *
     * If the term was retrieved from the database and the `doCache` flag is
     * set, the record will be added to the cache.
     *
     * If the term was not found, the returned value will be `false`. If the
     * `doMissing` flag is true in this situation, the method will also cache
     * terms that were not found; note that the `doCache` flag should also be
     * set in this case.
     *
     * @param theTermGID {String}: The term global identifier (`_key`).
     * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
     * @param doBatch {Boolean}: Check batch, defaults to `true`.
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Object}: The term record or `false` if the term does not exist.
     */
    getTerm(
        theTermGID,
        doCache = true,
        doBatch = true,
        doMissing = true
    ){
        ///
        // Check cache.
        ///
        if(doCache && TermsCache.cache.hasOwnProperty(theTermGID)) {
            return TermsCache.cache[theTermGID]                         // ==>
        }

        ///
        // Check batch.
        // If batch is on and term is there, return it.
        ///
        if(doBatch && this.batch.hasOwnProperty(theTermGID)) {
            return this.batch[theTermGID]                               // ==>
        }

        ///
        // Check database.
        ///
        const result = db._query(aql`
            LET term = (
              FOR doc IN ${collection_terms}
                FILTER doc._key == ${theTermGID}
              RETURN KEEP(doc,
                '_key',
                ${module.context.configuration.sectionData},
                ${module.context.configuration.sectionRule}
              )
            )
            
            LET enum = (
                LET path = (
                  FOR doc IN ${collection_edges}
                    FILTER doc._from == CONCAT_SEPARATOR('/', ${module.context.configuration.collectionTerm}, ${theTermGID})
                    FILTER doc.${module.context.configuration.predicate} == ${module.context.configuration.predicateEnumeration}

                    FOR item IN doc.${module.context.configuration.sectionPath}
                        RETURN PARSE_IDENTIFIER(item).key
                )
                RETURN
                    (LENGTH(path) > 0) ? { ${module.context.configuration.sectionPath}: path }
                                       : {}
            )
            
            RETURN
              (LENGTH(term) == 1) ?
                (LENGTH(enum) == 1) ? MERGE(term[0], enum[0])
                                    : term[0]
                                  : false
       `).toArray()

        ///
        // Process found term.
        ///
        if(result.length === 1)
        {
            ///
            // Set in cache.
            ///
            if(doCache) {
                TermsCache.cache[theTermGID] = result[ 0 ]
            }

            return result[ 0 ]                                          // ==>
        }

        //
        // Cache missing terms.
        ///
        if(doMissing) {
            TermsCache.cache[theTermGID] = false
        }

        return false                                                    // ==>

    } // getTerm()

    /**
     * getTerms
     *
     * This method will return the list of term records corresponding to the
     * provided list of term global identifiers.
     * The result will be a key/value dictionary in which each element will be
     * the result of the `getTerm()` method applied to the current element.
     *
     * The method assumes the parameter to be an array of strings. If there are
     * eventual duplicates in the string array, these will be reduces to a set.
     *
     * The cache is consulted by this method.
     *
     * @param TheTermGIDList {[String]}: The term global identifiers list.
     * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
     * @param doBatch {Boolean}: Check batch, defaults to `true`.
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Object}: Dictionary of matched terms..
     */
    getTerms(
        TheTermGIDList,
        doCache = true,
        doBatch = true,
        doMissing = true
    ){
        ///
        // Iterate list of term identifiers.
        ///
        const result = {}
        TheTermGIDList.forEach( (term) => {
            result[term] = this.getTerm(term, doCache, doBatch, doMissing)
        })

        return result                                                   // ==>

    } // getTerms()


    /**
     * STATIC METHODS
     */

    /**
     * QueryEnumIdentifierByCode
     *
     * Use this method to retrieve the global identifier of the term satisfying
     * the following conditions:
     *
     * - The term must be an enumeration element in the graph path identified
     * by the `theEnum` parameter.
     * - The term must feature a property, belonging to the code section of the
     * term record, named as the `theField` parameter.
     * - The property named as the `theField` parameter must have a value
     * matching the value of the `theValue` parameter.
     *
     * Any top level property of the code section can be used by this method: it
     * supports scalars and arrays.
     *
     * The cache is not consulted by this method.
     *
     * @param theField {String}: Name of the field.
     * @param theValue {String}: Value of the field.
     * @param theEnum {String}: The enumeration type global identifier.
     * @return {[String]}: The list of term global identifiers matching code and
     * type.
     */
    static QueryEnumIdentifierByCode(theField, theValue, theEnum)
    {
        ///
        // Query the database.
        ///
        return db._query(aql`
            LET terms = (
              FOR term IN ${view_terms}
                SEARCH term.${module.context.configuration.sectionCode}.${theField} == ${theValue}
              RETURN CONCAT_SEPARATOR('/', ${module.context.configuration.collectionTerm}, term._key)
            )
            
            FOR edge IN ${collection_edges}
              FILTER edge._from IN terms
              FILTER edge.${module.context.configuration.predicate} == ${module.context.configuration.predicateEnumeration}
              FILTER CONCAT_SEPARATOR("/", ${module.context.configuration.collectionTerm}, ${theEnum}) IN edge.${module.context.configuration.sectionPath}
            RETURN PARSE_IDENTIFIER(edge._from).key
        `)                                                              // ==>

    } // QueryEnumIdentifierByCode()

    /**
     * QueryEnumTermByCode
     *
     * Use this method to retrieve the record of the term satisfying the
     * following conditions:
     *
     * - The term must be an enumeration element in the graph path identified
     * by the `theEnum` parameter.
     * - The term must feature a property, belonging to the code section of the
     * term record, named as the `theField` parameter.
     * - The property named as the `theField` parameter must have a value
     * matching the value of the `theValue` parameter.
     *
     * Any top level property of the code section can be used by this method: it
     * supports scalars and arrays.
     *
     * The method will return a key/value dictionary in which the key is the
     * term global identifier and the value its record.
     *
     * The cache is not consulted by this method.
     *
     * @param theField {String}: Name of the field.
     * @param theValue {String}: Value of the field.
     * @param theEnum {String}: The enumeration type global identifier.
     * @return {[Object]}: The list of term records matching code and
     * type.
     */
    static QueryEnumTermByCode(theField, theValue, theEnum)
    {
        ///
        // Query the database.
        ///
        return db._query(aql`
            LET terms = (
              FOR term IN ${view_terms}
                SEARCH term.${module.context.configuration.sectionCode}.${theField} == ${theValue}
              RETURN CONCAT_SEPARATOR('/', ${module.context.configuration.collectionTerm}, term._key)
            )
            
            LET enums = (
                FOR edge IN ${collection_edges}
                  FILTER edge._from IN terms
                  FILTER edge.${module.context.configuration.predicate} == ${module.context.configuration.predicateEnumeration}
                  FILTER CONCAT_SEPARATOR("/", ${module.context.configuration.collectionTerm}, ${theEnum}) IN edge.${module.context.configuration.sectionPath}
                RETURN PARSE_IDENTIFIER(edge._from).key
            )
            
            FOR enum IN enums
              FOR term IN ${view_terms}
                SEARCH term._key == enum
              RETURN {
                [enum]: term
              }
        `)                                                              // ==>

    } // QueryEnumTermByCode()

} // Class: TermsCache

module.exports = TermsCache
