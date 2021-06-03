// const { valuefy } = require('eplog') // use this if copying the script
const { valuefy } = require('../../') // don't use this if copying the script

require('dotenv').config({ path: require('path').join(__dirname, '/.env.local') })

exports.profile = {
  // Create an integration: https://developers.notion.com/docs#create-a-new-integration
  integrationToken: process.env.integrationToken,

  // Duplicate and share databases (`Versions` and `Changes`) with new integration: https://www.notion.so/Eplog-Changelog-f451eff100f44c2fa67fe30e5ec4f014
  databaseName: process.env.databaseName
}

exports.init = async (ctx, client) => {
  const response = await client.databases.query({
    database_id: ctx.database.id,
    filter: {
      and: [
        { property: 'Omit', checkbox: { equals: false } },
        { property: 'Release Date', date: { is_not_empty: true } }
      ]
    },
    sort: [
      { property: 'Release Index', direction: 'ascending' }
    ]
  })

  const output = [CHANGELOG_OPENING]

  const versions = await Promise.all(
    valuefy(response.results, true)
      .map(async (version) => {
        const children = await (client.blocks.children.list({
          block_id: version.id,
          page_size: 100
        }).then(({ results }) => results).catch(() => []))
        return {
          ...version,
          children
        }
      })
  )

  const sortedVersions = versions.sort((a, b) => a.values['Release Index'] > b.values['Release Index'] ? -1 : 1)

  const changeset = valuefy(await Promise.all(sortedVersions.map(async (version) => {
    return {
      ...version,
      changes: valuefy(await Promise.all(
        version.properties.Changes.relation
          .map(async ({ id }) => {
            const change = await client.pages.retrieve({ page_id: id })
            const children = await (client.blocks.children.list({
              block_id: id,
              page_size: 100
            }).then(({ results }) => results).catch(() => []))
            return {
              ...change,
              children
            }
          })
      ))
    }
  })))

  changeset.forEach((version) => {
    const rows = []

    const versionTitle = `## ${version.values.Version} - ${version.values['Release Date'].split('T')[0]}`
    rows.push(versionTitle, '')

    const changeGroups = version.changes?.reduce((acc, change) => ({ ...acc, [change.values.Type]: [...acc[change.values.Type] || [], change] }), {}) || {}

    const groupRows = Object.entries(changeGroups)
      .map(([group, items]) => ([group, items.map(({ properties: { Name }, children }) => `-   ${propertyToMarkdown(Name)}${children?.length ? '\n\n' + blocksToMarkdown(children, 4) + '\n' : ''}`)]))
      .map(([group, content]) => `${group ? `### ${group}\n\n` : ''}${content.length ? content.join('\n') + '\n' : ''}`)
    rows.push(...[...groupRows, ...groupRows.length ? [''] : []])

    if (version.children?.length) {
      const children = blocksToMarkdown(version.children)
      rows.push(children)
    }
    output.push(rows.join('\n'))
  })

  process.stdout.write(output.join('\n'))
}

const blocksToMarkdown = (blocks, pad) => {
  const output = []
  const parsed = blocks.map((block) => {
    if (block.type === 'paragraph') {
      const parts = block.paragraph.text.map((part) => {
        if (part.type === 'text') return annotationToMarkdown(part)
        return `Unsupported part type: "${part.type}"`
      })
      return parts.join(' ')
    }

    return `Unsupported block type: "${block.type}`
  })
  output.push(...parsed.map(e => e + '\n'))

  return (pad > 0 ? output.map((row) => [...new Array(pad + 1)].join(' ') + row) : output).join('\n')
}

const propertyToMarkdown = (prop) =>
  prop[prop.type].map((item) => annotationToMarkdown(item)).join(' ')

const annotationToMarkdown = (item) => {
  let output = item.text.content

  if (item.annotations.bold) output = `**${output}**`
  if (item.annotations.italic) output = `*${output}*`
  if (item.annotations.strikethrough) output = `~~${output}~~`
  if (item.annotations.underline) output = `_${output}_`
  if (item.annotations.code) output = `\`${output}\``
  if (item.href) output = `[${output}](${item.href})`

  return output
}

const CHANGELOG_OPENING = `# Release history

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

<details>
  <summary><strong>Guiding Principles</strong></summary>

- Changelogs are for humans, not machines.
- There should be an entry for every single version.
- The same types of changes should be grouped.
- Versions and sections should be linkable.
- The latest version comes first.
- The release date of each versions is displayed.
- Mention whether you follow Semantic Versioning.

</details>

<details>
  <summary><strong>Types of changes</strong></summary>

Changelog entries are classified using the following labels _(from [keep-a-changelog](http://keepachangelog.com/)_):

- \`Added\` for new features.
- \`Changed\` for changes in existing functionality.
- \`Deprecated\` for soon-to-be removed features.
- \`Removed\` for now removed features.
- \`Fixed\` for any bug fixes.
- \`Security\` in case of vulnerabilities.

</details>
`
