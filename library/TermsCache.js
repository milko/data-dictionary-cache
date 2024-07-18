'use strict'

/**
 * TermsCache.js
 *
 * This file contains code to provide an interface to the data dictionary
 * database. It is a class that can be used to interrogate the data dictionary
 * database caching all queried terms, to prevent hitting yje database.
 *
 * This cache is implemented as a class.
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
     * matching term in the database. If the term exists, the dictionary will
     * receive an entry indexed by the provided global identifier containing the
     * term's record `_code`, `_data` and `_rule` sections plus the eventual
     * `_path` section of a matching enumeration.
     * If the term does not exist in the database, the cache will be set with an
     * entry valueof `false`, signalling a missing term and to prevent
     * unnecessary reads.
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
                "_key",
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
     * This method will return the terms corresponding to the provided
     * global identifiers list.
     *
     * If the term exists in the cache, the method will return that record.
     * If the term does not exist in the cache, the method will look for a
     * matching term in the database. If the term exists, the dictionary will
     * receive an entry indexed by the provided global identifier containing the
     * term's record `_code`, `_data` and `_rule` sections plus the eventual
     * `_path` section of a matching enumeration.
     * If the term does not exist in the database, the cache will be set with an
     * entry valueof `false`, signalling a missing term and to prevent
     * unnecessary reads.
     *
     * @param theTermsGID {Array}: The term global identifiers list.
     * @return {Array}: List of term records or `false` for missing terms.
     */
    getTerms(theTermsGID)
    {
        return theTermsGID.map(term => {
            return {[term]: this.getTerm(term)}
        })                                                              // ==>

    } // getTerms()

} // Class: TermsCache

module.exports = TermsCache
