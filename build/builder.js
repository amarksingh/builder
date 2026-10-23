"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.builder = exports.Builder = void 0;
const child_process_1 = __importDefault(require("child_process"));
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
        child_process_1.default.execSync(command, { cwd, stdio: 'inherit' });
    }
    /**
     * Builds the TypeScript project and synchronizes non-TS assets declared in tsconfig.
     *
     * @param options - Build configuration options.
     */
    build(options = {}) {
        const rootDir = options.rootDir || process.cwd();
        const configPath = options.projectConfig || 'tsconfig.json';
        if (!options.copyAssetsOnly) {
            this.runCommand(`npx tsc -p ${configPath}`, rootDir);
        }
        (0, assetCopier_1.copyAssets)(rootDir, undefined, configPath);
        if (options.prepare) {
            (0, packagePreparer_1.preparePackage)(rootDir);
        }
    }
}
exports.Builder = Builder;
exports.builder = new Builder();
//# sourceMappingURL=.maps/builder.js.map