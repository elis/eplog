const chalk = require('chalk')
const { storage } = require('./localstorage')

const chaklNotionColor = exports.chaklNotionColor = (color) => ({
  purple: 'magenta',
  pink: 'magenta',
  brown: 'red',
  orange: 'redBright'
})[color] || color

const buildPageFromCommander = (database, title, userOptions, parent) => {
  const props = Object.entries(database.properties)
  const titleField = props.find(([, prop]) => prop.type === 'title')

  const fields = Object.entries(userOptions)
    .filter(([name]) => name in database.properties)

  const properties = fields.map(([name, value]) => {
    const prop = database.properties[name]
    if (prop.type === 'rich_text') {
      return ({
        [name]: {
          rich_text: [
            {
              text: {
                content: value
              }
            }
          ]
        }
      })
    }

    if (prop.type === 'multi_select') {
      return ({
        [name]: {
          multi_select: [
            ...value
              // .map((opt) => prop.multi_select.options.find(({name}) => name === opt))
              .map((opt) => ({ name: opt }))
          ]
        }
      })
    }

    return null
  })
    .filter(e => !!e)
    .reduce((acc, elm) => ({ ...acc, ...elm }), {})

  const page = {
    parent: parent || {
      database_id: database.id
    },
    properties: {
      ...properties,
      [titleField[0]]: {
        title: [
          {
            text: {
              content: title
            }
          }
        ]
      }
    }
  }

  return page
}
exports.buildPageFromCommander = buildPageFromCommander

const attachOptionsFromProperties = (program, properties) => {
  const fields = Object.entries(properties || {})
    .filter(([, field]) => !'title, created_time, last_edited_time'.split(', ').includes(field.type))

  if (fields.length) {
    for (let [name, field] of fields) {
      name = name.replace(/[^a-z0-9-_ ]+/ig, '').replace(' ', '-')
      let parser
      let defaults
      const flags = `--${name} <value>`
      let description = `Set the "${name}" field to <value>`

      if (field.type === 'multi_select') {
        parser = (value, prev) => {
          return [...prev || [], value]
        }
        const choices = field.multi_select.options
          .map(({ name, color }) => chalk`${color !== 'default' ? chalk`{dim {${chaklNotionColor(color)} ${name}}}` : name}`)
          .join(', ')
        description = `${description} - (choices: ${choices})`
      }

      program.option(flags, description, parser, defaults)
    }
  }
}
exports.attachOptionsFromProperties = attachOptionsFromProperties

const loadUserDatabases = () =>
  JSON.parse(storage.getItem('databases') || '{}')
exports.loadUserDatabases = loadUserDatabases

const saveUserDatabases = (databases) =>
  storage.setItem('databases', JSON.stringify(databases))
exports.saveUserDatabases = saveUserDatabases

const prepareDatabases = (databases) =>
  (databases).results.map((db) => ({
    ...db,
    title_text: db.title.reduce((acc, { plain_text }) => `${acc ? acc + ' ' : ''}${plain_text}`, '')
  }))
exports.prepareDatabases = prepareDatabases

const getNotionClient = (token) => {
  if (!token) throw new Error('Integration token not provided')

  const { Client } = require('@notionhq/client')

  return new Client({ auth: token })
}
exports.getNotionClient = getNotionClient

const propToText = (prop) =>
  prop.type === 'rich_text' || prop.type === 'text' || prop.type === 'title'
    ? prop[prop.type].reduce((acc, rt) => `${acc && acc + ' '}${rt.type === 'text' && rt.text.content}`, '')
    : prop.type === 'created_time'
      ? prop.created_time
      : prop.type === 'multi_select'
        ? prop.multi_select.map(({ name }) => name).join(', ')
        : chalk`Unsupported prop type: {cyan ${prop.type}}`
exports.propToText = propToText
