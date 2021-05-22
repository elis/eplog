const { EplogError, ERRORS } = require('./errors')
const { saveUserSettings } = require('./localstorage')
const { prepareDatabases, getNotionClient, saveUserDatabases } = require('./notion')

const saveUserSettingsTask = async (ctx, task) =>
  saveUserSettings(ctx.settings)
exports.saveUserSettingsTask = saveUserSettingsTask

const getAPIKeyTask = async (ctx, task) => {
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
      type: 'Password',
      message: 'Your integration token: https://www.notion.so/my-integrations\nEnter Integration Token'
    })
    try {
      const client = getNotionClient(res)
      ctx.dbs = await client.databases.list()

      ctx.client = client
      ctx.profile.integrationToken = res
      ctx.updateSettings = true
    } catch (error) {
      console.log('What is error?', error)
      throw new Error('Bad token')
    }
  }
  if (!ctx.client) {
    const client = getNotionClient(ctx.profile.integrationToken)
    ctx.dbs = await client.databases.list()
    ctx.client = client
  }
}
exports.getAPIKeyTask = getAPIKeyTask

const loadUserDatabasesTask = async (ctx, task) => {
  const client = ctx.client || getNotionClient(ctx.profile.integrationToken)

  const dbs = prepareDatabases(ctx.dbs || await client.databases.list())
  // ctx.debug.dbs = dbs
  saveUserDatabases(dbs)
  ctx.databases = dbs
}
exports.loadUserDatabasesTask = loadUserDatabasesTask

const setDatabaseTask = async (ctx, task) => {
  const promptDb = async () => {
    const result = await task.prompt({
      type: 'AutoComplete',
      message: 'Select database',
      choices: ctx.databases.map(({ title_text }) => title_text)
    })

    const selected = ctx.databases.find(({ title_text }) => title_text === result)

    ctx.profile.database = selected.id
    ctx.database = selected
    ctx.updateSettings = true
  }
  if (!ctx.profile.database || ctx.requestDatabase) {
    if (ctx.databases.length)
      await promptDb()
    else
      throw new EplogError('No databases shared', ERRORS.NO_SHARED_DATABASES)
  }

  const database = ctx.databases.find(({ id }) => id === ctx.profile.database)

  if (!database)
    await promptDb()
  else ctx.database = database
}
exports.setDatabaseTask = setDatabaseTask
