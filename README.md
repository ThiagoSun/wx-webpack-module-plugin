# wx-webpack-module-plugin
[![996.icu](https://img.shields.io/badge/link-996.icu-red.svg)](https://996.icu)

## 介绍
一款webpack插件，用来提取小程序公共模块，适用于搭配webpack开发的小程序

## 使用

在webpack配置文件中：

```
plugins: [
    new WxWebpackModulePlugin({
        libPaths: ['src/utils', 'src/lib']
    }),
]
```

## 参数

### `libPaths`

Type: `Array<string>`<br>
Default: `null`

源代码中公共模块的路径（node_modules除外），该路径下的模块将不会被重复打包至各个chunk中，最终会作为小程序主包的一部分。

### `nodeModulesOutputDir`

Type: `string`<br>
Default: `mp_node_modules/`

node_modules下的模块被打包至该文件夹下，这个参数可修改该文件夹名称
