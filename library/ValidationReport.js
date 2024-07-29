'use strict'

/**
 * ValidationReport.js
 *
 * This file contains the ValidationReportand ValidationStatus class
 * definitions.
 */


/**
 * Class: ValidationReport
 *
 * This class instantiates an object representing the report of a validation
 * session. The object feature the following data members:
 *
 * - `status`: An instance of the ValidationStatus class that contains the
 *             code, message and status of the validation process.
 * - `descriptor`: The global identifier of the term corresponding to the value
 *                 descriptor.
 * - `value`: The incorrect value.
 * - `changes`: During the validation process, if required, there can be cases
 *              in which an enumeration code may be resolved in case it does
 *              not match exactly the full code: this field is an object that
 *              logs such changes: `field` contains the descriptor global
 *              identifier, `original` contains the original code and `resolved`
 *              contains the resolved code. Changes will usually be set when
 *              the status is idle, if there is an error the status will be
 *              replaced, but this is not an issue, since these changes are
 *              meant for correct values.
 * - Other members providing information on the eventual errors.
 *
 * A report whose `status.code` is `0` means that there was no error; the
 * presence of the `changes` member indicates that some data was corrected.
 * Any `status.code` value other than `0` is considered an error.
 */
class ValidationReport
{
	/**
	 * constructor
	 *
	 * The constructor instantiates a report by providing a status code and an
	 * eventual descriptor global identifier.
	 *
	 * By default, the constructor will instantiate an idle status without a
	 * descriptor reference using the default language. If you provide a
	 * descriptor reference, bear in mind that term references are not checked
	 * here.
	 *
	 * @param theStatusCode {Number}: The status code.
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theValue {Array|Object|Boolean|Number|String}: The incorrect value.
	 * @param theLanguage {String}: The message language code.
	 */
	constructor(
		theStatusCode = 'kOK',
		theDescriptor = '',
		theValue = null,
		theLanguage = module.context.configuration.language
	){
		///
		// Create status entry.
		///
		this.status = new ValidationStatus(theStatusCode, theLanguage)

		///
		// Set descriptor reference.
		///
		if(theDescriptor.length > 0) {
			this.descriptor = theDescriptor
		}

		///
		// Set value reference.
		///
		if(theValue !== null) {
			this.value = theValue
		}

	} // constructor()

} // Class: ValidationReport

