'use strict'

//
// Import frameworks.
//
const _ = require('lodash')

/**
 * Validator
 *
 * This file contains the Validator class which can be used to validate entries
 * data associated with data dictionary terms.
 *
 * The object is initialised by providing the value to be checked and,
 * eventually, the term global identifier of the descriptor corresponding to the
 * value.
 *
 * If the term reference was not provided, the value must be an object or an
 * array of objects; the objects cannot be empty. If the descriptor was
 * provided, the class validate() method can be called to perform the
 * validation.
 *
 * The result of the validation can be found in the `status` member of the
 * object. Status code 0 means that there were no errors.
 *
 * If you provided `true` to the `doResolve` parameter of the constructor,
 * when possible, values that do not match will try to be resolved, this
 * applies to time stamps, where string values will be interpreted, or for
 * enumerations, where values will be matched to the descriptor code section
 * property indicated in the constructor's `resolveCode`parameter. Enumerations
 * that have preferred values will also be resolved.
 */

/**
 * Modules.
 */
const TermsCache = require('./TermsCache')
const ValidationReport = require('./ValidationReport')
const validator = require("./Validator");

class Validator
{
	/**
	 * Constructor
	 *
	 * The constructor expects the value to be validated and the eventual
	 * descriptor of the value. If you omit the descriptor, the value is
	 * assumed to either be an object, whose properties will be validated, or
	 * an array of such objects. An exception will be raised if the value does
	 * not conform or if the eventual provided term reference cannot be
	 * resolved, or if the resolved term is not a descriptor.
	 *
	 * The constructor will initialise three members:
	 *
	 * - `cache` It implements the database interface and the cache.
	 * - `report`: It contains the status report.
	 * - `value`: The value to be validated.
	 * - `term`: The eventual descriptor record.
	 * - `zip`: A flag indicating whether to zip the descriptor to the array
	 * elements.
	 * - `resolve`: Resolve values flag.
	 * - `codes`: Code section property to probe when resolving enumerations.
	 *
	 * @param theValue {Array|Object|Number|String}: The value to be validated.
	 * @param theTerm {String}: The descriptor of the value, use empty string to
	 * ignore.
	 * @param doZip {Boolean}: If true, the descriptor is required and the value
	 * must be an array of objects: the descriptor applies to each element of
	 * the array.
	 * @param doResolve {Boolean}: If set, eventual resolved values will be
	 * updated in the original object.
	 * @param resolveCode {String}: Which code section property to probe when
	 * trying to resolve terms, only for enumerations (default to local
	 * identifier).
	 */
	constructor(
		theValue,
		theTerm = '',
		doZip = false,
		doResolve = false,
		resolveCode = module.context.configuration.localIdentifier
	){
		///
		// Init cache.
		///
		this.cache = new TermsCache()

		///
		// Init global flags.
		///
		this.zip = doZip
		this.resolve = doResolve
		this.codes = resolveCode

		///
		// Init descriptor.
		///
		if(theTerm.length > 0)
		{
			const term = this.getDescriptor(theTerm, true, false)
			if(term === false)
			{
				throw new Error(
					`Provided descriptor, ${theTerm}, either does not exist or is not a descriptor.`
				)                                                       // ==>
			}

			///
			// Init term.
			///
			this.term = term

			///
			// Handle zip.
			///
			if(doZip)
			{
				if(!Validator.IsArray(theValue)) {
					throw new Error(
						"You set the zip flag but not provided an array value."
					)                                                   // ==>
				}

			} // Zip values to descriptor.

		} // Provided descriptor.

		///
		// Handle no descriptor.
		///
		else
		{
			///
			// Assert non-empty object.
			//
			if(Validator.IsObject(theValue))
			{
				if(Object.keys(theValue).length === 0)
				{
					throw new Error(
						"Value provided is an empty object."
					)                                                   // ==>
				}

			} // Provided an object.

			///
			// Assert non-empty array of objects.
			///
			else if(Validator.IsArray(theValue))
			{
				theValue.forEach( (item) =>
				{
					if (Validator.IsObject(item))
					{
						if (Object.keys(item).length === 0)
						{
							throw new Error(
								"Found an empty object among array elements."
							)                                           // ==>
						}
					}
					else
					{
						throw new Error(
							"Found an array element that is not an object."
						)                                               // ==>
					}
				})

			} // Provided an array.

			else {
				throw new Error(
					"Expecting either an object or an array of objects."
				)                                                       // ==>

			} // Provided a non-object scalar.

			///
			// Assert no zip.
			///
			if(doZip) {
				throw new Error(
					"Zip flag is set, but no descriptor was provided."
				)                                                       // ==>

			} // Set zip flag.

		} // No descriptor provided.

		///
		// Init value.
		///
		this.value = theValue

	} // constructor()

