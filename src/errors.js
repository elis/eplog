
const ERRORS = {
  USER_CANCELED: 1000,
  NO_SHARED_DATABASES: 3004
}
exports.ERRORS = ERRORS

class EplogError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
  }
}
exports.EplogError = EplogError
