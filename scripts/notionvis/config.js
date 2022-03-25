require('dotenv').config()

const cachePath = './cache'

module.exports = {
  CHECK_INTERVAL: 1000 * 5, // 5 seconds

  IMGUR_CLIENT_ID: process.env.IMGUR_CLIENT_ID,
  IMGUR_CLIENT_SECRET: process.env.IMGUR_CLIENT_SECRET,

  SYNCED_BLOCK_ID: '0441e360-a680-4110-bdc6-317f064458ac',

  RENDERER_URL: 'https://kroki.io',
  // RENDERER_URL: 'http://localhost:8000',

  // Paths
  PATHS: {
    cache: cachePath,
    block: `${cachePath}/block.json`,
    page: `${cachePath}/page.json`,
    graph: `${cachePath}/graph.png`,
    graphSource: `${cachePath}/graph.txt`,
    blocks: `${cachePath}/blocks`,
    tree: `${cachePath}/tree.json`,
    database: `${cachePath}/database.json`,
    lastEditTime: `${cachePath}/last_edit_time.json`,
    logFile: `${cachePath}/execution.log`,
  }
}

