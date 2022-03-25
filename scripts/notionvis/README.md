# Visualize Notion Database as PlatnUML Diagram

This little package allows you to generate visual diagrams from notion databases by using `kroki.io` (either as a 3rd party service or as a locally running docker).

## Installation

Make sure you have [`eplog`](https://github.com/elis/eplog) installed.

Clone this folder to your local machine:

```bash
$ npx copy-github-directory https://github.com/elis/eplog/tree/master/scripts/notionvis notionvis
```

Edit `config.js` - you'll need to tell `notionvis` what synced block to use.

To use with a local docker, install docker and run `yarn docker`, and change the `RENDERER_URL` to `http://localhost:8000`.

To use with `kroki.io` as the rendering service instead of a local docker instance - configur the `RENDERER_URL` to point to `https://kroki.io`.

### Configure eplog

Make sure you have an `.eplogrc` file (it's a yaml file) containing the `integrationToken` and `databaseName` that you want the script to use the database to draw diagrams of.

`.eplogrc` file example:

```yaml
# file .eplogrc
integrationToken: secret_33nV1NWnhbwhJCIr6a50TQpofKJDH0aEqoahVSl9OHT

# Provide a database ID to select a specific database
# database: 16c4e990-82f4-437f-9fe1-d0a66bbabdaf

# or provide a database name
databaseName: Visvat
```

### Imgur Integration

For the script to be able to add images to your notion synced block you'll need to allow uploading to imgur (the only supported service, at the moment) - to do so create an `imgur application` (go to: https://api.imgur.com/oauth2/addclient), and add `IMGUR_CLIENT_ID` and `IMGUR_CLIENT_SECRET` to your `.env` file (see `example.env`).