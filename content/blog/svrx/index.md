---
title: Server-X：一款可能提升你十倍工作效率的工具
date: "2019-10-21T04:05:39.869Z"
description: "本文将介绍一款全新的前端开发工具，希望它能给你的前端开发带来看起来和现在一样但其实又不那么一样的体验。"
---

[![](https://svrx.io/assets/images/banner.png)](https://svrx.io/)

> 本文将介绍一款全新的前端开发工具，希望它能给你的前端开发带来看起来和现在一样但其实又不那么一样的体验。

你可能会说，大家都是 ~~秃头的~~ 成熟的前端程序员了，每一台电脑上都有几套自己辛辛苦苦装好的全家桶，为什么还要新换一个开发工具？

对，盲生，你可能发现了华点。

数一数你电脑上目前为前端本地开发安装了多少小工具、小插件？
这其中仅仅是为代码开发阶段，就可能有本地服务器、远程调试工具、代理工具、浏览器插件等等。
它们也许是你一个个尝试无数同款后最终确定安装的，
也可能是被各类『震惊！超好用前端开发工具大全』安利的，
并且其中不乏全局安装、全局配置的「重器」。

![震惊！超好用前端开发工具大全](https://p1.music.126.net/aBz8E_J0WPTo-FSmtm_hlA==/109951164418246375.png)

试想现在你要换一台新电脑或者重装新系统了，你还得一个个把它们重新安装回来。
况且大部分这样的工具是无法根据工程进行独立配置的，
也就是说你在不同项目之间切换时还需要手动修改你的开发工具配置。
这些都是一些强迫症患者如作者本人无法忍受的。

总结一下平时搞开发的时候一些习以为常但仔细一想又挺麻烦的场景：

- 你必须手动安装各类工具软件以丰富你的本地开发环境
- 这样的本地开发环境无法拷贝或者很难拷贝，无法分享
- 每种工具都要单独配置，且配置基本不是按照项目隔离的，切换项目时经常需要修改配置
- 有时候你的需求并没有合适的工具来满足，自己写一个又太麻烦
- 写一个项目要同时打开 N 种 工具：本地服务器、mock 服务器等
- 经常还需要不断重启这些工具以刷新配置
- ……

基于以上以及一些其它痛点，便有了下文将介绍的 server-x。

## 什么是 server-x

如同它名字的前半部分，`server`，你可以简单地说，server-x（缩写为 svrx）就是一个本地服务器，
并且它还是一个功能丰富、使用便捷的轻量级服务器。

先来看下最简单的使用场景：

首先你需要安装 svrx 的 CLI 工具，

```bash
npm install -g @svrx/cli
```

然后新建一个简单的页面，在项目根目录启动 svrx，

```bash
mkdir example && cd example
echo '<html><body>Hello svrx!</body></html>' > index.html
svrx
```

访问 http://localhost:8000 即可看到你的前端页面。

![启动demo](https://p1.music.126.net/Pq_Ck_EyFtW8lXfgTN09Mg==/109951164417568606.png)

安装便捷，启动迅速，独立使用，除了 node ，**不依赖任何别的环境**。
当然，这是任何一个独立的、基础的 dev server 都能做到的最必不可少的功能。

除此之外还有什么？svrx 还自带了诸如自动打开浏览器、监听代码变动自动刷新（livereload）、proxy 等实用性非常强的功能。
是的，你也可以说，部分 dev server 也是能做到的。

svrx 和其它本地服务器最大的区别，其实是它名字 `server-x` 的后半部分：`x`。
我们都知道，`x` 可以代表「未知和无限」，即 svrx 是一个有着无限可能的服务器。
为什么说它有无限的可能？因为 svrx 最大的特点：它是一个插件平台。

通过插件，理论上你的 svrx 确实可以拥有任意的功能。
每一个小功能在这里就是一个独立的插件，你只需要声明就能使用它，就像这样：

```bash
svrx --webpack --qrcode --markdown
```

很清晰直观，没有冗余的配置，在你声明插件以后，svrx 会自动帮你下载安装插件，然后直接启动。

所以你可以说，svrx 是一个聚合了众多功能插件的平台，它本身就是一个全家桶。
不过不同的是，你丝毫**不需要关心插件的安装过程**。除了 svrx 的 CLI，你**无需安装其它任何工具**。

另外，所有插件都不是全局安装，而是直接安装到你工程的`node_modules`目录中。
所以**工程开发是真正独立隔离的**，
你可以自由给每一个项目定制一套开发环境，不用考虑安装卸载，完全不担心环境污染问题，同时系统也可以保持干净清爽。

事实上，业内目前可用的本地 dev server 有很多，
但像 svrx 这样，轻量易用的、具有完备插件机制的、完全不依赖工程环境的，几乎是没有的。 
接下来，我们通过创建一个简单的前端工程，继续探索一下使用 svrx 进行开发的全新体验，
带你深入了解一些进阶用法和黑科技，这些才是 svrx 真正有趣的地方。

## 创建工程及启动

方便起见，我们选用前端常用的 [Create React App](https://github.com/facebook/create-react-app) 进行示例工程创建
（前面提到，svrx 不依赖任何工程环境，选取 CRA 仅仅为了示例方便）。

```bash
npm init react-app svrx-example
cd svrx-example
```

由于新工程默认使用 `webpack` 打包，想要启动这样的工程，
我们需要使用插件 [svrx-plugin-webpack](https://github.com/svrxjs/svrx-plugin-webpack)。
这个插件的作用就是读取项目配置，
调用 [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware)，
使你的 `webpack` 项目可以无缝接入到 svrx 服务中。

不过由于新工程并没有暴露出 `webpack` 配置项，所以我们需要先在根目录创建一个 `webpack.config.js`：

```js
// webpack.config.js
module.exports = require('react-scripts/config/webpack.config')('development');
```

然后我们就可以顺利启动项目了：

```bash
svrx --webpack
```

浏览器会自动弹出 http://localhost:8000/ 页面：

![start svrx](https://p1.music.126.net/ObArEQVEbjajRBkeOaJldQ==/109951164429015297.png)

这时可以尝试编辑下 `src/App.css`，看看页面是不是实时变化了？

![livereload](https://p1.music.126.net/yIQ1lg2pOhA1ETmGKvQvIQ==/109951164430535611.gif)

## 进阶 1：添加配置项

默认地，svrx 会在启动时自动开启一些内置的基础插件，
如静态伺服（serve）、转发服务（proxy）、页面自动刷新（livereload）等。
它们都有一些默认行为以保证用户可以快速启动 svrx，
当然，如果你需要对这些内置配置项做一些自定义修改，svrx 也提供了两种方式。

你可以在命令行启动 svrx 时传入参数进行配置：

```bash
svrx --port 3000 --https --no-livereload
```

也可以在你的工程目录下建立`.svrxrc.js`或`svrx.config.js`文件，将上面的命令行参数持久化下来：

```js
// .svrxrc.js
module.exports = {
  port: 3000,
  https: true,
  livereload: false
};
```

svrx 的全部配置项及描述可以在[官方文档-内置项](https://docs.svrx.io/zh/guide/option.html)中查看。

## 进阶 2：开始尝试使用其它插件

除了内置插件以外，svrx 还有很多独立插件，比如前面提到的 `svrx-plugin-webpack`。
在你需要别的开发功能（如远程调试、mock 等）时，只需要简单地在 svrx 配置中声明这些独立功能插件的名字即可正常使用。
正是这些独立插件，为 svrx 项目提供了丰富多彩的功能体验。下面先介绍几个好用的好玩的插件：

### [localtunnel](https://github.com/svrxjs/svrx-plugin-localtunnel) - 把本地服务暴露出去 

试想你正紧张有序地在进行页面开发，这个时候你领导的消息弹了出来： 

> 让我看看你的页面写得怎么样了

这个时候你怎么办？你是不是得先检查进度，把能用的代码先提交，然后你灵机一动，部署了一个本地服务，准备甩给你领导一串本机 IP。
但是你突然想起来，领导不是在出差吗？（太敬业了，还在时刻检查你的开发进度）领导访问不了内网啊。
这时你只能慌忙找服务器再部署一个测试环境给领导，部署得还贼慢，领导飞机都要起飞了！

这个时候，你就需要 svrx 的 [localtunnel](https://github.com/localtunnel/localtunnel) 插件了！
它可以将你的本地服务暴露到`localtunnel.me`，从而方便地进行本地代码的测试和分享。
你再也无需为了测试你的一点代码变动就专门部署一次测试服务了。

启动 `localtunnel` 只需在之前的启动命令后添加声明即可：

```bash
svrx --webpack --localtunnel
```

上面的命令将会自动安装 localtunnel 插件并启动 svrx，
其他人（是的，你们甚至不需要在同一个内网）此时访问终端打印的 https://*.localtunnel.me 也将看到你的本地服务：

![localtunnel](https://p1.music.126.net/0tnJ_DkmfTEl_jFdRGepbQ==/109951164429088111.png)

并且，你的每次本地页面变动都可以被别人实时看到，再也不用担心领导突然检查作业了！

![localtunnel-livereload](https://p1.music.126.net/Wc2rVrS4qNiUWSl1avHc9Q==/109951164430527349.gif)

### [weinre](https://github.com/svrxjs/svrx-plugin-weinre) - 远程调试移动端代码

现在一般都是如何进行移动端代码调试的？你可能会说，“这题我会！”很简单，先在手机上打开设置里的`开发者模式`（可能要找一下），允许`USB 连接`，再找一根 USB 连接线，把手机和电脑连接起来，然后你打开你电脑上的浏览器开发者工具，开启一些东西，找到远程设备，然后`Inspect`……

万一有更简便的方法呢？你可以试试 svrx 的 [weinre](http://people.apache.org/~pmuellr/weinre/docs/latest/Home.html) 插件，它用于方便地远程调试移动端的页面，而且是“无线”的。

我们再次回到刚才的 example 工程，这次我们在启动命令后面添加两个新的插件：

```bash
svrx --open=external --webpack --weinre --qrcode 
```

首先通过上面的命令快速安装 weinre 和二维码插件并启动 svrx，
此时试着拿手机访问启动好的项目页面，这里推荐配合 `qrcode` 二维码插件让手机轻松扫码访问页面地址:

![qrcode](https://p1.music.126.net/xIVX3rkv1dsvrUOlFRXldQ==/109951164430529750.gif)

紧接着电脑打开 weinre 的调试器页面 http://${your_ip}:8001（默认），
找到手机的访问记录，就可以在调试器上对手机页面进行远程调试了。

![weinre 调试器截图](https://p1.music.126.net/KaBNi-_EDelz8kE75i5gSg==/109951164429434114.png)

### 定制你的插件

除了上述的，svrx 还有很多有趣好用的插件，你可以在[svrx 的官网](https://svrx.io/plugin?query=svrx-plugin-) 查询目前所有的插件，并从中挑选使用。
通过不同插件的组合，你就可以自由定制你的开发环境啦！

![部分插件列表](https://p1.music.126.net/IZDarDVC9sHj69lxWuhljg==/109951164417587560.png)

当然，如果没找到你想要的功能插件，你还可以尝试自己写一个。

你可以用插件实现哪些功能呢？
拿前面的 `qrcode` 二维码插件来说，为了把二维码显示到页面上，你可以往前端页面注入一些 js 脚本，css 样式；
也可以像 `webpack` 插件那样，往后端逻辑中注入一些 koa 风格的中间件，拦截请求做数据处理，比如这里的 `webpack-dev-middleware`。

有了强大的前后端注入能力，几乎所有的本地开发需求，都可以通过创建一个 svrx 插件来解决。
而且**插件的开发异常简单**！刚刚介绍的一些插件的核心代码几乎都只有 50 行左右！
此外，svrx 还提供了快速创建插件的脚手架工具，可以去[官方文档-如何写一个插件](https://docs.svrx.io/zh/plugin/contribution.html)查看更多插件开发的细节，在这里就不赘述了。

## 进阶 3：可以热更新的快捷路由

在前后端分离的开发场景中，前端经常会碰到需要进行数据 mock 的情况。于是你可能会经历：

- 修改 mock 数据，重启 mock 服务器
- 打开、关闭接口转发，重启
- 修改工程代码，重启
- ……

就算你说现在的 mock 服务都很智能，不需要重启了，但是你还是需要在本地服务外手动再开启一个 mock 服务，要么就是狠一点，把 mock 数据写到工程代码里。太不优雅了！

于是 svrx 的动态路由就派上用场了。是的，除了丰富的插件体系，svrx 其实还有一个功能强大、使用便捷的动态路由功能。
还是回到我们的 example 工程，你可以通过以下命令开启快速尝试：

```bash
touch route.js # create empty routing file
svrx --webpack --route route.js
```

在`route.js`中：

```js
get('/blog').to.json({ title: 'svrx' });
```

此时打开`/blog`，你将看到`{ title: 'svrx' }`的 json 输出。

有了这个路由功能，你将可以在不侵入项目代码的前提下**快速直观地创建你的 mock 数据**。
并且它是支持 **hot reload** 的，即每次编辑 `route.js` 后，无需重启 svrx 服务，路由数据会自动更新。

![动态路由示例](https://p1.music.126.net/SJNCky1nh6RF_RIi2_kkLw==/109951164418247220.gif)

当然，除了用于本地开发数据 mock 外，svrx 路由还可以做很多。下面是一些路由示例：

```js
get('/index.html').to.sendFile('./index.html');
get('/blog').to.redirect('/user');
get('/old/rewrite:path(.*)').to.rewrite('/svrx/{path}');
get('/api(.*)').to.proxy('http://mock.server.com/');
get('/blog')
  .to.header({ 'X-Engine': 'svrx' })
  .json({ code: 200 });
```

如你所见，svrx 的路由语法非常简单，你可以清晰直观地阅读出每一条规则，比如发送文件、重定向、路由重写、proxy 等等。并且除了官方提供的一些路由操作外，你也可以通过插件来对路由操作进行扩展。关于 svrx 路由的语法规则、扩展等详情可以参阅[官方文档-路由的使用](https://docs.svrx.io/zh/guide/route.html)。

## 写在最后

> 一个渐进且易于使用的、插件化的前端开发平台。

这是 svrx 的 slogan，同时也非常准确地描述了 svrx 的定位：

- svrx 是面向前端开发者的一个强大的本地 dev server，它由本地服务、proxy、livereload 等功能插件组成
- svrx 有着丰富强大的插件系统，你可以自由使用或者定制想要的功能

在致力于为前端开发者提供更为优雅便捷的本地开发体验的同时，svrx 也为大家提供了一个可以快速进行自定义功能开发的平台。
作为用户，你可以挑选合适的插件组合来满足你的本地服务需求，一键启动，省时省力，易拔插的功能设计，也不用担心环境污染。
如果没有找到合适的插件，你可以变身开发者，自给自足，快速实现想要的功能。作为开发者，你还可以大开脑洞，通过你写的插件提升更多人的本地开发体验。

之后，svrx 也将继续推出更多优质功能或插件，持续为前端开发服务。

## Links

- [svrx 官网](https://svrx.io/) 官方使用文档、API、插件查询
- [Github - svrx](https://github.com/svrxjs/svrx) 核心源码、讨论交流、bug report

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
