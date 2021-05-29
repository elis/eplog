const chalk = require('chalk')
const program = require('commander')
const { Listr } = require('listr2')
const AsciiTable = require('ascii-table')

const packageJSON = require('../package.json')

const { loadUserSettings } = require('./localstorage')
const { loadUserDatabases, attachOptionsFromProperties, getNotionClient, buildPageFromCommander, propToText, prepareDatabases } = require('./notion')
const { getAPIKeyTask, setDatabaseTask, loadUserDatabasesTask, saveUserSettingsTask, addWorkspaceName } = require('./tasks')
const { ERRORS, EplogError } = require('./errors')

const prefix = chalk`{bgBlue {white  ✎ }} `
const description = chalk`${prefix}${packageJSON.description}`
const warning = chalk`${prefix}{bgYellow.black  Alert } No available databases detected.`
const docs = chalk`\nExample usage:
{dim # add a new note:}
$ eplog add My awesome note!

{dim # add note to a different database:}
$ eplog add -d SomeDatabase Another note

{dim # change default database:}
$ eplog -u

{dim # reload databases:}
$ eplog -r
`

const databases = loadUserDatabases()
const settings = loadUserSettings()
const profile = settings?.profiles?.[settings?.profile]
const database = !!(profile?.database && databases.length) && databases.find(({ id }) => id === profile.database)

const initCLI = () => {
  const context = {}

  if (settings.profile)
    context.profile = settings.profiles[settings.profile]

  if (settings.profile)
    context.profile = settings.profiles[settings.profile]

  if (context.profile?.database) {
    const selected = databases.find(({ id }) => id === context.profile.database)
    context.database = selected
  }

  const settingsCommand = program
    .command('settings')

  // const listSettingsCommand =
  settingsCommand
    .command('list', { isDefault: true })
    .action(listSettingsAction)

  // const getSettingCommand =
  settingsCommand
    .command('get <name>')
    .description('Get the value of a given setting')
    .action(getSettingAction)

  // const setSettingCommand =
  settingsCommand
    .command('set <name> <value>')
    .description('Set the value of a given setting')
    .action(setSettingAction)

  // const deleteSettingCommand =
  settingsCommand
    .command('delete <name>')
    .description('Delete an existing setting')
    .action(deleteSettingAction)

  if (databases.length) {
    const addCommand = program
      .command('add <title...>')
      .addOption(new program.Option('-l, --list', 'List available databases'))
      .addOption(new program.Option('-o, --open', 'Open the created document'))
      .addOption(
        new program.Option('-d, --database <database>', 'Select specific database')
          .choices(databases?.map(({ title_text }) => title_text))
      )
      .action(addAction)

    attachOptionsFromProperties(addCommand, context.database?.properties)

    // const listCommand =
    program
      .command('list [terms...]')
      .addOption(new program.Option('-a, --amount <number>', 'List number of items').default(12))
      .addOption(
        new program.Option('-d, --database <database>', 'Select specific database')
          .choices(databases?.map(({ title_text }) => title_text))
      )
      .action(listAction)

    // const execCommand =
    program.command('exec <filename>')
      .addOption(
        new program.Option('-d, --database <database>', 'Select specific database')
          .choices(databases?.map(({ title_text }) => title_text))
      )
      .action(execAction)
  }

  const mainCommand = program
    .name(Object.keys(packageJSON.bin)[0] || 'eplog')
    .version(packageJSON.version)
    .description(
      chalk`${description}${!databases?.length ? '\n' + warning : ''}`
    )
    .addHelpText('after', docs)
    .action(mainAction)

  if (databases.length) {
    mainCommand
      .addOption(new program.Option('-l, --list', 'List avialable databases'))
      .addOption(new program.Option('-u, --database [name]', 'Set default database')
        // eslint-disable-next-line camelcase
        .choices(databases?.map(({ title_text }) => title_text))
      )
      .addOption(new program.Option('-w, --workspace [name]', 'Set Notion workspace')
      )
      .addOption(new program.Option('-r, --reload', 'Reload databases'))
  }

  return program
}
exports.initCLI = initCLI

