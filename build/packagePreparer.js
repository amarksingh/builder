"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preparePackage = preparePackage;
exports.relocateSourceMaps = relocateSourceMaps;
exports.patchDualExports = patchDualExports;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Prepares the build directory for publication by cleaning package.json and patching dual exports.
 *
 * @param pkgDir - Package root directory (defaults to process.cwd()).
 * @returns Prepared package.json object.
 */
function preparePackage(pkgDir = process.cwd()) {
    const rootPkgPath = node_path_1.default.join(pkgDir, 'package.json');
    if (!node_fs_1.default.existsSync(rootPkgPath)) {
        throw new Error('No package.json found in ' + pkgDir);
    }
    const rootPkg = JSON.parse(node_fs_1.default.readFileSync(rootPkgPath, 'utf8'));
    const buildDir = node_path_1.default.join(pkgDir, 'build');
    if (!node_fs_1.default.existsSync(buildDir)) {
        throw new Error('Build directory does not exist: ' + buildDir);
    }
    const pubPkg = { ...rootPkg };
    delete pubPkg.devDependencies;
    delete pubPkg.scripts;
    delete pubPkg.files;
    const stripBuild = (str) => {
        return str.replace(/^(\.\/)?build\//, './').replace(/^(\.\/)?types\//, './.typed/');
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
    node_fs_1.default.writeFileSync(node_path_1.default.join(buildDir, 'package.json'), JSON.stringify(pubPkg, null, 2) + '\n');
    relocateSourceMaps(buildDir);
    patchDualExports(buildDir);
    const copyIfExists = (file) => {
        const src = node_path_1.default.join(pkgDir, file);
        if (node_fs_1.default.existsSync(src)) {
            node_fs_1.default.copyFileSync(src, node_path_1.default.join(buildDir, file));
        }
    };
    copyIfExists('README.md');
    copyIfExists('LICENSE.md');
    copyIfExists('LICENSE');
    return pubPkg;
}
/**
 * Relocates emitted .js.map source map files into a dedicated .typed/.maps directory within buildDir.
 * Updates sourceMappingURL in corresponding .js files and preserves source paths in source maps.
 *
 * @param buildDir - The build output directory.
 */
function relocateSourceMaps(buildDir) {
    if (!node_fs_1.default.existsSync(buildDir))
        return;
    const mapDir = node_path_1.default.join(buildDir, '.typed', '.maps');
    function scanAndMove(dir) {
        const entries = node_fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = node_path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== '.maps' && entry.name !== 'maps' && entry.name !== '.typed') {
                    scanAndMove(fullPath);
                }
            }
            else if (entry.isFile() && entry.name.endsWith('.js.map')) {
                const relFromBuild = node_path_1.default.relative(buildDir, fullPath);
                const targetMapPath = node_path_1.default.join(mapDir, relFromBuild);
                const targetSubDir = node_path_1.default.dirname(targetMapPath);
                if (!node_fs_1.default.existsSync(targetSubDir)) {
                    node_fs_1.default.mkdirSync(targetSubDir, { recursive: true });
                }
                try {
                    const mapContent = JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8'));
                    const originalDir = node_path_1.default.dirname(fullPath);
                    if (Array.isArray(mapContent.sources)) {
                        mapContent.sources = mapContent.sources.map((s) => {
                            const absSource = node_path_1.default.resolve(originalDir, s);
                            return node_path_1.default.relative(targetSubDir, absSource).replace(/\\/g, '/');
                        });
                    }
                    node_fs_1.default.writeFileSync(targetMapPath, JSON.stringify(mapContent) + '\n');
                    node_fs_1.default.unlinkSync(fullPath);
                    const jsFile = fullPath.slice(0, -4);
                    if (node_fs_1.default.existsSync(jsFile)) {
                        let jsCode = node_fs_1.default.readFileSync(jsFile, 'utf8');
                        const relMapUrl = node_path_1.default.relative(node_path_1.default.dirname(jsFile), targetMapPath).replace(/\\/g, '/');
                        const commentPrefix = '/' + '/# sourceMappingURL=';
                        const mapCommentRegex = /\/\/# sourceMappingURL=.*/g;
                        const replacementComment = commentPrefix + relMapUrl;
                        if (mapCommentRegex.test(jsCode)) {
                            jsCode = jsCode.replace(mapCommentRegex, replacementComment);
                        }
                        else {
                            jsCode += '\n' + replacementComment + '\n';
                        }
                        node_fs_1.default.writeFileSync(jsFile, jsCode);
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
    if (!node_fs_1.default.existsSync(dir))
        return;
    const files = node_fs_1.default.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
        const fullPath = node_path_1.default.join(dir, f.name);
        if (f.isDirectory()) {
            patchDualExports(fullPath);
        }
        else if (f.name.endsWith('.js') && !f.name.endsWith('.d.ts')) {
            let content = node_fs_1.default.readFileSync(fullPath, 'utf8');
            if (content.includes('exports.default =') && !content.includes('module.exports = d;')) {
                content += '\nif (exports.default) {\n    const d = exports.default;\n    module.exports = d;\n    Object.assign(module.exports, exports);\n    module.exports.default = d;\n}\n';
                node_fs_1.default.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}
//# sourceMappingURL=.typed/.maps/packagePreparer.js.map