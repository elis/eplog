# Release history

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

- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

</details>

## 1.3.0 - 2021-06-02

### Added

- 🗞 Added a changelog!
- Better support for properties and flags
- Added support for relation properties - use `$ eplog add --help` to see your default database relation options

You can now associate new entries with relations - any existing relations (which their respective database is `explicitly` shared with the integration) checkout the help to see your available relation flags.

For example:

```bash
$ eplog add This is an example title --Project Demo
✔ Resolve relations
✔ Save "This is an example title" to Eplog
id: 72134b91-b493-447d-b2ef-c23e4b9a2810
url: https://notion.so/72134b91b493447db2efc23e4b9a2810
time: 2021-06-01T22:27:30.882Z

properties
Last Update: 2021-06-01T22:27:30.882Z
Created: 2021-06-01T22:27:30.882Z
Project: f31f341e-2831-4e3c-44ab-d0492715b32f
Name: This is an example title
```

Note: If you provide a non-existing relation eplog will prompt to create a new one.

Note: You can provide more than a single relation on the same column - simply use the flag again. e.g. `$ eplog add --Project "My Pet Project" --Project "Main Project" Important note!`

Note: If you don't provide a value for the relation flag, eplog will prompt you with a list of existing options.

Note: If you don't see your relation in the `add --help` options try reloading your databases (run `$ eplog -r`), revoke and grant access of *relation database* to the *integration* and reload databases again.

## 1.2.0 - 2021-05-29

### Added

- Execute `.js` files with eplog

You can now execute any javascript file you create.

Example usage:

```js
// file notion-test.js

// Optionally override any of the profile settings
// your existing settings (integration token and default database) will be used if profile is not exported
exports.profile = {
  // provide integration token
  integrationToken: 'secret_....',
  // provide database ID
  database: 'a1e1cdff-72b2-4819-9a10-1078acc2ddc8',
  // or use a database name
  databaseName: 'Journal'
}

exports.init = async (ctx, client) => {
  /* ctx = {
      databases, // client.databases.list()
      profile, // { integrationToken, database }
      database, // databases.find(({ id }) => ctx.profile.database === id)
      program, // commander
      options, // commander options
      settings, // user settings
    }
  */
  // client = new require('@notionhq/client').Client({ auth: ctx.profile.integrationToken })
  // https://developers.notion.com/

  const items = await client.search({ query: 'Notion is Awesome!' })
  
  // ...
}
```

Now execute the script:

```bash
$ eplog exec notion-test.js
```

You can provide a custom [YAML](https://yaml.org) configuration file in the same directory as the executed file - eplog will use that to override the default settings.

```yaml
# file .eplogrc
integrationToken: secret_...
database: a1e1cdff-72b2-4819-9a10-1078acc2ddc8
# or use database name
# databaseName: Journal
```

## 1.1.0 - 2021-05-27

### Added

- Page URL is now available when saving
- Use `$ eplog add -o` to instantly open the new page once create in a new browser windows
- Use `$ eplog list [search]` for basic listing/searching

## 1.0.0 - 2021-05-20

First release! 🥳
