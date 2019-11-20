---
title: 使用 svrx 实现更优雅的接口 Mock
date: "2019-11-20T06:01:38.126Z"
description: "目前 Web 开发普遍都切换到了前后端分离的开发模式。虽然在工程和职能上已经分离了，但在实际工作中，前后端在开发进度上往往会出现不一致的情况，此时就会极大地影响开发效率。
接口 mock 在此时就发挥出了巨大价值，它磨平了这个时间差，最终实现高效的前后端分离开发。"
---

![](https://p1.music.126.net/K6JCLahP2dWrQSHM66xbyg==/109951164497762461.png)

## 导言

目前 Web 开发普遍都切换到了前后端分离的开发模式。虽然在工程和职能上已经分离了，但在实际工作中，前后端在开发进度上往往会出现不一致的情况，此时就会极大地影响开发效率。
**接口 mock** 在此时就发挥出了巨大价值，它磨平了这个时间差，最终实现高效的前后端分离开发。

具体到接口 mock 方案就多种多样了，但大体不外乎 「硬编码」 、 「前端拦截」和「后端拦截」这三种。
本文会尝试简单分析这三种常见方案的优劣，然后引出主要议题：基于 **[svrx](https://docs.svrx.io/zh/)** 的接口 mock 方案。

## 硬编码方案

硬编码即在前端代码中直接写入 mock 数据，比如：

```js
function getUser(id) {
  return { username: 'mock username', id: 100 }; //接口mock
  return ajax('/user', { id });
}
```

提交时移除或注释掉即可：

```js
function getUser(id) {
  // return {username: 'mock username', id: 100}
  return ajax(`/user/${id}`);
}
```

后端硬编码的 mock 方式亦是如此，不过它的侵入性保留在了后端逻辑中，前端的业务代码可以保持干净：

```js
router.get('/user/:id', async ctx => {
  ctx.body = { username: 'mock username', id: 100 };
  // ctx.body = await userService.get(ctx.params.id);
});
```

_注：上述范例基于 Koa 框架_

**硬编码的优点**

- 简单灵活，不需要任何工具和框架支持，就地使用。
- 如果是前端硬编码，支持修改生效，不需要重启 server。

**硬编码缺点**

- 接口 mock 和业务代码耦合，**挖坑一时爽，填坑火葬场**。

这种骚操作估计很多人年轻时都干过，提交时忘记删除导致夹带私货上线的车祸现场历历在目。
无论是否用一些专业的 mock 框架（比如 [mock.js](http://mockjs.com) ），这种在业务逻辑中耦合的方式显然是下下策，线上事故通报中可能往往因此就有了你的名字。

稍严谨的同学可能会配合构建工具(如 webpack )来实现本地 mock 代码和业务代码的隔离，但并未在本质上解决这种耦合关系，随着项目的迭代，项目同样也会变得难以维护。

更好的做法其实是将 mock 逻辑与业务逻辑完全解耦，并放到**独立的切面中管理**， 这样就可以避免将非业务代码提交到仓库。

这种切面分为前端拦截和后端拦截两种方式，如下图所示，数据响应直接在对应的切面中被拦截返回：

![](https://p1.music.126.net/Vvs-10wmVeYl0FVKqKInaw==/109951164481882357.png)

## 前端拦截

**前端拦截即在请求真正发送前做的拦截返回**，这种切面通常可以通过 「**Webview 容器定制**」 和 「**浏览器插件**」 两种方式来实现。

### Webview 容器定制

Webview 容器定制一般可以通过「网络拦截」和「脚本注入」两种方式，这也是一般混合应用中前端和 Native 交互的主要方式。

**网络拦截**

网络拦截经常会用在类似离线包的功能场景中，配合 mock 管理工具当然也可以用来接口模拟。 参考 Android，一般会使用下面的方法进行拦截来替换响应

```java
public WebResourceResponse shouldInterceptRequest(final WebView view, final String urlstr)
```

_此内容不是本文主要议题，不再深入展开_

**脚本注入**

Android 和 iOS 都有能力向 Webview 直接注入 JS 逻辑，这也是 Hybrid 应用中 Bridge 通信层的实现方式。

如果在注入脚本中通过魔改 fetch 或 XMLHttpRequest 等原生对象，就可以达到对响应的拦截改写。

**iOS 关键 API 举例**

```Objc
[self.webView stringByEvaluatingJavaScriptFromString:injectjs];
```

**Android 关键代码片段**

```Java
webView.loadUrl("javascript:" + injectjs);
```

但无论是网络拦截还是脚本注入，基于 Webview 容器的拦截很少会用在真实场景中，因为定制和使用成本都太高，而且只在本 App 中可以被使用。

### 浏览器插件

相较于定制 Webview 容器，浏览器插件显然是一个成本更低的前端容器劫持方案。
以 [code-mancers/interceptor](https://github.com/code-mancers/interceptor) 这个项目为例：

![](https://p1.music.126.net/bqC3agTPMA-uVJS3_bDsKw==/109951164476414249.png)

通过 Interceptor 插件，可以很容易以 GUI 的方式配置我们的 mock 数据，简单直观，且完全不侵入工程代码。

### 前端拦截分析

前端拦截有个两个天然优势：

- **可提供配置界面**：由于是在浏览器端拦截，可使用 DOM API 提供例如[ Interceptor 插件](https://github.com/code-mancers/interceptor)的可配置界面。
- **就地生效**：修改后无需重启服务。

但无论是浏览器插件还是定制 Webview 容器，实际上我们都忽略了一个重要事实：**浏览器环境其实是多种多样的**。
这导致了前端拦截的一个典型缺陷：**无法跨浏览器使用**，如上例的[Intercepror插件](https://github.com/code-mancers/interceptor)就无法在微信浏览器中使用。

如果是通过服务端拦截的话就可以避免这种情况。

## 服务端拦截方案

服务端拦截实现接口 mock，主要通过一个单独的 dev server 层来实现，它一般在访问真实接口前拦截请求并返回模拟数据。

### 裸奔的 dev server

方便起见，以 [Koa](https://koajs.com) 为例，裸奔一个 dev server：

```js
const proxy = require('koa-proxy');
const Koa = require('koa');

const app = new Koa();
app.use((ctx, next) => {
  switch (ctx.path) {
    case '/api/blog':
      ctx.body = { type: 'blog' };
      break;
    case '/api/user':
      ctx.body = { type: 'user' };
      break;
    default:
      return next();
  }
});
app.use(
  proxy({
    host: 'http://api.yoursite.com'
  })
);

app.listen(8000, () => {
  console.log(`server start at http://localhost:8000`);
});
```

如上例所见, 默认会将接口代理到 `api.yoursite.com`(你的目标 API 或后端基友的服务器)。
mock 数据的优先级大于真实的代理接口，比如我们访问`https://localhost:8000/api/user`，返回的就是我们的 mock 数据，后续如果需要增加 mock 接口，则需要不断添加 case 分支。

这种裸奔的方式很不直观，因为它**将 mock 规则和其他 dev server 的配置逻辑杂糅了**，且对于非 Node 选手有较高的学习成本。

### 专业的 dev server

由于裸奔 server 的明显痛点，一些聚焦于 dev server 领域的解决方案就开始大行其道，比如开发者耳熟能详的 [webpack-dev-server](https://webpack.docschina.org/configuration/dev-server/)。

它集成了一些通用服务配置，例如端口、host、代理等等，并且设计为被集成在 webpack 的构建流程中以实现构建产物的 serve。
这样我们就可以将 mock 逻辑比较独立的嵌入其中，以下述 webpack 配置为例：

```js
module.exports = {
  //...
  devServer: {
    port: 9000,
    headers: {
      'X-Custom-Foo': 'bar'
    },
    proxy: {
      '/api': 'http://localhost:3000'
    },
    before(app) {
      // 配置mock逻辑
      app.get('/api/blog', function(req, res) {
        res.json({ custom: 'response' });
      });
    }
  }
};
```

_(专业的 dev server 用预设的配置代替了手工的代码逻辑，显著提高了开发效率)_

但无论是裸起还是使用专业的 dev server，本质上还是存在以下问题：

- **不支持热重载**: 每次修改 mock 规则，都需要重新启动服务器。
- **不直观**: mock 规则和其他 server 配置杂糅，且对于非 Node 选手有较高的学习成本。
- **无法提供界面支持**，相较于前端拦截, 它无法提供 GUI 的界面配置能力。

## 使用 svrx 实现高效的接口 mock

从以上分析可以得出：前端拦截与后端拦截，都存在一些本质缺陷。
那是否有一种方式是同时拥有前后端接口 mock 的优势呢？答案就是 [**svrx**](https://docs.svrx.io/zh/)。

> _广告高能预警，看到这一步了，相信你已经是 svrx 的潜在客户了_

### svrx 简介

[svrx](https://docs.svrx.io/zh/)(音：Server-X) 是一个微内核架构、插件化的前端开发服务器，内部功能模块主要包含三个部分：

- **前端注入模块**： svrx 劫持所有 html 响应注入种子脚本，此脚本会集成管理所注册的前端资源（JS、CSS）。
- **后端注入模块**： svrx 内置一个带有优先级的中间件注册模块。
- **前后端通信模块**： 实现前端与后端注入的通信方式统一(基于 websocket)，可以以同构的方式完成事件或消息通信。

![](https://p1.music.126.net/TNL6UMLzvBzg7UMqLgIQKQ==/109951164495974023.png?param=720x0)

_如上图所示，通过清晰的模块划分，插件可以以统一的方式来完成插件注册，灵活使用前端和后端注入功能。_

svrx 也抽离了 dev-server 的通用功能，作为内置插件集成(包括 livereload、proxy、https 等等)，其他专有领域的功能(如 markdown、qrcode 等)则以外部插件的方式提供，最大化实现便捷和灵活的平衡。

其中细分到接口 mock 领域，目前也有一系列开箱即用的配套满足开发者的需求。让我们来试一试吧！

**安装**

```js
npm install @svrx/cli -g
```

_注: 后续所有插件能力都不需要再显式安装了_

**使用**

切换到你的工作目录并运行`svrx`，你会发现一个通用的 dev-server 已经运行起来了。

```shell
svrx
```

### svrx Routing DSL 实现接口 mock

具体到接口 mock 的需求，我们可以直接使用内置的[动态路由功能](https://docs.svrx.io/zh/guide/route.html)：

```js
touch route.js
svrx --route route.js
```

![](https://p1.music.126.net/rcXow3maqkkqLudiQd5A4Q==/109951164482113080.png)

以上就是成功启动的界面, 在`route.js`加入以下代码：

```js
get('/api/user/:id').to.json({ name: 'svrx' });
```

浏览器打开`/api/user/1`，可以看到对应的 JSON 响应。所有在`route.js`的改动都是支持 **hot reload** 的，我们无需重启服务器。

> 更多 [svrx Routing DSL 的使用指南请点击这里](https://docs.svrx.io/zh/guide/route.html)

如果你使用 svrx 路由来代替上面的其他 dev-server，除了路由写法更直观高效外，还有一个作用就是可以更细粒度地管理路由的优先级，比如 mock 和 proxy 的优先级：

```js
get('/api/user/:id').to.json({ name: 'svrx' });
post('/api/blog(.*)').to.proxy('http://path.to.api.com');
get('/(.*)').to.send('404 PAGE IS NOT FOUND');
```

_注:路由规则越前置，优先级越高_

### 使用 mock 插件来快速模拟接口

直接裸用 svrx 路由能解决 mock 的功能性问题，但无法解决 mock 的效率问题。

基于此，svrx 官方提供了[svrx-plugin-mock](https://github.com/svrxjs/svrx-plugin-mock)，
它内置了好用的 [mock.js](http://mockjs.com/) ，帮助我们实现快速数据模拟：

```js
svrx --mock --route route.js
```

直接使用 `-p mock` 或简写`--mock` 来激活这个插件。

![](https://p1.music.126.net/IdgskBTS6IA668I3h5yXQg==/109951164485717609.png)

如上图红框所示，svrx 的插件体系有**首次即安装的特性**，被安装插件会自动进入 svrx 全局管理，**后续激活插件无需重复下载**，更重要的是**不会污染你的工作目录**(包括`node_modules`)。

在`route.js`中加入以下代码：

```js
get('/api/user/:id').to.mock({
  name: '@name',
  email: '@email'
});
```

_mock 插件注册了一个名为 mock 的[路由 Action](https://docs.svrx.io/zh/guide/route.html#action-%E6%B8%85%E5%8D%95)，可在 Routing DSL 中被使用_

再次访问`/api/user/1`，你会得到以下满足一定模式的随机响应，比如：

```json
{
  "user": "Linda Thomas",
  "email": "g.ykyiexto@toaloso.cc"
}
```

除此之外，mock 插件也能快速模拟一些列表循环的逻辑, 比如：

```js
get('/api/user/:id').to.mock({
  name: '@name',
  email: '@email',
  'region|1-3': ['@region']
});
```

对应的响应中`region`将会是一个长度是 1 到 3 的地区数组，比如：

```json
{
  "name": "Nancy Allen",
  "email": "aopao@qpo.scm",
  "region": ["西北", "华中"]
}
```

可以看到使用 [mock](https://github.com/svrxjs/svrx-plugin-mock) 插件可以大大提高我们的 mock 效率，并且阅读仍然很直观。

### 使用 json-server 创建基于一定规则的批量接口

svrx 的 mock 插件加上内置的动态路由功能基本上能高效的处理 90% 的本地 mock 需求了。

但如果你的服务是基于 [json-server](https://github.com/typicode/json-server) 规范的，你也可以利用 [svrx-plugin-json-server](https://github.com/svrxjs/svrx-plugin-json-server) 来快速实现海量接口，让我们一起来试下吧。

首先在当前目录创建如下内容的 `db.json` 文件：

```json
{
  "posts": [{ "id": 1, "title": "json-server", "author": "typicode" }],
  "comments": [{ "id": 1, "body": "some comment", "postId": 1 }]
}
```

启动 svrx 并激活 `json-server` 插件：

```js
svrx -p json-server --route route.js
```

与 mock 类似，json-server 插件会注册一个名为 `jsonServer` 的[路由 Action](https://docs.svrx.io/zh/guide/route.html#action-%E6%B8%85%E5%8D%95)。

在`route.js` 加入以下配置：

```js
route('/(.*)').to.jsonServer();
```

以上语句会将所有请求直接代理到内部的 json-server 模块。

访问 `/posts`, 将看到如下响应：

```js
[
  {
    id: 1,
    title: 'json-server',
    author: 'typicode'
  }
];
```

值得一提的是，其实 json-server 内置了全部 crud 操作，以`posts`为例：

```shell
POST /posts        => Create 即创建操作
UPDATE /posts/:id  => UPDATE 即更新操作
GET /posts/:id     => READ 即读操作
GET /posts         => READ LIST 即列表读操作
DELETE /posts/:id  => DELETE 即删除操作
```

举个栗子，当你发起一个**创建**请求(以前端 fetch 为例):

```js
fetch('/posts', {
  method: 'POST',
  body: JSON.stringify({ title: 'svrx', author: 'x-orpheus' }),
  headers: {
    'content-type': 'application/json'
  }
});
```

你再访问 `/posts` 列表，会发现多了一条记录，**且这条记录会同步持久化到`db.json`**:

```js
[
  {
    id: 1,
    title: 'json-server',
    author: 'typicode'
  },
  {
    title: 'svrx',
    author: 'x-orpheus',
    id: 2
  }
];
```

**请求改写**

通过串连路由的 rewrite 指令，我们可以做到只引导部分流量到 json-server 服务，例如:

```js
route('/api/(.*)')
  .rewrite('/{0}')
  .to.jsonServer(); // /api/posts => /posts
```

这样只有`/api`开头的请求会代理到 json-server，其他请求可以走其他的 mock 逻辑。

### 使用接口管理平台

以上所有的 mock 方式其实都有一个较大的问题，就是 mock 规则都是在本地的，我们无法共享配置。

而实际上较大的团队都应该有 API 接口管理平台来统一管理接口定义，在网易我们使用[**NEI：接口管理平台**](https://nei.netease.com/)来管理 API(由云音乐前端团队维护，欢迎免费试用)。
一般这类平台都有接口模拟功能，代理到这类平台，我们可以轻松实现规范化的接口 mock：

![](https://p1.music.126.net/kDpS2jjo8fyuCojePmyOiA==/109951164485054793.png)

搭配这种接口管理平台，云音乐团队也封装了 svrx-plugin-nei (即将开源)来实现代理到 NEI 平台的数据模拟，如下图所示:

![](https://p1.music.126.net/nC_EwzTKSTrvLJDBz4X6EQ==/109951164495913863.png)

基于接口管理平台的接口模拟是与真实接口规范匹配的，所以**前后端规范性会更一致**，并且它的平台属性也**方便开发者共享配置**。
但这种方式也有巨大的劣势，就是**灵活度远低于本地接口模拟**。

值得一提的是**此插件利用 svrx 的前端注入能力实现了跨浏览器的前端配置界面**，
svrx 通过内部 injector 模块自动为响应是 html 类型的资源注入种子脚本，种子脚本会集成所有 plugin 注册的脚本内容，从而实现了前端逻辑在 dev-server 侧的注入。

### 通过 mock 解析 svrx 的核心价值

我们可以看到，以上所有特性在数据 Mock 领域都是功能互补的，没有所谓的万金油方案。

所以 svrx 带给我们其实并不是 `svrx-plugin-mock`、`svrx-plugin-json-server`亦或是`svrx-plugin-nei` 等等这些隔离的单一功能，
而是基于 svrx 这个平台，我们可以很容易的将这些围绕在`dev-server`领域的功能以**一种统一的方式集成起来使用，避免重复的安装和配置工作**。

举个栗子 🌰，当开发者希望 JSON 响应的格式输出更好看时，可以直接使用`-p json-viewer`来激活对应插件：

```js
svrx --route router.js \
  -p json-viewer \
  -p json-server \
  -p mock
```

响应视图立刻从下面的无序纯文本：

![](https://p1.music.126.net/qhhXtG840eDTslVqd1BfUQ==/109951164481900789.png?param=600x0)

无缝切换为直观的下图：

![](https://p1.music.126.net/whNJnacw5VERC5on6HR8xA==/109951164485027828.png?param=400x0)

再举个栗子 🌰，当我们想将我们的本地服务暴露到外网使用时，可以使用 `-p localtunnel` 激活 [localtunnel](https://github.com/localtunnel/localtunnel) 的反向隧道网关服务。

```js
svrx --route route.js \
  -p json-viewer \
  -p json-server \
  -p mock \
  -p "localtunnel?host=https://tunnel.svrx.io"
```

> - _参数过长时可以使用 [svrx 配置文件](https://docs.svrx.io/zh/quick-start.html#%E9%85%8D%E7%BD%AE%E6%8C%81%E4%B9%85%E5%8C%96)中_
> - tunnel.svrx.io 是属于福利性设施，不确保稳定性，请大家悠着点使用以避免服务因为各种原因不可用。

![](https://p1.music.126.net/mh0fszeEfluJ5Ocp_JVEcQ==/109951164485983063.png)

上图类似 https://fast-dragon-86.tunnel.svrx.io 的随机地址即可用于外网访问的域名了，这种即开即走的使用体验是碎片化的各种 dev server 平台无法提供给你的。

更重要的是，接口 mock 其实仅仅只是我们日常开发中的一环，**svrx 的定位是一个通用开发服务器**，它内置集成了`serve`、`proxy`、`livereload`、`route`等等日常前端开发中必不可少的功能，
并且可以通过社区[不断增加的插件池](https://svrx.io/plugin?query=svrx-plugin-)来进行自由组合使用，这个我们从上述接口 mock 这一场景的描述中应该已经看到。

完全可以这么说，**围绕 dev-server 的设施越多，svrx 存在的价值就越大**

## 写在最后

除了完全不推荐的「硬编码方案」之外，做到与业务代码解耦的「纯前端拦截」和「纯后端拦截」的接口 mock 方案也都存在一些无法规避的本质性问题。

而使用 svrx 以及它配套的社区插件，我们除了可以整合前端和后端拦截的优势，还可以将各种 mock 功能集成在一个服务中运行，解决了工具的碎片化问题，从而高效的实现接口 mock 需求。

## Links

- [**svrx（读音:Server-X）**](https://docs.svrx.io/zh/) 是一个渐进且易于使用的、插件化的前端开发服务器。
- [Server-X：一款可能提升你十倍工作效率的工具](https://juejin.im/post/5dad208ef265da5b7d692340)
- [mock.js](http://mockjs.com/)(前端 mock 工具库)以及对应的[svrx-plugin-mock](https://github.com/svrxjs/svrx-plugin-mock)插件
- [json-server](https://github.com/typicode/json-server): Get a full fake REST API with zero coding in less than 30 seconds (seriously)
- [localtunnel](https://github.com/localtunnel/localtunnel): 一个反向隧道服务，用来暴露本地服务到公网域名，这里也有[团队整理的 docker 快捷部署方案](https://github.com/x-orpheus/localtunnel-server)
- [NEI 接口管理平台](https://nei.netease.com/): 网易研发团队都在使用的接口管理平台
- [Koa](https://koajs.com): 一个轻量级的 Nodejs 框架
- 官方微信群: 已满百人请加微信号 cyxu0825 (项目Owner) 进群
 
  ![](https://p1.music.126.net/d1VyRRgxIWG44xNRSGm-Tw==/109951164498053449.png?param=200x0)


> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，可自由转载，转载请在标题标明转载并在显著位置保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
