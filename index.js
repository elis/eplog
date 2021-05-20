const chalk = require('chalk')
const program = require('commander')
const packageJSON = require('./package.json')
const { Client } = require('@notionhq/client');
const LocalStorage = require('node-localstorage').LocalStorage
const Listr = require('listr2').Listr

const tasksss = require('./src/tasks/tasks')

const { getVoicepacks, prefix } = require('./lib/util')
const NOTION_API_KEY = 'secret_boM6kupKDNRglxKgigrtsatBEmg4kse6sQ2dPjWoHD6'

const databases = tasksss.loadUserDatabases()
const settings = tasksss.loadUserSettings()

const storage = new LocalStorage('./scratch')
const run = async (input, options) => {
  const context = {}

  console.log('what is input and what are options?', { input, options })
  if (options.list) {
    console.log(chalk`{bold Available databases}`)
    console.log(databases.reduce((str, db) => chalk`${db.title_text} {dim - ${db.id}}\n`, ''))
    return
  }
  if (settings.profile) {
    context.profile = settings.profiles[settings.profile]
  }
  if (options.database) {
    const selected = databases.find(({title_text}) => title_text.toLowerCase() === options.database.toLowerCase())
    context.database = selected
  }
  else if (context.profile?.database) {
    const selected = databases.find(({id}) => id === context.profile.database)
    context.database = selected
  }

  if (input && input.length) {
    console.log('INPUT:', input)
    console.log('context.database:', context.database)
    console.log('context.profile:', context.profile)
    const client = new Client({ auth: context.profile.integrationToken });
    const result = await client.pages.create({
      parent: {
        database_id: context.database.id,
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: input.join(' ')
              }
            }
          ]
        }
      }
    })
    console.log('Result:', result)
    return
  }
  else {
    console.log('NO INPUT:')
    // return
  }

  (async () => {
    const profiles = storage.getItem('profiles')
    console.log('Profiles:', profiles)
    // console.log('process.env:', process.env)


    const setupEnvTask = (ctx, task) => {
      return task.newListr([
        {
          title: 'Prepare environment...',
          task: () => {}
        },
        {
          // title: 'Load user settings',
          task: tasksss.loadUserSettingsTask
        },
        {
          title: 'Get API Key',
          task: tasksss.getAPIKey
        },
        {
          title: 'Get Database',
          skip: (ctx) => !!ctx.database,
          task: tasksss.getDatabaseTask
        },
        {
          // title: 'Save user settings',
          enabled: (ctx) => !!ctx.settings,
          task: tasksss.saveUserSettingsTask
        },
      ])
    }

    const basicTasks = [
      {
        title: 'Prepare ENV',
        task: setupEnvTask
      },
      {
        title: 'Write something down',
        task: async (ctx, task) => {
          task.title = 'CTX.DATABASE: ' + ctx.database.title_text
          await task.prompt({
            type: 'confirm',
            message: 'Oy!'
          })
        }
      },
    ]

    const tasks = new Listr(basicTasks, { concurrent: false })

    try {
      const result = await tasks.run(context)
      console.log('result of runned tasks:', result)
    } catch (e) {
      // console.log('Error:', e.message, e.code)
    }
    // const response = await notion.databases.list();
    // const dbs = response?.results?.map((db) => ({
    //   title: db.title.reduce((acc, title) => `${acc ? acc + ' ' : ''}${title.plain_text}`, ''),
    //   id: db.id
    // }))
    // console.log(dbs);
  })();

  // const isList = options.list || options.search

  // isList && (await list(options))
  // !isList && (await vocalize(words, options))
}

const main = async () => {
  const voicepacks = await getVoicepacks()
  console.log('WHAT ARE DATABASES?', databases)
  console.log('WHAT ARE SETINGS?', settings)

  program
    .name(Object.keys(packageJSON.bin)[0] || 'eplog')
    .version(packageJSON.version)
    .addOption(
      new program.Option('-d, --database <database>', 'Select specific database')
        .choices(databases?.map(({title_text}) => title_text))

    )
    .addOption(
      new program.Option(
        '-f, --path [path]',
        'Set voicepack path (override -v option)'
      )
    )
    .addOption(new program.Option('-l, --list', 'List avialable databases'))
    .addOption(
      new program.Option('-s, --search <search>', 'Search in available words')
    )
    .addOption(new program.Option('-c, --compact', 'Compact result'))
    .addOption(new program.Option('-r, --repeat <n>', 'Repeat n times'))
    .addOption(
      new program.Option('-p, --pause <n>', 'Pause between repeats').default(
        1400
      )
    )
    .addOption(
      new program.Option('-d, --delay <n>', 'Delay between words').default(350)
    )
    .addOption(new program.Option('-i, --ignore', 'Ignore errors'))
    .addOption(new program.Option('-x, --random [n]', 'Pick random (n) words'))
    .arguments('[input...]')
    .description(
      chalk`${description}${!databases?.length ? '\n' + warning : ''}`,
      {
        input: 'input to save'
      }
    )
    .addHelpText('after', docs)
    .action(run)

  await program.parseAsync(process.argv)
}

const docs = chalk`
You can use the {blue wait:1234} modifier to add a custom delay (in milliseconds) between specific words.
e.g. {cyan $ vox echo go wait:1200 helium}
`
const description = chalk`${prefix}${packageJSON.description}`
const warning = chalk`${prefix}{bgYellow.black  Alert } No available databases detected.`

module.exports = main