	/**
	 * validate
	 *
	 * This method can be used to launch the validation process, it will
	 * return a boolean indicating whether the validation succeeded, `true`, or
	 * failed, `false`.
	 *
	 * The outcome of the validation will be published in the `report` data
	 * member: a status code of `0` indicates an idle status, any other value
	 * means there was an error. Eventual resolved values will be listed in the
	 * `resolved` data member which is an array of objects containing three
	 * properties: `descriptor` contains the descriptor key, `old` contains the
	 * original value and `resolved` contains the resolved value. If the
	 * property exists it means there were resolutions.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validate()
	{
		///
		// Handle zipped data.
		///
		if(this.hasOwnProperty('zip'))
		{
			this.report = []
			[Array(this.value.length).keys()].forEach( (index) => {
				this.report[index] = new ValidationReport()
				this.validateValueType(
					this.value[index],
					this.term,

				)
			})

		} // Zipped data.

		return true;                                                    // ==>

	} // validate()


	/**
	 * TOP LEVEL VALIDATION INTERFACE
	 */


	/**
	 * validateValue
	 *
	 * This method will validate the value/descriptore pair constituted by the
	 * provided descriptor term record and the value to be validated.
	 *
	 * If the descriptor was provided as a termglobal identifier, it will be
	 * resolved. If the term does not exist, or if the identifier references a
	 * term that is not a descriptor, the method will return an error.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValue {String|Number|Object|Array}: The descriptor value.
	 * @param theDescriptor {String|Object}: The descriptor global identifier or
	 * term record.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateValue(theValue, theDescriptor, theParent = null)
	{
		///
		// Locate descriptor.
		///
		if(!Validator.IsObject(theDescriptor)) {
			const descriptor =
				this.getDescriptor(
					theDescriptor,
					true,
					false,
					theParent
				)
			if(descriptor === false) {
				return false                                            // ==>
			}
		}

		///
		// Handle descriptor type.
		///
		return this.validateValueType(
			theValue, descriptor, theParent
		)                                                               // ==>

	} // validateValue()


	/**
	 * PRIVATE VALIDATION INTERFACE
	 */


