// webpack.config.js
const path = require('path')
const { name as packageName } = require('./package.json')

module.exports = {
entry: './src/index.tsx',
output: {
    // 公共路径，用于资源加载
    publicPath: './',
    // 输出目录
    path: path.resolve(__dirname, 'dist'),
    // 输出文件名，使用 contenthash 实现长期缓存
    filename: '[name].[contenthash:8].js',
    // 构建前清理输出目录
    clean: true,
    // 必须声明为 umd 格式，qiankun 需要此格式才能加载微应用
    library: `${packageName}-[name]`,
    libraryTarget: 'umd',
    // Webpack 5 使用 chunkLoadingGlobal，Webpack 4 使用 jsonpFunction
    // 避免多个微应用之间的全局变量冲突
    chunkLoadingGlobal: `webpackJsonp_${packageName}`,
},
// 其他配置...
}