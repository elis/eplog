const { saveUserSettings } = require('./localstorage')
const { prepareDatabases } = require("./notion")

const saveUserSettingsTask = exports.saveUserSettingsTask = async (ctx, task) =>
  saveUserSettings(ctx.settings)

exports.getAPIKeyTask = async (ctx, task) => {
  if (!ctx.settings.profile) {
    ctx.settings.profile = 'default'
    ctx.settings.profiles = {
      ...ctx.settings.profiles || {},
      default: {
        title: 'Default'
      }
    }

    ctx.updateSettings = true
  }

  ctx.profile = ctx.settings.profiles[ctx.settings.profile]

  if (!ctx.profile.integrationToken) {
    task.output = 'No token'
    const res = await task.prompt({
      type: 'Input',
      message: 'Your integration token: https://www.notion.so/my-integrations\nEnter Integration Token'
    })
    try {
      const client = getNotionClient(res)
      ctx.dbs = await client.databases.list()
  
      ctx.client = client
      ctx.profile.integrationToken = res
      ctx.updateSettings = true

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

const loadUserDatabasesTask = exports.loadUserDatabasesTask = async (ctx, task) => {
  const dbs = prepareDatabases(ctx.dbs || await ctx.client.databases.list())
  // ctx.debug.dbs = dbs
  saveUserDatabases(dbs)
  ctx.databases = dbs
}

const setDatabaseTask = exports.setDatabaseTask = async (ctx, task) => {

  const promptDb = async () => {
    const result = await task.prompt({
      type: 'AutoComplete',
      message: 'Select database',
      choices: ctx.databases.map(({title_text}) => title_text)
    })

    const selected = ctx.databases.find(({title_text}) => title_text === result)

    ctx.profile.database = selected.id
    ctx.database = selected
    ctx.updateSettings = true
  }
  if (!ctx.profile.database || ctx.requestDatabase) {
    if (ctx.databases.length) {
      await promptDb()
    } else {
      throw new Error('No databases shared with integration. See: https://developers.notion.com/docs/getting-started#share-a-database-with-your-integration')
    }
  }

  const database = ctx.databases.find(({id}) => id === ctx.profile.database)

  if (!database) {
    await promptDb()
  }
  else ctx.database = database
}
