const chalk = require('chalk')
const program = require('commander')
const { Listr } = require('listr2')
const AsciiTable = require('ascii-table')

const packageJSON = require('../package.json')

const { loadUserSettings } = require('./localstorage')
const { loadUserDatabases, attachOptionsFromProperties, getNotionClient, buildPageFromCommander, propToText } = require('./notion')
const { getAPIKeyTask, setDatabaseTask, loadUserDatabasesTask, saveUserSettingsTask } = require('./tasks')
const { ERRORS, EplogError } = require('./errors')

const prefix = chalk`{bgBlue {white  ^ }} `
const docs = chalk`
You can use the {blue wait:1234} modifier to add a custom delay (in milliseconds) between specific words.
e.g. {cyan $ vox echo go wait:1200 helium}
`
const description = chalk`${prefix}${packageJSON.description}`
const warning = chalk`${prefix}{bgYellow.black  Alert } No available databases detected.`

const databases = loadUserDatabases()
const settings = loadUserSettings()
const profile = settings?.profiles?.[settings?.profile]

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
      .addOption(new program.Option('-l, --list', 'List avialable databases'))
      .addOption(
        new program.Option('-d, --database <database>', 'Select specific database')
          .choices(databases?.map(({ title_text }) => title_text))
      )
      .action(addAction)

    attachOptionsFromProperties(addCommand, context.database?.properties)
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
      .addOption(new program.Option('-r, --reload', 'Reload databases'))
  }

  return program
}
exports.initCLI = initCLI

const mainAction = async (options) => {
  const context = {}

  context.databases = loadUserDatabases()
  const settings = context.settings = loadUserSettings()
  const profile = context.profile = settings?.profiles?.[settings?.profile]

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
  const context = {}
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

          const propsOutput = parsedProps.length ? chalk`\n\n{dim properties (${parsedProps.length} - ${Object.keys(result.properties).join(', ')}):}\n${propsTable.toString()}` : ''
          ctx.output = chalk`id: {cyan ${result.id}}\ntime: {cyan ${result.created_time}}${propsOutput}`
        } else
          ctx.output = chalk`id: {cyan ${result.id}}`
      },
      options: { persistentOutput: true }
    }
  ], { concurrent: false })

  try {
    const result = await tasks.run({
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