	/**
	 * validateObject
	 *
	 * Use this method to validate the provided object, all properties that are
	 * known terms will be considered descriptors and their values checked.
	 *
	 * The outcome of the validation will be published in the `report` data
	 * member. If the validation failed, the report might also hold data members
	 * referencing parts of the offending values.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValue {Object}: Object to validate.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateObject(theParent = null)
	{
		///
		// Handle object.
		///
		if(Validator.IsObject(theValue))
		{
			///
			// Assert not empty.
			///
			if(Object.keys(theValue).length === 0) {
				this.report = new ValidationReport('kEMPTY_OBJECT')
				if(theParent !== null) {
					this.report.parentValue = theParent
				}
				this.report.value = theValue

				return false                                            // ==>
			}

			///
			// Iterate object properties.
			///
			Object.keys(theValue).some( (key) => {
				return this.validateValue(key, theValue[key])
			})

			return this.report.statusCode === 0                         // ==>

		} // Value is an object.

		this.report = new ValidationReport('kNOT_AN_OBJECT')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.value = theValue

		return false                                                    // ==>

	} // validateObject()

	/**
	 * validateObjects
	 *
	 * Use this method to validate the provided list of objects. Each element of
	 * the provided list is expected to be an object and each property that is a
	 * known terms will be considered a descriptor and their values checked.
	 *
	 * The outcome of the validation will be published in the `report` data
	 * member. If the validation failed, the report might also hold data members
	 * referencing parts of the offending values.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValues {[Object]}: The object value.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateObjects(theValues, theParent = null)
	{
		///
		// Handle array of objects.
		///
		if(Validator.IsArray(theValues))
		{
			theValues.some( (item) => {
				return this.validateObject(item, theValues)
			})

			return this.report.statusCode === 0                         // ==>

		} // Value is an array.

		this.report = new ValidationReport('kNOT_AN_ARRAY')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.value = theValues

		return false                                                    // ==>

	} // validateObjects()

	/**
	 * validateObjectList
	 *
	 * Use this method to validate the provided list of objects against the
	 * provided descriptor. Each element of the provided list is expected to be
	 * an object belonging to the provided descriptor, and each property that is
	 * a known terms will be considered a descriptor and their values checked.
	 *
	 * The outcome of the validation will be published in the `report` data
	 * member. If the validation failed, the report might also hold data members
	 * referencing parts of the offending values.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValues {[Object]}: The object value.
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateObjectList(theValues, theDescriptor, theParent = null)
	{
		///
		// Locate descriptor.
		///
		const descriptor =
			this.getDescriptor(
				theDescriptor,
				true,
				true,
				false,
				theParent
			)
		if(descriptor === false) {
			return false                                                // ==>
		}

		///
		// Handle array of objects.
		///
		if(Validator.IsArray(theValues))
		{
			theValues.some( (item) => {
				return this.validateValue(theValues, item, theParent)
			})

			return this.report.statusCode === 0                         // ==>

		} // Value is an array.

		this.report = new ValidationReport('kNOT_AN_ARRAY')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.value = theValues

		return false                                                    // ==>

	} // validateObjectList()

	/**
	 * validateDescriptor
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value.
	 *
	 * If the descriptor does *not correspond* to any existing terms, the value
	 * will be considered *incorrect*.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValue {String|Number|Object|Array}: The descriptor value.
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateDescriptor(theValue, theDescriptor, theParent = null)
	{
		///
		// Locate descriptor.
		///
		const descriptor =
			this.getDescriptor(
				theDescriptor,
				true,
				false,
				theParent
			)
		if(descriptor === false) {
			return false                                                // ==>
		}

		///
		// Check data type.
		///
		return this.validateValueType(
			theValue, descriptor, theParent
		)                                                               // ==>

	} // validateDescriptor()

	/**
	 * validateValueType
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value.
	 *
	 * The provided descriptor is expected to be a valid term, and the term must
	 * feature the data section, thus be a descriptor.
	 *
	 * The method will scan the term data section resolving the eventual
	 * container types until it reaches the scalar dimension, where it will
	 * check the value's data type.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValue {String|Number|Object|Array}: The descriptor value.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateValueType(theValue, theDescriptor, theParent = null)
	{
		///
		// Traverse data section.
		///
		const dataSection = theDescriptor[module.context.configuration.sectionData]
		if(dataSection.hasOwnProperty(module.context.configuration.sectionScalar)) {
			return this.validateScalar(
				theValue,
				theDescriptor._key,
				dataSection[module.context.configuration.sectionScalar],
				theParent
			)                                                           // ==>
		} else if(dataSection.hasOwnProperty(module.context.configuration.sectionArray)) {
			return this.validateArray(
				theValue,
				theDescriptor._key,
				dataSection[module.context.configuration.sectionArray],
				theParent
			)                                                           // ==>
		} else if(dataSection.hasOwnProperty(module.context.configuration.sectionSet)) {
			return this.validateSet(
				theValue,
				theDescriptor._key,
				dataSection[module.context.configuration.sectionSet],
				theParent
			)                                                           // ==>
		} else if(dataSection.hasOwnProperty(module.context.configuration.sectionDict)) {
			return this.validateDict(
				theValue,
				theDescriptor._key,
				dataSection[module.context.configuration.sectionDict],
				theParent
			)                                                           // ==>
		}

		this.report = new ValidationReport('kEXPENTING_DATA_DIMENSION')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.value = theDescriptor

		return false                                                    // ==>

	} // validateValueType()


	/**
	 * DATA DIMENSION METHODS
	 */


