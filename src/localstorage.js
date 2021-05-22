const { LocalStorage } = require('node-localstorage')
const path = require('path')
const packageJSON = require('../package.json')

const homepath = path.join(process.env.HOME, '/', '.' + packageJSON.name)
const storagePath = path.join(homepath, '/storage')
const storage = new LocalStorage(storagePath)

exports.storage = storage

const loadUserSettings = () =>
  JSON.parse(storage.getItem('settings') || '{}')
exports.loadUserSettings = loadUserSettings

const saveUserSettings = (settings) =>
  storage.setItem('settings', JSON.stringify(settings))
exports.saveUserSettings = saveUserSettings
