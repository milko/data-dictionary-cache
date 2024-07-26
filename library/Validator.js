'use strict'

//
// Import frameworks.
//
const _ = require('lodash')

///
// Modules.
///
const TermsCache = require('./TermsCache')
const ValidationReport = require('./ValidationReport')

/**
 * Validator
 *
 * This class instantiates an object that can be used to validate values
 * associated to terms belonging to the data dictionary.
 *
 * Once instantiated, you can call the validate() method that will check if
 * the provided value respects the constraints defined in the data dictionary
 * term that represents the value's descriptor.
 *
 * Some general rules:
 *
 * - Objects cannot be empty.
 * - The `null` value is not valid: either a property is filled or missing.
 */
class Validator
{
	/**
	 * Constructor
	 *
	 * The constructor expects the following parameters:
	 *
	 * - `theValue`: The value to be checked. It can be of any type if you
	 *               also provide the descriptor, or it must be either an
	 *               object or an array of objects if you omit the descriptor.
	 *               Note that `null` or an empty object are considered an
	 *               error and the constructor will fail raising an exception.
	 * - `theTerm`: The global identifier of the term representing the value
	 *              descriptor. If the term cannot be referenced, or if the term
	 *              is not a descriptor, the constructor will raise an
	 *              exception. The term can be omitted, in which case the value
	 *              must either be an object or an array of objects: the
	 *              validation will scan all object properties and check those
	 *              properties that correspond to data dictionary descriptor
	 *              terms. Note that *any property matching a dictionary term*
	 *              will be expected to be a descriptor.
	 * - `doZip`: This boolean flag indicates whether all values should be
	 *            matched with the provided descriptor. If set, the value *must
	 *            be an array* and all elements of the array will be validated
	 *            against the provided descriptor. If set, and no descriptor was
	 *            provided, or if the value is not an array, the constructor
	 *            will raise an exception.
	 * - `doCache`: This boolean flag can be used to force caching of all
	 *              resolved terms. If false, no terms will be cached. This
	 *              value is passed to all TermsCache methods.
	 * - `doCacheMissing`: This boolean flag is related to the `doCache` flag and
	 *                     is only used if the cache flag is set. If this flag is
	 *                     set, terms that were not resolved will also be set
	 *                     with a `false` value; if this flag is not set, only
	 *                     resolved terms will be cached. This flag can be
	 *                     useful when objects contain a consistent set of
	 *                     properties that should be checked.
	 * - `doOnlyTerms`: This boolean flag can be used to expect all object
	 *                  properties to be descriptors. If the flag is set, when
	 *                  traversing objects we expect all properties to be
	 *                  descriptors. If the flag is off, object properties that
	 *                  do not match a term will be ignored, this is the
	 *                  default behaviour.
	 * - `doDataType`: This boolean flag can be used to have all values require
	 *                 their data type. If the flag is set, all data definitions
	 *                 must have the data type. If the flag is off, omitting the
	 *                 data type means that the value can be of any type, which
	 *                 is the default option.
	 * - `doResolve`: There are cases in which values are not fully compliant:
	 *                you could have provided the local identifier of an
	 *                enumeration or a string to be converted into a timestamp,
	 *                in these cases the validation process can resolve these
	 *                values. If this flag is set: if an enumeration code
	 *                doesn't match, the validator will check if the provided
	 *                value matches a property in the code section of the term
	 *                and is an element of the descriptor's enumeration type: if
	 *                that is the case, the value will be replaced with the
	 *                correct entry and no error issued. All resolved values are
	 *                logged in the `resolved` data member.
	 * - `resolveCode`: This parameter is linked to the previous flag: if the
	 *                  `doResolve` flag is set, this parameter allows you to
	 *                  indicate which terms code section field should be
	 *                  searched for matching the code in the value. By default,
	 *                  the local identifier, `_lid`, is searched, but this
	 *                  field allows you to search others, such as official
	 *                  identifiers, `_aid`.
	 *
	 * The provided parameters will be checked and set in the object that will
	 * feature the following members:
	 *
	 * - `value`: Will receive `theValue`.
	 * - `term`: Will receive the term record corresponding to `theTerm`.
	 * - `cache`: Will receive the TermsCache object implementing the interface
	 *            to the data dictionary database.
	 * - `zip`: Will receive the `doZip` flag.
	 * - `resolve`: Will receive the `doResolve` flag.
	 * - `resolver`: Will receive the `resolveCode` value.
	 * - `useCache`: Will receive the `doCache` flag.
	 * - `cacheMissing`: Will receive the `doMissing` flag.
	 * - `expectTerms`: Will receive thw `doOnlyTerms` flag.
	 * - `expectType`: Will receive the `doDataType` flag.
	 * - `language`: Will receive the language provided in validate() for report
	 *               messages.
	 *
	 * If you want to check a specific value, provide the value and descriptor.
	 * If you want to check a list of values of the same type, provide the list
	 * of values, the descriptor and set the `doZip` flag.
	 * If you want to check the properties of an object, provide the object in
	 * `theValue` and omit the descriptor.
	 * If you want to check the properties of a list of objects provide an array
	 * of objects in `theValue` and omit the descriptor.
	 * If you want to check a set of key/value pairs, provide a dictionary as
	 * the value and omit the descriptor.
	 *
	 * All terms read from the database are cached in the `cache` data member,
	 * the cached record will only hold the `_key`, data and rule term sections,
	 * and the`_path` property of the edge in which the term is the relationship
	 * origin.
	 *
	 * Note that the validation report is not initialised here, it will be set
	 * in the validate() method in order to match the value dimensions.
	 *
	 * To trigger validation, once instantiated, call the validate() method.
	 *
	 * @param theValue {Array|Object|Number|String}: The value to be checked.
	 * @param theTerm {String}: The descriptor global identifier, defaults to
	 *                          an empty string (no descriptor).
	 * @param doZip {Boolean}: If true, match the descriptor with each element
	 *                         of the provided list of values, defaults to
	 *                         false.
	 * @param doCache {Boolean}: Flag for caching terms, defaults to true.
	 * @param doCacheMissing {Boolean}: Flag for caching non resolved terms,
	 *                                  defaults to false.
	 * @param doOnlyTerms {Boolean}: Flag to expect all object properties to be
	 *                               term descriptors.
	 * @param doDataType {Boolean}: Flag to require data type for all values.
	 * @param doResolve {Boolean}: If true, resolve timestamps and eventual
	 *                             unmatched enumerations, defaults to false.
	 * @param resolveCode {String}: If doResolve is set, provide the term code
	 *                              section property name where to match codes,
	 *                              defaults to the local identifier code,
	 *                              `_lid`.
	 */
	constructor(
		theValue,
		theTerm = '',
		doZip = false,
		doCache = true,
		doCacheMissing = false,
		doOnlyTerms = false,
		doDataType = false,
		doResolve = false,
		resolveCode = module.context.configuration.localIdentifier
	){
		///
		// Init value.
		// We are optimistic.
		///
		this.value = theValue

		///
		// Init cache.
		///
		this.cache = new TermsCache()

		///
		// Init global flags.
		///
		this.zip = Boolean(doZip)
		this.resolve =  Boolean(doResolve)
		this.useCache =  Boolean(doCache)
		this.cacheMissing =  Boolean(doCacheMissing)
		this.expectTerms =  Boolean(doOnlyTerms)
		this.expectTerms =  Boolean(doOnlyTerms)
		this.expectType = Boolean(doDataType)
		this.resolver = resolveCode

		///
		// Handle descriptor.
		///
		if(theTerm.length > 0)
		{
			///
			// Resolve term.
			///
			const term =
				this.cache.getDescriptor(theTerm, this.useCache, this.cacheMissing)
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
			// Handle array.
			///
			if(Validator.IsArray(theValue)) {
				theValue.forEach( (item) => {
					if(!Validator.IsObject(item)) {
						throw new Error(
							"Expecting an array of objects: you provided a different element."
						)                                               // ==>
					}
				})
			}

			///
			// Handle object.
			///
			else
			{
				if(doZip) {
					throw new Error(
						"To zip you must provide the descriptor."
					)                                                   // ==>
				}

				if(!Validator.IsObject(theValue)) {
					throw new Error(
						"You did not provide a descriptor: we expect either an array of objects or an object."
					)                                                   // ==>
				}
			}

		} // No descriptor provided.

	} // constructor()