	/**
	 * validateScalar
	 *
	 * This method will check if the value is a scalar and then attempt to
	 * check if the value corresponds to the declared data type.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateScalar(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Handle scalar.
		///
		if(!Validator.IsArray(theValue))
		{
			///
			// Handle type.
			///
			if(theSection.hasOwnProperty(module.context.configuration.scalarType))
			{
				///
				// Parse data type.
				///
				let pass = true
				switch(theSection[module.context.configuration.scalarType])
				{
					case module.context.configuration.typeBoolean:
						return this.validateBoolean(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>

					case module.context.configuration.typeInteger:
						return this.validateInteger(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>

					case module.context.configuration.typeNumber:
						return this.validateNumber(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>

					case module.context.configuration.typeTypestamp:
						return this.validateTimestamp(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>

					case module.context.configuration.typeString:
						return true

					case module.context.configuration.typeKey:
						return true

					case module.context.configuration.typeHandle:
						return true

					case module.context.configuration.typeEnum:
						return true

					case module.context.configuration.typeDate:
						return true

					case module.context.configuration.typeStruct:
						return true

					case module.context.configuration.typeObject:
						return true

					case module.context.configuration.typeGeoJSON:
						return true

				} // Parsing data type.

				if(theParent !== null) {
					this.report.parentValue = theParent
				}
				this.report.descriptor = theDescriptor
				this.report.value = theValue

				return false                                            // ==>

			} // Has data type.

			this.report = new ValidationReport('kMISSING_SCALAR_DATA_TYPE')
			if(theParent !== null) {
				this.report.parentValue = theParent
			}
			this.report.descriptor = theDescriptor
			this.report.value = theSection

			return false                                                // ==>

		} // Is a scalar.

		this.report = new ValidationReport('kNOT_A_SCALAR')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.descriptor = theDescriptor
		this.report.value = theValue

		return false                                                    // ==>

	} // validateScalar()

	/**
	 * validateArray
	 *
	 * This method will check if the value is an array, and then it will
	 * traverse the data definition until it finds a scalar type.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {Array}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateArray(theValue, theDescriptor, theSection, theParent)
	{

		return true                                                    // ==>

	} // validateArray()

	/**
	 * validateSet
	 *
	 * This method will check if the value is an array of unique values, and
	 * then it will pass the value to a method that will validate the scalar
	 * element value type.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {Array}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateSet(theValue, theDescriptor, theSection, theParent)
	{

		return true                                                    // ==>

	} // validateSet()

	/**
	 * validateDict
	 *
	 * This method will check if the value is an object, and then it will pass
	 * the keys and values to the dictionary validation method.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateSet(theValue, theDescriptor, theSection, theParent)
	{

		return true                                                    // ==>

	} // validateSet()


	/**
	 * DATA TYPE METHODS
	 */


