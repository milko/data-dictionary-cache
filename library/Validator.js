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
	 * known terms will be considered descriptors and their values will be
	 * checked.
	 *
	 * The outcome of the validation will be published in the `report` data
	 * member. If the validation failed, the report might also hold data members
	 * referencing parts of the offending object.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValue {Object}: Object to validate.
	 * @param theParent {Any}: Parent value, defaults to null.
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
		this.report.value = theValue

		return false                                                    // ==>

	} // validateObject()

	/**
	 * validateObjects
	 *
	 * Use this method to validate an array of objects. Each object's property
	 * will be scanned.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theValues {[Object]}: The object value.
	 * @param theParent {Any}: Parent value, defaults to null.
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
	 * validateValue
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value.
	 *
	 * If the descriptor does not correspond to any existing term,the value will
	 * be considered *valid*.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theValue {Any}: The descriptor value.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateValue(theDescriptor, theValue)
	{
		///
		// Locate term.
		///
		const term = this.cache.getTerm(theDescriptor, true, false)
		if(term === false) {
			return true                                                 // ==>
		}

		///
		// Do something with the descriptor record.
		///

		return true                                                     // ==>

	} // validateValue()

	/**
	 * validateDescriptor
	 *
	 * This method will validate the key/value pair constituted by the provided
	 * descriptor and the provided value.
	 *
	 * If the descriptor does not correspond to any existing term,the validation
	 * will fail.
	 *
	 * The method returns a boolean: `true` means the validation was successful,
	 * if the validation failed, the method will return `false`.
	 *
	 * @param theDescriptor {String}: The descriptor global identifier.
	 * @param theValue {Any}: The descriptor value.
	 * @return {Boolean}: `true` means valid, `false` means error.
	 */
	validateDescriptor(theDescriptor, theValue)
	{
		///
		// Locate term.
		///
		const term = this.cache.getTerm(theDescriptor, true, false)
		if(term === false) {
			this.report = new ValidationReport('kUNKNOWN_DESCRIPTOR')
			this.report.descriptor = theDescriptor

			return false                                                // ==>
		}

		///
		// Do something with the descriptor record.
		///

		return true                                                     // ==>

	} // validateDescriptor()


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
