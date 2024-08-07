'use strict'

/**
 * TermsCache.js
 *
 * This file contains the TermsCache class which implements a data dictionary
 * database cache and interface for accessing terms.
 *
 * All names are defined in the service settings, except default names, such as
 * the document key in ArangoDB, `_key`.
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
 * The class also features a series of methods for resolving enumerations
 * and two other methods, one to validate collection names and the other to
 * validate a document key value. Note that the latter two methods should always
 * be used to check collection and key names, so that the regular expressions
 * are kept in a single place.
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
     * documentExists
     *
     * This method can be used to check if the provided document reference can
     * be resolved.
     *
     * If `doCache` is true, the method will first check if the cache has a key
     * matching the provided document handle, if that is the case it will return
     * the value. If the handle cannot be matched in the cache, the method will
     * check the database and if the handle can be resolved, `true` will be
     * saved in the cache: if the handle was not resolved, and `doMissing` is
     * true, `false` will be set in the cache.
     *
     * If `doCache` is false, neither matched nor unmatched handles will be
     * stored in the cache.
     *
     * The method will return a boolean indicating whether the handle documentExists in
     * the database or not. In no case the actual record will be stored
     * anywhere.
     *
     * @param theHandle {String}: The document handle (`_id`).
     * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Boolean}: Whether the handle was resolved or not.
     */
    documentExists(
        theHandle,
        doCache = true,
        doMissing = false
    ){
        ///
        // Check cache.
        ///
        if(doCache)
        {
            if(TermsCache.cache.hasOwnProperty(theHandle)) {
                return true                                             // ==>
            }

            if(db._exists(theHandle) === false) {
                if(doMissing) {
                    TermsCache.cache[theHandle] = false
                }

                return false
            }

            if(doMissing) {
                TermsCache.cache[theHandle] = true
            }

            return true                                                 // ==>

        } // Use cache.

        return (db._exists(theHandle) !== false)                        // ==>

    } // documentExists()

    /**
     * collectionExists
     *
     * Use this method to check if the provided collection documentExists.
     *
     * The method will return true if the collection documentExists, false if not.
     *
     * The cache is not consulted by this method.
     *
     * @param theName {String}: Collection name.
     *
     * @return {Boolean}: Returns true if the collection exists, or not.
     */
    collectionExists(theName)
    {
        return (db._collection(theName) !== null)                       // ==>

    } // collectionExists()

    /**
     * getTerm
     *
     * This method can be used to retrieve a partial term record given the term
     * identifier.
     *
     * The method expects the term global identifier in the `theTermGID`
     * parameter.
     *
     * The method features two flags: `doCache`, and `doMissing`.
     *
     * If `doCache` is true, the method will check if it can find the term in
     * the cache, if the term cannot be found, the method will query the
     * database. If the term was found, it will be stripped of all top level
     * properties, except `_key`, `_data` and `_rule`, and the method will check
     * if an edge documentExists with the term as the `_from` property and the
     * `_predicate_enum-of` as the predicate: in that case the `_path` property
     * of the edge will be added to the term's top level. This is the record
     * that will be returned by the method.
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
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Object|Boolean}: The term record or `false` if the term does not exist.
     */
    getTerm(
        theTermGID,
        doCache = true,
        doMissing = false
    ){
        ///
        // Check cache.
        ///
        if(doCache && TermsCache.cache.hasOwnProperty(theTermGID)) {
            return TermsCache.cache[theTermGID]                         // ==>
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
     * getDescriptor
     *
     * This method can be used to retrieve a partial descriptor record given the
     * term identifier.
     *
     * For the most part, this method uses the `getTerm()`, but if the resolved
     * term does not feature a data section, this method will consider this an
     * error and return `false`.
     *
     * The cache is consulted by this method.
     *
     * @param theTermGID {String}: The term global identifier (`_key`).
     * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Object|Boolean}: The term record or `false` if the term does not
     *                           exist or if the term is not a descriptor.
     */
    getDescriptor(
        theTermGID,
        doCache = true,
        doMissing = false
    ){
        ///
        // Resolve term.
        ///
        const term = this.getTerm(theTermGID, doCache, doMissing)
        if(term !== false) {
            if(!term.hasOwnProperty(module.context.configuration.sectionData)) {
                return false                                            // ==>
            }
        }

        return term                                                     // ==>

    } // getDescriptor()

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
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Object}: Dictionary of matched terms.
     */
    getTerms(
        TheTermGIDList,
        doCache = true,
        doMissing = false
    ){
        ///
        // Iterate list of term identifiers.
        ///
        const result = {}
        TheTermGIDList.forEach( (term) => {
            result[term] = this.getTerm(term, doCache, doMissing)
        })

        return result                                                   // ==>

    } // getTerms()

    /**
     * getDescriptors
     *
     * This method will return the list of descriptor records corresponding to
     * the provided list of term global identifiers.
     * The result will be a key/value dictionary in which each element will be
     * the result of the `getDescriptor()` method applied to the current
     * element.
     *
     * The method assumes the parameter to be an array of strings. If there are
     * eventual duplicates in the string array, these will be reduces to a set.
     *
     * The cache is consulted by this method.
     *
     * @param TheTermGIDList {[String]}: The term global identifiers list.
     * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
     * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
     *
     * @return {Object}: Dictionary of matched terms.
     */
    getDescriptors(
        TheTermGIDList,
        doCache = true,
        doMissing = false
    ){
        ///
        // Iterate list of descriptor identifiers.
        ///
        const result = {}
        TheTermGIDList.forEach( (term) => {
            result[term] = this.getDescriptor(term, doCache, doMissing)
        })

        return result                                                   // ==>

    } // getDescriptors()


    /**
     * STATIC ENUMERATION METHODS
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
    queryEnumIdentifierByCode(theField, theValue, theEnum)
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
        `).toArray()                                                    // ==>

    } // queryEnumIdentifierByCode()

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


    /**
     * STATIC VALIDATION METHODS
     */


    /**
     * CheckHandle
     *
     * Use this method to check if the provided handle is correct.
     *
     * The method will not check if the document documentExists in the database, but
     * will only assert that the code is compatible with ArangoDB.
     *
     * The method will return true if the handle is usable, false if not.
     *
     * The cache is not consulted by this method.
     *
     * @param theHandle {String}: Document handle.
     * @return {Boolean}: Returns true if the handle is usable, or not.
     */
    static CheckHandle(theHandle)
    {
        ///
        // Divide the handle into its components.
        ///
        const parts = theHandle.split('/')
        if(parts.length === 2)
        {
            ///
            // Check collection name.
            ///
            if(TermsCache.CheckCollectionName(parts[0]))
            {
                ///
                // Check document key.
                ///
                if(TermsCache.CheckKeyValue(parts[1]))
                {
                    return true                                         // ==>

                } // Document key OK.

            } // Collection name OK.

        } // Has one slash.

        return false                                                    // ==>

    } // CheckHandle()

    /**
     * CheckCollectionName
     *
     * Use this method to check if the provided collection name is valid.
     *
     * The method will return true if the name is usable, false if not.
     *
     * The cache is not consulted by this method.
     *
     * @param theName {String}: Document handle.
     *
     * @return {Boolean}: Returns true if the collection name is usable, or not.
     */
    static CheckCollectionName(theName)
    {
        ///
        // Init local storage.
        ///
        const regexp = new RegExp("^[a-zA-Z0-9-_]{1,128}$")

        return Boolean(theName.match(regexp))                           // ==>

    } // CheckCollectionName()

    /**
     * CheckKeyValue
     *
     * Use this method to check if the provided key value is valid.
     *
     * The method will return true if the value is usable, false if not.
     *
     * The cache is not consulted by this method.
     *
     * @param theValue {String}: Document handle.
     *
     * @return {Boolean}: Returns true if the handle is usable, or not.
     */
    static CheckKeyValue(theValue)
    {
        ///
        // Init local storage.
        ///
        const regexp = new RegExp("^[a-zA-Z0-9-.@+,=;$!*'%()_]{1,254}$")

        return Boolean(theValue.match(regexp))                           // ==>

    } // CheckKeyValue()


    /**
     * STATIC SYMBOLS
     */


    /**
     * DefaultNamespaceKey
     *
     * Use this method to get the default namespace document key.
     *
     * The default namespace should only be referenced by the namespace
     * property in the code section of the term. When setting the namespace to
     * an empty string, it means that the current term has the default
     * namespace. User defined terms should not reference this namespace.
     * Since it is forbidden to have an empty string as key, we assign a
     * specific value to reference the default namespace. Note that this term
     * should always be expected to exist in the database.
     *
     * The method will return the document key of the default namespace term.
     *
     * The cache is not consulted by this method.
     *
     * @return {String}: Returns the document key of the default namespace term.
     */
    static DefaultNamespaceKey()
    {
        return ';'                                                      // ==>

    } // DefaultNamespaceKey()

} // Class: TermsCache

module.exports = TermsCache
