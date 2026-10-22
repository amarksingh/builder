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
exports.preparePackage = preparePackage;
exports.patchDualExports = patchDualExports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Prepares the build directory for publication by cleaning package.json and patching dual exports.
 *
 * @param pkgDir - Package root directory (defaults to process.cwd()).
 * @returns Prepared package.json object.
 */
function preparePackage(pkgDir = process.cwd()) {
    const rootPkgPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(rootPkgPath)) {
        throw new Error('No package.json found in ' + pkgDir);
    }
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const buildDir = path.join(pkgDir, 'build');
    if (!fs.existsSync(buildDir)) {
        throw new Error('Build directory does not exist: ' + buildDir);
    }
    const pubPkg = { ...rootPkg };
    delete pubPkg.devDependencies;
    delete pubPkg.scripts;
    delete pubPkg.files;
    const stripBuild = (str) => {
        return str.replace(/^(\.\/)?build\//, './');
    };
    if (typeof pubPkg.main === 'string')
        pubPkg.main = stripBuild(pubPkg.main).replace(/^\.\//, '');
    if (typeof pubPkg.types === 'string')
        pubPkg.types = stripBuild(pubPkg.types).replace(/^\.\//, '');
    if (typeof pubPkg.bin === 'string') {
        pubPkg.bin = stripBuild(pubPkg.bin).replace(/^\.\//, '');
    }
    else if (pubPkg.bin && typeof pubPkg.bin === 'object') {
        const newBin = {};
        for (const [k, v] of Object.entries(pubPkg.bin)) {
            if (typeof v === 'string') {
                newBin[k] = stripBuild(v).replace(/^\.\//, '');
            }
        }
        pubPkg.bin = newBin;
    }
    if (pubPkg.exports) {
        const rewriteExports = (obj) => {
            if (typeof obj === 'string')
                return stripBuild(obj);
            if (Array.isArray(obj))
                return obj.map(rewriteExports);
            if (typeof obj === 'object' && obj !== null) {
                const res = {};
                for (const [k, v] of Object.entries(obj)) {
                    res[k] = rewriteExports(v);
                }
                return res;
            }
            return obj;
        };
        pubPkg.exports = rewriteExports(pubPkg.exports);
    }
    fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify(pubPkg, null, 2) + '\n');
    patchDualExports(buildDir);
    const copyIfExists = (file) => {
        const src = path.join(pkgDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(buildDir, file));
        }
    };
    copyIfExists('README.md');
    copyIfExists('LICENSE.md');
    copyIfExists('LICENSE');
    return pubPkg;
}
/**
 * Patches CJS and ESM dual export compatibility on compiled JavaScript files.
 *
 * @param dir - Directory containing built JS files.
 */
function patchDualExports(dir) {
    if (!fs.existsSync(dir))
        return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
        const fullPath = path.join(dir, f.name);
        if (f.isDirectory()) {
            patchDualExports(fullPath);
        }
        else if (f.name.endsWith('.js') && !f.name.endsWith('.d.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('exports.default =') && !content.includes('module.exports = d;')) {
                content += '\nif (exports.default) {\n    const d = exports.default;\n    module.exports = d;\n    Object.assign(module.exports, exports);\n    module.exports.default = d;\n}\n';
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}
//# sourceMappingURL=packagePreparer.js.map