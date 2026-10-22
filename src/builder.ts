import * as childProcess from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { copyAssets } from './assetCopier';
import { preparePackage } from './packagePreparer';

export interface BuildOptions {
    rootDir?: string;
    projectConfig?: string;
    prepare?: boolean;
    copyAssetsOnly?: boolean;
}

export class Builder {
    /**
     * Executes a command synchronously with inherited stdio.
     *
     * @param command - Command string.
     * @param cwd - Working directory.
     */
    public runCommand(command: string, cwd: string): void {
        childProcess.execSync(command, { cwd, stdio: 'inherit' });
    }

    /**
     * Builds the TypeScript project and synchronizes non-TS assets declared in tsconfig.
     *
     * @param options - Build configuration options.
     */
    public build(options: BuildOptions = {}): void {
        const rootDir: string = options.rootDir || process.cwd();
        const configPath: string = options.projectConfig || (fs.existsSync(path.join(rootDir, 'tsconfig.build.json')) ? 'tsconfig.build.json' : 'tsconfig.json');

        if (!options.copyAssetsOnly) {
            this.runCommand(`npx tsc -p ${configPath}`, rootDir);
        }

        copyAssets(rootDir);

        if (options.prepare) {
            preparePackage(rootDir);
        }
    }
}

export const builder: Builder = new Builder();