	/**
	 * validateBoolean
	 *
	 * This method will validate the provided boolean value.
	 *
	 * The method only asserts the value is boolean.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateBoolean(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check if boolean.
		///
		if(Validator.IsBoolean(theValue)) {
			return true                                                 // ==>
		}

		this.report = new ValidationReport('kNOT_A_BOOLEAN')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.descriptor = theDescriptor
		this.report.value = theValue

		return false                                                    // ==>

	} // validateBoolean()

	/**
	 * validateInteger
	 *
	 * This method will validate the provided integer value.
	 *
	 * The method will first assert if the value is an integer.
	 * The method will then assert the value is within valid range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateInteger(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check if integer.
		///
		if(Validator.IsInteger(theValue)) {
			///
			// Check if in range.
			///
			return this.ValidateNumericRange(
				theValue, theDescriptor, theSection, theParent
			)                                                           // ==>
		}

		this.report = new ValidationReport('kNOT_AN_INTEGER')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.descriptor = theDescriptor
		this.report.value = theValue

		return false                                                    // ==>

	} // validateInteger()

	/**
	 * validateNumber
	 *
	 * This method will validate the provided number value.
	 *
	 * The method will first assert if the value is a number.
	 * The method will then assert the value is within valid range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateNumber(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check if integer.
		///
		if(Validator.IsNumber(theValue)) {
			///
			// Check if in range.
			///
			return this.ValidateNumericRange(
				theValue, theDescriptor, theSection, theParent
			)                                                           // ==>
		}

		this.report = new ValidationReport('kNOT_A_NUMBER')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.descriptor = theDescriptor
		this.report.value = theValue

		return false                                                    // ==>

	} // validateNumber()

	/**
	 * validateTimestamp
	 *
	 * This method will validate the provided timestamp value.
	 *
	 * If the value is a number, the function will assume it is a unix time,
	 * if the value is a string, the function will try to interpret it as a
	 * date.
	 *
	 * If there is an range, the method will check the range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateTimestamp(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check if UNIX timestamp.
		///
		if(Validator.IsNumber(theValue)) {
			return this.ValidateNumericRange(
				theValue, theDescriptor, theSection, theParent
			)                                                           // ==>
		}

		///
		// Check if string date.
		///
		if(Validator.IsString(theValue)) {
			const timestamp = new Date(theValue)
			if(!isNaN(timestamp.valueOf())) {
				theValue = timestamp.valueOf()
				this.report.value = theValue

				return this.ValidateNumericRange(
					theValue, theDescriptor, theSection, theParent
				)                                                       // ==>
			}
		}

		this.report = new ValidationReport('kVALUE_NOT_A_TIMESTAMP')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.descriptor = theDescriptor
		this.report.value = theValue

		return false                                                    // ==>

	} // validateTimestamp()


	/**
	 * VALIDATION UTILITY METHODS
	 */


