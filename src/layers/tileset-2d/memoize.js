// deck.gl, MIT license
// @note - this is a duplicate of the deck.gl core export (because Tileset2D should be deck.gl independent)

/**
 * Speed up consecutive function calls by caching the result of calls with identical input
 * https://en.wikipedia.org/wiki/Memoization
 * @param compute - the function to be memoized
 */
export function memoize(compute) {
  let cachedArgs = {}
  let cachedResult

  return args => {
    for (const key in args) {
      if (!isEqual(args[key], cachedArgs[key])) {
        cachedResult = compute(args)
        cachedArgs = args
        break
      }
    }
    return cachedResult
  }
}

function isEqual(a, b) {
  if (a === b) {
    return true
  }
  if (Array.isArray(a)) {
    // Special treatment for arrays: compare 1-level deep
    // This is to support equality of matrix/coordinate props
    const len = a.length
    if (!b || b.length !== len) {
      return false
    }

    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
        return false
      }
    }
    return true
  }
  return false
}
