const yargs = require('yargs/yargs')

const boxen = (...args) =>
  import('boxen').then(({ default: boxen }) => boxen(...args))

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args))
const pako = require('pako')

const { pipeline } = require('node:stream')
const { promisify } = require('node:util')
const hash = require('object-hash')
const streamPipeline = promisify(pipeline)
const { ImgurClient } = require('imgur')
const SimpleNodeLogger = require('simple-node-logger')

const config = require('./config')
const { Listr } = require('listr2')
const { PATHS: paths } = config

const ERROR_NO_CHANGES_IN_DATA = 'No change in data'

const loggerOptions = {
  logFilePath: paths.logFile,
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  flags: 'w',
}

const log = SimpleNodeLogger.createSimpleFileLogger(loggerOptions)

log.info('Starting...')

exports.init = async (ctx, client) => {
  const argv = yargs(ctx.args)
    .boolean('l')
    .alias('l', 'listen')
    .describe('l', 'Listen to database changes')
    .alias('i', 'interval')
    .number('i')
    .describe('i', 'Check interval in miliseconds')
    .default('i', config.CHECK_INTERVAL)
    .boolean('s')
    .alias('s', 'silent')
    .describe('s', 'Silent mode - suppress all output')
    .help('help').argv

  log.info('ARGV: ', JSON.stringify(argv))

  const visualizer = new DBVisualizer(argv, ctx, client)
  if (argv.listen) {
    !argv.silent && console.log('Begin listening...')
    visualizer.listen()
  } else
    visualizer.checkLatest().catch((e) => {
      if (e.message !== ERROR_NO_CHANGES_IN_DATA) throw e
    })
}

class DBVisualizer {
  _listening = false

  constructor(argv, ctx, client) {
    this.argv = argv
    this.ctx = ctx
    this.client = client
    log.info('Visualizer initialized')

    this.checkInterval = argv.interval
    this.syncedBlockId = config.SYNCED_BLOCK_ID
    this.databaseId = ctx.database?.id || config.DATABASE_ID
    // console.log('ctx:', ctx)
    // process.exit(0)

    this.verifyImgurSecrets()
  }

  verifyImgurSecrets = async () => {
    if (this.syncedBlockId && (!config.IMGUR_CLIENT_ID || !config.IMGUR_CLIENT_SECRET)) {
      log.error('IMGUR_CLIENT_ID or IMGUR_CLIENT_SECRET is not defined')
      !this.argv.silent &&
        console.error(
          'Error: IMGUR_CLIENT_ID or IMGUR_CLIENT_SECRET is not defined'
        )
      // https://api.imgur.com/oauth2/addclient
      !this.argv.silent &&
        console.log(
          await boxen(
            'Register you imgur application (https://api.imgur.com/oauth2/addclient) and fill in the .env file with your IMGUR_CLIENT_ID and IMGUR_CLIENT_SECRET (use `example.env` file and save it as `.env`)',
            { title: 'Imgur API Key Missing', titleAlignment: 'left' }
          )
        )
      process.exit(1)
    }
  }
  listen = async () => {
    log.info('Begin listening...')

    this._listening = true
    await this.checkLatest(true).catch(() => ({}))

    this.idle()

    return () => {
      log.info('Stop listening...')
      this._listening = false
    }
  }

  idle = () => {
    setTimeout(async () => {
      const start = Date.now()
      !this.argv.silent && console.log(new Date().toISOString(), 'Begin...')
      try {
        await this.checkLatest().catch(() => ({}))
      } catch (error) {
        console.error(error)
      }
      const end = Date.now()
      !this.argv.silent &&
        console.log(
          new Date().toISOString(),
          `Completed in ${Math.floor((end - start) / 100) / 10} seconds.`
        )
      if (this._listening) {
        !this.argv.silent &&
          console.log(
            new Date().toISOString(),
            'Idle for ' + this.checkInterval / 1000 + ' seconds...\n\n'
          )
        this.idle()
      }
    }, this.checkInterval)
  }