	/**
	 * ValidateNumericRange
	 *
	 * This method will assert if the provided numeric value is within range.
	 *
	 * The method will first check if the section has any range indicators, if
	 * that is the case, it will validate the value range. If that is not the
	 * case, the method will return true.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	ValidateNumericRange(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeNumber)) {
			const range = theSection[module.context.configuration.rangeNumber]
			let inRange = true

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range)) {
				if(range.hasOwnProperty(module.context.configuration.rangeNumberMinInclusive)) {
					if(theValue < range[module.context.configuration.rangeNumberMinInclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMinExclusive)) {
					if(theValue <= range[module.context.configuration.rangeNumberMinExclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMaxInclusive)) {
					if(theValue > range[module.context.configuration.rangeNumberMaxInclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMaxExclusive)) {
					if(theValue >= range[module.context.configuration.rangeNumberMaxExclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			this.report = new ValidationReport('kRANGE_NOT_AN_OBJECT')
			if(theParent !== null) {
				this.report.parentValue = theParent
			}
			this.report.descriptor = theDescriptor
			this.report.section = theSection
			this.report.value = range

			return false                                                // ==>

		} // Has range.

		return true                                                     // ==>

	} // ValidateNumericRange()

	/**
	 * ValidateStringRange
	 *
	 * This method will assert if the provided string value is within range.
	 *
	 * The method will first check if the section has any range indicators, if
	 * that is the case, it will validate the value range. If that is not the
	 * case, the method will return true.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	ValidateStringRange(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeString)) {
			const range = theSection[module.context.configuration.rangeString]
			let inRange = true

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range)) {
				if(range.hasOwnProperty(module.context.configuration.rangeStringMinInclusive)) {
					if(theValue < range[module.context.configuration.rangeStringMinInclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMinExclusive)) {
					if(theValue <= range[module.context.configuration.rangeStringMinExclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMaxInclusive)) {
					if(theValue > range[module.context.configuration.rangeStringMaxInclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMaxExclusive)) {
					if(theValue >= range[module.context.configuration.rangeStringMaxExclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			this.report = new ValidationReport('kRANGE_NOT_AN_OBJECT')
			if(theParent !== null) {
				this.report.parentValue = theParent
			}
			this.report.descriptor = theDescriptor
			this.report.section = theSection
			this.report.value = range

			return false                                                // ==>

		} // Has range.

		return true                                                     // ==>

	} // ValidateStringRange()

	/**
	 * ValidateDateRange
	 *
	 * This method will assert if the provided date value is within range.
	 *
	 * The method will first check if the section has any range indicators, if
	 * that is the case, it will validate the value range. If that is not the
	 * case, the method will return true.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	ValidateDateRange(theValue, theDescriptor, theSection, theParent)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeDate)) {
			const range = theSection[module.context.configuration.rangeDate]
			let inRange = true

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range)) {
				if(range.hasOwnProperty(module.context.configuration.rangeDateMinInclusive)) {
					if(theValue < range[module.context.configuration.rangeDateMinInclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMinExclusive)) {
					if(theValue <= range[module.context.configuration.rangeDateMinExclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMaxInclusive)) {
					if(theValue > range[module.context.configuration.rangeDateMaxInclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMaxExclusive)) {
					if(theValue >= range[module.context.configuration.rangeDateMaxExclusive]) {
						return setRangeError(
							theValue, theDescriptor, theSection, theParent
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			this.report = new ValidationReport('kRANGE_NOT_AN_OBJECT')
			if(theParent !== null) {
				this.report.parentValue = theParent
			}
			this.report.descriptor = theDescriptor
			this.report.section = theSection
			this.report.value = range

			return false                                                // ==>

		} // Has range.

		return true                                                     // ==>

	} // ValidateDateRange()

	/**
	 * setRangeError
	 *
	 * This method will instantiate a range error and set the appropriate
	 * status report fields, then return `false`.
	 *
	 * @param theValue {String|Number|Object}: Data value.
	 * @param theDescriptor {String}: Descriptor global identifier.
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `false`.
	 */
	setRangeError(theValue, theDescriptor, theSection, theParent)
	{
		this.report = new ValidationReport('kVALUE_OUT_OF_RANGE')
		if(theParent !== null) {
			this.report.parentValue = theParent
		}
		this.report.descriptor = theDescriptor
		this.report.section = theSection
		this.report.value = theValue

		return false                                                    // ==>

	} // setRangeError()


	/**
	 * CACHE INTERFACE METHODS
	 */


	/**
	 * getTerm
	 *
	 * This method will attempt to locate the term record matching the provided
	 * global identifier.
	 *
	 * If the term was found it will be cached, if the `doCache` flag was set.
	 *
	 * If the term was not found, and the `doCheck` flag was set, the method
	 * will set an error report stating that the term was not found. If the
	 * `doMissing` flag was set, and the `doCache` flag also`, the missing
	 * term will be cached.
	 *
	 * In all cases the method will return the term record, or `false\ if not
	 * found.
	 *
	 * @param theTerm {String}: The global identifier.
	 * @param doCheck {Boolean}: Raise an error if the term was not found.
	 * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
	 * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Object|Boolean}: `true` if descriptor, `false` if not.
	 */
	getTerm(
		theTerm,
		doCheck,
		doCache,
		doMissing,
		theParent)
	{
		///
		// Check term.
		///
		const term = this.cache.getTerm(theTerm, doCache, doMissing)
		if(doCheck === true && term === false) {
			this.report = new ValidationReport('kUNKNOWN_TERM')
			if(theParent !== null) {
				this.report.parentValue = theParent
			}
			this.report.value = theTerm
		}

		return term                                                     // ==>

	} // getTerm()

