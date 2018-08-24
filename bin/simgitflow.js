#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const minimist = require('minimist');

const lib = require('../lib/index.js');

const USAGE_TEXT = `
    usage: simgitflow <command>

    command:
        feat    合并 feat mr
        fix     合并 fix mr
`;

async function main(argv) {
    argv = minimist(argv);

    // no command
    if(argv._.length === 0) {
        return console.log(USAGE_TEXT);
    }

    const command = argv._[0];

    switch(command) {
    case 'feat': {
        try {
            await lib.resolveFeat(process.cwd());
        } catch (error) {
            console.error(chalk.red(error));
        }
        break;
    }

    case 'fix': {
        try {
            await lib.resolveFix(process.cwd());
        } catch (error) {
            console.error(chalk.red(error));
        }
        break;
    }

    default: {
        console.log(USAGE_TEXT);
    }
    }
}

if(!module.parent) {
    (async () => await main(process.argv.slice(2)))();
}

module.exports = main;