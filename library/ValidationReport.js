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
 * - status: A record containing the status code and message.
 * - `descriptor`: The descriptor global identifier.
 */
class ValidationReport
{
	/**
	 * constructor
	 *
	 * The constructor instantiates an idle report.
	 *
	 * The method expects the status code and the descriptor global identifier.
	 *
	 * @param theStatusCode
	 * @param theDescriptor
	 */
	constructor(
		theStatusCode = 'kOK',
		theDescriptor = ''
	){
		///
		// Create status entry.
		///
		this.status = new ValidationStatus(theStatusCode)

		///
		// Set descriptor reference.
		///
		if(theDescriptor.length > 0) {
			this.descriptor = theDescriptor
		}

	} // constructor()

} // Class: ValidationReport

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
		"kRANGE_NOT_AN_OBJECT": {
			"statusCode": -2,
			"statusMessage": {
				"iso_639_3_eng": "The range variable is expected to be an object."
			}
		},
		"kEXPENTING_DATA_DIMENSION": {
			"statusCode": -1,
			"statusMessage": {
				"iso_639_3_eng": `The provided descriptor lacks a required property in its data section: expecting. \`${module.context.configuration.sectionScalar}\`, \`${module.context.configuration.sectionArray}\`, \`${module.context.configuration.sectionSet}\` or \`${module.context.configuration.sectionDict}\``
			}
		},
		"kOK": {
			"statusCode": 0,
			"statusMessage": {
				"iso_639_3_eng": "Idle.",
				"iso_639_3_ita": "Operativo.",
				"iso_639_3_fra": "Opérationnel.",
				"iso_639_3_esp": "Operativo.",
				"iso_639_3_deu": "Betriebsbereit."
			}
		},
		"kNOT_AN_OBJECT": {
			"statusCode": 1,
			"statusMessage": {
				"iso_639_3_eng": "Expecting an object value."
			}
		},
		"kNOT_AN_ARRAY": {
			"statusCode": 2,
			"statusMessage": {
				"iso_639_3_eng": "Expecting an array value."
			}
		},
		"kEMPTY_OBJECT": {
			"statusCode": 3,
			"statusMessage": {
				"iso_639_3_eng": "The object is empty."
			}
		},
		"kUNKNOWN_TERM": {
			"statusCode": 4,
			"statusMessage": {
				"iso_639_3_eng": "Term not found."
			}
		},
		"kNOT_A_DESCRIPTOR": {
			"statusCode": 5,
			"statusMessage": {
				"iso_639_3_eng": "The provided term reference is not a descriptor."
			}
		},
		"kNOT_A_SCALAR": {
			"statusCode": 6,
			"statusMessage": {
				"iso_639_3_eng": "The value is not a scalar."
			}
		},
		"kMISSING_SCALAR_DATA_TYPE": {
			"statusCode": 7,
			"statusMessage": {
				"iso_639_3_eng": `Invalid descriptor: missing data type (${module.context.configuration.scalarType}).`
			}
		},
		"kNOT_A_BOOLEAN": {
			"statusCode": 8,
			"statusMessage": {
				"iso_639_3_eng": "Value is not a boolean."
			}
		},
		"kNOT_AN_INTEGER": {
			"statusCode": 9,
			"statusMessage": {
				"iso_639_3_eng": "Value is not an integer."
			}
		},
		"kNOT_A_NUMBER": {
			"statusCode": 10,
			"statusMessage": {
				"iso_639_3_eng": "Value is not a number."
			}
		},
		"kVALUE_OUT_OF_RANGE": {
			"statusCode": 11,
			"statusMessage": {
				"iso_639_3_eng": "Value out of range."
			}
		},
		"kVALUE_NOT_A_TIMESTAMP": {
			"statusCode": 12,
			"statusMessage": {
				"iso_639_3_eng": "Value cannot be interpreted as a timestamp."
			}
		}
	}

} // Class: ValidationStatus

module.exports = ValidationReport