	/**
	 * validate
	 *
	 * This method can be used to launch the validation process, it will
	 * return a boolean indicating whether the validation succeeded, `true`, or
	 * failed, `false`.
	 *
	 * The method handles the following object configurations:
	 *
	 * - Zipped: the value is an array of values and the descriptor was
	 *           provided.
	 * - Objects array: and array of objects wasprovided without a descriptor.
	 * - Object: an object was provided without descriptor.
	 * - Descriptor and value: both descriptor and value were provided.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theLanguage {String}: Language code for report messages, defaults
	 *                              to default language.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validate(theLanguage = module.context.configuration.language)
	{
		///
		// Set used language.
		///
		this.language = theLanguage

		///
		// Handle zipped data.
		///
		if(this.zip) {
			return this.validateZipped()                                // ==>
		}

		///
		// Handle no descriptor.
		///
		if(!this.hasOwnProperty('term'))
		{
			///
			// Array of objects.
			///
			if(Validator.IsArray(this.value)) {
				return this.validateObjects()                           // ==>
			}

			///
			// Object.
			///
			if(Validator.IsObject(this.value)) {
				return this.validateObject(this.value)                  // ==>
			}

			throw new Error(
				"Unchecked case: when omitting the descriptor, the value must be either an object or an array of objects."
			)                                                           // ==>
		}

	} // validate()


	/**
	 * TOP LEVEL VALIDATION INTERFACE
	 */


