'use strict';

var webpackSources = require('webpack-sources');

const path = require("path");
const defaultNodeModulesOutputDir = 'mp_node_modules/';
function replaceStart(searchValue, replaceValue) {
    if (this.indexOf(searchValue) === 0) {
        return this.replace(searchValue, replaceValue);
    }
    else {
        return this;
    }
}
class WxWebpackPlugin {
    constructor(options) {
        var _a;
        // mp_node_modules文件夹，去掉两边的.和/
        let nodeModulesOutputDir = options.nodeModulesOutputDir || defaultNodeModulesOutputDir;
        nodeModulesOutputDir = replaceStart.call(nodeModulesOutputDir, '.', '');
        nodeModulesOutputDir = replaceStart.call(nodeModulesOutputDir, '/', '');
        nodeModulesOutputDir[nodeModulesOutputDir.length - 1] === '/' &&
            (nodeModulesOutputDir = nodeModulesOutputDir.substr(0, nodeModulesOutputDir.length - 1));
        this.state = {
            nodeModules: [],
            nodeModulesPath: path.resolve(process.cwd(), 'node_modules'),
            utilModules: [],
            utilModulesPaths: ((_a = options === null || options === void 0 ? void 0 : options.libPaths) === null || _a === void 0 ? void 0 : _a.filter(item => {
                return item.indexOf('node_modules') === -1;
            }).map(item => {
                return path.resolve(process.cwd(), item);
            })) || [],
            nodeModulesOutputDir,
            options: options
        };
    }
    /**
     * 给chunk取名
     * @param moduleResource
     * @param dir
     * @param prefix
     */
    getNewChunkName(moduleResource = '', dir, prefix = '') {
        let chunkName = '';
        if (dir instanceof Array) {
            const findRst = dir.find(item => moduleResource.indexOf(item) >= 0);
            if (findRst) {
                chunkName = replaceStart.call(moduleResource.split(findRst)[1], '/', '');
                prefix = this.state.options.libPaths.find(item => findRst.indexOf(item) >= 0) || '';
                prefix = replaceStart.call(prefix, '.', '');
                prefix = replaceStart.call(prefix, '/', '');
                prefix = replaceStart.call(prefix, 'src/', '');
            }
        }
        else {
            chunkName = moduleResource.split(dir)[1];
        }
        chunkName = chunkName.replace(path.extname(chunkName), '');
        return `${prefix ? (prefix + (prefix[prefix.length - 1] === '/' ? '' : '/')) : ''}${chunkName}`;
    }
    /**
     * 给module新创建一个chunk，每个chunk关联一个module
     * @param compilation
     * @param module
     * @param namePrefix
     */
    createNewChunkForModule(compilation, module, namePrefix) {
        // @ts-ignore
        const modulePath = module.resource || module.context;
        const newChunkName = this.getNewChunkName(modulePath, modulePath.indexOf('node_modules/') >= 0 ? 'node_modules/' : this.state.utilModulesPaths, namePrefix);
        // @ts-ignore
        const newChunk = compilation.addChunk(newChunkName);
        newChunk.addModule(module);
        module.addChunk(newChunk);
        return true;
    }
    /**
     * 移除此module的所有chunk关联
     * @param module
     */
    removeModulesAllChunks(module) {
        for (const moduleChunk of module.getChunks()) {
            module.removeChunk(moduleChunk);
        }
    }
    /**
     * 遍历所有原始模块，找出需要提取出的公共模块
     * @param modules
     */
    iterateAllModules(modules) {
        modules.forEach(module => {
            // @ts-ignore
            const modulePath = module.resource || module.context;
            if (modulePath.indexOf(this.state.nodeModulesPath) >= 0
                || modulePath.indexOf('node_modules/') >= 0) {
                this.removeModulesAllChunks(module);
                if (modulePath.match(/\/moment\/locale/)) {
                    return;
                }
                this.state.nodeModules.push(module);
                return;
            }
            const findRst = this.state.utilModulesPaths.find(uPath => {
                return modulePath.indexOf(uPath) >= 0;
            });
            if (findRst) {
                this.removeModulesAllChunks(module);
                this.state.utilModules.push(module);
                return;
            }
        });
    }
    /**
     * webpack优化chunk包之后，会修改chunk name，需要再把它改回成我们需要的名字
     * @param chunk
     */
    resolveChunkNameAfterOptimization(chunk) {
        const { nodeModulesOutputDir } = this.state;
        if (chunk.name.indexOf(nodeModulesOutputDir) > 0) {
            chunk.name = `${nodeModulesOutputDir}${chunk.name.split(nodeModulesOutputDir)[1]}`;
        }
    }
    /**
     * 对生成的asset文件内容做处理
     * @param asset
     * @param dependencies
     */
    appendAssetContent(asset, dependencies) {
        // @ts-ignore
        const source = asset.source();
        const requireStatements = dependencies.map(item => {
            return `require("${item}");`;
        });
        return new webpackSources.ConcatSource(...requireStatements, source);
    }
    /**
     * 向文件头部插入require语句
     * @param assets
     * @param compilation
     */
    appendRequireStatements(assets, compilation) {
        const chunks = compilation.chunks;
        const modules = compilation.modules;
        const { nodeModulesOutputDir } = this.state;
        chunks.forEach(chunk => {
            const requireDependencies = [];
            // 找出chunk.modules依赖的所有模块
            chunk.getModules().forEach((module) => {
                if (module.type.indexOf('javascript') === -1) {
                    return;
                }
                // @ts-ignore
                if (!module.resource) {
                    return;
                }
                // @ts-ignore
                if (!path.extname(module.resource).match(/\.(ts|js|mjs)$/)) {
                    return;
                }
                // @ts-ignore
                module.dependencies.forEach(dp => {
                    if (!dp.module || !dp.module.resource) {
                        return;
                    }
                    if (!path.extname(dp.module.resource).match(/\.(ts|js|mjs)$/)) {
                        return;
                    }
                    // @ts-ignore
                    let requirePath = path.relative(path.dirname(module.resource), dp.module.resource)
                        .replace('node_modules', nodeModulesOutputDir)
                        .replace(/\.(ts|mjs)/, '.js');
                    // @ts-ignore
                    if (module.resource.indexOf('/src') >= 0 && dp.module.resource.indexOf('/src') === -1) {
                        requirePath = requirePath.replace('../', '');
                    }
                    if (requireDependencies.indexOf(requirePath) === -1) {
                        requireDependencies.push(requirePath);
                    }
                });
            });
            // 上面找出依赖的过程会有遗漏，还需要遍历所有mp_node_modules.reasons，找出因为此chunk而引入的模块
            modules.forEach(module => {
                if (module.type.indexOf('javascript') === -1) {
                    return;
                }
                // @ts-ignore
                if (!module.resource) {
                    return;
                }
                // @ts-ignore
                if (module.resource.indexOf('node_modules') === -1) {
                    return;
                }
                // @ts-ignore
                if (!path.extname(module.resource).match(/\.(ts|js|mjs)$/)) {
                    return;
                }
                module.reasons.forEach(reason => {
                    if (!reason.module.resource) {
                        return;
                    }
                    let tempChunkName = `${nodeModulesOutputDir}${reason.module.resource.split('node_modules')[1]}`;
                    tempChunkName = tempChunkName.replace(path.extname(tempChunkName), '');
                    // @ts-ignore
                    let tempModulePath = `${nodeModulesOutputDir}${module.resource.split('node_modules')[1]}`;
                    if (chunk.name !== tempChunkName) {
                        return;
                    }
                    const requirePath = path.relative(path.dirname(tempChunkName), tempModulePath)
                        .replace(/\.(ts|mjs)/, '.js');
                    if (requireDependencies.indexOf(requirePath) === -1) {
                        requireDependencies.push(requirePath);
                    }
                });
            });
            if (requireDependencies.length > 0) {
                // @ts-ignore
                assets[`${chunk.name}.js`] = this.appendAssetContent(assets[`${chunk.name}.js`], requireDependencies);
            }
        });
        // 向app.js中插入require("runtime")
        // @ts-ignore
        if (!assets['app.js'].source().match(/require\((\"|\')runtime(\.js)?(\"|\')\)/g)) {
            // @ts-ignore
            assets['app.js'] = this.appendAssetContent(assets['app.js'], ['runtime']);
        }
    }
    apply(compiler) {
        compiler.hooks.environment.tap('WxWebpackPlugin', () => {
            // 修改webpack config，必须抽出runtime.js
            compiler.options.optimization.runtimeChunk = {
                name: 'runtime'
            };
        });
        compiler.hooks.thisCompilation.tap('WxWebpackPlugin', (compilation) => {
            compilation.hooks.optimizeModules.tap('WxWebpackPlugin', (modules) => {
                this.iterateAllModules(modules);
            });
            compilation.hooks.optimizeChunks.tap('WxWebpackPlugin', (chunks) => {
                this.state.nodeModules.forEach(module => this.createNewChunkForModule(compilation, module, this.state.nodeModulesOutputDir));
                this.state.utilModules.forEach(module => this.createNewChunkForModule(compilation, module, ''));
            });
            compilation.hooks.afterOptimizeChunks.tap('WxWebpackPlugin', (chunks) => {
                chunks.forEach(chunk => this.resolveChunkNameAfterOptimization(chunk));
            });
            compilation.hooks.optimizeAssets.tapAsync('WxWebpackPlugin', (assets, callback) => {
                this.appendRequireStatements(assets, compilation);
                callback();
            });
        });
    }
}

module.exports = WxWebpackPlugin;
//# sourceMappingURL=index.cjs.js.map