  checkLatest = async () => {
    const tasker = new Listr(
      [
        {
          title: 'Load data',
          options: {
            collapse: false,
            showTimer: true,
            persistentOutput: true,
            bottomBar: Infinity,
          },
          task: this.taskLoadBasics,
        },
        {
          title: 'Update diagram',
          enabled: (ctx) => ctx.data?.length && ctx.lastTime !== ctx.dataHash,
          options: {
            collapse: false,
            showTimer: true,
            persistentOutput: true,
            bottomBar: Infinity,
          },
          task: this.taskUpdate,
        },
        {
          title: 'No changes',
          enabled: (ctx) => ctx.data?.length && ctx.lastTime === ctx.dataHash,
          task: () => {
            throw new Error(ERROR_NO_CHANGES_IN_DATA)
          },
        },
      ],
      {
        rendererSilent: this.argv.silent,
      }
    )

    return tasker.run()
  }

  taskLoadBasics = (ctx, ptask) =>
    ptask.newListr(
      () => [
        {
          title: 'Fetch latest database',
          options: { persistentOutput: true, bottomBar: Infinity },
          task: async (_, task) => {
            const data = await this.getGraphData(this.client, this.databaseId)
            if (!data?.length) {
              log.error('No data found')
              throw new Error('No data found')
            }
            const dataHash = hash({ data })
            ctx.data = data
            ctx.dataHash = dataHash
            task.title = task.title + ` (${data.length} items)`
            log.debug('Data loaded', { rows: data.length })
          },
        },
        {
          title: 'Load last edit hash',
          options: { persistentOutput: true, bottomBar: Infinity },
          task: async (_, task) => {
            const lastTime = await require('fs')
              .promises.readFile(paths.lastEditTime, 'utf8')
              .catch(() => '')

            Object.assign(ctx, { lastTime })
            this.lastTime = lastTime
            task.title = task.title + (lastTime ? ` (${lastTime})` : '')
          },
        },
      ],
      {
        concurrent: true,
        exitOnError: false,
      }
    )

  taskUpdate = (ctx, ptask) =>
    ptask.newListr([
      {
        title: 'Generate graph data',
        options: {
          collapse: false,
          showTimer: true,
          persistentOutput: true,
          bottomBar: Infinity,
        },
        task: async (_, task) => {
          const { data } = ctx

          log.info('Generate graph data...')
          const [graph, tree, pointers] = await this.getGraph(data)
          ctx.graph = graph
          ctx.tree = tree
          ctx.pointers = pointers

          log.info('Graph generated ', ctx.graph.length)
          task.title =
            task.title + ` (${ctx.graph.split('\n').length} rows of code)`
        },
      },
      {
        notitle: 'Save graph data',
        enabled: () => ctx.graph?.length,
        task: this.subtaskSaveGraphData(ctx),
      },
      {
        title: 'Generate graph image',
        options: {
          collapse: false,
          showTimer: true,
          persistentOutput: true,
          bottomBar: Infinity,
        },
        task: this.subtaskGenerateGraphImage(ctx),
      },
      {
        notitle: 'Handle old block',
        xenabled: () => true,
        skip: () => !this.syncedBlockId && 'Synced block not configured',
        task: this.subtaskHandleOldBlock(ctx),
      },
      {
        title: 'Create new block',
        options: {
          collapse: false,
          showTimer: true,
          persistentOutput: true,
          bottomBar: Infinity,
        },
        skip: () => !this.syncedBlockId && 'Synced block not configured',
        task: this.subtaskCreateNewBlock(ctx),
      },
      {
        title: 'Local image',
        enabled: () => !this.syncedBlockId,
        task: (_, task) => {
          task.title = `Graph image: ${paths.graph}`
        }
      },
      {
        title: 'Update last edit hash',
        task: async (_, task) => {
          await require('fs').promises.writeFile(
            paths.lastEditTime,
            ctx.dataHash
          )
          log.info('Last time data hash updated:', ctx.dataHash)
        },
      },
    ])

  subtaskSaveGraphData = (ctx) => (_, task) =>
    task.newListr(
      [
        {
          title: 'Save graph source',
          task: () =>
            require('fs').promises.writeFile(paths.graphSource, ctx.graph),
        },
        {
          title: 'Save graph debug',
          task: () =>
            require('fs').promises.writeFile(
              paths.graphSource + '.debug.json',
              JSON.stringify(
                {
                  tree: ctx.tree,
                  pointers: ctx.pointers,
                },
                1,
                1
              )
            ),
        },
      ],
      { concurrent: true }
    )