const mainAction = async (options) => {
  const context = { options }

  context.databases = loadUserDatabases()
  const settings = context.settings = loadUserSettings()
  const profile = context.profile = settings?.profiles?.[settings?.profile]

  if (options.list) {
    const dbs = context.databases.reduce((acc, db) =>
      chalk`${acc ? acc + '\n' : ''}${db.title_text} {dim ${db.id}}`
    , '')
    console.log(dbs)
    return
  }

  const mainTasks = [
    {
      title: 'Initialize Eplog',
      enabled: () => !profile || !profile.integrationToken || !profile.database,
      task: async (ctx, task) => {
        return task.newListr([
          {
            title: 'Notion API',
            task: async (ctx, subTask) => {
              if (!settings || !profile?.integrationToken) {
                const result = await subTask.prompt({
                  type: 'confirm',
                  message: 'You do not have an API key (integration token) set up - would you like to set one up right now?'
                })
                if (!result) throw new EplogError('Not confirmed', ERRORS.USER_CANCELED)
              }
            }
          },
          {
            title: 'Enter API Key',
            enabled: (ctx) => !ctx.profile?.integrationToken,
            task: getAPIKeyTask
          },
          {
            title: 'Save User Settings',
            enabled: (ctx) => ctx.updateSettings,
            task: saveUserSettingsTask
          },
          {
            // title: 'Load user databases',
            task: loadUserDatabasesTask
          },
          {
            title: 'Select Default Database',
            enabled: (ctx) => !ctx.profile?.database,
            task: setDatabaseTask
          }
        ])
      }
    },
    {
      title: 'Reload Database',
      enabled: () => options.reload,
      task: (ctx, { newListr }) =>
        newListr([
          { task: getAPIKeyTask },
          { task: loadUserDatabasesTask }
        ])
    },
    {
      title: 'Set Notion Workspace',
      enabled: () => options.workspace,
      task: (ctx, { newListr }) =>
        newListr([
          { task: getAPIKeyTask },
          { task: addWorkspaceName }
        ])
    },
    {
      title: 'Select Default Database',
      enabled: (ctx) => options.database,
      task: async (ctx, task) => {
        if (typeof options.database === 'string') {
          const database = context.database = ctx.databases?.find(({ id, title_text }) =>
            title_text === options.database
          )
          ctx.profile.database = database.id
          task.title = chalk`Database selected: {cyan ${database.title_text}} {dim (id: {cyan ${database.id}})}`
        } else {
          const result = await task.prompt({
            type: 'AutoComplete',
            message: 'Select database',
            choices: ctx.databases.map(({ title_text }) => title_text)
          })
          const database = context.database = ctx.databases.find(({ id, title_text }) =>
            title_text === result
          )
          ctx.profile.database = database.id
          task.title = chalk`Database selected: {cyan ${result}} {dim (id: {cyan ${database.id}})}`
        }
        ctx.updateSettings = true
      }
    },
    {
      title: 'Save User Settings',
      enabled: (ctx) => ctx.updateSettings,
      task: saveUserSettingsTask
    }
  ]

  try {
    const tasks = new Listr(mainTasks, { concurrent: false })
    await tasks.run(context)
  } catch (error) {
    if (error.code === ERRORS.NO_SHARED_DATABASES)
      console.log('No databases shared with integration. See: https://developers.notion.com/docs/getting-started#share-a-database-with-your-integration')
    else if (error.code === ERRORS.USER_CANCELED)
      console.log('Goodbye. 👋')
    else console.log('Error with tasks:', error)
  }
}

