const { LocalStorage } = require("node-localstorage");
const path = require('path')

const homepath = path.join(process.env['HOME'], '/.daylog')
const storagePath = path.join(homepath, '/storage')
const storage = new LocalStorage(storagePath)

exports.storage = storage


// const userStorageTask = {
//   title: 'Prepare user storage',
//   task: (ctx, task) => new Listr([
//   ])
// }