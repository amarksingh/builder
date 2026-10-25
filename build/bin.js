#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder_1 = require("./builder");
const assetCopier_1 = require("./assetCopier");
const packagePreparer_1 = require("./packagePreparer");
const args = process.argv.slice(2);
if (args.includes('--assets-only')) {
    (0, assetCopier_1.copyAssets)();
}
else if (args.includes('--prepare-only')) {
    (0, packagePreparer_1.preparePackage)();
}
else {
    const isApp = args.includes('--app');
    const isLib = args.includes('--lib') || (!isApp && args.includes('--prepare'));
    const isPrepare = isLib || args.includes('--prepare');
    const isClean = args.includes('--clean');
    const pIndex = args.indexOf('-p');
    let projectConfig;
    if (pIndex !== -1 && args[pIndex + 1]) {
        projectConfig = args[pIndex + 1];
    }
    const outIndex = args.indexOf('--outDir');
    let outDir;
    if (outIndex !== -1 && args[outIndex + 1]) {
        outDir = args[outIndex + 1];
    }
    builder_1.builder.build({
        mode: isApp ? 'app' : 'lib',
        prepare: isPrepare,
        clean: isClean,
        projectConfig,
        outDir
    });
}
//# sourceMappingURL=.typed/.maps/bin.js.map