  subtaskGenerateGraphImage = (ctx) => (_, task) =>
    task.newListr([
      {
        title: 'Fetch image',
        task: async (_, task) => {
          log.info('Fetching image...')
          ctx.image = await this.fetchImage(ctx.graph)
          log.info('Image loaded', ctx.image.body.length)
        },
      },
      {
        title: 'Save to file',
        enabled: () => ctx.image,
        task: async (_, task) => {
          await streamPipeline(
            ctx.image.body,
            require('fs').createWriteStream(paths.graph)
          )
          log.info('Image saved to', paths.graph)
        },
      },
      {
        title: 'Upload to image server',
        // skip: () => true,
        skip: () => (!config.IMGUR_CLIENT_ID || !config.IMGUR_CLIENT_SECRET) && 'Upload to imgur — Imgur not configured',
        task: async (_, task) => {
          try {
            ctx.imageUrl = await this.uploadGraph(paths.graph)
            task.title = task.title + ` (${ctx.imageUrl})`
          } catch (error) {
            throw new Error(
              'Failed to upload image — ' + (error.message || error)
            )
          }
        },
      },
      {
        title: 'Fake image url',
        enabled: () => false,
        task: async (_, task) => {
          ctx.imageUrl = 'https://i.imgur.com/DGzFRsV.png'
          task.title = task.title + ` (${ctx.imageUrl})`
          log.info('Using fake image url: ', ctx.imageUrl)
        },
      },
    ])

  subtaskHandleOldBlock = (ctx) => (_, task) =>
    task.newListr([
      {
        notitle: 'Load old block',
        task: async (_, task) => {
          try {
            ctx.oldBlock = await this.loadOldBlock(paths.block)
            ctx.oldBlockId = ctx.oldBlock?.id
          } catch (error) {}
        },
      },
      {
        title: 'Delete old block',
        enabled: () => ctx.oldBlockId,
        task: async (_, task) => {
          await this.deleteOldBlock(ctx.oldBlockId)
        },
      },
    ])

  subtaskCreateNewBlock = (ctx) => (_, task) =>
    task.newListr([
      {
        title: 'Create new block',
        task: async (_, task) => {
          log.info('Generating new block...')
          try {
            const response = await this.saveToPage(
              this.syncedBlockId,
              ctx.imageUrl,
              ctx.graph
            )

            ctx.block = response.results?.[0]
            log.info('Parsed block:', JSON.stringify(ctx.block, 1, 1))
            ctx.blockId = ctx.block?.id
            log.info('Block created BlockID:', ctx.blockID)

            await require('fs').promises.writeFile(
              paths.lastEditTime,
              ctx.dataHash
            )
          } catch (error) {
            throw new Error(
              'Failed to create block — ' + (error.message || error)
            )
          }
        },
      },
      {
        title: 'Save block to file',
        task: async (_, task) => {
          await require('fs').promises.writeFile(
            paths.block,
            JSON.stringify(ctx.block, 1, 1)
          )
          log.info('Block data written to file:', paths.block)
        },
      },
    ])

