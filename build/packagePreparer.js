"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preparePackage = preparePackage;
exports.relocateSourceMaps = relocateSourceMaps;
exports.patchDualExports = patchDualExports;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Prepares the build directory for publication by cleaning package.json and patching dual exports.
 *
 * @param pkgDir - Package root directory (defaults to process.cwd()).
 * @returns Prepared package.json object.
 */
function preparePackage(pkgDir = process.cwd()) {
    const rootPkgPath = path_1.default.join(pkgDir, 'package.json');
    if (!fs_1.default.existsSync(rootPkgPath)) {
        throw new Error('No package.json found in ' + pkgDir);
    }
    const rootPkg = JSON.parse(fs_1.default.readFileSync(rootPkgPath, 'utf8'));
    const buildDir = path_1.default.join(pkgDir, 'build');
    if (!fs_1.default.existsSync(buildDir)) {
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
            const res = {};
            for (const [k, v] of Object.entries(obj)) {
                res[k] = rewriteExports(v);
            }
            return res;
        };
        pubPkg.exports = rewriteExports(pubPkg.exports);
    }
    fs_1.default.writeFileSync(path_1.default.join(buildDir, 'package.json'), JSON.stringify(pubPkg, null, 2) + '\n');
    relocateSourceMaps(buildDir);
    patchDualExports(buildDir);
    const copyIfExists = (file) => {
        const src = path_1.default.join(pkgDir, file);
        if (fs_1.default.existsSync(src)) {
            fs_1.default.copyFileSync(src, path_1.default.join(buildDir, file));
        }
    };
    copyIfExists('README.md');
    copyIfExists('LICENSE.md');
    copyIfExists('LICENSE');
    return pubPkg;
}
/**
 * Relocates emitted .js.map source map files into a dedicated maps/ directory within buildDir.
 * Updates sourceMappingURL in corresponding .js files and preserves source paths in source maps.
 *
 * @param buildDir - The build output directory.
 */
function relocateSourceMaps(buildDir) {
    if (!fs_1.default.existsSync(buildDir))
        return;
    const mapDir = path_1.default.join(buildDir, 'maps');
    function scanAndMove(dir) {
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'maps') {
                    scanAndMove(fullPath);
                }
            }
            else if (entry.isFile() && entry.name.endsWith('.js.map')) {
                const relFromBuild = path_1.default.relative(buildDir, fullPath);
                const targetMapPath = path_1.default.join(mapDir, relFromBuild);
                const targetSubDir = path_1.default.dirname(targetMapPath);
                if (!fs_1.default.existsSync(targetSubDir)) {
                    fs_1.default.mkdirSync(targetSubDir, { recursive: true });
                }
                try {
                    const mapContent = JSON.parse(fs_1.default.readFileSync(fullPath, 'utf8'));
                    const originalDir = path_1.default.dirname(fullPath);
                    if (Array.isArray(mapContent.sources)) {
                        mapContent.sources = mapContent.sources.map((s) => {
                            const absSource = path_1.default.resolve(originalDir, s);
                            return path_1.default.relative(targetSubDir, absSource).replace(/\\/g, '/');
                        });
                    }
                    fs_1.default.writeFileSync(targetMapPath, JSON.stringify(mapContent) + '\n');
                    fs_1.default.unlinkSync(fullPath);
                    const jsFile = fullPath.slice(0, -4);
                    if (fs_1.default.existsSync(jsFile)) {
                        let jsCode = fs_1.default.readFileSync(jsFile, 'utf8');
                        const relMapUrl = path_1.default.relative(path_1.default.dirname(jsFile), targetMapPath).replace(/\\/g, '/');
                        const commentPrefix = '/' + '/# sourceMappingURL=';
                        const mapCommentRegex = /\/\/# sourceMappingURL=.*/g;
                        const replacementComment = commentPrefix + relMapUrl;
                        if (mapCommentRegex.test(jsCode)) {
                            jsCode = jsCode.replace(mapCommentRegex, replacementComment);
                        }
                        else {
                            jsCode += '\n' + replacementComment + '\n';
                        }
                        fs_1.default.writeFileSync(jsFile, jsCode);
                    }
                }
                catch (_) { }
            }
        }
    }
    scanAndMove(buildDir);
}
/**
 * Patches CJS and ESM dual export compatibility on compiled JavaScript files.
 *
 * @param dir - Directory containing built JS files.
 */
function patchDualExports(dir) {
    if (!fs_1.default.existsSync(dir))
        return;
    const files = fs_1.default.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
        const fullPath = path_1.default.join(dir, f.name);
        if (f.isDirectory()) {
            patchDualExports(fullPath);
        }
        else if (f.name.endsWith('.js') && !f.name.endsWith('.d.ts')) {
            let content = fs_1.default.readFileSync(fullPath, 'utf8');
            if (content.includes('exports.default =') && !content.includes('module.exports = d;')) {
                content += '\nif (exports.default) {\n    const d = exports.default;\n    module.exports = d;\n    Object.assign(module.exports, exports);\n    module.exports.default = d;\n}\n';
                fs_1.default.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}
//# sourceMappingURL=maps/packagePreparer.js.map