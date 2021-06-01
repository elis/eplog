
const ERRORS = {
  USER_CANCELED: 1000,
  MISSING_INTEGRATION_TOKEN: 3002,
  NO_SHARED_DATABASES: 3004,
  RELATION_DATABASE_NOT_LOADED: 3005
}
exports.ERRORS = ERRORS

class EplogError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
  }
}
EplogError.ERRORS = ERRORS
exports.EplogError = EplogError
