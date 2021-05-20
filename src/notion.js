const chalk = require('chalk');
const { storage } = require('./localstorage');

const chaklNotionColor = exports.chaklNotionColor = (color) => ({
  purple: 'magenta',
  pink: 'magenta',
  brown: 'red',
  orange: 'redBright'
})[color] || color

const buildPageFromCommander = exports.buildPageFromCommander = (database, title, userOptions, parent) => {
  const props = Object.entries(database.properties)
  const titleField = props.find(([, prop]) => prop.type === 'title')

  const fields = Object.entries(userOptions)
    .filter(([name]) => name in database.properties)

  const properties = fields.map(([name, value]) => {
    const prop = database.properties[name]
    if (prop.type === 'rich_text')
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
    
    if (prop.type === 'multi_select'){
      return ({
        [name]: {
          multi_select: [
            ...value
              // .map((opt) => prop.multi_select.options.find(({name}) => name === opt))
              .map((opt) => ({ name: opt }))
          ]
        }
      })}
  })
    .filter(e => !!e)
    .reduce((acc, elm) => ({ ...acc, ...elm }), {})

  const page = {
    parent: parent || {
      database_id: database.id,
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
      },
    }
  }

  return page
}

const attachOptionsFromProperties = exports.attachOptionsFromProperties = (program, properties) => {
  const fields = Object.entries(properties || {})
    .filter(([, field]) => !'title, created_time, last_edited_time'.split(', ').includes(field.type))

  if (fields.length) {
    for (let [name, field] of fields) {
      name = name.replace(/[^a-z0-9-_ ]+/ig, '').replace(' ', '-')
      let parser
      let defaults
      let flags = `--${name} <value>`
      let description =  `Set the "${name}" field to <value>`

      if (field.type === 'multi_select') {
        parser = (value, prev) => {
          return [...prev || [], value];
        }
        const choices = field.multi_select.options
          .map(({name, color}) => chalk`${color !== 'default' ? chalk`{dim {${chaklNotionColor(color)} ${name}}}` : name}`)
          .join(', ')
        description = `${description} - (choices: ${choices})`
      }
      
      program.option(flags, description, parser, defaults)
    }
  }
}


const loadUserDatabases = exports.loadUserDatabases = () => {
  return JSON.parse(storage.getItem('databases') || '{}')
}

const saveUserDatabases = exports.saveUserDatabases = (databases) => {
  storage.setItem('databases', JSON.stringify(databases))
}

const prepareDatabases = exports.prepareDatabases = (databases) =>
  (databases).results.map((db) => ({
    ...db,
    title_text: db.title.reduce((acc, {plain_text}) => `${acc ? acc + ' ' : ''}${plain_text}`, '')
  }))

const getNotionClient = exports.getNotionClient = (token) => {
  if (!token)
    throw new Error('Integration token not provided')
  
  const { Client } = require('@notionhq/client');

  return new Client({ auth: token })
}

const propToText = exports.propToText = (prop) =>
  prop.type === 'rich_text' || prop.type === 'text' || prop.type === 'title'
    ? prop[prop.type].reduce((acc, rt) => `${acc && acc + ' '}${rt.type === 'text' && rt.text.content}`, '')
    : prop.type === 'created_time'
    ? prop.created_time
    : prop.type === 'multi_select'
    ? prop.multi_select.map(({name}) => name).join(', ')
    : chalk`Unsupported prop type: {cyan ${prop.type}}`
