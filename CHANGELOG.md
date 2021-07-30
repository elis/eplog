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

## v1.4.0 - 2021-07-30

### Added

-   Added support for piping title to `add`

    Thanks to  [Ned McClain](https://github.com/nmcclain) 's  [pull request](https://github.com/elis/eplog/pull/1)  suggestion users can now pipe the  `title`  argument to  `$ eplog add`  command to automate things further.

    Examples:

    `$ echo "The time on `hostname` is `date`" | eplog add`  

    `$ head CHANGELOG.md | eplog add`




## v1.3.1 - 2021-06-03

### Added

-   Added  `propToText`  and  `valuefy`  to exports

    You can import  `propToText`  and/or  `valuefy`  form  `eplog`  to help you deal with notion properties and their values.

    `require('eplog').propToText`  - converts a property of a page to a text friendly value of the same property.

    `require('eplog').valuefy`  - add  `value`  to page object properties.


-   Added changelog generating script

    The changelog for this project is now created using a script that loads the data from a  [notion.so](http://notion.so)  database, and generates a markdown file named  `CHANGELOG.md` .

    [Read more](/05edef9e1e0c4d86872e87501bf6503f)

    




## v1.3.0 - 2021-06-02

### Added

-   Added a changelog! 🗞
-   Added support for relation properties

### Fixed

-   Improved support for properties and flags


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

Note: You can provide more than a single relation on the same column - simply use the flag again. e.g.  `$ eplog add --Project "My Pet Project" --Project "Main Project" Important note!`

Note: If you don't provide a value for the relation flag, eplog will prompt you with a list of existing options.

Note: If you don't see your relation in the  `add --help`  options try reloading your databases (run  `$ eplog -r` ), revoke and grant access of  *relation database*  to the  *integration*  and reload databases again.

## v1.2.1 - 2021-05-29

### Fixed

-   Fix  `.eplog`  files not loaded correctly


## v1.2.0 - 2021-05-29

### Added

-   Execute  `.js`  files with eplog


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

exports.init = async ( *ctx* ,  *client* ) => {

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

You can provide a custom  [YAML](https://yaml.org)  configuration file in the same directory as the executed file - eplog will use that to override the default settings.

```yaml

# file .eplogrc

integrationToken: secret_...

database: a1e1cdff-72b2-4819-9a10-1078acc2ddc8

# or use database name

# databaseName: Journal

```

## v1.1.2 - 2021-05-27

-   Minor UI Cleanup


## v1.1.1 - 2021-05-27

-   Cleanup


## v1.1.0 - 2021-05-27

### Added

-   Page URL is now available when saving
-   Use  `$ eplog add -o`  to instantly open the new page once create in a new browser windows
-   Use  `$ eplog list [search]`  for basic listing/searching


## v1.0.3 - 2021-05-23

### Fixed

-   Fixed missing peer dependency


## v1.0.2 - 2021-05-23

### Changed

-   Improved README


## v1.0.1 - 2021-05-21

First Release! 🥳
