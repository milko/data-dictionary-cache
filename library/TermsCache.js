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
 * Class: Database
 */
class TermsCache
{
    ///
    // Static members.
    ///
    static cache = null

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
     * This method will return the term corresponding to the provided
     * global identifier.
     *
     * If the term exists in the cache, the method will return that record.
     * If the term does not exist in the cache, the method will look for a
     * matching term in the database.
     * If the term exists, the dictionary will receive an entry, indexed by the
     * provided global identifier, containing the term's record `_code`, `_data`
     * and `_rule` sections plus the eventual `_path` section if the term is an
     * enumeration element.
     * If the term does not exist in the database, the cache will be set with an
     * entry value of `false`, signalling a missing term; this to prevent
     * unnecessary reads.
     *
     * The method assumes the parameter to be a string.
     *
     * @param theTermGID {String}: The term global identifier.
     * @return {Object}: The term record or `false` if the term does not exist.
     */
    getTerm(theTermGID)
    {
        ///
        // Check cache.
        ///
        if(TermsCache.cache.hasOwnProperty(theTermGID)) {
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
                ${module.context.configuration.sectionCode},
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
                        RETURN PARSE_KEY(item)
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
        // Set cache.
        ///
        TermsCache.cache[theTermGID] = (result.length === 1)
            ? result[ 0 ]
            : false

        return TermsCache.cache[theTermGID]                             // ==>

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
     * @return {Object}: Dictionary of matched terms..
     */
    getTerms(TheTermGIDList)
    {
        ///
        // Iterate list of term identifiers.
        ///
        const result = {}
        TheTermGIDList.forEach(term => {
            result[term] = this.getTerm(term)
        })

        return result                                                   // ==>

    } // getTerms()

    /**
     * getEnumByLID
     *
     * This method can be used to retrieve the global identifier of the term
     * whose local identifier matches the provided `code` and is an enumeration
     * element of the graph whose path matches the provided `type` parameter.
     *
     * The code provided in the `theCode` parameter must match the term local
     * identifier (`_lid`). All edges featuring these matching terms as
     * relationship sources (`_from`) will be selected and further trimmed by
     * only selecting those edges whose paths list (`_path`) contain the
     * enumeration type global identifier provided in the `theType`
     * parameter. The method will return the global identifier of the term that
     * holds the provided local identifier and belongs to the provided graph
     * path.
     *
     * The method should return a single element or no elements if there were no
     * matches. If the method returns more than one element, it means that the
     * enumerations graph structure is probably corrupt, this option should be
     * handled by the caller.
     *
     * Use this method when you expect enumeration local codes (local
     * identifiers) rather than full codes (global identifiers).
     *
     * The cache is not consulted by this method.
     *
     * @param theCode {String}: The enumeration local identifier.
     * @param theType {String}: The enumeration type global identifier.
     * @return {[String]}: The list of term global identifiers matching code and
     * type.
     */
    getEnumByLID(theCode, theType)
    {
        ///
        // Match terms matching code and edges matching path.
        ///
        return TermsCache.getEnumGIDByCode(
            module.context.configuration.localIdentifier,
            theCode,
            theType
        )                                                               // ==>

    } // getEnumByLID()

    /**
     * getTermByAID
     *
     * This method can be used to retrieve the global identifier of the term
     * whose official identifiers match the provided `code` and is an
     * enumeration element of the graph whose path matches the provided `type`
     * parameter.
     *
     * The code provided in the `theCode` parameter must match at least one of
     * the term's official identifiers (`_aid`). All edges featuring these
     * matching terms as relationship sources (`_from`) will be selected and
     * further trimmed by only selecting those edges whose paths list (`_path`)
     * contain the enumeration type global identifier provided in the `theType`
     * parameter. The method will return the global identifier of the term that
     * holds the provided official identifier and belongs to the provided graph
     * path.
     *
     * The method should return a single element or no elements if there were no
     * matches. If the method returns more than one element, it means that the
     * enumerations graph structure is probably corrupt, this option should be
     * handled by the caller.
     *
     * Use this method when you expect enumeration official codes (official
     * identifiers) rather than full codes (global identifiers).
     *
     * The cache is not consulted by this method.
     *
     * @param theCode {String}: The enumeration local identifier.
     * @param theType {String}: The enumeration type global identifier.
     * @return {[String]}: The list of term global identifiers matching code and
     * type.
     */
    getEnumByAID(theCode, theType)
    {
        ///
        // Match terms matching code and edges matching path.
        ///
        return TermsCache.getEnumGIDByCode(
            module.context.configuration.officialIdentifiers,
            theCode,
            theType
        )                                                               // ==>

    } // getEnumByAID()

    /**
     * getTermByPID
     *
     * This method can be used to retrieve the global identifier of the term
     * whose provider identifiers match the provided `code` and is an
     * enumeration element of the graph whose path matches the provided `type`
     * parameter.
     *
     * The code provided in the `theCode` parameter must match at least one of
     * the term's provider identifiers (`_pid`). All edges featuring these
     * matching terms as relationship sources (`_from`) will be selected and
     * further trimmed by only selecting those edges whose paths list (`_path`)
     * contain the enumeration type global identifier provided in the `theType`
     * parameter. The method will return the global identifier of the term that
     * holds the provided provider identifier and belongs to the provided graph
     * path.
     *
     * The method should return a single element or no elements if there were no
     * matches. If the method returns more than one element, it means that the
     * enumerations graph structure is probably corrupt, this option should be
     * handled by the caller.
     *
     * Use this method when you expect enumeration provider codes (official
     * identifiers) rather than full codes (global identifiers).
     *
     * The cache is not consulted by this method.
     *
     * @param theCode {String}: The enumeration local identifier.
     * @param theType {String}: The enumeration type global identifier.
     * @return {[String]}: The list of term global identifiers matching code and
     * type.
     */
    getEnumByPID(theCode, theType)
    {
        ///
        // Match terms matching code and edges matching path.
        ///
        return TermsCache.getEnumGIDByCode(
            module.context.configuration.providerIdentifiers,
            theCode,
            theType
        )                                                               // ==>

    } // getEnumByPID()


    /**
     * STATIC METHODS
     */

    /**
     * getEnumGIDByCode
     *
     * Use this method to retrieve the global identifier of the term satisfying
     * the following conditions:
     *
     * - The term must be an enumeration element in the graph path identified
     * by the `theEnum` parameter.
     * - The term must feature a property that belongs to the code section of
     * the term record named as the `theField` parameter.
     * - The property named as the `theField` parameter must have a value
     * matching the value of the `theValue` parameter.
     * - The property referenced in the `theField` parameter can either be a
     * scalar or an array.
     *
     * The method should return a single element or no elements if there were no
     * matches. If the method returns more than one element, it means that the
     * enumerations graph structure is probably corrupt, this option should be
     * handled by the caller.
     *
     * The cache is not consulted by this method.
     *
     * @param theField {String}: Name of the field.
     * @param theValue {String}: Value of the field.
     * @param theEnum {String}: The enumeration type global identifier.
     * @return {[String]}: The list of term global identifiers matching code and
     * type.
     */
    static getEnumGIDByCode(theField, theValue, theEnum)
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
            RETURN PARSE_KEY(edge._from)
        `)                                                              // ==>

    } // getEnumGIDByCode()

} // Class: TermsCache

module.exports = TermsCache
