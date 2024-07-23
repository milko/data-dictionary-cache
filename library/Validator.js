'use strict'

//
// Import frameworks.
//
const _ = require('lodash')

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
	 * The constructor will initialise two members:
	 * - `cache` wgich implements the database interface and the cache.
	 * - `status`: The status report of the validation process.
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
	validateObject(theValue, theParent = null)
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
	 * @param theValue {Any}: The descriptor value.
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
	 * validateValue
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value.
	 *
	 * If the descriptor does *not correspond* to any existing terms, the value
	 * will be considered *valid*.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValue {Any}: The descriptor value.
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateValue(theValue, theDescriptor, theParent = null)
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
		// Do something with the descriptor record.
		///

		return true                                                     // ==>

	} // validateValue()

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
	 * @param theValue {Any}: The descriptor value.
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
				dataSection[module.context.configuration.sectionScalar],
				theParent
			)                                                           // ==>
		} else if(dataSection.hasOwnProperty(module.context.configuration.sectionArray)) {
			return this.validateArray(
				theValue,
				dataSection[module.context.configuration.sectionArray],
				theParent
			)                                                           // ==>
		} else if(dataSection.hasOwnProperty(module.context.configuration.sectionSet)) {
			return this.validateSet(
				theValue,
				dataSection[module.context.configuration.sectionSet],
				theParent
			)                                                           // ==>
		} else if(dataSection.hasOwnProperty(module.context.configuration.sectionDict)) {
			return this.validateDict(
				theValue,
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
	 * DATA TYPE METHODS
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
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateScalar(theValue, theSection, theParent)
	{

		return true                                                    // ==>

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
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateArray(theValue, theSection, theParent)
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
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateSet(theValue, theSection, theParent)
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
	 * @param theSection {Object}: Scalar descriptor section.
	 * @param theParent {Array|Object}: Parent value, defaults to null.
	 * @return {Boolean}: `true` if valid, `false` if not.
	 */
	validateSet(theValue, theSection, theParent)
	{

		return true                                                    // ==>

	} // validateSet()


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