const addAction = async (title, options, ...rest) => {
  const context = { options }
  const databases = context.databases = loadUserDatabases()
  const settings = context.settings = loadUserSettings()
  const profile = context.profile = settings?.profiles?.[settings?.profile]

  const database = context.database = databases?.find(({ id, title_text }) =>
    options.database
      ? title_text.toLowerCase() === options.database.toLowerCase()
      : id === profile?.database
  )

  const client = getNotionClient(context.profile.integrationToken)

  title = title.join(' ')
  const page = buildPageFromCommander(context.database, title, options)

  const tasks = new Listr([
    {
      title: chalk`Save {green "${title}"} to {cyan ${database.title_text}}`,
      task: async (ctx, task) => {
        const result = ctx.result = await client.pages.create(page)
        ctx.url = `https://notion.so/${result.id.split('-').join('')}`
        const linkOutput = chalk`\n${ctx.url}`
        const idOutput = chalk`id: {cyan ${result.id}}`
        if (!ctx.profile.compact) {
          const table = new AsciiTable()
          table.addRow('id', result.id)
          table.addRow('created_time', result.created_time)

          const propsTable = new AsciiTable()
          const parsedProps = Object.entries(result.properties)
            .map(([name, prop]) => {
              const value = propToText(prop)
              propsTable.addRow(name, value)
              return value
            })

          const propsOutput = parsedProps.length ? chalk`\n\n{dim properties:}\n${propsTable.toString()}` : ''
          ctx.output = chalk`${idOutput}${linkOutput}\ntime: {cyan ${result.created_time}}${propsOutput}`
        } else
          ctx.output = chalk`${idOutput}${linkOutput}`
      },
      options: { persistentOutput: true }
    },
    {
      title: 'Open created item...',
      enabled: (ctx) => !!ctx.options.open,
      task: async (ctx, task) => {
        const exec = require('child_process').exec
        exec('open ' + ctx.url)
      }
    }
  ], { concurrent: false })

  try {
    const result = await tasks.run({
      ...context,
      profile,
      database
    })

    if (result.output)
      console.log(result.output)
  } catch (error) {
    if (error.code === 'validation_error')
      console.log('Error: ', error.message)
    else console.log('Error with add task:', error)
  }
}

const listSettingsAction = (options) => {
  if (!profile) return console.log('Run the initialization process')

  const { title, ...listSettings } = profile
  Object.entries(listSettings).forEach(([name, value]) =>
    console.log(chalk`${name}: {cyan ${valueMask(name, value)}}`)
  )
}

const listAction = async (terms, options) => {
  let selectedDB = database

  if (options.database)
    selectedDB = databases.find(({ title_text }) => title_text.toLowerCase() === options.database.toLowerCase())

  const client = getNotionClient(profile.integrationToken)

  let cursor
  let counter = 0

  const templateRow = (ctx) => {
    const [titleName, titleProp] = Object.entries(ctx.properties).find(([name, { type }]) => type === 'title') || []
    return chalk`{dim [{green ${`${++counter}`.padStart(2, '0')}}]} {dim ${titleName}:} {cyan ${titleProp.title.reduce((acc, el) => `${acc ? acc + ' ' : ''}${el.plain_text}`, '')}} {dim ({blue {underline https://notion.so/${ctx.id.split('-').join('')}}})}`
  }

  const stateMessage = chalk`Listing database items - {dim {cyan ${selectedDB.title_text}}} ${terms.length > 0 ? chalk`{dim {green "${terms.join(' ')}"}}` : ''}`
  console.log(stateMessage)

  const query = async () => {
    const results = await client.databases.query({
      database_id: selectedDB.id,
      page_size: +options.amount,
      ...cursor ? { start_cursor: cursor } : {},
      ...terms.length
        ? {
            filter: {
              or: [
                {
                  property: 'Name',
                  title: {
                    contains: terms.join(' ')
                  }
                }
              ]
            }
          }
        : {}
    })

    const rows = results.results.map(templateRow)
      .reduce((acc, row) => `${acc ? acc + '\n' : ''}${row}`, '')

    const noResults = chalk`No results.`
    console.log(rows || noResults)

    if (results.has_more) {
      const { Confirm } = require('enquirer')
      const confirm = new Confirm({ message: 'Show more items?' })
      const input = await confirm.run()
      if (input) {
        cursor = results.next_cursor
        query()
      }
    }
  }

  query()
}

