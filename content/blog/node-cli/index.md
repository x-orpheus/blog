---
title: Node CLI 工具的插件方案探索
date: "2020-04-28T01:05:16.039Z"
description: "CLI 工具作为开发者们亲密无间的好伙伴，996 风雨无阻地陪伴着我们进行日常的开发工作。身为前端开发，你一定也亲自开发过一套属于你自己的 CLI 小工具！"
---

![banner](https://p1.music.126.net/lXoJC7CSdxC0nzhOPxn93g==/109951164693223169.jpg)

> 本文作者：[徐超颖](https://github.com/xuchaoying)

CLI 工具作为开发者们亲密无间的好伙伴，996 风雨无阻地陪伴着我们进行日常的开发工作。身为前端开发，你一定也亲自开发过一套属于你自己的 CLI 小工具！如果没有，本文也不会教~ 在接下来的五分钟里，我们来聊聊 Node CLI 工具的进阶设计，探索一下在 CLI 端需求复杂化的场景下，如何利用**插件机制**来为这类小工具带来更灵活、丰富的功能体验。

## 插件化带来的好处

截至目前，我们已经接触过大量的插件化平台了，比如 koa、egg、webpack 等等，为什么这些框架或者工具都不约而同地选择实现一套插件机制？

首先，如果没有插件，我们把所有的大小功能全部集中写在一起，这会导致项目的体量过于庞大，代码结构会异常冗长复杂，显然不会是一个健康的项目应有的姿态。而使用插件机制，对旁系功能做剪枝操作，仅保留核心功能，甚至连核心功能也插件化，在大大简化项目的同时，还主要给项目带来了以下特性：

- **灵活性**，由于插件本身和核心代码之间是相互独立的，因此插件可以自由更新变动，而不会影响到核心代码及其它插件功能，从某种程度上是提升了核心代码的稳定性
- **功能定制化**， 用户可以自由组合插件功能，无需安装冗余功能
- **可扩展性**，这也是插件机制最大的特征之一，不管是项目维护者还是社区都可以轻松贡献插件，以满足核心功能外的不同需求

可以说，如果你的项目功能结构复杂，或者未来有不断迭代需求的计划，都可以考虑使用插件机制来简化开发、使用成本。

## 先定一个小目标

说回到我们的 Node CLI 小工具，一般来讲，CLI 小工具都是轻量易用的，比如我们可能经常使用的一些脚手架提供的工具命令：

```bash
MyTool new aaa
MyTool delete bbb
```

而且通常它们安装起来也很容易：

```bash
npm install -g MyTool
```

但是，一旦我们有了新的功能需求，比如添加一个命令、添加一个参数，就不得不发布更新包，想办法提示用户去更新我们的工具，这是非常不方便、不及时的。结合标题我们知道，可以利用插件机制来化解需求迭代这个问题。

那么先来定一个小目标，一个插件化的 CLI 工具理想情况下应该具备什么特征呢？ 

首先，插件最好是**声明即使用，完全不用安装**的，比如：

```bash
MyTool start --featureA --featureB # 我们假设featureA、featureB是两个独立的插件
```

像这样，在使用插件的过程中，并不要求用户去下载任何插件，用户声明插件即可使用。当然，这和一般的插件平台使用插件的方式是不同的，比如我们使用 webpack 的插件时，需要先修改 `package.json` 文件，把这些插件下载到本地工程的`node_modules` 中，再去配置文件里声明这些插件，就像这样：

![webpack 插件](https://p1.music.126.net/GEiNu84BbGuKZigH3Si0Pw==/109951164638588357.png)

webpack 这样的插件使用方式确实有点繁琐，所以在我们的插件方案里，首先要做的就是免去插件的安装过程。  

插件既然不用安装，也就更不提更新或者卸载了。总的来说，要做到插件化，我们需要给我们的 CLI 工具**内置一整套插件包管理逻辑**。让用户可以不再关心任何插件包相关的操作，不需要下载安装，不需要更新插件，更不需要卸载插件，一切的一切，都交给小工具来处理。

那么要实现这样的一套插件包管理逻辑，我们需要考虑的因素和方案有哪些呢？下面我们就具体来探索下免安装插件包管理机制。

##  插件的注册

考虑到 Node CLI 工具插件的使用场景，以及插件功能的独立性，我们很容易想到利用 [npm](https://www.npmjs.com/) 来注册发布我们的插件：每个插件都是一个单独的 npm 包，只要插件包的名字具有一定的特征，我们就可以轻松根据插件名字查找到对应的包。比如这样的插件名字与包名的对应关系：

插件名 | 包名
--- | ---
`@{pluginName}` | myTool-plugin-`@{pluginName}`
@`${scopeName}`/`${pluginName}` | @`${scopeName}`/myTool-plugin-`@{pluginName}`

另外，我们也需要考虑到一些特殊的包，比如 `scoped` 包，这个也是如上面表格所示在名字上做好特征区分。

还有一种是发布在私有 npm 上的插件包，这就需要我们的插件平台本身添加 `registry` 参数来做区分了，当然，使用私有插件也会比普通插件多一个参数，比如：

```bash
MyTool --registry=http://my.npm.com --my-plugin # 使用一个名为 my-plugin 的私有插件
```

## 包下载

由于我们的插件都是一个个 npm 包，所以我们只需要考虑如何下载一个 npm 包。最初我们的想法可能是以库的形式引入 `npm` ，然后安装插件包：

```js
const npm = require('npm');
npm.install();
```

但是这样有个很大的性能问题，`npm` 包的大小有约 25 M，这对于一个命令行工具来说很不 OK。

于是我们想，既然要做的是一个 Node CLI 工具，那么用户的本地肯定有 Node 环境啊，我们能不能利用本地的 `npm` 来下载插件包呢？答案是肯定的：

```js
const npm = require('global-npm');
npm.install();
```

这里我们可以使用 [global-npm](https://www.npmjs.com/package/global-npm) 或者其它类似的包，他们的作用是**根据环境变量信息找到并加载本地的 `npm`**。这样，我们的核心包大小就得到了完美的“大瘦身”。

## 存储

插件包下载后，存储位置也是一个问题。默认地，`npm` 会把下载的包存放在当前目录的 `node_modules` 中。在一般脚手架工具的使用场景里， 包管理器默认会把插件包文件存放在用户工程项目的 `node_modules`，这样的好处就是插件包做到了工程粒度的隔离。但是，由于插件包是由我们全局的 CLI 工具下载的，而且肯定，我们不应该把插件作为一个 `devDependency` 添加进用户工程目录下的 `package.json` 文件，这会修改用户的文件，不符合我们的预期。由此就产生了一个矛盾，即 `node_modules` 中存在插件包，但是 `package.json` 中又没有声明插件包。

这么乍一看其实是没有问题的，如果用户安装了所有工程依赖和我们的插件，是可以正常启动 我们的工具并运行的。但是这里有一个 npm 冷知识：对于在 `node_modules` 中存在，但又没有在 `package.json` 中声明的依赖，npm 在执行 `install` 命令时，会对它们进行剪枝（prune）操作。这是 npm 的一种优化，即如果某些依赖没有被事先声明，那它们就会在下一次 `install` 操作中被移除。

![npm remove packages](https://p1.music.126.net/cgZpeXB_KXte_oWx3cxu4w==/109951164628574489.png)

所以，一旦用户在某个时候又运行了一次 `npm install xxx`， 比如新增一个工程依赖，或者新增一个我们的插件（前面讲过插件其实也是用 `npm install` 来安装的），就会有之前某些已安装插件的依赖被 npm 移除！这就导致我们在下一次运行  CLI 工具和某个插件时会收到依赖丢失的报错。

正是因为 npm 的这个特性，我们必须得放弃将插件包存储在用户工程 `node_modules` 目录中的方案，转而**全局存储插件包**，将某个全局目录比如 `~/.mytool/plugins` 作为插件包的存放地址，里面的插件包将按照 `${插件名}/${version}` 的路径存放，如：

```bash
# ~/.mytool/plugins
├── pluginA
│   └── 1.0.1
├── pluginB
│   └── 1.0.0
└── pluginC
    ├── 1.0.1
    └── 1.0.2
```

如此我们的插件包便逃过了 npm 的“误伤”，不过，因为存储位置的改变，插件包的加载逻辑也要做相应的调整。

## 加载

考虑到版本、存储位置等问题，插件的加载其实是有点复杂的。以下是一个本地开发服务器的插件加载流程，我们可以用这个简化版的流程图来帮助理解：

![简化流程图](https://p1.music.126.net/KovN-m9rdz2w63LPP3oqdg==/109951164631391726.png)

首先，如果我们有一个参数 `path`，用来指定某个插件包加载的路径，显然，用户就是上帝，永远优先级最高（手动狗头），所以我们先对 `path` 参数进行了判断。如果存在该参数，我们直接从这个路径加载插件包。

然后，如果我们的工作区划分是以工程为粒度的，那么我们也应尊重工程本地的插件依赖包：如果 `node_modules` 中存在该插件包（主要是用户手动安装的情况），那我们就直接加载这个工程中的插件包。

最后，上一节我们提到，插件包是被全部托管在一个全局文件夹中的，可以说 99% 的情况下，我们的插件都是从这个文件夹加载的。内部逻辑简单来说就是：查询文件夹中是否存在该插件，**有则加载，无则下载**最佳（一般是最新）的一个插件版本。不过这里其实还有个细节要考虑，那就是用户如果指定了插件的版本号，我们还需要判断全局文件夹中是否存在相应版本的插件，如果没有，我们需要下载该版本。

以上其实是插件加载的一个简化版流程，复杂的部分——如果你同时也在思考的话，可能隐隐约约也会觉察——比方说在文件夹中查询插件时，真的只是简单判断文件存在与否吗？默认总是加载最新版本的插件吗？这些问题，我们将拆成后续几个小节慢慢说。

## 插件包与核心包的版本匹配问题

每个插件平台一定比较头疼的一个问题，就是用户所用的核心包（一般来讲就是插件平台本身）与插件包的版本匹配问题。有时候核心包有大更新（BREAKING CHANGE）时，旧的插件包的版本不一定能匹配上，反之亦然。于是我们肯定希望，在出现版本不匹配问题时，能对用户作出提示，并且，像我们正在讨论的这种插件免安装管理模式，应该能自动根据核心包版本匹配并安装相应的插件，理论上用户根本不会感知核心包或者插件包有版本这一概念。

要做到自动匹配核心包和插件包，首先我们需要想办法将它们的版本关联起来。你可以采用插件开发者声明的方法，比如，插件开发者可以在插件 `package.json` 中的 `engines` 字段下声明插件正常运行所需的核心包环境，如：

```json
{ "engines" : { "svrx" : "^1.0.0" } }
```

这表示该插件只能在 `^1.0.0` 区间的 `svrx` 版本上运行。（`svrx` 是某个 CLI 工具的名字）

由于 `package.json` 中的字段可以在下载这个包之前直接由 `npm view` 命令读取，

![npm view engines](https://p1.music.126.net/maga5UyX16fGlRIAQTX_1A==/109951164635357391.png)

我们就可以结合当前用户使用的 `svrx` 核心包版本轻松判断出最佳匹配的插件版本，再对该版本进行下载。版本匹配这里我们可以选择 [semver](https://www.npmjs.com/package/semver) 来做判断：

```js
semver.satisfies('1.2.3',  '1.x || >=2.5.0 || 5.0.0 - 7.2.3')  // true
```

所以，在上一节讲述的插件加载流程里，当用户没有指定具体版本时，我们加载的目标插件包并不一定是该插件的最新（latest）版本，而是**根据 `engines` 字段做了 semver 检查后最匹配的一个版本**。

## 自动更新

好了，我们再回到之前提出的问题，插件包更新了怎么办？实际上，这是任何插件机制都会遇到的问题。一般的解决方案是，比如 webpack 的插件，我们安装插件时会把版本信息写到 `package.json` 中，如 `html-webpack-plugin@^3.0.0`，这样，当 `v3.1.0` 发布后，我们“下次重新安装”这个插件包时，可以自动更新成最新的版本。但是请注意，“下次重新安装”指的是我们移除本地依赖后重新安装这个 npm 包，然而实际使用过程中，我们并不会频繁去更新这些工程中的依赖，所以绝大多数情况下，我们没有办法及时享受到最新版本的插件。这是用户自行安装插件都会面临的问题。

那如果是插件免安装机制呢？我们是不是可以每次加载都默认加载最新版本？当然可以，因为加载的具体版本可以由内部的加载机制决定。但是，这样做有一个弊端：如果每次加载插件都去判断（npm view）一次该插件是否有最新版，有最新版还要下载（npm install）新的版本包，太浪费时间了！等所有插件都加载好，服务启动，黄花菜都凉了！

怎么才能做到自动更新插件的同时，又不拖慢加载速度呢？我们可以采用一个折中的方案，即在每次服务启动后，才对所有使用中的插件做版本更新检查、新版本下载，并且这一切都**在子进程中进行**，绝不会阻塞服务正常运行。这样，下一次启动 Server-X 时，这些插件就都是最新版本了。

不过这样的方案仍然有一些细节需要注意，比如，包下载出错怎么办？在下载过程中用户突然中断程序怎么办？这些特殊情况都会造成下载的插件包文件不完整、不可用。对此我们可以尝试**使用临时文件夹作为插件包下载的暂存区**，等确认插件包下载成功后再将临时文件夹内的文件移动到目标文件夹（`~/.myTool/plugins`）中，就像这样：

```js
const tmp = require('tmp');
const tmpPath = tmp.dirSync().name;   // 生成一个随机临时文件夹目录
const result = await npm.install({
    name: packageName,
	path: tmpPath,  // npm 下载到临时文件夹 
	global: true,
	// ...
});  
const tmpFolder = libPath.join(tmpPath, 'node_modules', packageName);  
const destFolder = libPath.join(root, result.version);  
  
// 复制到目标文件夹  
fs.copySync(tmpFolder, destFolder, {  
  dereference: true, // ensure linked folder is copied too  
});
```

所以如果插件下载失败，我们的目标文件夹中就不会存在这个插件包，于是下一次启动时我们会尝试重新下载该插件。下载失败的部分插件包呢，由于是在临时文件夹中，会定期被我们的系统清理，也不用担心垃圾残余，超级环保！

## 过期包清理

其实，我们真正需要关心的残余文件，是那些已经存在于插件文件夹中的、过期的插件包。因为自动更新机制的存在，我们会在每次插件更新后下载新的版本存放到插件文件夹中，下一次也是直接启动新的插件版本，这样一来老版本的插件包就没用了，如果不能及时清理，可能会占用用户的存储空间。

具体的清理逻辑也很简单，就是在做自动更新这一步的同时，**找出插件存储目录中版本不是最新且不是当前用户指定的版本**，然后批量删除文件夹。此外，考虑到工程师洁癖，个人觉得 CLI 工具本身也应该要有**自清理**逻辑，如果用户卸载了工具，那么工具应该自动清除所有存储在本地的配置、核心包和插件包，做到零污染。

## 总结

以上呢，就是我们对于 Node CLI 工具插件包管理的一些方案探索和设计细节讨论了。如果你只看标题和粗体加黑文字的话，那么你就会发现其实不看其它文字好像也还OK？（嘿嘿嘿～） 

本文核心内容及素材均来源于网易云音乐前端组出品的一款插件化的本地开发服务器—— [Server-X](https://docs.svrx.io/zh/)及其插件机制的设计开发过程，为了通用化，文中刻意隐去了对 `Server-X` 的描述，如果你仍然感兴趣，或者想了解具体的插件机制代码，可以打开下方的链接进行进一步阅读。

总的来说，从插件包的下载、存储、加载，到版本管理，其实都存在了一些开发前我们可能没考虑周全的问题，如果你正好也打算做一个插件平台，或是遇到了类似的场景，希望 Server-X 的这套免安装插件包管理机制能对你有所帮助。

## Links

> 可以 star 支持一下嘛

- [Server-X 包管理  GitHub 主要源码](https://github.com/svrxjs/svrx/blob/master/packages/svrx-util/lib/package-manager/package-manager.js)
- [Server-X 项目主页](https://svrx.io/)

*小注：文章开头的 996 系形容词，与网易云音乐前端开发组无关！*

![](https://p1.music.126.net/YPUNLNecp5mwgcUjCIv-sA==/109951164881217006.gif)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，可自由转载，转载请在标题标明转载并在显著位置保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！