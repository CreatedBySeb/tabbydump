# tabbydump

tabbydump is a command line tool for making static copies of Tabbycat tab sites for archiving and preservation. tabbydump is distributed under the [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) license.

## Installation

Download a tarball from releases, install the dependencies with npm and optionally run `npm link` to make it globally available.

```bash
cd tabbydump
npm i --only=production
npm link # Optional
```

## Build

Clone the git repository, install the dependencies with npm, then run `npm build`.

```bash
git clone https://github.com/CreatedBySeb/tabbydump
cd tabbydump
npm i
npm build
```

## Usage

tabbydump can either archive a specific tournament, or all active tournaments on a tab site. Use a tournament URL (e.g. `https://example.herokuapp.com/example`) to archive a specific tournament, or a site URL (e.g. `https://example.herokuapp.com/`) to archive all active tournaments.

*Globally installed*
```bash
tabbydump <url>
```

*Locally installed*
```bash
npm start <url>
```