	/**
	 * validateZipped
	 *
	 * This method expects the value to be an array and it expects the
	 * descriptor to have been provided. The method will iterate the list of
	 * values matching the provided descriptor to each one.
	 *
	 * The `report` data member of the current object will be an array
	 * containing a status report for each checked value. Note that if you
	 * instantiated this object with the `doResolve` flag set, some values you
	 * provided might have been modified: if the corresponding status report has
	 * a `resolved` member, it means that there were modifications.
	 *
	 * The method assumes the `zip` flag to be set and all parameters to have
	 * been previously checked.
	 *
	 * The method will return true if no errors occurred, or false if at least
	 * one error occurred.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateZipped()
	{
		///
		// Init local storage.
		///
		let status = true
		const section = this.term[module.context.configuration.sectionData]

		///
		// Instantiate report.
		///
		this.report = []

		///
		// Iterate value elements.
		///
		this.value.forEach( (value, index) =>
		{
			///
			// Init idle status report.
			///
			this.setStatusReport('kOK', this.term_key, null, index)

			///
			// Validate.
			///
			if(!this.doValidateDimension(this.value, this.term, section, index)) {
				status = false
			}
		})

		return status                                                   // ==>

	} // validateZipped()

	/**
	 * validateObjects
	 *
	 * This method expects an objects array as value, the method will iterate
	 * each object and feed it to the `validateObject()` method that will take
	 * care of validating it.
	 *
	 * This method will initialise the reports container, but will not set the
	 * idle status, this will be done by the validateObject() method.
	 *
	 * The method will return true if no errors occurred, or false if at least
	 * one error occurred.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateObjects()
	{
		///
		// Init local storage.
		///
		let status = true

		///
		// Instantiate report.
		// Note that we do not initialise the status here.
		///
		this.report = []

		///
		// Iterate value elements.
		///
		this.value.forEach( (value, index) =>
		{
			///
			// Handle object.
			///
			if(Validator.IsObject(value)) {
				if(!this.validateObject(this.value[index], index)) {
					status = false
				}
			}
			else
			{
				return this.setStatusReport(
					'kNOT_AN_OBJECT',
					'',
					value,
					index
				)                                                       // ==>
			}
		})

		return status                                                   // ==>

	} // validateObjects()

	/**
	 * validateObject
	 *
	 * This method expects the value to be an object, the method will traverse
	 * the object's properties matching the property name to known terms, if the
	 * property matches a descriptor term, the value will be validated. If the
	 * matched term is not a descriptor, an error will be raised.
	 *
	 * The method assumes you provide an object.
	 *
	 * The method will return true if no errors occurred, or false if at least
	 * one error occurred.
	 *
	 * @param theContainer {Object}: The object to be checked.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateObject(theContainer, theReportIndex = null)
	{
		///
		// Init local storage.
		///
		let status = true

		///
		// Init current idle status report.
		///
		this.setStatusReport('kOK', '', null, theReportIndex)

		///
		// Traverse object.
		///
		Object.keys(theContainer).some( (property) => {

			///
			// Resolve property.
			///
			const term =
				this.cache.getTerm(
					property, this.useCache, this.cacheMissing
				)

			///
			// Term not found.
			///
			if(term === false) {
				if(this.expectTerms) {
					status = this.setStatusReport(
						'kUNKNOWN_TERM',
						property,
						theContainer[property],
						theReportIndex
					)

					return true
				}

				return false
			}

			///
			// Assert term is a descriptor.
			///
			if(!term.hasOwnProperty(module.context.configuration.sectionData)) {
				status = this.setStatusReport(
					'kNOT_A_DESCRIPTOR',
					property,
					theContainer,
					theReportIndex
				)

				return true
			}

			///
			// Validate property/value pair.
			///
			if(!this.doValidateDimension(
				theContainer,
				term,
				term[module.context.configuration.sectionData],
				theReportIndex
			)) {
				status = false
				return true
			}

			return false
		})

		return status                                                   // ==>

	} // validateObject()


	/**
	 * PRIVATE VALIDATION INTERFACE
	 */


