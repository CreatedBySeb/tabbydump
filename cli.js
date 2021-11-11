#!/usr/bin/env node
const cp = require("child_process");

cp.spawnSync(
	"node",
	[`${__dirname}/dist/index.js`].concat(process.argv.slice(2)),
	{ stdio: "inherit" },
);