  saveToPage = async (blockId, imageUrl, graph) => {
    log.info('Saving to page..')

    try {
      const response = await this.client.blocks.children.append({
        block_id: blockId,
        children: [
          {
            object: 'block',
            type: 'synced_block',
            synced_block: {
              synced_from: null,

              children: [
                {
                  object: 'block',
                  type: 'image',
                  image: {
                    type: 'external',
                    external: {
                      url: imageUrl,
                    },
                  },
                },
                {
                  object: 'block',
                  type: 'toggle',
                  toggle: {
                    rich_text: [
                      {
                        type: 'text',
                        text: {
                          content: 'Source',
                          link: null,
                        },
                      },
                    ],
                    color: 'default',
                    children: [
                      {
                        object: 'block',
                        type: 'code',
                        code: {
                          rich_text: [
                            {
                              type: 'text',
                              text: {
                                content: graph,
                              },
                            },
                          ],
                          language: 'plain text',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      })
      log.info('Block save response: ', JSON.stringify(response, 1, 1))

      return response
    } catch (error) {
      log.error('Error saving: ', JSON.stringify(error, 1, 1))
      throw error
    }
  }

  buildGraphTree = async (data) => {
    const tree = []
    const pointers = []
    const refs = data.reduce((acc, page) => ({ ...acc, [page.id]: page }), {})
    const leafs = {}

    for (const page of data) {
      const title = page.properties?.Name?.title?.[0]?.plain_text
      const type = page.properties?.Type?.select?.name
      const curve = page.properties?.Curve?.checkbox
      const dashed = page.properties?.Dashed?.checkbox
      const parents = page.properties['Parent Items']?.relation

      const pointTo = page.properties['Points to'].relation

      const leaf = {
        ...(leafs[page.id] || {}),
        id: page.id,
        title,
        type,
        curve,
        dashed,
        original: page,
      }
      leafs[page.id] = leaf

      if (parents.length) {
        for (const { id: parentId } of parents) {
          const parent = leafs[parentId] || {}
          parent.children = [...(parent.children || []), leaf]

          leafs[parentId] = parent
        }
      } else {
        tree.push(leaf)
      }

      if (pointTo.length) {
        for (const { id: pointToId } of pointTo) {
          const pointsTo = leafs[pointToId] || {}
          pointsTo.pointedTo = [...(pointsTo.pointedTo || []), leaf]

          leafs[pointToId] = pointsTo
          pointers.push([page.id, pointToId])
        }
      }
    }

    const pointersMap = pointers.map(([from, to]) => [leafs[from], leafs[to]])

    await require('fs').promises.writeFile(
      `${paths.tree}`,
      JSON.stringify({ leafs, tree, pointers }, 1, 1)
    )

    return [tree, pointersMap]
  }

  treeToPlantUML = async (tree, pointers) => {
    const treeNodeToSource = this.treeNodeToSource(0)
    const plantUML = tree.map(treeNodeToSource)

    const treeUML = plantUML.join('\n')
    const pointersUML = pointers.map(this.pointerToSource).join('\n')
    return `${treeUML}\n\n${pointersUML}`
  }

  pointerToSource = ([pointer, pointee]) => {
    const char = pointer.dashed ? '.' : '-'
    return `${pointer.title} ${char.repeat(pointer.curve ? 2 : 3)}> ${
      pointee.title
    }`
  }

  treeNodeToSource =
    (depth = 0) =>
    (leaf) => {
      const children = leaf.children
        ?.map(this.treeNodeToSource(depth + 1))
        .join('\n')
        .split('\n')
        .map((e) => '  '.repeat(depth + 1) + e)
        .join('\n')

      if (['package', 'database', 'folder'].indexOf(leaf.type) >= 0) {
        const output = `${leaf.type} "${leaf.title}" {
  ${children ? children : ''}
}`
        return output
      }
      if (depth > 0) {
        return ''
      }

      return leaf.title && `"${leaf.title}"`
    }

  getGraph = async (data) => {
    const [tree, pointers] = await this.buildGraphTree(data)
    const source = await this.treeToPlantUML(tree, pointers)

    const templated = graphTemplate.replace('{{graph}}', source)
    return [templated, tree, pointers]
  }

  fetchImage = async (graph) => {
    const data = Buffer.from(graph, 'utf8')
    const compressed = pako.deflate(data, { level: 9 })
    const result = Buffer.from(compressed)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

    const image = await fetch(`${config.RENDERER_URL}/plantuml/png/${result}`)
    return image
  }

  uploadGraph = async (filename) => {
    log.info('Uploading graph with config: ', JSON.stringify(config, 1, 1))
    const client = new ImgurClient({
      clientId: config.IMGUR_CLIENT_ID,
      clientSecret: config.IMGUR_CLIENT_SECRET,
      refreshToken: config.REFRESH_TOKEN,
    })

    const response = await client.upload({
      image: require('fs').createReadStream(filename),
      type: 'stream',
    })
    if (response.status !== 200) {
      log.error('Upload failed:', JSON.stringify(response, 1, 1))
      throw new Error(response.data)
    }

    log.info('Upload successful: ', response.data.link)
    return response.data.link
  }

  getGraphData = async () => {
    const response = await this.client.databases.query({
      database_id: this.databaseId,
      sorts: [
        {
          property: 'Last Edited',
          direction: 'descending',
        },
      ],
    })

    await require('fs').promises.writeFile(
      paths.database,
      JSON.stringify(response, 1, 1)
    )

    this.databaseResults = response.results
    return response.results
  }

  loadOldBlock = async (filepath) => {
    const oldBlock = await require('fs').promises.readFile(filepath, 'utf8')
    try {
      const oldBlockData = JSON.parse(oldBlock)
      return oldBlockData
    } catch (_) {
      return {}
    }
  }

  deleteOldBlock = async (oldBlockId) => {
    if (oldBlockId) {
      log.info('Deleting old block...', oldBlockId)
      await this.client.blocks.delete({
        block_id: oldBlockId,
      })
      log.info('Block deleted.')
    }
  }
}

const graphTemplate = `
@startuml
!theme cerulean-outline

{{graph}}

@enduml`
