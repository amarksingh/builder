import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { copyAssets } from './assetCopier';
import { preparePackage } from './packagePreparer';

export interface BuildOptions {
    rootDir?: string;
    projectConfig?: string;
    prepare?: boolean;
    copyAssetsOnly?: boolean;
    clean?: boolean;
    mode?: 'lib' | 'app';
    outDir?: string;
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
        const configPath: string = options.projectConfig || 'tsconfig.json';
        const isApp: boolean = options.mode === 'app';

        if (options.clean) {
            const defaultTargetDir = isApp ? '.dist' : 'build';
            const targetDir = options.outDir || defaultTargetDir;
            const fullTargetDir = path.resolve(rootDir, targetDir);
            if (fs.existsSync(fullTargetDir)) {
                fs.rmSync(fullTargetDir, { recursive: true, force: true });
            }
        }

        if (!options.copyAssetsOnly) {
            this.runCommand(`npx tsc -p ${configPath}`, rootDir);
        }

        copyAssets(rootDir, options.outDir, configPath);

        if (options.prepare && !isApp) {
            preparePackage(rootDir);
        }
    }
}

export const builder: Builder = new Builder();
