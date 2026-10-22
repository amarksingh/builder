#!/usr/bin/env node

import { builder } from './builder';
import { copyAssets } from './assetCopier';
import { preparePackage } from './packagePreparer';

const args: string[] = process.argv.slice(2);

if (args.includes('--assets-only')) {
    copyAssets();
} else if (args.includes('--prepare-only')) {
    preparePackage();
} else {
    const isPrepare: boolean = args.includes('--prepare');
    const pIndex: number = args.indexOf('-p');
    let projectConfig: string | undefined;
    if (pIndex !== -1 && args[pIndex + 1]) {
        projectConfig = args[pIndex + 1];
    }
    builder.build({
        prepare: isPrepare,
        projectConfig
    });
}
