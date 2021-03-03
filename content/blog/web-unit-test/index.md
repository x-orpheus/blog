---
title: 前端单元测试技术方案总结
date: 2021-03-03T02:31:47.166Z
description: 单元测试的技术方案很多，不同工具之间有互相协同，也存在功能重合，给我们搭配测试方案带来不小的困难，而且随着 ES6, TypeScript 的出现，单元测试又增加了很多其他步骤，完整配置起来往往需要很大的时间成本。
---

![题图](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7289440914/8006/d604/65dd/cb6ead57764ff32f02a64f327e79c3e7.jpg)

> 本文作者: [江水](https://www.zhihu.com/people/li-quan-wei-41)

本文主要介绍前端**单元测试**的一些技术方案。

单元测试的技术方案很多，不同工具之间有互相协同，也存在功能重合，给我们搭配测试方案带来不小的困难，而且随着 `ES6`, `TypeScript` 的出现，单元测试又增加了很多其他步骤，完整配置起来往往需要很大的时间成本。我希望通过对这些工具的各自作用的掌握，了解完整的前端测试技术方案。前端单元测试的领域也很多，这里主要讲对于前端组件如何进行单元测试，最后会主要介绍下对于 `React` 组件的一些测试方法总结。

### 通用测试

单元测试最核心的部分就是做断言，比如传统语言中的 `assert` 函数，如果当前程序的某种状态符合 `assert` 的期望此程序才能正常执行，否则直接退出应用。所以我们可以直接用 `Node` 中自带的 `assert` 模块做断言。

用最简单的例子做个验证

```javascript
function multiple(a, b) {
    let result = 0;
    for (let i = 0; i < b; ++i)
        result += a;
    return result;
}
```

```javascript
const assert = require('assert');
assert.equal(multiple(1, 2), 3));
```

这种例子能够满足基础场景的使用，也可以作为一种单元测试的方法。

`nodejs` 自带的 `assert` 模块提供了下面一些断言方法，只能满足一些简单场景的需要。

```javascript
assert.deepEqual(actual, expected[, message])
assert.deepStrictEqual(actual, expected[, message])
assert.doesNotMatch(string, regexp[, message])
assert.doesNotReject(asyncFn[, error][, message])
assert.doesNotThrow(fn[, error][, message])
assert.equal(actual, expected[, message])
assert.fail([message])
assert.ifError(value)
assert.match(string, regexp[, message])
assert.notDeepEqual(actual, expected[, message])
assert.notDeepStrictEqual(actual, expected[, message])
assert.notEqual(actual, expected[, message])
assert.notStrictEqual(actual, expected[, message])
assert.ok(value[, message])
assert.rejects(asyncFn[, error][, message])
assert.strictEqual(actual, expected[, message])
assert.throws(fn[, error][, message])
```

自带的 `assert` 不是专门给单元测试使用, 提供的错误信息文档性不好，上面的 `demo` 最终执行下来会产生下面的报告:

```bash
$ node index.js
assert.js:84
  throw new AssertionError(obj);
  ^

AssertionError [ERR_ASSERTION]: 2 == 3
    at Object.<anonymous> (/home/quanwei/git/index.js:4:8)
    at Module._compile (internal/modules/cjs/loader.js:778:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:789:10)
    at Module.load (internal/modules/cjs/loader.js:653:32)
    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)
    at Function.Module._load (internal/modules/cjs/loader.js:585:3)
    at Function.Module.runMain (internal/modules/cjs/loader.js:831:12)
    at startup (internal/bootstrap/node.js:283:19)
    at bootstrapNodeJSCore (internal/bootstrap/node.js:623:3)
```

由于自带的模块依赖 `Node` 自身的版本，没办法自由升级，所以使用内置的包灵活性有时候不太够，另外我们很多断言函数也需要在浏览器端执行，所以我们需要同时支持浏览器和 `Node` 端的断言库。同时观察上面的输出可以发现，这个报告更像是程序的错误报告，而不是一个单元测试报告。而我们在做单元测时往往需要断言库能够提供良好的测试报告，这样才能一目了然地看到有哪些断言通过没通过，所以使用专业的单元测试断言库还是很有必要。

### chai

![chai](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288685151/e731/a144/fe91/cccf0486bd1d3c64eee56f17b46001e2.png)

`chai` 是目前很流行的断言库，相比于同类产品比较突出。`chai` 提供了 [TDD](https://en.wikipedia.org/wiki/Test-driven_development) (Test-driven development）和 [BDD](https://en.wikipedia.org/wiki/Behavior-driven_development) (Behavior-driven development) 两种风格的断言函数，这里不会过多介绍两种风格的优缺，本文主要以 `BDD` 风格做演示。

#### TDD 风格的 chai

```javascript
var assert = require('chai').assert
  , foo = 'bar'
  , beverages = { tea: [ 'chai', 'matcha', 'oolong' ] };

assert.typeOf(foo, 'string'); // without optional message
assert.typeOf(foo, 'number', 'foo is a number'); // with optional message
assert.equal(foo, 'bar', 'foo equal `bar`');
assert.lengthOf(foo, 3, 'foo`s value has a length of 3');
assert.lengthOf(beverages.tea, 3, 'beverages has 3 types of tea');
```

`chai` 比 `Node` 自带的 `assert` 增加了一个断言说明参数，可以通过这个参数提高测试报告的可读性

```bash
$ node chai-assert.js

/home/quanwei/git/learn-tdd-bdd/node_modules/chai/lib/chai/assertion.js:141
      throw new AssertionError(msg, {
      ^
AssertionError: foo is a number: expected 'bar' to be a number
    at Object.<anonymous> (/home/quanwei/git/learn-tdd-bdd/chai-assert.js:6:8)
    at Module._compile (internal/modules/cjs/loader.js:778:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:789:10)
    at Module.load (internal/modules/cjs/loader.js:653:32)
    at tryModuleLoad (internal/modules/cjs/loader.js:593:12)
    at Function.Module._load (internal/modules/cjs/loader.js:585:3)
    at Function.Module.runMain (internal/modules/cjs/loader.js:831:12)
    at startup (internal/bootstrap/node.js:283:19)
    at bootstrapNodeJSCore (internal/bootstrap/node.js:623:3)
```

#### BDD 风格的 chai

`chai` 的 `BDD` 风格使用 `expect` 函数作为语义的起始，也是目前几乎所有 `BDD` 工具库都遵循的风格。

`chai` 的 `expect` 断言风格如下

```javascript
expect(foo).to.be.a('string');
expect(foo).to.equal('bar');
expect(foo).to.have.lengthOf(3);
```

`BDD` 的思想就是写单元测试就像写产品需求，而不关心内部逻辑，每一个用例阅读起来就像一篇文档。例如下面的用例：

1. foo 是一个字符串              ->`expect(foo).to.be.a('string')`
2. foo 字符串里包含 'bar'     ->`expect(foo).to.include('bar')`
3. foo 字符串里不包含 'biz'  -> `expect(foo).to.not.include('biz')`

可以看到这种风格的测试用例可读性更强。

其他的断言库还有 `expect.js` `should.js` [better-assert](https://github.com/tj/better-assert) , [unexpected.js](https://unexpected.js.org/) 这些断言库都只提供纯粹的断言函数，可以根据喜好选择不同的库使用。

有了断言库之后我们还需要使用测试框架将我们的断言更好地组织起来。

### mocha 和 Jasmine

![mocha jasmine](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288702281/d7ee/bc5d/30fb/7b198b7176345d6c8eb4db06254d2dc3.png)

`mocha` 是一个经典的测试框架(Test Framework)，测试框架提供了一个单元测试的骨架，可以将不同子功能分成多个文件，也可以对一个子模块的不同子功能再进行不同的功能测试，从而生成一份结构型的测试报告。例如 `mocha` 就提供了`describe` 和 `it ` 描述用例结构，提供了 `before`, `after`, `beforeEach`, `afterEach` 生命周期函数，提供了 `describe.only` ,`describe.skip` , `it.only`, `it.skip` 用以执行指定部分测试集。

```javascript
const { expect } = require('chai');
const { multiple } = require('./index');

describe('Multiple', () => {
    it ('should be a function', () => {
        expect(multiple).to.be.a('function');
    })

    it ('expect 2 * 3 = 6', () => {
        expect(multiple(2, 3)).to.be.equal(6);
    })
})
```

测试框架不依赖底层的断言库，哪怕使用原生的 `assert` 模块也可以进行。给每一个文件都要手动引入 `chai` 比较麻烦 ，这时候可以给 `mocha` 配置全局脚本，在项目根目录 `.mocharc.js` 文件中加载断言库, 这样每个文件就可以直接使用 `expect` 函数了。

```javascript
// .mocharc.js
global.expect = require('chai').expect;
```

使用 mocha 可以将我们的单元测试输出成一份良好的测试报告 `mocha *.test.js`

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288724164/84dd/f65f/e9c8/e5ebd56f8332c721c6ccd85aba2d0c0f.png)

当出现错误时输出如下![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288754833/2e6e/4cfe/90ee/06957d71ca816feb5844f35ea595fb09.png)

因为运行在不同环境中需要的包格式不同，所以需要我们针对不同环境做不同的包格式转换，为了了解在不同端跑单元测试需要做哪些事情，可以先来了解一下常见的包格式。

目前我们主流有三种模块格式，分别是 `AMD`, `CommonJS`, `ES Module`。

#### AMD

[AMD](https://github.com/amdjs/amdjs-api/blob/master/AMD.md) 是 `RequireJS` 推广过程中流行的一个比较老的规范，目前无论浏览器还是 `Node` 都没有默认支持。`AMD` 的标准定义了 `define` 和 `require`函数，`define`用来定义模块及其依赖关系，`require` 用以加载模块。例如

```diff
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8"/>
        <title>Document</title>
+        <script
+			src="https://requirejs.org/docs/release/2.3.6/minified/require.js"></script>
+        <script src="./index.js" />
</head>
    <body></body>
</html>
```

```javascript
// index.js
define('moduleA', ['https://some/of/cdn/path'], function() {
    return { name: 'moduleA' };
});

define(function(require) {
    const fs = require('fs');
    return fs;
})

define('moduleB', function() {
    return { name: 'module B' }
});

require(['moduleA', 'moduleB'], function(moduleA, moduleB) {
    console.log(module);
});
```

这里使用了`RequireJS` 作为 `AMD` 引擎, 可以看到 `define` 函数会定义当前依赖了哪些模块并将模块加载完成后异步回调给当前模块，这种特性使得 AMD 尤为适合浏览器端异步加载。

我们可以使用 `webpack` 打包一份 `amd` 模块看下真实代码

```javascript
// entry.js
export default function sayHello() {
    return 'hello amd';
}
```

```javascript
// webpack.config.js
module.exports = {
    mode: 'development',
    devtool: false,
    entry: './entry.js',
    output: {
        libraryTarget: 'amd'
    }
}
```

最终生成代码(精简了不相关的逻辑)

```javascript
// dist/main.js
define(() => ({
    default: function sayHello() {
        return 'hello amd';
    }
}));
```

在浏览器/`Node` 中想要使用 `AMD` 需要全局引入 `RequireJS`，对单元测试而言比较典型的问题是在初始化 `karma` 时会询问是否使用 `RequireJS` ，不过一般现在很少有人使用了。

#### CommonJS

可以缩写成`CJS` , 其 [规范 ](http://wiki.commonjs.org/wiki/Modules/1.1)主要是为了定义 `Node` 的包格式，`CJS` 定义了三个关键字, 分别为 `require`，`exports`, `module`, 目前几乎所有`Node` 包以及前端相关的`NPM`包都会转换成该格式, `CJS` 在浏览器端需要使用 `webpack` 或者 `browserify` 等工具打包后才能执行。

#### ES Module

`ES Module` 是 `ES 2015` 中定义的一种模块规范，该规范定义了 代表为 `import` 和 `export` ，是我们开发中常用的一种格式。虽然目前很多新版浏览器都支持`<script type="module">` 了，支持在浏览器中直接运行 `ES6` 代码，但是浏览器不支持 `node_modules` ，所以我们的原始 `ES6` 代码在浏览器上依然无法运行，所以这里我暂且认为浏览器不支持 `ES6` 代码, 依然需要做一次转换。

下表为每种格式的支持范围，括号内表示需要借助外部工具支持。

|          | Node                     | 浏览器                     |
| -------- | ------------------------ | -------------------------- |
| AMD      | 不支持(require.js, r.js) | 不支持(require.js)         |
| CommonJS | **支持**                 | 不支持(webpack/browserify) |
| ESModule | 不支持(babel)            | 不支持(webpack)            |

单元测试要在不同的环境下执行就要打不同环境对应的包，所以在搭建测试工具链时要确定自己运行在什么环境中，如果在 `Node` 中只需要加一层 `babel` 转换，如果是在真实浏览器中，则需要增加 `webpack` 处理步骤。

所以为了能够在 `Node` 环境的 `Mocha`中使用 `ES Module` 有两种方式

1. `Node` 环境天生支持 `ES Module ` (node version >= 15)
2. 使用 `babel` 代码进行一次转换

第一种方式略过，第二种方式使用下面的配置

```shell
npm install @babel/register @babel/core @babel/preset-env --save-dev
```

```diff
// .mocharc.js
+ require('@babel/register');
global.expect = require('chai').expect;
```

```diff
// .babelrc
+ {
+    "presets": ["@babel/preset-env" ，“@babel/preset-typescript”]
+ }
```

同样地如果在项目中用到了 `TypeScript`, 就可以使用`ts-node/register` 来解决，因为 `TypeScript`本身支持 `ES Module` 转换成 `CJS`, 所以支持了 `TypeScript`后就不需要使用 `babel` 来转换了。(这里假设使用了 `TypeScript` 的默认配置)

```shell
npm install ts-node typescript --save-dev
```

```javascript
// .mocharc.js
require('ts-node/register');
```

`Mocha` 自身支持浏览器和 `Node` 端测试，为了在浏览器端测试我们需要写一个 html, 里面使用 `<script src="mocha.min.js"> ` 的文件，然后再将本地所有文件插入到html中才能完成测试，手动做工程化效率比较低，所以需要借助工具来实现这个任务，这个工具就是 `Karma`。

`Karma` 本质上就是在本地启动一个web服务器，然后再启动一个外部浏览器加载一个引导脚本，这个脚本将我们所有的源文件和测试文件加载到浏览器中，最终就会在浏览器端执行我们的测试用例代码。所以使用 `Karma` + `mocha` +`chai` 即可搭建一个完整的浏览器端的单元测试工具链。

```shell
npm install karma mocha chai karma-mocha karma-chai --save-dev
npx karma init
// Which testing framework do you want to use: mocha
// Do you want to use Require.js: no
// Do you want capture any browsers automatically: Chrome
```

这里 `Karma` 初始化时选择了 `Mocha` 的支持，然后第二个 `Require.js` 一般为否，除非业务代码中使用了`amd`类型的包。第三个选用 `Chrome` 作为测试浏览器。 然后再在代码里单独配置下 `chai` 。

```diff
// karma.conf.js
module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
-    frameworks: ['mocha'],
+    frameworks: ['mocha', 'chai'],

    // list of files / patterns to load in the browser
    files: [],
```

`Karma` 的 `frameworks` 作用是在全局注入一些依赖，这里的配置就是将 `Mocha` 和 `chai` 提供的测试相关工具暴露在全局上供代码里使用。 `Karma` 只是将我们的文件发送到浏览器去执行，但是根据前文所述我们的代码需要经过 `webpack` 或 `browserify` 打包后才能运行在浏览器端。

如果原始代码已经是 `CJS`了，可以使用 `browserify` 来支持浏览器端运行，基本零配置，但是往往现实世界比较复杂，我们有 `ES6 `，`JSX` 以及 `TypeScript` 要处理，所以这里我们使用 `webpack` 。

 下面是 `webpack` 的配置信息。

```shell
npm install karma-webpack@4 webpack@4 @babel/core @babel/preset-env @babel/preset-react babel-loader --save-dev
```

```diff
// karma.conf.js
module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai'],


    // list of files / patterns to load in the browser
    files: [
+      { pattern: "test/*.test.js", watched: false }
    ],

    preprocessors: {
+      'test/**/*.js': [ 'webpack']
    },

+    webpack: {
+       module: {
+			rules: [{
+           test: /.*\.js/,
+           use: 'babel-loader'
+         }]
+     }
+    },
```

```json
// .babelrc
{
    "presets": ["@babel/preset-env", "@babel/preset-react"]
}
```

这里我们测试一个`React` 程序代码如下

```javascript
// js/index.js
import React from 'react';
import ReactDOM from 'react-dom';

export function renderToPage(str) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    console.log('there is real browser');
    return new Promise(resolve => {
        ReactDOM.render(<div>{ str } </div>, container, resolve);
    });
}

// test/index.test.js
import { renderToPage } from '../js/index';

describe('renderToPage', () => {
    it ('should render to page', async function () {
        let content = 'magic string';
        await renderToPage(content);
        expect(document.documentElement.innerText).to.be.contain(content);
    })
})
```

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288797723/727f/709e/c4f1/9261201cc80a03968211862de81c8a1d.png)

并且打开了本地浏览器

![karma browser](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288813921/78e9/883b/4718/337b43c0841428ce9dafadb3db61d57e.png)

可以看到现在已经在真实浏览器中运行测试程序了。

因为图形化的测试对 `CI` 机器不友好，所以可以选择 `puppeteer` 代替 `Chrome`。

再者这些都是很重的包，如果对真实浏览器依赖性不强，可以使用 `JSDOM` 在 `Node` 端模拟一个浏览器环境。

稍微总结下工具链

* 在 Node 环境下测试工具链可以为 : `mocha` + `chai` + `babel`
* 模拟浏览器环境可以为 : `mocha` + `chai` + `babel` + `jsdom`
* 在真实浏览器环境下测试工具链可以为 : `karma` + `mocha` + `chai` + `webpack` + `babel`

一个测试流水线往往需要很多个工具搭配使用，配置起来比较繁琐，还有一些额外的工具例如单元覆盖率（istanbul），函数/时间模拟 (sinon.js）等工具。工具之间的配合有时候不一定能够完美契合，选型费时费力。

`jasmine` 的出现就稍微缓解了一下这个问题，但也不够完整，`jasmine`提供一个测试框架，里面包含了 测试流程框架，断言函数，mock工具等测试中会遇到的工具。可以近似地看作 `jasmine = mocha + chai + 辅助工具` 。

接下来试一试 `jasmine` 的工作流程。

使用 `npx jasmine init ` 初始化之后会在当前目录中生成`spec`目录, 其中包含一份默认的配置文件

```javascript
// ./spec/support/jasmine.json
{
  "spec_dir": "spec",
  "spec_files": [
    "**/*[sS]pec.js"
  ],
  "helpers": [
    "helpers/**/*.js"
  ],
  "stopSpecOnExpectationFailure": false,
  "random": true
}
```

如果希望加载一些全局的配置可以在 `spec/helpers` 目录中放一些`js`文件, 正如配置所言，jasmine 在启动时会去执行 `spec/helpers` 目录下的所有`js`文件。

比如我们常常使用 `es6`语法，就需要增加`es6`的支持。

新增 `spec/helpers/babel.js` 写入如下配置即可。

```shell
npm install @babel/register @babel/core @babel/preset-env --save-dev
```

```javascript
// spec/helpers/babel.js
require('babel-register');
```

```json
// .babelrc
{
    "presets": ["@babel/preset-env"]
}
```

和 `mocha` 一样，如果需要 `TypeScript` 的支持，可以使用如下配置

```shell
npm install ts-node typescript --save-dev
```

```javascript
// spec/helpers/typescript.js
require('ts-node/register');
```

配置文件中的 `spec_dir`是 `jasmine`约定的用例文件目录，`spec_files`规定了用例文件格式为 `xxx.spec.js`。

有了这份默认配置就可以按照要求写用例，例如

```javascript
// ./spec/index.spec.js
import { multiple } from '../index.js';

describe('Multiple', () => {
    it ('should be a function', () => {
        expect(multiple).toBeInstanceOf(Function);
    })

    it ('should 7 * 2 = 14', () => {
        expect(multiple(7, 2)).toEqual(14);
    })

    it ('should 7 * -2 = -14', () => {
        expect(multiple(7, -2)).toEqual(-14);
    })
})
```

`jasmine` 的断言风格和 `chai` 很不一样，`jasmine` 的 `API` 如下，与 `chai` 相比少写了很多 `.` ，而且支持的功能更加清晰，不用考虑如何组合使用的问题，而且下文介绍的 `jest` 测试框架也是使用这种风格。

```
nothing()
toBe(expected)
toBeCloseTo(expected, precisionopt)
toBeDefined()
toBeFalse()
toBeFalsy()
toBeGreaterThan(expected)
toBeGreaterThanOrEqual(expected)
toBeInstanceOf(expected)
toBeLessThan(expected)
toBeLessThanOrEqual(expected)
toBeNaN()
toBeNegativeInfinity()
toBeNull()
toBePositiveInfinity()
toBeTrue()
toBeTruthy()
toBeUndefined()
toContain(expected)
toEqual(expected)
toHaveBeenCalled()
toHaveBeenCalledBefore(expected)
toHaveBeenCalledOnceWith()
toHaveBeenCalledTimes(expected)
toHaveBeenCalledWith()
toHaveClass(expected)
toHaveSize(expected)
toMatch(expected)
toThrow(expectedopt)
toThrowError(expectedopt, messageopt)
toThrowMatching(predicate)
withContext(message) → {matchers}
```

运行 `jasmine` 即可生成测试报告

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288840974/e1bb/d2cb/428e/60b4be284d81de2b603f21009002e455.png)

默认的测试报告不是很直观， 如果希望提供类似 `Mocha` 风格的报告可以安装 `jasmine-spec-reporter` ，在 `spec/helpers` 目录中添加一个配置文件， 例如`spec/helpers/reporter.js`。

```javascript
const SpecReporter = require('jasmine-spec-reporter').SpecReporter;

jasmine.getEnv().clearReporters();               // remove default reporter logs
jasmine.getEnv().addReporter(new SpecReporter({  // add jasmine-spec-reporter
  spec: {
    displayPending: true
  }
}));
```

此时输出的用例报告如下

![jasmine](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288855339/75e5/56c6/459a/e5a7f325b2a12fa92351e7b7b938ee2b.png)

如果在 `Jasmine` 中执行 DOM 级别的测试，就依然需要借助 `Karma` 或 `JSDOM`了，具体的配置这里就不再赘述。

总结下 `Jasmine` 的工具链

1. Node 环境下测试 : `Jasmine` + `babel`
2. 模拟 `JSDOM` 测试 : `Jasmine` + `JSDOM` + `babel`
3. 真实浏览器测试 : `Karma` + `Jasmine` + `webpack` + `babel`

### JEST

![jest](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288870749/a67b/da76/efa9/09afbcf7e97663425e2e793d1b4f49d4.png)

`Jest` 是 `facebook` 出的一个完整的单元测试技术方案，集 测试框架, 断言库, 启动器, 快照，沙箱，mock工具于一身，也是 `React` 官方使用的测试工具。`Jest` 和 `Jasmine` 具有非常相似的 `API` ，所以在 `Jasmine` 中用到的工具在 `Jest` 中依然可以很自然地使用。可以近似看作 `Jest = JSDOM 启动器 + Jasmine  ` 。

虽然 Jest 提供了很丰富的功能，但是并没有内置 `ES6` 支持，所以依然需要根据不同运行时对代码进行转换，由于 Jest 主要运行在 `Node` 中，所以需要使用 `babel-jest` 将 `ES Module` 转换成 `CommonJS` 。

Jest 的默认配置

```shell
npm install jest --save-dev
npx jest --init
√ Would you like to use Jest when running "test" script in "package.json"? ... yes
√ Would you like to use Typescript for the configuration file? ... no
√ Choose the test environment that will be used for testing » jsdom (browser-like)
√ Do you want Jest to add coverage reports? ... no
√ Which provider should be used to instrument code for coverage? » babel
√ Automatically clear mock calls and instances between every test? ... yes
```

在 `Node` 或 `JSDOM` 下增加 `ES6`代码的支持

```shell
npm install jest-babel @babel/core @babel/preset-env
```

```json
// .babelrc
{
    "presets": ["@babel/preset-env"]
}
```

```diff
// jest.config.js
// 下面两行为默认配置，不写也可以
{
+    testEnvironment: "jsdom",
+    transform: {"\\.[jt]sx?$": "babel-jest"}
}
```

使用 `Jest` 生成测试报告

![jest](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288884924/d4ed/3c56/9b03/0adaf779f64f8ff5ec4cc4bdc4a023a4.png)

对于 `React` 和 `TypeScript` 支持也可以通过修改 `babel` 的配置解决

```shell
npm install @babel/preset-react @babel/preset-typescript --save-dev
```

```json
// .babrlrc
{
    "presets": ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"]
}
```

#### Jest 在真实浏览器环境下测试

目前 `Jest` 不支持直接在真实浏览器中进行测试，其默认的启动器只提供了一个 `JSDOM` 环境，在浏览器中进行单元测试目前只有 `Karma` 方案能做到，所以也可以使用 `Karma` + `Jest` 方案实现，但是不建议这么做，因为 `Jest` 自身太重，使用 `Karma` + `Jasmine` 能达到基本一样的效果。

另外还有一个比较流行的 `E2E` 方案 `Jest` + `Puppeteer ` ,  由于 `E2E`  不属于单元测试范畴，这里不再展开。

`Jest` 工具链总结

* Node 环境下测试 : `Jest` + `babel`
* `JSDOM` 测试 : `Jest` + `babel`
* 真实浏览器测试(不推荐)
* `E2E` 测试 : `Jest` + `Puppeteer`

##### 稍作总结

上面的内容介绍了 `chai` ,  `mocha` , `karma` , `jasmine` 和 `jest`, 每种工具分别对应一些自己特有的工具链，在选取合适的测试工具时根据实际需要选择， 测试领域还有非常多的工具数都数不过来，下面来看下 React 单元测试的一些方法。

#### 使用 Jest + Enzyme 对 React 进行单元测试

![enzyme](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288949022/b540/991e/e6c7/04186cfa1052b4769df679a2aaca6685.png)

`Enzyme`基础配置如下:

```shell
npm install enzyme enzyme-adapter-react-16 jest-enzyme jest-environment-enzyme jest-canvas-mock react@16 react-dom@16 --save-dev
```

```diff
// jest.config.js
{
- "testEnvironment": "jsdom",
+  setupFilesAfterEnv: ["jest-enzyme", "jest-canvas-mock"],
+  testEnvironment: "enzyme",
+  testEnvironmentOptions: {
+    "enzymeAdapter": "react16"
+  },
}
```

`jest-canvas-mock` 这个包是为了解决一些使用 `JSDOM` 未实现行为触发警告的问题。

上面建立了一个使用 `Enzyme` 比较友好的环境，可以直接在全局作用域里引用 `React` , `shallow`, `mount` 等 `API`。此外 `Enzyme` 还注册了许多友好的断言函数到 `Jest` 中，如下所示，[参考地址](https://github.com/enzymejs/enzyme-matchers/blob/master/packages/jest-enzyme/README.md)

```
toBeChecked()
toBeDisabled()
toBeEmptyRender()
toExist()
toContainMatchingElement()
toContainMatchingElements()
toContainExactlyOneMatchingElement()
toContainReact()
toHaveClassName()
toHaveDisplayName()
toHaveHTML()
toHaveProp()
toHaveRef()
toHaveState()
toHaveStyle()
toHaveTagName()
toHaveText()
toIncludeText()
toHaveValue()
toMatchElement()
toMatchSelector()
```

```javascript
// js/ClassComponent.js
import React from 'react';

export default class ClassComponent extends React.PureComponent {
    constructor() {
        super();
        this.state = { name: 'classcomponent' };
    }
    render() {
        return (
            <div>
                a simple class component
                <CustomComponent />
            </div>
        );
    }
}

// test/hook.test.js
import HookComponent from '../js/HookComponent';

describe('HookComponent', () => {
    it ('test with shallow', () => {
        const wrapper = shallow(<HookComponent id={1} />);
        expect(wrapper).toHaveState('name', 'classcomponent');
        expect(wrapper).toIncludeText('a simple class component');
        expect(wrapper).toContainReact(<div>a simple class component</div>);
        expect(wrapper).toContainMatchingElement('CustomComponent');
    })
})
```

`Enzyme` 提供了三种渲染组件方法

* `shallow` 使用 `react-test-renderer` 将组件渲染成内存中的对象, 可以方便进行 `props`, `state` 等数据方面的测试，对应的操作对象为 `ShallowWrapper`，在这种模式下仅能感知到第一层自定义子组件，对于自定义子组件内部结构则无法感知。
* `mount` 使用 `react-dom` 渲染组件，会创建真实 `DOM` 节点，比 `shallow` 相比增加了可以使用原生 `API` 操作 `DOM` 的能力，对应的操作对象为 `ReactWrapper `，这种模式下感知到的是一个完整的 `DOM` 树。
* `render` 使用 `react-dom-server` 渲染成 `html` 字符串，基于这份静态文档进行操作，对应的操作对象为 `CheerioWrapper`。

#### Shallow 渲染

因为 `shallow` 模式仅能感知到第一层自定义子组件组件，往往只能用于简单组件测试。例如下面的组件

```javascript
// js/avatar.js
function Image({ src }) {
    return <img src={src} />;
}

function Living({ children }) {
    return <div className="icon-living"> { children } </div>;
}

function Avatar({ user, onClick }) {
    const { living, avatarUrl } = user;
    return (
        <div className="container" onClick={onClick}>
            <div className="wrapper">
              <Living >
                <div className="text"> 直播中 </div>
              </Living>
            </div>
            <Image src={avatarUrl} />
        </div>
    )
}

export default Avatar;
```

`shallow` 渲染虽然不是真正的渲染，但是其组件生命周期会完整地走一遍。

使用 `shallow(<Avatar />) ` 能感知到的结构如下, 注意看到 `div.text` 作为 `Living` 组件的 `children` 能够被检测到，但是 `Living` 的内部结构无法感知。

![shallow](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7288961002/d1ac/72cd/3523/afa5210e03236071b83b5322d0368c6e.png)

`Enzyme` 支持的选择器支持我们熟悉的 `css selector` 语法，这种情况下我们可以对 `DOM` 结构做如下测试

```javascript
// test/avatar.test.js
import Avatar from '../js/avatar';

describe('Avatar', () => {
    let wrapper = null, avatarUrl = 'abc';

    beforeEach(() => {
        wrapper = shallow(<Avatar user={{ avatarUrl: avatarUrl }} />);
    })

    afterEach(() => {
        wrapper.unmount();
        jest.clearAllMocks();
    })

    it ('should render success', () => {
        // wrapper 渲染不为空
        expect(wrapper).not.toBeEmptyRender();
        // Image 组件渲染不为空, 这里会执行 Image 组件的渲染函数
        expect(wrapper.find('Image')).not.toBeEmptyRender();
        // 包含一个节点
        expect(wrapper).toContainMatchingElement('div.container');
        // 包含一个自定义组件
        expect(wrapper).toContainMatchingElement("Image");
        expect(wrapper).toContainMatchingElement('Living');
        // shallow 渲染不包含子组件的内部结构
        expect(wrapper).not.toContainMatchingElement('img');
        // shallow 渲染包含 children 节点
        expect(wrapper).toContainMatchingElement('div.text');
        // shallow 渲染可以对 children 节点内部结构做测试
        expect(wrapper.find('div.text')).toIncludeText('直播中');
    })
})

```

如果我们想去测试对应组件的 `props` / `state` 也可以很方便测试，不过目前存在缺陷，`Class Component` 能通过 `toHaveProp`, `toHaveState` 直接测试， 但是 `Hook ` 组件无法测试 `useState` 。

```javascript
it ('Image component receive props', () => {
  const imageWrapper = wrapper.find('Image');、
  // 对于 Hook 组件目前我们只能测试 props
  expect(imageWrapper).toHaveProp('src', avatarUrl);
})
```

`wrapper.find` 虽然会返回同样的一个 `ShallowWrapper` 对象，但是这个对象的子结构是未展开的，如果想测试`imageWrapper` 内部结构，需要再 `shallow render` 一次。

```javascript
it ('Image momponent receive props', () => {
  const imageWrapper = wrapper.find('Image').shallow();

  expect(imageWrapper).toHaveProp('src', avatarUrl);
  expect(imageWrapper).toContainMatchingElement('img');
  expect(imageWrapper.find('img')).toHaveProp('src', avatarUrl);
})
```

也可以改变组件的 `props`, 触发组件重绘

```javascript
it ('should rerender when user change', () => {
    const newAvatarUrl = '' + Math.random();
    wrapper.setProps({ user: { avatarUrl: newAvatarUrl }});
    wrapper.update();
    expect(wrapper.find('Image')).toHaveProp('src', newAvatarUrl);
})
```

另一个常见的场景是事件模拟，事件比较接近真实测试场景，这种场景下使用 `shallow` 存在诸多缺陷，因为 `shallow` 场景事件不会像真实事件一样有捕获和冒泡流程，所以此时只能简单的触发对应的 `callback` 达到测试目的。

```javascript
it ('will call onClick prop when click event fired', () => {
    const fn = jest.fn();

    wrapper.setProps({ onClick: fn });
    wrapper.update();

    // 这里触发了两次点击事件，但是 onClick 只会被调用一次。
    wrapper.find('div.container').simulate('click');
    wrapper.find('div.wrapper').simulate('click');
    expect(fn).toHaveBeenCalledTimes(1);
})
```

关于这些网上有人总结了 `shallow` 模式下的一些不足

1. `shallow` 渲染不会进行事件冒泡，而 `mount` 会。
2. `shallow` 渲染因为不会创建真实 `DOM`，所以组件中使用 `refs` 的地方都无法正常获取，如果确实需要使用 `refs` , 则必须使用 `mount`。
3. `simulate`  在 `mount` 中会更加有用，因为它会进行事件冒泡。

其实上面几点说明了一个现象是 `shallow` 往往只适合一种理想的场景，一些依赖浏览器行为表现的操作 `shallow` 无法满足，这些和真实环境相关的就只能使用`mount`了。

#### Mount 渲染

`Mount` 渲染的对象结构为 `ReactWrapper` 其提供了和 `ShallowWrapper` 几乎一样的 `API` , 差异很小。

在 `API`层面的一些差异如下

```diff
+ getDOMNode()        获取DOM节点
+ detach()            卸载React组件，相当于 unmountComponentAtNode
+ mount()             挂载组件，unmount之后通过这个方法重新挂载
+ ref(refName)        获取 class component 的 instance.refs 上的属性
+ setProps(nextProps, callback)
- setProps(nextProps)
- shallow()
- dive()
- getElement()
- getElements()
```

另外由于 `mount` 使用 `ReactDOM` 进行渲染，所以其更加接近真实场景，在这种模式下我们能观察到整个 `DOM` 结构和React组件节点结构。

![mount](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7688022285/ad17/32c1/17d0/97eff4bf93e02f26b71747e844d04982.png)

```javascript
describe('Mount Avatar', () => {
    let wrapper = null, avatarUrl = '123';

    beforeEach(() => {
        wrapper = mount(<Avatar user={{ avatarUrl }} />);
    })

    afterEach(() => {
        jest.clearAllMocks();
    })

    it ('should set img src with avatarurl', () => {
        expect(wrapper.find('Image')).toExist();
        expect(wrapper.find('Image')).toHaveProp('src', avatarUrl);
        expect(wrapper.find('img')).toHaveProp('src', avatarUrl);
    })
})
```

在 `shallow` 中无法模拟的事件触发问题在 `mount` 下就不再是问题。

```javascript
it ('will call onClick prop when click event fired', () => {
    const fn = jest.fn();

    wrapper.setProps({ onClick: fn });
    wrapper.update();

    wrapper.find('div.container').simulate('click');
    wrapper.find('div.wrapper').simulate('click');
    expect(fn).toHaveBeenCalledTimes(2);
})
```

总结一下 `shallow` 中能做的 `mount` 都能做，`mount`中能做的 `shallow `不一定能做。

#### Render 渲染

`render` 内部使用 `react-dom-server` 渲染成字符串，再经过 `Cherrio` 转换成内存中的结构，返回 `CheerioWrapper` 实例，能够完整地渲染整个`DOM` 树，但是会将内部实例的状态丢失，所以也称为 `Static Rendering` 。这种渲染能够进行的操作比较少，这里也不作具体介绍，可以参考 [官方文档](https://enzymejs.github.io/enzyme/docs/api/render.html) 。



### 总结

如果让我推荐的话，对于真实浏览器我会推荐 `Karma` + `Jasmine` 方案测试，对于 `React` 测试 `Jest` + `Enzyme` 在 `JSDOM` 环境下已经能覆盖大部分场景。另外测试 `React`组件除了 `Enzyme` 提供的操作， `Jest` 中还有很多其他有用的特性，比如可以 `mock` 一个 `npm` 组件的实现，调整 `setTimeout` 时钟等，真正进行单元测试时，这些工具也是必不可少的，整个单元测试技术体系包含了很多东西，本文无法面面俱到，只介绍了一些距离我们最近的相关的技术体系。

参考

1. https://medium.com/building-ibotta/understanding-chai-js-language-mechanics-cc28e4c9604b
2. https://medium.com/@turhan.oz/typescript-with-jasmine-easy-project-setup-530c7cc764e8
3. https://www.liuyiqi.cn/2015/10/12/karma-start/
4. https://jestjs.io/docs/en
5. https://blog.bitsrc.io/how-to-test-react-components-with-jest-and-enzyme-in-depth-145fcd06b90
6. https://www.freecodecamp.org/news/testing-react-hooks/
7. https://www.reddit.com/r/reactjs/comments/ajw2uv/jestenzyme_simulate_event_bubbling_onclick/

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
