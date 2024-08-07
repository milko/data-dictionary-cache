'use strict'

//
// Import frameworks.
//
const _ = require('lodash')

///
// Modules.
///
const crypto = require('@arangodb/crypto')
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
 * Validation errors will be saved in the current object, dictionary errors will
 * be thrown as exceptions, this means that an exception signals a corrupted
 * data dictionary.
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
	 * - `doDefaultNamespace`: By default, any user-defined term that references
	 *                         another term by key, cannot do so if the key is an
	 *                         empty string. This prevents the use of the default
	 *                         namespace. This flag will disable this check only
	 *                         for the term namespace, this means that the term
	 *                         namespace value will be allowed to be an empty
	 *                         string, all other descriptors will require non
	 *                         empty strings. *Note that the empty string will
	 *                         have to be replaced by `:` for referencing the
	 *                         default namespace, and that only to query the
	 *                         database.
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
	 * - `defNamespace`: Will receive the `allowDefaultNamespace` flag.
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
	 * @param doDefaultNamespace {Boolean}: If true, allow default namespace to
	 *                                      be used, defaults to false.
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
		doDefaultNamespace = false,
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
		this.defNamespace = Boolean(doDefaultNamespace)
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
	 * *Be aware that validation will not check the actual value of a term
	 * global identifier, this should be done by the caller*.
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
		const key = this.term._key
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
			this.setStatusReport('kOK', key, null, index)

			///
			// Validate.
			///
			const container = { [key]: this.value[index] }
			if(!this.doValidateDataSection(container, key, section, index)) {
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
	 * Validation workflow:
	 *
	 * - Iterate object properties.
	 * - Check if property matches a term.
	 * - Check if matched term is a descriptor.
	 * - Validate according to descriptor data section.
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
		// Init current idle status report.
		///
		this.setStatusReport('kOK', '', null, theReportIndex)

		///
		// Validate object.
		///
		return this.doValidateObject(
			theContainer, null, null, theReportIndex
		)                                                               // ==>

	} // validateObject()


	/**
	 * PRIVATE VALIDATION INTERFACE
	 */


	/**
	 * doValidateDataSection
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
	 * - `theKey`: Either the global identifier of the value's descriptor the
	 *             index of the array element. It is the container key
	 *             corresponding to the value. null when there is no key to the
	 *             container.
	 * - `theSection`: The term data section corresponding to the current
	 *                 dimension. As we traverse nested containers, this will be
	 *                 the data section corresponding to the current container.
	 * - `theReportIndex`: The eventual index of the current report. This is
	 *                     used when validate() was called on an array of
	 *                     values: for each value a report is created in the
	 *                     current object, so each value can be evaluated. If
	 *                     the value is a scalar, provide `null` here.
	 *
	 * Validation workflow:
	 *
	 * - Handle empty data section: all is fair.
	 * - Iterate all expected data section blocks and call related validator.
	 * - Raise an error if none of the expected blocks were found and the
	 *   `expectType` flag is set, or return true if not set.
	 *
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theContainer {String|Number|Object|Array}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	doValidateDataSection(
		theContainer,
		theKey,
		theSection,
		theReportIndex = null)
	{
		///
		// Handle empty data section.
		///
		if(Object.keys(theSection).length === 0) {
			return true                                                 // ==>
		}

		///
		// Traverse data section.
		// We know the descriptor has the data section.
		///
		if(theSection.hasOwnProperty(module.context.configuration.sectionScalar)) {
			return this.doValidateScalar(
				theContainer,
				theKey,
				theSection[module.context.configuration.sectionScalar],
				theReportIndex
			)                                                           // ==>
		} else if(theSection.hasOwnProperty(module.context.configuration.sectionArray)) {
			return this.doValidateArray(
				theContainer,
				theKey,
				theSection[module.context.configuration.sectionArray],
				theReportIndex
			)                                                           // ==>
		} else if(theSection.hasOwnProperty(module.context.configuration.sectionSet)) {
			return this.doValidateSet(
				theContainer,
				theKey,
				theSection[module.context.configuration.sectionSet],
				theReportIndex
			)                                                           // ==>
		} else if(theSection.hasOwnProperty(module.context.configuration.sectionDict)) {
			return this.doValidateDict(
				theContainer,
				theKey,
				theSection[module.context.configuration.sectionDict],
				theReportIndex
			)                                                           // ==>
		}

		if(this.expectType) {
			return this.setStatusReport(
				'kEXPECTING_DATA_DIMENSION',
				theKey, theSection, theReportIndex
			)                                                           // ==>
		}

		return true                                                     // ==>

	} // doValidateDataSection()

	/**
	 * doValidateSetSection
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value. *It is assumed that the value is part
	 * of a set*.
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
	 * - `theKey`: Either the global identifier of the value's descriptor the
	 *             index of the array element. It is the container key
	 *             corresponding to the value. null when there is no key to the
	 *             container.
	 * - `theSection`: The term data section corresponding to the current
	 *                 dimension. As we traverse nested containers, this will be
	 *                 the data section corresponding to the current container.
	 * - `theReportIndex`: The eventual index of the current report. This is
	 *                     used when validate() was called on an array of
	 *                     values: for each value a report is created in the
	 *                     current object, so each value can be evaluated. If
	 *                     the value is a scalar, provide `null` here.
	 *
	 * Validation workflow:
	 *
	 * - Handle empty data section: all is fair.
	 * - Iterate all expected data section blocks and call related validator.
	 * - Raise an error if none of the expected blocks were found and the
	 *   `expectType` flag is set, or return true if not set.
	 *
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theContainer {String|Number|Object|Array}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	doValidateSetSection(
		theContainer,
		theKey,
		theSection,
		theReportIndex = null)
	{
		///
		// Handle empty data section.
		///
		if(Object.keys(theSection).length === 0) {
			return true                                                 // ==>
		}

		///
		// Traverse data section.
		// We know the descriptor has the data section.
		///
		if(theSection.hasOwnProperty(module.context.configuration.sectionSetScalar)) {
			return this.doValidateSetElement(
				theContainer,
				theKey,
				theSection[module.context.configuration.sectionSetScalar],
				theReportIndex
			)                                                           // ==>
		}

		if(this.expectType) {
			return this.setStatusReport(
				'kEXPECTING_DATA_DIMENSION',
				theKey, theSection, theReportIndex
			)                                                           // ==>
		}

		return true                                                     // ==>

	} // doValidateSetSection()


	/**
	 * DATA DIMENSION METHODS
	 */


	/**
	 * doValidateScalar
	 *
	 * This method will check if the value is a scalar and then attempt to
	 * check if the value corresponds to the declared data type.
	 *
	 * Validation workflow:
	 *
	 * - Check if value is scalar.
	 * - Check if descriptor data section contains scalar data type.
	 * - Parse data type and call related validator.
	 * - Raise an error if data type is unsupported.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data, array or set term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateScalar(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Assert scalar.
		///
		if(!Validator.IsArray(value))
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
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeInteger:
						return this.doValidateInteger(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeNumber:
						return this.doValidateNumber(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeTypestamp:
						return this.doValidateTimeStamp(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeString:
						return this.doValidateString(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeKey:
						return this.doValidateKey(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeHandle:
						return this.doValidateHandle(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeEnum:
						return this.doValidateEnum(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeDate:
						return this.doValidateDate(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeStruct:
						return this.doValidateStruct(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeObject:
						return this.doValidateObject(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeGeoJSON:
						///
						// TODO: Looking for suitable library or inspiration.
						///
						return this.doValidateGeoJSON(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					default:
						return this.setStatusReport(
							'kUNSUPPORTED_DATA_TYPE',
							theKey, theSection, theReportIndex
						)                                               // ==>

				} // Parsing data type.

			} // Has data type.

			///
			// Missing data type.
			///
			else if(this.expectType) {
				return this.setStatusReport(
					'kMISSING_DATA_TYPE',
					theKey, theSection, theReportIndex
				)                                                       // ==>

			} // Missing data type.

			return true                                                 // ==>

		} // Is a scalar.

		return this.setStatusReport(
			'kNOT_A_SCALAR',
			theKey, value, theReportIndex
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
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateArray(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if array.
		///
		if(Validator.IsArray(value))
		{
			///
			// Assert number of elements.
			///
			if(!this.checkArrayElements(
				theContainer, theKey, theSection, theReportIndex
			)) {
				return false                                            // ==>
			}

			///
			// Iterate elements.
			///
			for(let i = 0; i < value.length; i++) {
				if(!this.doValidateDataSection(
					value, i, theSection, theReportIndex
				)) {
					return false                                        // ==>
				}
			}

			return true                                                 // ==>

		} // Is an array.

		return this.setStatusReport(
			'kVALUE_NOT_AN_ARRAY', theKey, value, theReportIndex
		)                                                               // ==>

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
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateSet(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if array.
		///
		if(Validator.IsArray(value))
		{
			///
			// Assert number of elements.
			///
			if(!this.checkArrayElements(
				theContainer, theKey, theSection, theReportIndex
			)) {
				return false                                            // ==>
			}

			///
			// Iterate elements.
			///
			for(let i = 0; i < value.length; i++) {
				if(!this.doValidateSetSection(
					value, i, theSection, theReportIndex
				)) {
					return false                                        // ==>
				}
			}

			return true                                                 // ==>

		} // Is an array.

		return this.setStatusReport(
			'kVALUE_NOT_AN_ARRAY', theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateSet()

	/**
	 * doValidateSetElement
	 *
	 * This method will check if the value is a scalar and then attempt to
	 * check if the value corresponds to the declared data type.
	 *
	 * Validation workflow:
	 *
	 * - Check if value is scalar.
	 * - Check if descriptor set section contains set-scalar data type.
	 * - Parse data type and call related validator.
	 * - Raise an error if data type is unsupported.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data, array or set term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateSetElement(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Assert scalar.
		///
		if(!Validator.IsArray(value))
		{
			///
			// Handle type.
			///
			if(theSection.hasOwnProperty(module.context.configuration.setScalarType))
			{
				///
				// Parse data type.
				///
				switch(theSection[module.context.configuration.setScalarType])
				{
					case module.context.configuration.typeBoolean:
						return this.doValidateBoolean(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeInteger:
						return this.doValidateInteger(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeNumber:
						return this.doValidateNumber(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeTypestamp:
						return this.doValidateTimeStamp(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeString:
						return this.doValidateString(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeKey:
						return this.doValidateKey(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeHandle:
						return this.doValidateHandle(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeEnum:
						return this.doValidateEnum(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					case module.context.configuration.typeDate:
						return this.doValidateDate(
							theContainer, theKey, theSection, theReportIndex
						)                                               // ==>

					default:
						return this.setStatusReport(
							'kUNSUPPORTED_DATA_TYPE',
							theKey, theSection, theReportIndex
						)                                               // ==>

				} // Parsing data type.

			} // Has data type.

				///
				// Missing data type.
			///
			else if(this.expectType) {
				return this.setStatusReport(
					'kMISSING_DATA_TYPE',
					theKey, theSection, theReportIndex
				)                                                       // ==>

			} // Missing data type.

			return true                                                 // ==>

		} // Is a scalar.

		return this.setStatusReport(
			'kNOT_A_SCALAR',
			theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateSetElement()

	/**
	 * validateDict
	 *
	 * This method will check if the value is an object, and then it will pass
	 * the keys and values to the dictionary validation method.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateDict(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Assert value is an object.
		///
		if(Validator.IsObject(value))
		{
			///
			// Assert dictionary key section exists.
			///
			if(!theSection.hasOwnProperty(module.context.configuration.sectionDictKey)) {
				return this.setStatusReport(
					'kMISSING_DICT_KEY_SECTION',
					theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			///
			// Assert dictionary key section is an object.
			///
			if(!Validator.IsObject(theSection[module.context.configuration.sectionDictKey]))
			{
				return this.setStatusReport(
					'kINVALID_DICT_KEY_SECTION',
					theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			///
			// Handle keys section.
			///
			if(Object.keys(theSection[module.context.configuration.sectionDictKey]).length !== 0)
			{
				///
				// Check if section has type.
				///
				const section = theSection[module.context.configuration.sectionDictKey]
				if(section.hasOwnProperty(module.context.configuration.keyScalarType))
				{
					if(!this.doValidateDictKeys(
						theContainer, theKey, section, theReportIndex
					)) {
						return false                                    // ==>
					}

				} else {
					return this.setStatusReport(
						'kINVALID_DICT_KEY_SECTION',
						theKey, section, theReportIndex
					)                                                   // ==>
				}

			} // Section is not empty.

			///
			// Assert dictionary value section exists.
			///
			if(!theSection.hasOwnProperty(module.context.configuration.sectionDictValue)) {
				return this.setStatusReport(
					'kMISSING_DICT_VALUE_SECTION',
					theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			///
			// Assert dictionary value section is an object.
			///
			if(!Validator.IsObject(theSection[module.context.configuration.sectionDictValue]))
			{
				return this.setStatusReport(
					'kINVALID_DICT_VALUE_SECTION',
					theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			///
			// Handle values section.
			///
			if(Object.keys(theSection[module.context.configuration.sectionDictValue]).length !== 0)
			{
				///
				// Check if section has type.
				///
				if(!this.doValidateDictValues(
					theContainer, theKey,
					theSection[module.context.configuration.sectionDictValue],
					theReportIndex
				)) {
					return false                                        // ==>
				}

			} // Section is not empty.

			return true                                                 // ==>

		} // Value is an object.

		return this.setStatusReport(
			'kNOT_AN_OBJECT', theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateDict()

	/**
	 * doValidateDictKeys
	 *
	 * This method will check if the dictionary key value corresponds to the
	 * dictionary key data definition.
	 *
	 * The method expects the following conditions:
	 * - The value is an object.
	 * - Dictionary key section exists.
	 * - Dictionary key section is an object.
	 * - Dictionary key section is not empty.
	 * - Dictionary key section has data type.
	 *
	 * Validation workflow:
	 *
	 * - Parse data type.
	 * - Iterate all keys applying data type validation.
	 * - Raise an error if data type is unsupported.
	 * - If there were any resolved values, update the original object.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The list of dictionary keys.
	 * @param theKey {Number|null}: The keys array index.
	 * @param theSection {Object}: Dictionary key section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateDictKeys(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		let changed = false
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer
		const keys = Object.keys(value)
		const changes = Object.fromEntries(keys.map(key => [key, key]))

		///
		// Parse data type.
		///
		switch(theSection[module.context.configuration.keyScalarType])
		{
			///
			// String.
			///
			case module.context.configuration.typeString:
				for(let i = 0; i < keys.length; i++)
				{
					const key = keys[i]
					if(!this.doValidateString(
						keys, i, theSection, theReportIndex
					)) {
						return false                                    // ==>
					}

					changes[key] = keys[i]
					if(key !== keys[i]) {
						changed = true
					}
				}
				break

			///
			// Document key.
			///
			case module.context.configuration.typeKey:
				for(let i = 0; i < keys.length; i++)
				{
					const key = keys[i]
					if(!this.doValidateKey(
						keys, i, theSection, theReportIndex
					)) {
						return false                                    // ==>
					}

					changes[key] = keys[i]
					if(key !== keys[i]) {
						changed = true
					}
				}
				break

			///
			// Document handle.
			///
			case module.context.configuration.typeHandle:
				for(let i = 0; i < keys.length; i++)
				{
					const key = keys[i]
					if(!this.doValidateHandle(
						keys, i, theSection, theReportIndex
					)) {
						return false                                    // ==>
					}

					changes[key] = keys[i]
					if(key !== keys[i]) {
						changed = true
					}
				}
				break

			///
			// Enumeration.
			///
			case module.context.configuration.typeEnum:
				for(let i = 0; i < keys.length; i++)
				{
					const key = keys[i]
					if(!this.doValidateEnum(
						keys, i, theSection, theReportIndex
					)) {
						return false                                    // ==>
					}

					changes[key] = keys[i]
					if(key !== keys[i]) {
						changed = true
					}
				}
				break

			///
			// Date.
			///
			case module.context.configuration.typeDate:
				for(let i = 0; i < keys.length; i++)
				{
					const key = keys[i]
					if(!this.doValidateDate(
						keys, i, theSection, theReportIndex
					)) {
						return false                                    // ==>
					}

					changes[key] = keys[i]
					if(key !== keys[i]) {
						changed = true
					}
				}
				break

			default:
				return this.setStatusReport(
					'kUNSUPPORTED_DATA_TYPE',
					theKey, theSection, theReportIndex
				)                                                       // ==>

		} // Parsing data type.

		///
		// Reconcile resolved keys.
		///
		if(changed) {
			const resolved = {}
			Object.keys(changes).forEach(key => {
				resolved[changes[key]] = value[key]
			})

			if(theKey !== null) {
				theContainer[theKey] = resolved
			} else {
				theContainer = resolved
			}
		}

		return true                                                     // ==>

	} // doValidateDictKeys()

	/**
	 * doValidateDictValues
	 *
	 * This method will check if the dictionary values corresponds to the
	 * dictionary values data definition.
	 *
	 * The method expects the following conditions:
	 * - The value is an object.
	 * - Dictionary values section exists.
	 * - Dictionary values section is an object.
	 * - Dictionary values section is not empty.
	 *
	 * Validation workflow:
	 *
	 * - Parse data type.
	 * - Iterate all keys applying data type validation.
	 * - Raise an error if data type is unsupported.
	 * - If there were any resolved values, update the original object.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Dictionary value section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateDictValues(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		let status = true
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Iterate dictionary object keys.
		///
		Object.keys(value).some( (key) => {
			if(!this.doValidateDataSection(
				value, key, theSection, theReportIndex
			)) {
				status = false
				return true
			}

			return false
		})

		return status                                                   // ==>

	} // doValidateDictValues()


	/**
	 * DATA TYPE METHODS
	 */


	/**
	 * doValidateBoolean
	 *
	 * This method will validate the provided boolean value.
	 *
	 * The method only asserts if the value is boolean.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateBoolean(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if boolean.
		///
		if(Validator.IsBoolean(value)) {
			return true                                                 // ==>
		}

		return this.setStatusReport(
			'kNOT_A_BOOLEAN',
			theKey, value, theReportIndex
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
	 * Validation workflow:
	 *
	 * - Check if value is integer.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateInteger(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle integer.
		///
		if(Validator.IsInteger(value))
		{
			return this.checkNumericRange(
				theContainer, theKey, theSection, theReportIndex
			)                                                           // ==>
		}

		return this.setStatusReport(
			'kNOT_AN_INTEGER',
			theKey, value, theReportIndex
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
	 * Validation workflow:
	 *
	 * - Check if value is number.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateNumber(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle number.
		///
		if(Validator.IsNumber(value))
		{
			return this.checkNumericRange(
				theContainer, theKey, theSection, theReportIndex
			)                                                           // ==>
		}

		return this.setStatusReport(
			'kNOT_A_NUMBER',
			theKey, value, theReportIndex
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
	 * If there is a range, the method will check the range: note that the
	 * method expects a numeric range.
	 *
	 * Validation workflow:
	 *
	 * - If value is numeric, return check range status.
	 * - If value is string, convert to timestamp and check range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateTimeStamp(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if UNIX timestamp.
		///
		if(Validator.IsNumber(value)) {
			return this.checkNumericRange(
				theContainer, theKey, theSection, theReportIndex
			)                                                           // ==>
		}

		///
		// Check if string date.
		///
		if(Validator.IsString(value))
		{
			///
			// Convert to timestamp.
			///
			const timestamp = new Date(value)
			if(!isNaN(timestamp.valueOf()))
			{
				///
				// Log resolved value.
				///
				this.logResolvedValues(
					theKey, value, timestamp.valueOf(), theReportIndex
				)

				///
				// Update original value.
				///
				if(theKey !== null) {
					theContainer[theKey] = timestamp.valueOf()
				} else {
					theContainer = timestamp.valueOf()
				}

				///
				// Update status report.
				// TODO: Replace status, in report, with kMODIFIED_VALUE.
				///

				///
				// Check timestamp valid range.
				///
				return this.checkNumericRange(
					theContainer, theKey, theSection, theReportIndex
				)                                                       // ==>

			} // Converted to timestamp.

		} // Value is string.

		return this.setStatusReport(
			'kVALUE_NOT_A_TIMESTAMP',
			theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateTimeStamp()

	/**
	 * doValidateString
	 *
	 * This method will validate the provided string value.
	 *
	 * The method will first assert if the value is a string.
	 * The method will then assert the value is within valid range.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is a string.
	 * - Assert string respects eventual regular expression.
	 * - Check eventual string range.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateString(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle string.
		///
		if(Validator.IsString(value))
		{
			///
			// Check regular expression.
			///
			if(this.checkRegexp(theContainer, theKey, theSection, theReportIndex))
			{
				///
				// Check valid range.
				///
				return this.checkStringRange(
					theContainer, theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			return false                                                // ==>
		}

		return this.setStatusReport(
			'kNOT_A_STRING',
			theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateString()

	/**
	 * doValidateKey
	 *
	 * This method will validate the provided key value.
	 *
	 * The method will first assert if the value is a string.
	 * Then it will assert that the string is not empty (default namespace).
	 * The method will then check that the string corresponds to a term.
	 * Finally, the method will check the eventual data kind.
	 *
	 * Note that two special values will be checked:
	 *
	 * - Empty string: By default an empty string term reference is a reference
	 *                 to the *default namespace*. Referencing this namespace is
	 *                 only allowed if this object was instantiated with the
	 *                 `defNamespace` member set to true.
	 * - `":"``: This is the actual key of the default namespace, for this
	 *           reason it is not allowed to be used as a term key, except,
	 *           obviously, for the default namespace. Since this object is only
	 *           concerned in validating existing objects, we forbid the use of
	 *           this value as a term reference.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is a string.
	 * - Assert key is not empty, or the descriptor is not the namespace.
	 * - Assert the key is not the physical key of the default namespace.
	 * - Assert key is a valid string.
	 * - If data section has data kind:
	 * - Assert data kind is an array.
	 *   - Assert key corresponds to a term.
	 *   - Depending on data kind, assert term is an enum, descriptor or
	 *     structure definition.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateKey(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Assert string.
		///
		if(!this.doValidateString(theContainer, theKey, theSection, theReportIndex)) {
			return false                                                // ==>
		}

		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle default namespace reference.
		///
		if(value.length === 0)
		{
			///
			// Handle dictionary term and namespace field.
			///
			if(this.defNamespace &&
				theKey === module.context.configuration.namespaceIdentifier) {
				return true                                             // ==>
			}

			///
			// Handle user term or field other than _nid.
			///
			if((!this.defNamespace) ||
				(theKey !== module.context.configuration.namespaceIdentifier)) {
				return this.setStatusReport(
					'kEMPTY_KEY', theKey, value, theReportIndex
				)                                                       // ==>
			}

		} // Provided default namespace reference.

		///
		// Forbid direct reference to default namespace.
		///
		if(value === TermsCache.DefaultNamespaceKey()) {
			return this.setStatusReport(
				'kNO_REF_DEFAULT_NAMESPACE_KEY', theKey, value, theReportIndex
			)                                                           // ==>
		}

		///
		// Validate document key value.
		///
		if(!TermsCache.CheckKeyValue(value)) {
			return this.setStatusReport(
				'kBAD_KEY_VALUE', theKey, value, theReportIndex
			)                                                           // ==>
		}

		///
		// Handle data kind.
		///
		if(theSection.hasOwnProperty(module.context.configuration.dataKind))
		{
			///
			// Assert kind is an array.
			///
			const kinds = theSection[module.context.configuration.dataKind]
			if(Validator.IsArray(kinds))
			{
				///
				// Assert value matches a term.
				// We do this because we only expect term reference qualifiers
				// in the data kind, so the term must exist.
				///
				const term =
					this.cache.getTerm(
						value, this.useCache, this.cacheMissing
					)
				if(term === false)
				{
					return this.setStatusReport(
						'kVALUE_NOT_TERM', theKey, value, theReportIndex
					)                                                   // ==>
				}

				///
				// Iterate and parse data kind elements.
				// Exit on first valid value.
				// Exit if _kind is not _any-xxx.
				// Log errors.
				// Exit with last error.
				///
				let statusReport = {}     // Will hold last error.
				// Loop breaks on first status === true.
				for(const kind of kinds) {
					switch(kind) {
						case module.context.configuration.anyTerm:
							return true                                 // ==>

						case module.context.configuration.anyEnum:
							if(Validator.IsEnum(term)) {
								return true                             // ==>
							}
							statusReport = {
								"theStatus": 'kNOT_AN_ENUM',
								"theDescriptor": theKey,
								"theValue": value,
								"theReportIndex": theReportIndex,
								"theCustomFields": { "section": theSection }
							}
							break

						case module.context.configuration.anyDescriptor:
							if(Validator.IsDescriptor(term)) {
								return true                             // ==>
							}
							statusReport = {
								"theStatus": 'kNOT_A_DESCRIPTOR',
								"theDescriptor": theKey,
								"theValue": value,
								"theReportIndex": theReportIndex,
								"theCustomFields": { "section": theSection }
							}
							break

						case module.context.configuration.anyObject:
							if(Validator.IsStruct(term)) {
								return true                             // ==>
							}
							statusReport = {
								"theStatus": 'kNOT_A_STRUCTURE_DEFINITION',
								"theDescriptor": theKey,
								"theValue": value,
								"theReportIndex": theReportIndex,
								"theCustomFields": { "section": theSection }
							}
							break

						default:
							throw new Error(
								`Invalid data kind option, ${kind}, in descriptor ${theKey}.`
							)                                           // ==>

					} // Parsed allowed values.

				} // Iterating _kind elements.

				return this.setStatusReport(
					statusReport.theStatus,
					statusReport.theDescriptor,
					statusReport.theValue,
					statusReport.theReportIndex,
					statusReport.theCustomFields
				)                                                       // ==>

			} // Data kind is an array.

			throw new Error(
				`Data kind must be an array, in ${theKey}.`
			)                                                           // ==>

		} // Has data kind.

		return true                                                     // ==>

	} // doValidateKey()

	/**
	 * doValidateHandle
	 *
	 * This method will validate the provided handle value.
	 *
	 * The method will first assert if the value is a string.
	 * Finally, the method will assert that the document documentExists.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is a string.
	 * - Assert handle is well-formed.
	 * - Check collection name.
	 * - Check if collection exists.
	 * - Check key value.
	 * - Assert document exists.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateHandle(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Assert string.
		///
		if(!this.doValidateString(theContainer, theKey, theSection, theReportIndex)) {
			return false                                                // ==>
		}

		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Validate handle.
		///
		///
		// Divide the handle into its components.
		///
		const parts = value.split('/')
		if(parts.length === 2)
		{
			///
			// Check collection name.
			///
			if(TermsCache.CheckCollectionName(parts[0]))
			{
				///
				// Check collection.
				///
				if(this.cache.collectionExists(parts[0]))
				{
					///
					// Check document key.
					///
					if(TermsCache.CheckKeyValue(parts[1]))
					{
						///
						// Assert the document documentExists.
						///
						if(this.cache.documentExists(value, this.useCache, this.cacheMissing))
						{
							return true                                 // ==>

						} // Document documentExists.

						return this.setStatusReport(
							'kUNKNOWN_DOCUMENT', theKey, value, theReportIndex
						)                                               // ==>

					} // Document key OK.

					return this.setStatusReport(
						'kBAD_KEY_VALUE', theKey, value, theReportIndex
					)                                                   // ==>

				} // Collection documentExists.

				return this.setStatusReport(
					'kUNKNOWN_COLLECTION', theKey, value, theReportIndex
				)                                                       // ==>

			} // Collection name OK.

			return this.setStatusReport(
				'kBAD_COLLECTION_NAME', theKey, value, theReportIndex
			)                                                           // ==>

		} // Has one slash.

		return this.setStatusReport(
			'kBAD_HANDLE_VALUE', theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateHandle()

	/**
	 * doValidateEnum
	 *
	 * This method will validate the provided enumeration element.
	 *
	 * The method will first assert if the value is a string.
	 * Then it will assert that the string is not empty.
	 * The method will then check that the string corresponds to a term, if that
	 * is the case, it will check the eventual data kinds.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is a string.
	 * - Assert string does not reference default namespace.
	 * - Assert data section has data kind.
	 * - Assert data kind is an array.
	 * - Assert value references a term.
	 * - If term was not found:
	 *   - Try resolving term by probing codes.
	 * - If term was found:
	 *   - Assert term is an enumeration element.
	 *   - Assert term belongs to enumeration type.
	 *
	 * The method will return `true` if enum, or `false` if not.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateEnum(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Assert string.
		///
		if(!this.doValidateString(theContainer, theKey, theSection, theReportIndex)) {
			return false                                                // ==>
		}

		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Forbid direct reference to default namespace.
		///
		if(TermsCache.DefaultNamespaceKey() === value) {
			return this.setStatusReport(
				'kNO_REF_DEFAULT_NAMESPACE_KEY', theKey, value, theReportIndex
			)                                                           // ==>
		}

		///
		// Get term.
		///
		const term = this.cache.getTerm(
			value, this.useCache, this.cacheMissing
		)

		///
		// Assert existing term.
		///
		if(term === false) {
			if(this.resolve) {
				return this.doResolveEnum(
					theContainer, theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			return this.setStatusReport(
				'kVALUE_NOT_TERM', theKey, value, theReportIndex
			)                                                           // ==>
		}

		///
		// Check if it is an enumeration element.
		///
		if(!term.hasOwnProperty(module.context.configuration.sectionPath)) {
			return this.setStatusReport(
				'kNOT_AN_ENUM', theKey, value, theReportIndex
			)                                                           // ==>
		}

		///
		// Save paths.
		///
		const paths = term[module.context.configuration.sectionPath]

		///
		// Assert data kind.
		///
		if(theSection.hasOwnProperty(module.context.configuration.dataKind))
		{
			///
			// Save data kinds.
			///
			const kinds = theSection[module.context.configuration.dataKind]

			///
			// Assert data kinds.
			///
			if(!Validator.IsArray(kinds)) {
				throw new Error(
					`The data kind must be an array, in ${key}.`
				)                                                       // ==>
			}

			///
			// Match enumeration path with data kinds.
			///
			let status = false
			kinds.some( (item) => {
				if(paths.includes(item)) {
					status = true
					return true
				}
			})

			if(!status) {
				return this.setStatusReport(
					'kNOT_CORRECT_ENUM_TYPE',
					theKey, value, theReportIndex,
					{ "section": theSection}
				)                                                       // ==>
			}

		} // Has data kinds.

		return true                                                     // ==>

	} // doValidateEnum()

	/**
	 * doValidateDate
	 *
	 * This method will validate the provided string date.
	 *
	 * The method will not validate the actual date, it will only ensure the
	 * value is in the correct format.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is a string.
	 * - Check string format.
	 * - Check date range.
	 *
	 * The method will return `true` if enum, or `false` if not.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateDate(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle string.
		///
		if(Validator.IsString(value)) {
			///
			// Validate string format.
			///
			const regexp = new RegExp("^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$|^[0-9]{4}-[0-9]{4}$")
			if (value.match(regexp)) {
				return this.checkDateRange(
					theContainer, theKey, theSection, theReportIndex
				)                                                       // ==>
			}

			return this.setStatusReport(
				'kINVALID_DATE_FORMAT', theKey, value, theReportIndex
			)                                                           // ==>
		}

		return this.setStatusReport(
			'kNOT_A_STRING', theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateDate()

	/**
	 * doValidateStruct
	 *
	 * This method will validate the provided struct value.
	 *
	 * The method only asserts if the value is an object.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateStruct(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if boolean.
		///
		if(Validator.IsObject(value)) {
			return true                                                 // ==>
		}

		return this.setStatusReport(
			'kNOT_AN_OBJECT',
			theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateStruct()

	/**
	 * doValidateObject
	 *
	 * This method will validate the provided object value.
	 *
	 * The method only asserts if the value is boolean.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is an object.
	 * - Validate object rules.
	 * - Validate object keys/values.
	 *
	 * Note that this method may be called directly from the top level, so
	 * both the descriptor and the section may be missing (null): be attentive
	 * when setting status reports.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object|null}: Data or array term section, or null.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateObject(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if object.
		///
		if(Validator.IsObject(value))
		{
			///
			// Validate object structure.
			///
			if(theSection !== null) {
				if(!this.doValidateObjectStructure(
					theContainer, theKey, theSection, theReportIndex)
				){
					return this.setStatusReport(
						'kINVALID_OBJECT_STRUCTURE',
						theKey, value, theReportIndex,
						{"section": theSection}
					)                                                   // ==>
				}
			}

			///
			// Validate object.
			///
			let status = true
			Object.keys(value).some( (property) => {

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
							'kUNKNOWN_PROPERTY',
							property, value, theReportIndex
						)

						return true
					}

					return false
				}

				///
				// Assert term is a descriptor.
				///
				if(!Validator.IsDescriptor(term)) {
					status = this.setStatusReport(
						'kPROPERTY_NOT_DESCRIPTOR',
						property, value, theReportIndex
					)

					return true
				}

				///
				// Validate property/value pair.
				///
				if(!this.doValidateDataSection(
					value, property, term[module.context.configuration.sectionData],
					theReportIndex
				)) {
					status = false
					return true
				}

				return false
			})

			return status                                               // ==>
		}

		return this.setStatusReport(
			'kNOT_AN_OBJECT',
			theKey, value, theReportIndex
		)                                                               // ==>

	} // doValidateObject()

	/**
	 * doValidateGeoJSON
	 *
	 * This method will validate the provided GeoJSON object value.
	 *
	 * TODO: Need to find a suitable library for checking GeoJSON objects.
	 *
	 * Validation workflow:
	 *
	 * - Assert value is an object.
	 * - Assert value has "type" property.
	 * - Assert value has "coordinates" property.
	 * - Assert the "coordinates" property is an array.
	 *
	 * Note that the value will correspond to the "geometry" property, but
	 * may have another name.
	 *
	 * Note that this method may be called directly from the top level, so
	 * both the descriptor and the section may be missing (null): be attentive
	 * when setting status reports.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object|null}: Data or array term section, or null.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateGeoJSON(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check if object.
		///
		if(Validator.IsObject(value))
		{
			///
			// Assert object has type property.
			///
			if(!value.hasOwnProperty('type')) {
				return this.setStatusReport(
					'kGEOJSON_MISSING_TYPE',
					theKey, value, theReportIndex,
					{ "section": theSection }
				)                                                       // ==>
			}

			///
			// Assert object has coordinates property.
			///
			if(!value.hasOwnProperty('coordinates')) {
				return this.setStatusReport(
					'kGEOJSON_MISSING_COORDINATES',
					theKey, value, theReportIndex,
					{ "section": theSection }
				)                                                       // ==>
			}

			///
			// Assert coordinates is an array.
			///
			if(!Validator.IsArray(value['coordinates'])) {
				return this.setStatusReport(
					'kGEOJSON_INVALID_COORDINATES',
					theKey, value, theReportIndex,
					{ "section": theSection }
				)                                                       // ==>
			}

			return true                                                 // ==>
		}

		return this.setStatusReport(
			'kNOT_AN_OBJECT',
			theKey, value, theReportIndex,
			{ "section": theSection }
		)                                                               // ==>

	} // doValidateGeoJSON()


	/**
	 * PRIVATE VALIDATION UTILITIES
	 */


	/**
	 * doResolveEnum
	 *
	 * This method will try to resolve the current value into a valid
	 * enumeration by testing if the current value corresponds to the value in
	 * the field set in the current `resolver` property of the current object.
	 *
	 * The method will first check if the `resolve` property of the current
	 * object is set, if that is not the case, the method will return a
	 * `kVALUE_NOT_TERM` error.
	 *
	 * Then it will check if the current value corresponds to the value of the
	 * code section field whose name is in the `resolver` property of the
	 * current object, and if the eventual matched term is an enumeration
	 * belonging to one of the data kinds of the current descriptor. If that id
	 * the case, the current value will be replaced with the matching term's
	 * global identifier, the value change will be logged and the method will
	 * return true.
	 *
	 * If the value cannot be resolved, the method will return a
	 * `kVALUE_NOT_TERM` error report.
	 *
	 * *The method expects the descriptor to have the data kinds section and
	 * that the value is an array.*
	 *
	 * The method will return `true` if resolved, or `false` if not.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doResolveEnum(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check the resolve flag.
		///
		if(!this.resolve) {
			return this.setStatusReport(
				'kVALUE_NOT_TERM', theKey, value, theReportIndex
			)                                                           // ==>
		}

		///
		// Iterate data kinds.
		///
		let resolved = null
		theSection[module.context.configuration.dataKind].some( (type) => {
			const terms = this.cache.queryEnumIdentifierByCode(
				this.resolver, value, type
			)

			if(terms.length === 1) {
				resolved = terms[0]
				return true
			}
		})

		///
		// Found a match.
		///
		if(resolved !== null)
		{
			///
			// Replace value.
			///
			if(theKey !== null) {
				theContainer[theKey] = resolved
			} else {
				theContainer = resolved
			}

			///
			// Log changes.
			///
			this.logResolvedValues(
				theKey, value, resolved, theReportIndex
			)

			return true                                                 // ==>
		}

		return this.setStatusReport(
			'kVALUE_NOT_TERM', theKey, value, theReportIndex
		)                                                               // ==>

	} // doResolveEnum()

	/**
	 * doValidateObjectStructure
	 *
	 * This method will validate the structure of the provided object.
	 *
	 * The method will ensure the value follows the descriptor rules.
	 * The method will also assert that the descriptor has a rule section, and
	 * it will apply the rule section directives.
	 *
	 * If the validation fails, the method will return false, however, it will
	 * not set a status report illustrating the exact reason of the error, this
	 * is because you may have more than one object type to conform, so it is
	 * the caller responsibility to set the status report. Status reports on
	 * objects are a tricky thing, since the property may take several object
	 * structures, it would be difficult to tell if a report issued deep inside
	 * an object refer to one or another object type, that may also require
	 * different properties...
	 *
	 * The method will return `true` if valid, or `false` if not.
	 *
	 * @param theContainer {Object}: The object container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateObjectStructure(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Check if the descriptor has a data kind.
		///
		if(theSection.hasOwnProperty(module.context.configuration.dataKind))
		{
			///
			// Handle data kinds.
			///
			const kinds = theSection[module.context.configuration.dataKind]
			if(Validator.IsArray(kinds))
			{
				///
				// Iterate data kinds.
				///
				let status = false
				kinds.some( (kind) =>
				{
					///
					// Resolve kind.
					///
					const term = this.cache.getTerm(
						kind, this.useCache, this.cacheMissing
					)
					if(term === false) {
						throw new Error(
							`Invalid term reference ${kind}, was used as a data kind.`
						)                                               // ==>
					}

					///
					// Assert data kind has rule.
					///
					if(!term.hasOwnProperty(module.context.configuration.sectionRule))
					{
						throw new Error(
							`Term ${term._key} is missing the required rule section.`
						)                                               // ==>

					} // Found rule.

					///
					// Assert rule section is an object.
					///
					if(!Validator.IsObject(term[module.context.configuration.sectionRule])) {
						throw new Error(
							`Term ${term._key} has an invalid rule section.`
						)                                               // ==>
					}

					///
					// Validate rule.
					///
					if(this.doValidateObjectRule(
						theContainer, theKey, theSection, theReportIndex, term )
					){
						status = true
						return true
					}
				})

				return status                                           // ==>

			} // Data kind is an array.

			throw new Error(
				`The data kind must be an array, in ${theKey}.`
			)                                                           // ==>

		} // Descriptor has data kind.

		return true                                                     // ==>

	} // doValidateObjectStructure()

	/**
	 * doValidateObjectRule
	 *
	 * This method will validate the structure of the provided object against
	 * the rules section of the provided data kind.
	 *
	 * The method will ensure the value follows the descriptor rules.
	 *
	 * The method expects the rule section to be there and to be an object, it
	 * will check if the rules section is empty.
	 *
	 * Note that any error triggered from this method will not set a status
	 * report: this should be done by the caller.
	 *
	 * The method will return `true` if valid, or `false` if not.
	 *
	 * @param theContainer {Object}: The object container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 * @param theObjectType {Object}: The current data kind object.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateObjectRule(
		theContainer,
		theKey,
		theSection,
		theReportIndex,
		theObjectType)
	{
		///
		// Init local storage.
		///
		const rules = theObjectType[module.context.configuration.sectionRule]

		///
		// Handle empty rule section.
		///
		if(Object.keys(rules).length > 0)
		{
			///
			// Handle required properties.
			///
			if(rules.hasOwnProperty(module.context.configuration.sectionRuleRequired)) {
				if(!this.doValidateObjectRuleRequired(
					theContainer, theKey, theSection, theReportIndex, rules
				)) {
					return false                                        // ==>
				}
			}

			///
			// Handle banned properties.
			///
			if(rules.hasOwnProperty(module.context.configuration.sectionRuleBanned)) {
				if(!this.doValidateObjectRuleBanned(
					theContainer, theKey, theSection, theReportIndex, rules
				)) {
					return false                                        // ==>
				}
			}

		} // Rules section not empty.

		return true                                                     // ==>

	} // doValidateObjectRule()

	/**
	 * doValidateObjectRuleRequired
	 *
	 * This method will validate the structure of the provided object against
	 * the required properties in the rules section of the current data kind.
	 *
	 * The method will ensure that all required properties are in the object.
	 *
	 * The method expects the rule section to be there and to be an object, and
	 * to contain the required properties section.
	 *
	 * Note that any error triggered from this method will not set a status
	 * report: this should be done by the caller.
	 *
	 * The method will return `true` if valid, or `false` if not.
	 * The method exits on first false.
	 *
	 * @param theContainer {Object}: The object container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 * @param theObjectRules {Object}: The current data kind rules section.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateObjectRuleRequired(
		theContainer,
		theKey,
		theSection,
		theReportIndex,
		theObjectRules)
	{
		///
		// Init local storage.
		///
		const required = theObjectRules[module.context.configuration.sectionRuleRequired]
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle required.
		///
		let selector = null
		const properties = Object.keys(value)
		if(Object.keys(required).length > 0)
		{
			///
			// Require one among set.
			///
			selector = module.context.configuration.selectionDescriptorsOne
			if(required.hasOwnProperty(selector)) {
				if(!Validator.IsArray(required[selector])) {
					throw new Error(
						`Invalid rule section in ${selector}.`
					)                                                   // ==>
				}
				const intersection = required[selector].filter(item => properties.includes(item))
				if(intersection.length !== 1) {
					return false                                        // ==>
				}
			}

			///
			// Require one or none among set.
			///
			selector = module.context.configuration.selectionDescriptorsOneNone
			if(required.hasOwnProperty(selector)) {
				if(!Validator.IsArray(required[selector])) {
					throw new Error(
						`Invalid rule section in ${selector}.`
					)                                                   // ==>
				}
				const intersection = required[selector].filter(item => properties.includes(item))
				if(!(intersection.length === 0 || intersection.length === 1)) {
					return false                                        // ==>
				}
			}

			///
			// Require one or more among set.
			///
			selector = module.context.configuration.selectionDescriptorsAny
			if(required.hasOwnProperty(selector)) {
				if(!Validator.IsArray(required[selector])) {
					throw new Error(
						`Invalid rule section in ${selector}.`
					)                                                   // ==>
				}
				const intersection = required[selector].filter(item => properties.includes(item))
				if(intersection.length === 0) {
					return false                                        // ==>
				}
			}

			///
			// Require one or none from each set.
			///
			selector = module.context.configuration.selectionDescriptorsAnyOne
			if(required.hasOwnProperty(selector)) {
				if(!Validator.IsArray(required[selector])) {
					throw new Error(
						`Invalid rule section in ${theKey}.`
					)                                                   // ==>
				}
				let status = true
				required[selector].forEach( (choice) => {
					if(!Validator.IsArray(choice)) {
						throw new Error(
							`Invalid rule section in ${theKey}.`
						)                                               // ==>
					}
					const intersection = choice.filter(item => properties.includes(item))
					if(intersection.length > 1) {
						status = false
						return true
					}
				})
			}

			///
			// Require all from set.
			///
			selector = module.context.configuration.selectionDescriptorsAll
			if(required.hasOwnProperty(selector)) {
				if(!Validator.IsArray(required[selector])) {
					throw new Error(
						`Invalid rule section in ${selector}.`
					)                                                   // ==>
				}
				const intersection = required[selector].filter(item => properties.includes(item))
				if(intersection.length !== required[selector].length) {
					return false                                        // ==>
				}
			}

		} // Has required.

		return true                                                     // ==>

	} // doValidateObjectRuleRequired()

	/**
	 * doValidateObjectRuleBanned
	 *
	 * This method will validate the structure of the provided object against
	 * the required properties in the rules section of the current data kind.
	 *
	 * The method will ensure that all required properties are in the object.
	 *
	 * The method expects the rule section to be there and to be an object, and
	 * to contain the required properties section.
	 *
	 * Note that any error triggered from this method will not set a status
	 * report: this should be done by the caller.
	 *
	 * The method will return `true` if valid, or `false` if not.
	 * The method exits on first false.
	 *
	 * @param theContainer {Object}: The object container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 * @param theObjectRules {Object}: The current data kind rules section.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	doValidateObjectRuleBanned(
		theContainer,
		theKey,
		theSection,
		theReportIndex,
		theObjectRules)
	{
		///
		// Init local storage.
		///
		const banned = theObjectRules[module.context.configuration.sectionRuleBanned]
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Handle banned.
		///
		const properties = Object.keys(value)
		if(Object.keys(banned).length > 0)
		{
			const intersection = banned.filter(item => properties.includes(item))
			if(intersection.length > 0) {
				return false                                            // ==>
			}

		} // Has banned.

		return true                                                     // ==>

	} // doValidateObjectRuleBanned()


	/**
	 * VALIDATION UTILITY METHODS
	 */


	/**
	 * checkNumericRange
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
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	checkNumericRange(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeNumber))
		{
			///
			// Init local storage.
			///
			const range = theSection[module.context.configuration.rangeNumber]
			const value = (theKey !== null)
				? theContainer[theKey]
				: theContainer

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range))
			{
				if(range.hasOwnProperty(module.context.configuration.rangeNumberMinInclusive)) {
					if(value < range[module.context.configuration.rangeNumberMinInclusive]) {
						return this.setStatusReport(
								'kVALUE_LOW_RANGE',
								theKey, value, theReportIndex,
								{ "section": range }
							)                                           // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMinExclusive)) {
					if(value <= range[module.context.configuration.rangeNumberMinExclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMaxInclusive)) {
					if(value > range[module.context.configuration.rangeNumberMaxInclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeNumberMaxExclusive)) {
					if(value >= range[module.context.configuration.rangeNumberMaxExclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			throw new Error(
				`The range section is not an object, in ${theKey}.`
			)                                                           // ==>

		} // Has range.

		return true                                                     // ==>

	} // checkNumericRange()

	/**
	 * checkStringRange
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
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	checkStringRange(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeString))
		{
			///
			// Init local storage.
			///
			const range = theSection[module.context.configuration.rangeString]
			const value = (theKey !== null)
				? theContainer[theKey]
				: theContainer

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range))
			{
				if(range.hasOwnProperty(module.context.configuration.rangeStringMinInclusive)) {
					if(value < range[module.context.configuration.rangeStringMinInclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                           // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMinExclusive)) {
					if(value <= range[module.context.configuration.rangeStringMinExclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMaxInclusive)) {
					if(value > range[module.context.configuration.rangeStringMaxInclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeStringMaxExclusive)) {
					if(value >= range[module.context.configuration.rangeStringMaxExclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			throw new Error(
				`The range section is not an object, in ${theKey}.`
			)                                                           // ==>

		} // Has range.

		return true                                                     // ==>

	} // checkStringRange()

	/**
	 * checkDateRange
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
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	checkDateRange(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Check range.
		///
		if(theSection.hasOwnProperty(module.context.configuration.rangeDate))
		{
			///
			// Init local storage.
			///
			const range = theSection[module.context.configuration.rangeDate]
			const value = (theKey !== null)
				? theContainer[theKey]
				: theContainer

			///
			// Ensure range is an object.
			///
			if(Validator.IsObject(range))
			{
				if(range.hasOwnProperty(module.context.configuration.rangeDateMinInclusive)) {
					if(value < range[module.context.configuration.rangeDateMinInclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                           // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMinExclusive)) {
					if(value <= range[module.context.configuration.rangeDateMinExclusive]) {
						return this.setStatusReport(
							'kVALUE_LOW_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMaxInclusive)) {
					if(value > range[module.context.configuration.rangeDateMaxInclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				if(range.hasOwnProperty(module.context.configuration.rangeDateMaxExclusive)) {
					if(value >= range[module.context.configuration.rangeDateMaxExclusive]) {
						return this.setStatusReport(
							'kVALUE_HIGH_RANGE',
							theKey, value, theReportIndex,
							{ "section": range }
						)                                               // ==>
					}
				}

				return true                                             // ==>

			} // Correct range descriptor structure.

			throw new Error(
				`The range section is not an object, in ${theKey}.`
			)                                                           // ==>

		} // Has range.

		return true                                                     // ==>

	} // checkDateRange()

	/**
	 * checkArrayElements
	 *
	 * This method will assert if the provided array has the correct number of
	 * elements.
	 *
	 * The method will first check if the section has the elements indicator, if
	 * that is the case, it will validate the number of array elements.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	checkArrayElements(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Check if elements are checked.
		///
		if(theSection.hasOwnProperty(module.context.configuration.arrayElements))
		{
			///
			// Check elements count.
			///
			const elements = theSection[module.context.configuration.arrayElements]
			if(Validator.IsObject(elements))
			{
				///
				// Init local storage.
				///
				const value = (theKey !== null)
					? theContainer[theKey]
					: theContainer

				///
				// Minimum elements.
				///
				if(elements.hasOwnProperty(module.context.configuration.arrayMinElements)
					&& value.length < elements[module.context.configuration.arrayMinElements])
				{
					return this.setStatusReport(
						'kARRAY_HAS_TOO_FEW_ELEMENTS',
						theKey, value, theReportIndex,
						{ "section": theSection }
					)                                                   // ==>

				} // Too few elements.

				///
				// Maximum elements.
				///
				if(elements.hasOwnProperty(module.context.configuration.arrayMaxElements)
					&& value.length > elements[module.context.configuration.arrayMaxElements])
				{
					return this.setStatusReport(
						'kARRAY_HAS_TOO_MANY_ELEMENTS',
						theKey, value, theReportIndex,
						{ "section": theSection }
					)                                                   // ==>

				} // Too many elements.

			} // Number of elements is an object.

		} // Has number of required elements.

		return true                                                     // ==>

	} // checkArrayElements()

	/**
	 * checkRegexp
	 *
	 * This method will assert if the provided string value matches the provided
	 * regular expression.
	 *
	 * The method assumes that `theSection` contains the regular expression
	 * in the correct term. The method also assumes the value is a string.
	 *
	 * The method will return `true` if there were no errors, or `false`.
	 *
	 * @param theContainer {Object}: The value container.
	 * @param theKey {String|Number|null}: The key to the value in the container.
	 * @param theSection {Object}: Data or array term section.
	 * @param theReportIndex {Number}: Container key for value, defaults to null.
	 *
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	checkRegexp(
		theContainer,
		theKey,
		theSection,
		theReportIndex)
	{
		///
		// Init local storage.
		///
		const value = (theKey !== null)
			? theContainer[theKey]
			: theContainer

		///
		// Check regular expression.
		///
		if(theSection.hasOwnProperty(module.context.configuration.regularExpression))
		{
			//
			// Instantiate regular expression.
			//
			const regexpstr = theSection[module.context.configuration.regularExpression]
			const regexp = new RegExp(regexpstr)

			//
			// Match value.
			//
			if(!value.match(regexp)) {
				return this.setStatusReport(
					'kNO_MATCH_REGEXP',
					theKey,
					value,
					theReportIndex,
					{ "regexp": regexpstr }
				)                                                       // ==>
			}

		} // Has regular expression.

		return true                                                     // ==>

	} // checkRegexp()


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
	 * logResolvedValues
	 * This method can be used to log resolved values to the current status
	 * report. The method expects the status report to have been initialised
	 * and the current status should be idle.
	 *
	 * If later there is an error, the status will be replaced and the logged
	 * changes will be lost, but since the value is not correct, this does not
	 * matte.
	 *
	 * Since we are only interested in the descriptor and its value, making the
	 * same change to several instances of the same descriptor/value pair should
	 * result in a single log entry. The `changes` member of the status report
	 * is a key/value dictionary in which the key is the hash of the key/value
	 * combination between descriptor and value, and the value is the log
	 * entry.
	 *
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theOldValue  {String|Number|Object|Array}:
	 * @param theNewValue {String|Number|Object|Array}:
	 * @param theReportIndex {Number}: Report index, defaults to null.
	 */
	logResolvedValues(theDescriptor,
	                  theOldValue,
	                  theNewValue,
	                  theReportIndex = null)
	{
		///
		// Init local storage.
		///
		let hash
		const record = {}

		///
		// Create log key.
		///
		if(Validator.IsObject(theOldValue)) {
			hash = crypto.md5(theDescriptor + "\t" + JSON.stringify(theNewValue))
		} else {
			hash = crypto.md5(theDescriptor + "\t" + theNewValue.toString())
		}

		///
		// Create log.
		///
		record[hash] = {
			"field": theDescriptor,
			"original": theOldValue,
			"resolved": theNewValue
		}

		///
		// Set in report.
		///
		if(theReportIndex !== null) {
			if(this.report[theReportIndex].hasOwnProperty('changes')) {
				this.report[theReportIndex].changes = {
					...this.report[theReportIndex].changes,
					...record
				}
			} else {
				this.report[theReportIndex].changes = record
			}
		} else {
			if(this.report.hasOwnProperty('changes')) {
				this.report.changes = {
					...this.report.changes,
					...record
				}
			} else {
				this.report.changes = record
			}
		}

	} // logResolvedValues()


	/**
	 * STATIC UTILITY METHODS
	 */


	/**
	 * IsBoolean
	 * The method will return `true` if the provided value is a boolean.
	 * @param theValue {Array|Object|Number|String}: The value to test.
	 * @return {Boolean}: `true` if boolean, `false` if not.
	 */
	static IsBoolean(theValue)
	{
		return _.isBoolean(theValue)                                // ==>

	} // Validator::IsBoolean()

	/**
	 * IsInteger
	 * The method will return `true` if the provided value is an integer.
	 * @param theValue {Array|Object|Number|String}: The value to test.
	 * @return {Boolean}: `true` if integer, `false` if not.
	 */
	static IsInteger(theValue)
	{
		return _.isInteger(theValue)                                // ==>

	} // Validator::IsInteger()

	/**
	 * IsNumber
	 * The method will return `true` if the provided value is a number.
	 * @param theValue {Array|Object|Number|String}: The value to test.
	 * @return {Boolean}: `true` if number, `false` if not.
	 */
	static IsNumber(theValue)
	{
		return _.isNumber(theValue)                                 // ==>

	} // Validator::IsNumber()

	/**
	 * IsString
	 * The method will return `true` if the provided value is a string.
	 * @param theValue {Array|Object|Number|String}: The value to test.
	 * @return {Boolean}: `true` if string, `false` if not.
	 */
	static IsString(theValue)
	{
		return _.isString(theValue)                                 // ==>

	} // Validator::IsString()

	/**
	 * IsArray
	 * The method will return `true` if the provided value is an array.
	 * @param theValue {Array|Object|Number|String}: The value to test.
	 * @return {Boolean}: `true` if array, `false` if not.
	 */
	static IsArray(theValue)
	{
		return Array.isArray(theValue)                              // ==>

	} // Validator::IsArray()

	/**
	 * IsObject
	 * The method will return `true` if the provided value is an object.
	 * @param theValue {Array|Object|Number|String}: The value to test.
	 * @return {Boolean}: `true` if object, `false` if not.
	 */
	static IsObject(theValue)
	{
		return _.isPlainObject(theValue)                            // ==>

	} // Validator::IsObject()

	/**
	 * IsEnum
	 * The method will return `true` if the provided term is an enumeration.
	 * Note that this method expects the cache to be on.
	 * @param theTerm {Object}: The value to test.
	 * @param theEnum {String}: Optional enumeration type.
	 * @return {Boolean}: `true` if object, `false` if not.
	 */
	static IsEnum(theTerm, theEnum = '')
	{
		if(theTerm.hasOwnProperty(module.context.configuration.sectionPath)) {
			if(theEnum.length > 0) {
				return theTerm[module.context.configuration.sectionPath]
					.contains(theEnum)								// ==>
			}
		}

		return false												// ==>

	} // Validator::IsEnum()

	/**
	 * IsStruct
	 * The method will return `true` if the provided term is an object definition.
	 * Note that this method expects the cache to be on.
	 * @param theTerm {Object}: The value to test.
	 * @param theEnum {String}: Optional enumeration type.
	 * @return {Boolean}: `true` if object, `false` if not.
	 */
	static IsStruct(theTerm, theEnum = '')
	{
		return theTerm.hasOwnProperty(
			module.context.configuration.sectionRule
		)															// ==>

	} // Validator::IsStruct()

	/**
	 * IsDescriptor
	 * The method will return `true` if the provided term is a descriptor.
	 * Note that this method expects the cache to be on.
	 * @param theTerm {Object}: The value to test.
	 * @return {Boolean}: `true` if object, `false` if not.
	 */
	static IsDescriptor(theTerm)
	{
		return theTerm.hasOwnProperty(
			module.context.configuration.sectionData
		)															// ==>

	} // Validator::IsDescriptor()

} // class: Validator

module.exports = Validator
