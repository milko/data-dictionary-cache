'use strict'

/**
 * Validator
 *
 * This file contains the Validator class which implements a class that can be
 * used to validate entries destined to the data dictionary and other
 * collections depending on the data dictionary.
 */

/**
 * Modules.
 */
const TermsCache = require('./TermsCache')
const ValidationReport = require('./ValidationReport')

class Validator
{
	/**
	 * Constructor
	 *
	 * The constructor will instantiate an idle status and a cache.
	 */
	constructor()
	{
		///
		// Init cache.
		///
		this.cache = new TermsCache()

		///
		// Init status.
		///
		this.report = new ValidationReport()

	} // constructor()

} // class: Validator

module.exports = Validator
