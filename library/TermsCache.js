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
              FOR doc IN ${collection_edges}
                FILTER doc._from == CONCAT_SEPARATOR('/', ${module.context.configuration.collectionTerm}, ${theTermGID})
                FILTER doc.${module.context.configuration.predicate} == ${module.context.configuration.predicateEnumeration}
              RETURN KEEP(doc, ${module.context.configuration.sectionPath})
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

} // Class: TermsCache

module.exports = TermsCache
