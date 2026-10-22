"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.builder = exports.Builder = void 0;
const childProcess = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
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
        childProcess.execSync(command, { cwd, stdio: 'inherit' });
    }
    /**
     * Builds the TypeScript project and synchronizes non-TS assets declared in tsconfig.
     *
     * @param options - Build configuration options.
     */
    build(options = {}) {
        const rootDir = options.rootDir || process.cwd();
        const configPath = options.projectConfig || (fs.existsSync(path.join(rootDir, 'tsconfig.build.json')) ? 'tsconfig.build.json' : 'tsconfig.json');
        if (!options.copyAssetsOnly) {
            this.runCommand(`npx tsc -p ${configPath}`, rootDir);
        }
        (0, assetCopier_1.copyAssets)(rootDir);
        if (options.prepare) {
            (0, packagePreparer_1.preparePackage)(rootDir);
        }
    }
}
exports.Builder = Builder;
exports.builder = new Builder();
//# sourceMappingURL=builder.js.map