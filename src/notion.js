const chalk = require('chalk')
const { storage } = require('./localstorage')

const chaklNotionColor = exports.chaklNotionColor = (color) => ({
  purple: 'magenta',
  pink: 'magenta',
  brown: 'red',
  orange: 'redBright'
})[color] || color

const buildPageFromCommander = (database, title, userOptions, client, parent) => {
  const props = Object.entries(database.properties)
  const titleField = props.find(([, prop]) => prop.type === 'title')

  const safeProps = Object.keys(database.properties)
    .reduce((acc, name) => ({ ...acc, [sanitizePropertyName(name)]: name }), {})

  const fields = Object.entries(userOptions)
    .filter(([name]) => name in safeProps)

  const properties = fields.map(([name, value]) => {
    const prop = database.properties[safeProps[name]]
    if (prop.type === 'rich_text') {
      return ({
        [safeProps[name]]: {
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
        [safeProps[name]]: {
          multi_select: [
            ...value
              // .map((opt) => prop.multi_select.options.find(({name}) => name === opt))
              .map((opt) => ({ name: opt }))
          ]
        }
      })
    }

    if (prop.type === 'relation') {
      return ({
        [safeProps[name]]: {
          relation: value
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
      name = sanitizePropertyName(name) // name.replace(/[^a-z0-9-_ ]+/ig, '').replace(/^[ ]+/, '').replace(/[ ]+/g, '-')
      let parser
      let defaults
      let flags = `--${name} <value>`
      let description = `Set the "${name}" field to <value>`

      if (field.type === 'multi_select') {
        parser = accumulatorParser
        const choices = field.multi_select.options
          .map(({ name, color }) => chalk`${color !== 'default' ? chalk`{${chaklNotionColor(color)} ${name}}` : name}`)
          .join(', ')
        description = `${description} - (choices: ${choices})`
      } else if (field.type === 'relation') {
        parser = accumulatorParser
        flags = `--${name} [value]`
        description = `Set ${name} to [value]`
      }

      program.option(flags, description, parser, defaults)
    }
  }
}
exports.attachOptionsFromProperties = attachOptionsFromProperties

const sanitizePropertyName = (name) =>
  name.replace(/[^a-z0-9]+/ig, '')

exports.sanitizePropertyName = sanitizePropertyName

const accumulatorParser = (value, prev) => {
  return [...prev || [], value]
}

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
    : prop.type === 'created_time' || prop.type === 'last_edited_time'
      ? prop[prop.type]
      : prop.type === 'relation'
        ? prop.relation.map(({ id }) => id).join(', ')
        : prop.type === 'multi_select'
          ? prop.multi_select.map(({ name }) => name).join(', ')
          : chalk`Unsupported prop type: {cyan ${prop.type}}`
exports.propToText = propToText