	/**
	 * doValidateDimension
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value.
	 *
	 * The provided descriptor is expected to be a resolved descriptor term.
	 *
	 * The method will scan the descriptor data section resolving the eventual
	 * container types until it reaches the scalar dimension, where it will
	 * check the value's data type and return the status.
	 *
	 * The method assumes the default idle status report to be already set.
	 *
	 * The method expects the following parameters:
	 *
	 * - `theContainer`: The container of the value.
	 * - `theDescriptor`: The term record corresponding to the descriptor. The
	 *                    term `_key` is the key to access the value in the
	 *                    container.
	 * - `theSection`: The term data section corresponding to the current
	 *                 dimension. As we traverse nested containers, this will be
	 *                 the data section corresponding to the current container.
	 * - `theReportIndex`: The eventual index of the current report. This is
	 *                     used when validate() was called on an array of
	 *                     values: for each value a report is created in the
	 *                     current object, so each value can be evaluated. If
	 *                     the value is a scalar, provide `null` here.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theContainer {String|Number|Object|Array}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	doValidateDimension(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex = null)
	{
		///
		// Traverse data section.
		// We know the descriptor has the data section.
		///
		if(theSection.hasOwnProperty(module.context.configuration.sectionScalar)) {
			return this.doValidateScalar(
				theContainer,
				theDescriptor,
				theSection[module.context.configuration.sectionScalar],
				theReportIndex
			)                                                           // ==>
		} else if(theSection.hasOwnProperty(module.context.configuration.sectionArray)) {
			return this.doValidateArray(
				theContainer,
				theDescriptor,
				theSection[module.context.configuration.sectionArray],
				theReportIndex
			)                                                           // ==>
		} else if(theSection.hasOwnProperty(module.context.configuration.sectionSet)) {
			return this.doValidateSet(
				theContainer,
				theDescriptor,
				theSection[module.context.configuration.sectionSet],
				theReportIndex
			)                                                           // ==>
		} else if(theSection.hasOwnProperty(module.context.configuration.sectionDict)) {
			return this.doValidateDict(
				theContainer,
				theDescriptor,
				theSection[module.context.configuration.sectionDict],
				theReportIndex
			)                                                           // ==>
		}

		return this.setStatusReport(
			'kEXPECTING_DATA_DIMENSION',
			theDescriptor._key,
			theSection,
			theReportIndex
		)                                                               // ==>

	} // doValidateDimension()


	/**
	 * DATA DIMENSION METHODS
	 */


