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
    const isApp: boolean = args.includes('--app');
    const isLib: boolean = args.includes('--lib') || (!isApp && args.includes('--prepare'));
    const isPrepare: boolean = isLib || args.includes('--prepare');
    const isClean: boolean = args.includes('--clean');
    const pIndex: number = args.indexOf('-p');
    let projectConfig: string | undefined;
    if (pIndex !== -1 && args[pIndex + 1]) {
        projectConfig = args[pIndex + 1];
    }
    const outIndex: number = args.indexOf('--outDir');
    let outDir: string | undefined;
    if (outIndex !== -1 && args[outIndex + 1]) {
        outDir = args[outIndex + 1];
    }

    builder.build({
        mode: isApp ? 'app' : 'lib',
        prepare: isPrepare,
        clean: isClean,
        projectConfig,
        outDir
    });
}