const valueMask = (name, value) =>
  name === 'integrationToken'
    ? value.substr(0, 8) + ([...new Array(value.length - 16)]).join('▫︎') + value.substr(value.length - 8)
    : value

const getSettingAction = (name, options) => {
  if (!profile) return console.log('Run the initialization process')

  console.log(profile?.[name] || chalk`{dim Undefined}`)
}

const setSettingAction = (name, value, options) => {
  const context = {
    settings,
    profile
  }

  if (!profile) return console.log('Run the initialization process')

  const tasks = new Listr([
    {
      title: chalk`Update setting {cyan ${name}} to {green ${value}}${profile[name] ? chalk` {dim (previous: {cyan ${profile[name]}})}` : ''}`,
      enabled: (ctx) => ctx.updateSettings,
      task: saveUserSettingsTask
    }
  ], { concurrent: false })

  profile[name] = value === 'true'
    ? true
    : value === 'false'
      ? false
      : value

  tasks.run({
    ...context,
    updateSettings: true
  })
}

const deleteSettingAction = (name, options) => {
  const context = {}
  const settings = context.settings = loadUserSettings()
  const profile = context.profile = settings?.profiles?.[settings?.profile]

  if (!profile) return console.log('Run the initialization process')

  const tasks = new Listr([
    {
      title: chalk`Delete {cyan ${name}} from settings${profile[name] ? chalk` {dim (value: {cyan ${profile[name]}})}` : ''}`,
      enabled: (ctx) => ctx.updateSettings,
      task: saveUserSettingsTask
    }
  ], { concurrent: false })

  delete profile[name]

  tasks.run({
    ...context,
    updateSettings: true
  })
}

const execAction = async (filename, options, program) => {
  const context = {
    program,
    options,
    profile,
    databases,
    database,
    settings
  }

  context.args = program.parent?.args?.slice(2)
  const path = require('path')
  const modulePath = path.resolve(process.env.PWD, filename)
  const fileModule = require(modulePath)
  if (!fileModule.init || typeof fileModule.init !== 'function')
    throw new Error('Unable to execute file module - `init` export not found')

  const dirname = path.dirname(modulePath)
  const rcfilePath = path.resolve(dirname, './.eplogrc')
  const rcAccess = await require('fs').promises.access(rcfilePath, require('fs').promises.R_OK).catch(() => false)
  if (rcAccess) {
    const fileData = await require('fs').promises.readFile(rcfilePath, { encoding: 'utf8' })
    const loadedProfile = require('yaml').parse(fileData)
    context.profile = { ...context.profile, ...loadedProfile }
  }
  if (fileModule.profile)
    context.profile = { ...context.profile, ...fileModule.profile }
  try {
    if (context.profile.integrationToken) {
      const client = getNotionClient(context.profile.integrationToken)
      const dbs = await client.databases.list()

      if (!dbs || !dbs.results.length)
        throw new EplogError('No databases shared with integration', ERRORS.NO_SHARED_DATABASES)

      context.databases = prepareDatabases(dbs)
      context.database = context.profile.database
        ? context.databases.find(({ id, title_text }) => id === context.profile.database || title_text === context.profile.databaseName)
        : false

      return await fileModule.init(context, client)
    } else
      throw new EplogError('Missing integration token', ERRORS.MISSING_INTEGRATION_TOKEN)
  } catch (err) {
    if (err.code === 'unauthorized')
      console.log(`Bad integration token - token provided: "${context.profile.integrationToken}"`)
    else if (err.code && [ERRORS.NO_SHARED_DATABASES, ERRORS.MISSING_INTEGRATION_TOKEN].contains(err.code))
      console.log(chalk`{bgWhite {red  Error }}: ${err.message}`)
    else {
      console.log(chalk`{bgWhite {red  Script Error }}:`)
      console.error(err)
    }
  }
}