	/**
	 * doValidateScalar
	 *
	 * This method will check if the value is a scalar and then attempt to
	 * check if the value corresponds to the declared data type.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateScalar(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Assert scalar.
		///
		if(!Validator.IsArray(theContainer[theDescriptor._key]))
		{
			///
			// Handle type.
			///
			if(theSection.hasOwnProperty(module.context.configuration.scalarType))
			{
				///
				// Parse data type.
				///
				switch(theSection[module.context.configuration.scalarType])
				{
					case module.context.configuration.typeBoolean:
						return this.doValidateBoolean(
							theContainer, theDescriptor, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeInteger:
						return this.doValidateInteger(
							theContainer, theDescriptor, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeNumber:
						return this.doValidateNumber(
							theContainer, theDescriptor, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeTypestamp:
						return this.doValidateTimeStamp(
							theContainer, theDescriptor, theSection, theReportIndex
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

				///
				// Unsupported data type.
				///
				return this.setStatusReport(
					'kUNSUPPORTED',
					theDescriptor._key,
					theSection,
					theReportIndex
				)                                                       // ==>

			} // Has data type.

			///
			// Missing data type.
			///
			else if(this.expectType) {
				return this.setStatusReport(
					'kMISSING_SCALAR_DATA_TYPE',
					theDescriptor._key,
					theContainer,
					theReportIndex
				)                                                       // ==>

			} // Missing data type.

			return true                                                 // ==>

		} // Is a scalar.

		return this.setStatusReport(
			'kNOT_A_SCALAR',
			theDescriptor._key,
			theContainer[theDescriptor._key],
			theReportIndex
		)                                                               // ==>

	} // doValidateScalar()

	/**
	 * doValidateArray
	 *
	 * This method will check if the value is an array, and then it will
	 * traverse the data definition until it finds a scalar type.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateArray(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{

		return true                                                    // ==>

	} // doValidateArray()

	/**
	 * doValidateSet
	 *
	 * This method will check if the value is an array of unique values, and
	 * then it will pass the value to a method that will validate the scalar
	 * element value type.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateSet(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{

		return true                                                    // ==>

	} // doValidateSet()

	/**
	 * validateDict
	 *
	 * This method will check if the value is an object, and then it will pass
	 * the keys and values to the dictionary validation method.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateSet(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{

		return true                                                    // ==>

	} // doValidateSet()


	/**
	 * DATA TYPE METHODS
	 */