	/**
	 * getDescriptor
	 *
	 * This method will attempt to locate the term record matching the provided
	 * global identifier and assert it is a descriptor.
	 *
	 * The method will first call the `getTerm()` method to resolve the global
	 * identifier, raising an error if the term was not found. If the term was
	 * found, the method will check if the term has the data section: if that is
	 * not the case, the method will set a corresponding error report.
	 *
	 * In all cases the method will return the term record, or `false` and an
	 * error report if not found or not a descriptor.
	 *
	 * @param theTerm {String}: The global identifier.
	 * @param doCache {Boolean}: Check and store to cache, defaults to `true`.
	 * @param doMissing {Boolean}: Cache also missing terms, defaults to `true`.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Object|Boolean}: `true` if descriptor, `false` if not.
	 */
	getDescriptor(
		theTerm,
		doCache,
		doMissing,
		theParent)
	{
		///
		// Check term.
		///
		const term =
			this.getTerm(
				theTerm,
				true,
				doCache,
				doMissing,
				theParent
			)
		if(term === false) {
			return false                                                // ==>
		}

		///
		// Check descriptor.
		///
		if(!term.hasOwnProperty(module.context.configuration.sectionData)) {
			this.report = new ValidationReport('kNOT_A_DESCRIPTOR')
			if(theParent !== null) {
				this.report.parentValue = theParent
			}
			this.report.value = theTerm

			return false                                                // ==>
		}

		return term                                                     // ==>

	} // getDescriptor()


	/**
	 * STATIC UTILITY METHODS
	 */


	/**
	 * IsBoolean
	 * The method will return `true` if the provided value is a boolean.
	 * @param theValue {Any}: The value to test.
	 * @return {Boolean}: `true` if boolean, `false` if not.
	 */
	static IsBoolean(theValue)
	{
		return _.isBoolean(theValue)                                // ==>

	} // Validator::IsBoolean()

	/**
	 * IsInteger
	 * The method will return `true` if the provided value is an integer.
	 * @param theValue {Any}: The value to test.
	 * @return {Boolean}: `true` if integer, `false` if not.
	 */
	static IsInteger(theValue)
	{
		return _.isInteger(theValue)                                // ==>

	} // Validator::IsInteger()

	/**
	 * IsNumber
	 * The method will return `true` if the provided value is a number.
	 * @param theValue {Any}: The value to test.
	 * @return {Boolean}: `true` if number, `false` if not.
	 */
	static IsNumber(theValue)
	{
		return _.isNumber(theValue)                                 // ==>

	} // Validator::IsNumber()

	/**
	 * IsString
	 * The method will return `true` if the provided value is a string.
	 * @param theValue {Any}: The value to test.
	 * @return {Boolean}: `true` if string, `false` if not.
	 */
	static IsString(theValue)
	{
		return _.isString(theValue)                                 // ==>

	} // Validator::IsString()

	/**
	 * IsArray
	 * The method will return `true` if the provided value is an array.
	 * @param theValue {Any}: The value to test.
	 * @return {Boolean}: `true` if array, `false` if not.
	 */
	static IsArray(theValue)
	{
		return Array.isArray(theValue)                              // ==>

	} // Validator::IsArray()

	/**
	 * IsObject
	 * The method will return `true` if the provided value is an object.
	 * @param theValue {Any}: The value to test.
	 * @return {Boolean}: `true` if object, `false` if not.
	 */
	static IsObject(theValue)
	{
		return _.isPlainObject(theValue)                            // ==>

	} // Validator::IsObject()

} // class: Validator

module.exports = Validator
