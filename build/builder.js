"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.builder = exports.Builder = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = __importDefault(require("node:child_process"));
const assetCopier_1 = require("./assetCopier");
const packagePreparer_1 = require("./packagePreparer");
class Builder {
    /**
     * Executes a command synchronously with inherited stdio.
     *
     * @param command - Command string.
     * @param cwd - Working directory.
     */
    runCommand(command, cwd) {
        node_child_process_1.default.execSync(command, { cwd, stdio: 'inherit' });
    }
    /**
     * Builds the TypeScript project and synchronizes non-TS assets declared in tsconfig.
     *
     * @param options - Build configuration options.
     */
    build(options = {}) {
        const rootDir = options.rootDir || process.cwd();
        const configPath = options.projectConfig || 'tsconfig.json';
        const isApp = options.mode === 'app';
        if (options.clean) {
            const defaultTargetDir = isApp ? '.dist' : 'build';
            const targetDir = options.outDir || defaultTargetDir;
            const fullTargetDir = node_path_1.default.resolve(rootDir, targetDir);
            if (node_fs_1.default.existsSync(fullTargetDir)) {
                node_fs_1.default.rmSync(fullTargetDir, { recursive: true, force: true });
            }
        }
        if (!options.copyAssetsOnly) {
            this.runCommand(`npx tsc -p ${configPath}`, rootDir);
        }
        (0, assetCopier_1.copyAssets)(rootDir, options.outDir, configPath);
        if (options.prepare && !isApp) {
            (0, packagePreparer_1.preparePackage)(rootDir);
        }
    }
}
exports.Builder = Builder;
exports.builder = new Builder();
//# sourceMappingURL=.typed/.maps/builder.js.map