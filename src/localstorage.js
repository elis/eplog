const { LocalStorage } = require("node-localstorage");
const path = require('path')

const homepath = path.join(process.env['HOME'], '/.daylog')
const storagePath = path.join(homepath, '/storage')
const storage = new LocalStorage(storagePath)

exports.storage = storage

const loasUserSettings = exports.loadUserSettings = () =>
  JSON.parse(storage.getItem('settings') || '{}')

const saveUserSettings = exports.saveUserSettings = (settings) =>
  storage.setItem('settings', JSON.stringify(settings))
