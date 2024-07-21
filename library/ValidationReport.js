'use strict'

/**
 * ValidationReport.js
 *
 * This file contains the ValidationReport class which implements a report that
 * will be used to return status information regarding validation procedures.
 */


/**
 * Class: ValidationReport
 *
 * The class implements the following data members:
 * - status: A record containing the status code and message in the default
 */
class ValidationReport
{
	constructor(
		theStatusCode = 'kOK',
		theDescriptor = ''
	){
		///
		// Create status entry.
		///
		this.status = new ValidationStatus(theStatusCode)

		///
		// Set descriptir reference.
		///
		if(theDescriptor.length > 0) {
			this.descriptor = theDescriptor
		}

	} // constructor()

} // Class: TermsCache

/**
 * Class: ValidationStatus
 *
 * This class implements a status object that contains two elements: the
 * `statusCode` which is an integer holding the numeric code corresponding to
 * the current status, and `statusMessage` that contains a set of messages, each
 * in a different language, describing the current status. The messages in
 * different languages are implemented as the `_info` section elements of the
 * term record.
 */
class ValidationStatus
{
	/**
	 * constructor
	 *
	 * We initialise the object by providing the status code,
	 * The object can be initialised without parameters: it will instantiate an
	 * idle status.
	 *
	 * If the provided status code cannot be found, the constructor will raise
	 * and exception.
	 *
	 * @param theStatusCode {String}: The status code constant, default to `kIdle`.
	 * @param theDefaultLanguage {string}: The default language for the status messages.
	 */
	constructor(
		theStatusCode = 'kOK',
		theDefaultLanguage = module.context.configuration.language
	){
		///
		// Check status code.
		///
		if(!ValidationStatus.statusRecords.hasOwnProperty(theStatusCode)) {
			throw new Error(
				`Accessing unknown status code: [${theStatusCode}].`
			)                                                           // ==>
		}

		///
		// Save status record.
		///
		const status = ValidationStatus.statusRecords[theStatusCode]

		///
		// Set status code.
		///
		this.statusCode = status.statusCode

		///
		// Set status message.
		///
		this.statusMessage = (status.statusMessage.hasOwnProperty(theDefaultLanguage))
						   ? status.statusMessage[theDefaultLanguage]
						   : status.statusMessage[module.context.configuration.language]

	} // constructor()

	/**
	 * Static members.
	 *
	 * Here we store the status records.
	 */
	static statusRecords =
	{
		"kOK": {
			"statusCode": 0,
			"statusMessage": {
				"iso_639_3_eng": "Idle.",
				"iso_639_3_ita": "Operativo.",
				"iso_639_3_fra": "Opérationnel.",
				"iso_639_3_esp": "Operativo.",
				"iso_639_3_deu": "Betriebsbereit."
			}
		}
	}

} // Class: ValidationStatus

module.exports = ValidationReport