/**
 * Class: ValidationStatus
 *
 * This class implements a status report consisting of two members:
 *
 * - `code`: The status code.
 * - `message`: The status message.
 *
 * A code of `0` indicates an idle status, any other value indicates an error.
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
	 * and exception, so make tests before deploying validation procedures.
	 *
	 * @param theCode {String}: The status code constant.
	 * @param theLanguage {string}: The status message language.
	 */
	constructor(theCode, theLanguage)
	{
		///
		// Check status code.
		///
		if(!ValidationStatus.statusRecords.hasOwnProperty(theCode)) {
			throw new Error(
				`Accessing unknown status code: [${theCode}].`
			)                                                           // ==>
		}

		///
		// Select static status record.
		///
		const status = ValidationStatus.statusRecords[theCode]

		///
		// Set status code.
		///
		this.code = status.statusCode

		///
		// Set status message.
		// If provided language cannot be found, use default language.
		// It is assumed that all messages have the default language version.
		///
		this.message = (status.statusMessage.hasOwnProperty(theLanguage))
						   ? status.statusMessage[theLanguage]
						   : status.statusMessage[module.context.configuration.language]

	} // constructor()

	/**
	 * Static members.
	 *
	 * Here we store the status records.
	 */
	static statusRecords =
	{
		"kNINVALID_DATA_KIND_OPTION": {
			"statusCode": -4,
			"statusMessage": {
				"iso_639_3_eng": "Invalid data section: string key data type features an invalid option."
			}
		},
		"kNOT_ARRAY_DATA_KIND": {
			"statusCode": -3,
			"statusMessage": {
				"iso_639_3_eng": "Invalid data section: the data kind is not an array."
			}
		},
		"kRANGE_NOT_AN_OBJECT": {
			"statusCode": -2,
			"statusMessage": {
				"iso_639_3_eng": "Invalid data section: the range variable is expected to be an object."
			}
		},
		"kEXPECTING_DATA_DIMENSION": {
			"statusCode": -1,
			"statusMessage": {
				"iso_639_3_eng": `Invalid data section: expecting. \`${module.context.configuration.sectionScalar}\`, \`${module.context.configuration.sectionArray}\`, \`${module.context.configuration.sectionSet}\` or \`${module.context.configuration.sectionDict}\`, but none provided.`
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
				"iso_639_3_eng": "Expecting an object."
			}
		},
		"kNOT_AN_ARRAY": {
			"statusCode": 2,
			"statusMessage": {
				"iso_639_3_eng": "Expecting an array."
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
				"iso_639_3_eng": "The term reference is not a descriptor."
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
				"iso_639_3_eng": `Invalid descriptor: missing data type.`
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
		"kVALUE_LOW_RANGE": {
			"statusCode": 12,
			"statusMessage": {
				"iso_639_3_eng": "Value is less than valid range."
			}
		},
		"kVALUE_HIGH_RANGE": {
			"statusCode": 13,
			"statusMessage": {
				"iso_639_3_eng": "Value is higher than valid range."
			}
		},
		"kVALUE_NOT_A_TIMESTAMP": {
			"statusCode": 14,
			"statusMessage": {
				"iso_639_3_eng": "Value cannot be interpreted as a timestamp."
			}
		},
		"kUNSUPPORTED": {
			"statusCode": 15,
			"statusMessage": {
				"iso_639_3_eng": "The value does not correspond to a supported option."
			}
		},
		"kNOT_A_STRING": {
			"statusCode": 16,
			"statusMessage": {
				"iso_639_3_eng": "Value is not a string."
			}
		},
		"kNO_MATCH_REGEXP": {
			"statusCode": 17,
			"statusMessage": {
				"iso_639_3_eng": "String does not match regular expression."
			}
		},
		"kEMPTY_KEY": {
			"statusCode": 18,
			"statusMessage": {
				"iso_639_3_eng": "The provided key cannot be an empty string."
			}
		},
		"kNOT_AN_ENUM": {
			"statusCode": 19,
			"statusMessage": {
				"iso_639_3_eng": "The provided key is not an enumeration element reference."
			}
		},
		"kNOT_A_STRUCTURE_DEFINITION": {
			"statusCode": 20,
			"statusMessage": {
				"iso_639_3_eng": "The provided key is not a structure definition reference."
			}
		},
		"kNO_REF_DEFAULT_NAMESPACE_KEY": {
			"statusCode": 21,
			"statusMessage": {
				"iso_639_3_eng": "You cannot use this value as the key for a term: it is reserved to the default namespace: use an empty string to reference the default namespace."
			}
		},
		"kUNKNOWN_DOCUMENT": {
			"statusCode": 22,
			"statusMessage": {
				"iso_639_3_eng": "Document not found in the database."
			}
		},
		"kBAD_KEY_VALUE": {
			"statusCode": 23,
			"statusMessage": {
				"iso_639_3_eng": "Invalid value for document key."
			}
		},
		"kBAD_HANDLE_VALUE": {
			"statusCode": 24,
			"statusMessage": {
				"iso_639_3_eng": "Invalid value for document handle."
			}
		},
		"kBAD_COLLECTION_NAME": {
			"statusCode": 25,
			"statusMessage": {
				"iso_639_3_eng": "Invalid value for collection name."
			}
		},
		"kUNKNOWN_COLLECTION": {
			"statusCode": 26,
			"statusMessage": {
				"iso_639_3_eng": "Collection does not exist in the database."
			}
		}
	}

} // Class: ValidationStatus

module.exports = ValidationReport
