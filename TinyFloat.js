
/**
 * @param {boolean} signed
 * @param {number} exponentSize
 * @param {number} exponentBias
 * @return {function(new:TinyFloat, ?(undefined|boolean|number|string|Object))}
 */
function createTinyFloat(signed, exponentSize, exponentBias) {
  if (typeof signed !== 'boolean') {
    throw new TypeError('The signed flag must be a boolean')
  }
  if (
    (typeof exponentSize !== 'number') ||
    !Number.isInteger(exponentSize) ||
    (exponentSize < 1) ||
    ((signed && (exponentSize > 7)) || (!signed && (exponentSize > 8)))
  ) {
    throw new TypeError('The exponent size must be specified a positive ' +
          'integer, that cannot be greater than 7 for signed tiny floats, ' +
          'nor greater than 8 for unsigned tiny floats')
  }
  if ((typeof exponentBias !== 'number') || !Number.isInteger(exponentBias)) {
    throw new TypeError('The exponent bias must be an integer')
  }

  /**
   * Symbols used to represent the private fields and methods of the
   * {@linkcode TinyFloat} instances.
   *
   * @type {Object<string, symbol>}
   */
  const PRIVATE = Object.freeze({
    // fields
    value: Symbol('value'),

    // methods
    importValue: Symbol('importValue')
  })

  const BIT_MASKS = Object.freeze({
    SIGN: 0x80, //  1 0000 000
    EXPONENT: 0x78, // 0 1111 000
    MANTISSA: 0x07 // 0 0000 111
  })

  const EXPONENT_BIAS = -2

  // We have 14 available NaN values (x 1111 yyy for yyy !== 000) to reduce the
  // risk of TinyFloat(NaN) === TinyFloat(NaN). Since there are only 14 NaN
  // values available, the 15th NaN value will be equal to the 1st when
  // compared using == or ===. Because of this, TinyFloat.equals(),
  // TinyFloat.identicalTo() or TinyFloat.isNaN() should be used when comparing
  // tiny float numbers.
  let lastNaNValue = 0

  // Since we want TinyFloat(x) === TinyFloat(x) (like regular numbers, only
  // NaN will be the issue here), and there are only 256 possible values, we
  // can cache them.
  const INSTANCE_CACHE = {}

  class TinyFloat {
    /**
     * @param {?(undefined|boolean|number|string|Object)} value
     */
    constructor(value) {
      if (value instanceof Object) {
        let primitiveValue = value.valueOf()
        if (primitiveValue instanceof Object) {
          return TinyFloat.NaN
        }

        return new TinyFloat(primitiveValue)
      }

      if ((typeof value === 'boolean') || (value === null)) {
        return new TinyFloat(value ? 1 : 0)
      }

      if (value === undefined) {
        return TinyFloat.NaN
      }

      if (typeof value === 'string') {
        return new TinyFloat(parseFloat(value))
      }

      let tinyFloatValue = this[PRIVATE.importValue](value)

      if (INSTANCE_CACHE[tinyFloatValue]) {
        return INSTANCE_CACHE[tinyFloatValue]
      }

      this[PRIVATE.value] = tinyFloatValue
      INSTANCE_CACHE[tinyFloatValue] = this

      Object.freeze(this)
    }

    /**
     * @return {number}
     */
    get sign() {
      return (this[PRIVATE.value] & BIT_MASKS.SIGN) >> 7
    }

    /**
     * @return {number}
     */
    get exponent() {
      return (this[PRIVATE.value] & BIT_MASKS.EXPONENT) >> 3
    }

    /**
     * @return {number}
     */
    get mantissa() {
      return this[PRIVATE.value] & BIT_MASKS.MANTISSA
    }

    /**
     * @return {TinyFloat}
     */
    abs() {
      if (this.sign()) {
        return new TinyFloat(-this.valueOf())
      }

      return this
    }

    /**
     * @param {(Object|TinyFloat)} otherValue
     * @return {boolean}
     */
    equals(otherValue) {
      if (otherValue instanceof TinyFloat) {
        return !TinyFloat.isNaN(otherValue) &&
            !TinyFloat.isNaN(this) &&
            (this === otherValue)
      }

      return this.valueOf() == otherValue
    }

    /**
     *
     * @param {(Object|TinyFloat)} otherValue
     * @return {boolean}
     */
    identicalTo(otherValue) {
      if (!(otherValue instanceof TinyFloat)) {
        return false
      }

      return this.equals(otherValue)
    }

    /**
     * @return {number}
     */
    valueOf() {
      if (TinyFloat.isNaN(this)) {
        return NaN
      }

      let sign = this.sign
      if (!TinyFloat.isFinite(this)) {
        return sign ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
      }

      let exponent = this.exponent
      if (!exponent) { // subnormal numbers
        return sign ? (-this.mantissa) : this.mantissa
      }

      // normalized number
      let realExponent = exponent - EXPONENT_BIAS
      let value = 2 ** realExponent
      let mantissa = this.mantissa
      if ((mantissa & 0x4) > 0) {
        value += 2 ** (realExponent - 1)
      }
      if ((mantissa & 0x2) > 0) {
        value += 2 ** (realExponent - 2)
      }
      if ((mantissa & 0x1) > 0) {
        value += 2 ** (realExponent - 3)
      }

      return sign ? -value : value
    }

    /**
     * @return {string}
     */
    toString() {
      return `${this.valueOf()}`
    }

    /**
     * @return {TinyFloat}
     */
    static get ZERO() {
      return COMMON_VALUES.ZERO
    }

    /**
     * @return {TinyFloat}
     */
    static get EPSILON() {
      return COMMON_VALUES.EPSILON
    }

    /**
     * @return {TinyFloat}
     */
    static get NaN() {
      return new TinyFloat(NaN) // always* generate a new NaN value
    }

    /**
     * @return {TinyFloat}
     */
    static get POSITIVE_INFINITY() {
      return COMMON_VALUES.POSITIVE_INFINITY
    }

    /**
     * @return {TinyFloat}
     */
    static get NEGATIVE_INFINITY() {
      return COMMON_VALUES.NEGATIVE_INFINITY
    }

    /**
     * @return {TinyFloat}
     */
    static get MAX_VALUE() {
      return COMMON_VALUES.MAX_VALUE
    }

    /**
     * @return {TinyFloat}
     */
    static get MIN_VALUE() {
      return COMMON_VALUES.MIN_VALUE
    }

    /**
     * @return {TinyFloat}
     */
    static get MAX_SAFE_INTEGER() {
      return COMMON_VALUES.MAX_SAFE_INTEGER
    }

    /**
     * @return {TinyFloat}
     */
    static get MIN_SAFE_INTEGER() {
      return COMMON_VALUES.MIN_SAFE_INTEGER
    }

    /**
     * @param {TinyFloat} tinyFloat
     * @return {boolean}
     */
    static isFinite(tinyFloat) {
      return !this.isNaN(tinyFloat) &&
          (tinyFloat !== TinyFloat.POSITIVE_INFINITY) &&
          (tinyFloat !== TinyFloat.NEGATIVE_INFINITY)
    }

    /**
     * @param {TinyFloat} tinyFloat
     * @return {boolean}
     */
    static isInteger(tinyFloat) {
      return this.isFinite(tinyFloat)
    }

    /**
     * @param {TinyFloat} tinyFloat
     * @return {boolean}
     */
    static isSafeInteger(tinyFloat) {
      return (Math.abs(tinyFloat.valueOf()) - 7) <= 0
    }

    /**
     * @param {TinyFloat} tinyFloat
     * @return {boolean}
     */
    static isNaN(tinyFloat) {
      return (tinyFloat.exponent === 15) && tinyFloat.mantissa
    }

    /**
     * @param value
     * @return {number}
     */
    [PRIVATE.importValue](value) {
      let integralValue = value > 0 ? Math.floor(value) : Math.ceil(value)
      if (integralValue === 0) {
        return 0
      } else if (Math.abs(integralValue) > 122880) { // infinity
        let sign = integralValue > 0 ? 0 : (1 << 7)
        let exponent = 15 << 3
        return sign | exponent
      } else if (isNaN(integralValue)) {
        lastNaNValue = (lastNaNValue + 1) % 16
        if ((lastNaNValue & BIT_MASKS.MANTISSA) === 0) {
          lastNaNValue = (lastNaNValue + 1) % 16
        }
        let sign = (lastNaNValue >> 3) << 7
        let exponent = 15 << 3
        return sign | exponent | (lastNaNValue & BIT_MASKS.MANTISSA)
      } else if (Math.abs(integralValue) < 8) { // subnormal numbers
        let sign = integralValue > 0 ? 0 : (1 << 7)
        let mantissa = Math.abs(integralValue)
        return sign | mantissa
      } else { // normalized numbers
        let sign = integralValue > 0 ? 0 : (1 << 7)
        let rawExponent = Math.floor(Math.log2(Math.abs(integralValue)))
        let exponent = Math.max(rawExponent + EXPONENT_BIAS, 0) << 3
        let remainder = Math.abs(integralValue) - (2 ** rawExponent)
        let mantissa = 0
        if (remainder >= (2 ** (rawExponent - 1))) {
          mantissa += 4
          remainder -= 2 ** (rawExponent - 1)
        }
        if (remainder >= (2 ** (rawExponent - 2))) {
          mantissa += 2
          remainder -= 2 ** (rawExponent - 2)
        }
        if (remainder >= (2 ** (rawExponent - 3))) {
          mantissa += 1
        }
        return sign | exponent | mantissa
      }
    }
  }

  /**
   * @type {Object<string, TinyFloat>}
   */
  const COMMON_VALUES = Object.freeze({
    ZERO: new TinyFloat(0),
    EPSILON: new TinyFloat(1),
    POSITIVE_INFINITY: new TinyFloat(Number.POSITIVE_INFINITY),
    NEGATIVE_INFINITY: new TinyFloat(Number.NEGATIVE_INFINITY),
    MAX_VALUE: new TinyFloat(122880),
    MIN_VALUE: new TinyFloat(1),
    MAX_SAFE_INTEGER: new TinyFloat(7),
    MIN_SAFE_INTEGER: new TinyFloat(-7)
  })

  return TinyFloat
}
