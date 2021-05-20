const { Listr } = require("listr2");
// const { LocalStorage } = require("node-localstorage");
// const path = require('path')

// const homepath = path.join(process.env['HOME'], '/.daylog')
// const storagePath = path.join(homepath, '/storage')
const { storage } = require('../localstorage')

const loadUserSettingsTask = exports.loadUserSettingsTask = async (ctx, task) => {
  ctx.settings = loasUserSettings()
}
const saveUserSettingsTask = exports.saveUserSettingsTask = async (ctx, task) =>
  saveUserSettings(ctx.settings)

const loasUserSettings = exports.loadUserSettings = () =>
  JSON.parse(storage.getItem('settings') || '{}')

const saveUserSettings = exports.saveUserSettings = (settings) =>
  storage.setItem('settings', JSON.stringify(settings))

const loadUserDatabases = exports.loadUserDatabases = () => {
  return JSON.parse(storage.getItem('databases') || '{}')
}
const saveUserDatabases = exports.saveUserDatabases = (databases) => {
  storage.setItem('databases', JSON.stringify(databases))
}

exports.getAPIKey = async (ctx, task) => {
  if (!ctx.settings.profile) {
    ctx.settings.profile = 'default'
    ctx.settings.profiles = {
      ...ctx.settings.profiles || {},
      default: {
        title: 'Default'
      }
    }
  }

  ctx.profile = ctx.settings.profiles[ctx.settings.profile]

  if (!ctx.profile.integrationToken) {
    task.output = 'No token'
    const res = await task.prompt({
      type: 'Input',
      message: 'Your integration token: https://www.notion.so/my-integrations\nEnter Integration Token'
    })
    ctx.debug.integrationToken = res
    try {
      const client = getNotionClient(res)
      ctx.dbs = await client.databases.list()
  
      ctx.client = client
      ctx.profile.integrationToken = res
    } catch (error) {
      throw new Error('Bad token')
    }
  }
  if (!ctx.client) {
    const client = getNotionClient(ctx.profile.integrationToken)
    ctx.dbs = await client.databases.list()
    ctx.client = client
  }
}

const getDatabaseTask = exports.getDatabaseTask = async (ctx, task) => {
  const dbs = (ctx.dbs || await ctx.client.databases.list()).results.map((db) => ({
    ...db,
    title_text: db.title.reduce((acc, {plain_text}) => `${acc ? acc + ' ' : ''}${plain_text}`, '')
  }))
  // ctx.debug.dbs = dbs
  saveUserDatabases(dbs)

  const promptDb = async () => {
    const result = await task.prompt({
      type: 'AutoComplete',
      message: 'Select database',
      choices: dbs.map(({title_text}) => title_text)
    })

    const selected = dbs.find(({title_text}) => title_text === result)

    ctx.profile.database = selected.id
    ctx.database = selected
  }
  if (!ctx.profile.database) {

    if (dbs.length) {
      await promptDb()
    } else {
      throw new Error('No databases shared with integration. See: https://developers.notion.com/docs/getting-started#share-a-database-with-your-integration')
    }
  }

  const database = dbs.find(({id}) => id === ctx.profile.database)

  if (!database) {
    await promptDb()
  }
  else ctx.database = database
}
const getNotionClient = exports.getNotionClient = (token) => {
  if (!token)
    throw new Error('Integration token not provided')
  
  const { Client } = require('@notionhq/client');

  return new Client({ auth: token })
}

const selectDatabase = exports.selectDatabase = async () => {

}