	/**
	 * doValidateBoolean
	 *
	 * This method will validate the provided boolean value.
	 *
	 * The method only asserts the value is boolean.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateBoolean(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Check if boolean.
		///
		if(Validator.IsBoolean(theContainer[theDescriptor._key])) {
			return true                                                 // ==>
		}

		return this.setStatusReport(
			'kNOT_A_BOOLEAN',
			theDescriptor._key,
			theContainer[theDescriptor._key],
			theReportIndex
		)                                                               // ==>

	} // doValidateBoolean()

	/**
	 * doValidateInteger
	 *
	 * This method will validate the provided integer value.
	 *
	 * The method will first assert if the value is an integer.
	 * The method will then assert the value is within valid range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateInteger(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Handle integer.
		///
		if(Validator.IsInteger(theContainer[theDescriptor._key]))
		{
			return this.ValidateNumericRange(
				theContainer, theDescriptor, theSection, theReportIndex
			)                                                           // ==>
		}

		return this.setStatusReport(
			'kNOT_AN_INTEGER',
			theDescriptor._key,
			theContainer[theDescriptor._key],
			theReportIndex
		)                                                               // ==>

	} // doValidateInteger()

	/**
	 * doValidateNumber
	 *
	 * This method will validate the provided number value.
	 *
	 * The method will first assert if the value is a number.
	 * The method will then assert the value is within valid range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateNumber(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Handle number.
		///
		if(Validator.IsNumber(theContainer[theDescriptor._key]))
		{
			return this.ValidateNumericRange(
				theContainer, theDescriptor, theSection, theReportIndex
			)                                                           // ==>
		}

		return this.setStatusReport(
			'kNOT_A_NUMBER',
			theDescriptor._key,
			theContainer[theDescriptor._key],
			theReportIndex
		)                                                               // ==>

	} // doValidateNumber()

	/**
	 * doValidateTimeStamp
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
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateTimeStamp(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Check if UNIX timestamp.
		///
		if(Validator.IsNumber(theContainer[theDescriptor._key])) {
			return this.ValidateNumericRange(
				theContainer, theDescriptor, theSection, theReportIndex
			)                                                           // ==>
		}

		///
		// Check if string date.
		///
		if(Validator.IsString(theContainer[theDescriptor._key]))
		{
			///
			// Convert to timestamp.
			///
			const timestamp = new Date(theContainer[theDescriptor._key])
			if(!isNaN(timestamp.valueOf()))
			{
				///
				// Update original value.
				///
				theContainer[theDescriptor._key] = timestamp.valueOf()

				// TODO: Log modified value.

				return this.ValidateNumericRange(
					theContainer, theDescriptor, theSection, theReportIndex
				)                                                       // ==>

			} // Converted to timestamp.

		} // Value is string.

		return this.setStatusReport(
			'kVALUE_NOT_A_TIMESTAMP',
			theDescriptor._key,
			theContainer[theDescriptor._key],
			theReportIndex
		)                                                               // ==>

	} // doValidateTimeStamp()


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
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	ValidateNumericRange(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeNumber))
		{
			const value = theContainer[theDescriptor._key]
			const range = theSection[module.context.configuration.rangeNumber]

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range))
			{
				if(range.hasOwnProperty(module.context.configuration.rangeNumberMinInclusive)) {
					if(value < range[module.context.configuration.rangeNumberMinInclusive]) {
						return this.setStatusReport(
								'kVALUE_LOW_RANGE',
								theDescriptor._key,
								theContainer[theDescriptor._key],
								theReportIndex,
								{ "section": range }
							)                                           // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMinExclusive)) {
					if(value <= range[module.context.configuration.rangeNumberMinExclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMaxInclusive)) {
					if(value > range[module.context.configuration.rangeNumberMaxInclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMaxExclusive)) {
					if(value >= range[module.context.configuration.rangeNumberMaxExclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			return this.setStatusReport(
				'kRANGE_NOT_AN_OBJECT',
				theDescriptor._key,
				range,
				theReportIndex,
				{ "section": theSection }
			)                                                           // ==>

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
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	ValidateStringRange(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeString))
		{
			const value = theContainer[theDescriptor._key]
			const range = theSection[module.context.configuration.rangeString]

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range))
			{
				if(range.hasOwnProperty(module.context.configuration.rangeStringMinInclusive)) {
					if(value < range[module.context.configuration.rangeStringMinInclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMinExclusive)) {
					if(value <= range[module.context.configuration.rangeStringMinExclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMaxInclusive)) {
					if(value > range[module.context.configuration.rangeStringMaxInclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMaxExclusive)) {
					if(value >= range[module.context.configuration.rangeStringMaxExclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			return this.setStatusReport(
				'kRANGE_NOT_AN_OBJECT',
				theDescriptor._key,
				range,
				theReportIndex,
				{ "section": theSection }
			)                                                           // ==>

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
	 * @param theContainer {Object}: The value container.
	 * @param theDescriptor {Object}: The descriptor term record.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	ValidateDateRange(
		theContainer,
		theDescriptor,
		theSection,
		theReportIndex)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeDate))
		{
			const value = theContainer[theDescriptor._key]
			const range = theSection[module.context.configuration.rangeDate]

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range))
			{
				if(range.hasOwnProperty(module.context.configuration.rangeDateMinInclusive)) {
					if(value < range[module.context.configuration.rangeDateMinInclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMinExclusive)) {
					if(value <= range[module.context.configuration.rangeDateMinExclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMaxInclusive)) {
					if(value > range[module.context.configuration.rangeDateMaxInclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMaxExclusive)) {
					if(value >= range[module.context.configuration.rangeDateMaxExclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theDescriptor._key,
							theContainer[theDescriptor._key],
							theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			return this.setStatusReport(
				'kRANGE_NOT_AN_OBJECT',
				theDescriptor._key,
				range,
				theReportIndex,
				{ "section": theSection }
			)                                                           // ==>

		} // Has range.

		return true                                                     // ==>

	} // ValidateDateRange()


	/**
	 * UTILITY METHODS
	 */


	/**
	 * setStatusReport
	 *
	 * This method can be used to set a status report.
	 *
	 * @param theStatus {String}: The status code, defaults to idle.
	 * @param theDescriptor {String}: The descriptor global identifier, defaults
	 *                                to empty string.
	 * @param theValue {String|Number|Object|Array}: Value, defaults to null.
	 * @param theReportIndex {Number}: Report index, defaults to null.
	 * @param theCustomFields {Object}: Key/value dictionary to add to the
	 *                                  report, defaults to empty object.
	 *
	 * @return {Boolean}: `true`, if the status code is `0`, `false` if not.
	 */
	setStatusReport(
		theStatus = 'kOK',
		theDescriptor = '',
		theValue = null,
		theReportIndex = null,
		theCustomFields = {})
	{
		///
		// Instantiate report with current language.
		///
		const report =
			new ValidationReport(
				theStatus,
				theDescriptor,
				theValue,
				this.language
			)

		///
		// Add custom report fields.
		///
		Object.entries(theCustomFields).forEach(([key, value]) => {
			report[key] = value
		})

		///
		// Store report.
		///
		if(theReportIndex !== null) {
			this.report[theReportIndex] = report
		} else {
			this.report = report
		}

		return (report.status.code === 0)                               // ==>

	} // setStatusReport()


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
