exports.patch = function(obj, fn, patch) {
  const f = obj[fn]
  obj[fn] = function(...args) {
      const r = patch({
        original: f,
        self: this,
        args: args
      })
      return r
    }
}
