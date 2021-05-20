# VOX Gen

## Speech synthesising from the cli using Half-Life and Black Mesa VOX voice packs

[![NPM Version](http://img.shields.io/npm/v/voxgen.svg?style=flat)](https://www.npmjs.org/package/voxgen)
[![NPM Downloads](https://img.shields.io/npm/dm/voxgen.svg?style=flat)](https://npmcharts.com/compare/voxgen?minimal=true)
[![Install Size](https://packagephobia.now.sh/badge?p=voxgen)](https://packagephobia.now.sh/result?p=voxgen)

# Usage

![Example Usage](https://raw.githubusercontent.com/elis/voxgen/main/assets/img/voxgif.gif)

## Instant Use (via NPX)

```bash
$ npx voxgen lima sector unauthorized
```

## Install Locally

```bash
$ npm i -g voxgen
  ...

$ vox forms status india
```

## Basic Usage

```bash
Usage: vox [options] [words...]

 λ  Speech synthesising from the cli using Half-Life and Black Mesa VOX voice packs

Arguments:
  words                  words to say

Options:
  -V, --version          output the version number
  -v, --voice <voice>    Select voice (choices: "black-mesa", "half-life", default: "black-mesa")
  -f, --path [path]      Set voicepack path (override -v option)
  -l, --list [letter]    List words
  -s, --search <search>  Search in available words
  -c, --compact          Compact result
  -r, --repeat <n>       Repeat n times
  -p, --pause <n>        Pause between repeats (default: 1400)
  -d, --delay <n>        Delay between words (default: 350)
  -i, --ignore           Ignore errors
  -x, --random [n]       Pick random (n) words
  -h, --help             display help for command

You can use the wait:1234 modifier to add a custom delay (in milliseconds) between specific words.
e.g. $ vox echo go wait:1200 helium
```

## Options

### Change Voice-pack 
#### `-v, --voice <voice>`

Change the voice to use

Example:

```bash
$ vox -v half-life helium warm expect
 λ  Synthesizing speech — using half-life voicepack
 λ  "helium warm expect"
 λ  Complete in 2261ms.
```


### Custom Voice-pack path
#### `-f, --path [path]`

Use a custom directory, which is expected to have several .wav files, for the voxgen voice-pack.

Default path is the current working directory (`./`).


### List Words
#### `-l, --list [letter]`

List the available words for the chosen voice-pack.

If `letter` provided it will be used to match words starting with `letter` (can be more than one letter).

Use in conjunction with `-c` for compact display result.


### Search Words
#### `-s, --search <search>`

Like `--list` but `search` term is matched in any position of the word.


### Compact Mode
#### `-c, --compac`

Reduces the output footprint on `--list` and when vocalizing.


### Repeat Mode
#### `-r, --repeat <n>`

Repeat the vocalization `n` times.


### Pause Duration
#### `-p, --pause <n>`

Adjust the pause between repeats when using with `--repeat`.


### Delay Duration
#### `-d, --delay <n>`

Adjust the delay between individual words.

Note: Using `wait:400` modifier will stagger with the delay - e.g. a `wait:400` with a `--delay 600` will result in a 1000ms pause.


### Ignore Errors
#### `-i, --ignore`

Ignore any errors (non-existing words) and continue playing.


### Random
#### `-x, --random [n]`

Generate a random vocalization - provide `n` number to specify the length in words of vocalization to generate.


## Modifiers

Modifiers allow to use in place of words to execute a command such as a pause.

### wait

Use `wait:1234` as a word anywhere to generate a pause of `1234`ms or any other duration.

Example:

```bash
$ vox green alert wait:1200 lima sector wait:1200 buzwarn wait:1200 buzwarn

 λ  Synthesizing speech — using black-mesa voicepack
 λ  "green alert wait:1200 lima sector wait:1200 buzwarn wait:1200 buzwarn"
 λ  Complete in 10577ms.

```






