import * as fs from 'fs';
import * as path from 'path';

/**
 * Prepares the build directory for publication by cleaning package.json and patching dual exports.
 *
 * @param pkgDir - Package root directory (defaults to process.cwd()).
 * @returns Prepared package.json object.
 */
export function preparePackage(pkgDir: string = process.cwd()): Record<string, any> {
    const rootPkgPath: string = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(rootPkgPath)) {
        throw new Error('No package.json found in ' + pkgDir);
    }

    const rootPkg: Record<string, any> = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const buildDir: string = path.join(pkgDir, 'build');

    if (!fs.existsSync(buildDir)) {
        throw new Error('Build directory does not exist: ' + buildDir);
    }

    const pubPkg: Record<string, any> = { ...rootPkg };

    delete pubPkg.devDependencies;
    delete pubPkg.scripts;
    delete pubPkg.files;

    const stripBuild = (str: string): string => {
        return str.replace(/^(\.\/)?build\//, './');
    };

    if (typeof pubPkg.main === 'string') pubPkg.main = stripBuild(pubPkg.main).replace(/^\.\//, '');
    if (typeof pubPkg.types === 'string') pubPkg.types = stripBuild(pubPkg.types).replace(/^\.\//, '');
    if (typeof pubPkg.bin === 'string') {
        pubPkg.bin = stripBuild(pubPkg.bin).replace(/^\.\//, '');
    } else if (pubPkg.bin && typeof pubPkg.bin === 'object') {
        const newBin: Record<string, string> = {};
        for (const [k, v] of Object.entries(pubPkg.bin)) {
            if (typeof v === 'string') {
                newBin[k] = stripBuild(v).replace(/^\.\//, '');
            }
        }
        pubPkg.bin = newBin;
    }

    if (pubPkg.exports) {
        const rewriteExports = (obj: any): any => {
            if (typeof obj === 'string') return stripBuild(obj);
            if (Array.isArray(obj)) return obj.map(rewriteExports);
            if (typeof obj === 'object' && obj !== null) {
                const res: Record<string, any> = {};
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

    const copyIfExists = (file: string): void => {
        const src: string = path.join(pkgDir, file);
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
export function patchDualExports(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
        const fullPath: string = path.join(dir, f.name);
        if (f.isDirectory()) {
            patchDualExports(fullPath);
        } else if (f.name.endsWith('.js') && !f.name.endsWith('.d.ts')) {
            let content: string = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('exports.default =') && !content.includes('module.exports = d;')) {
                content += '\nif (exports.default) {\n    const d = exports.default;\n    module.exports = d;\n    Object.assign(module.exports, exports);\n    module.exports.default = d;\n}\n';
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}
