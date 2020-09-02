---
title: 云音乐 React Native 体系建设与发展
date: 2020-09-02T03:27:18.628Z
description: 本文介绍了云音乐引入 React Native 0.33 版本历史，RN 自动部署平台和离线包服务平台实现，0.33 版本如何升级到 0.6 版本，业界首个 RN codemod 框架推出，三端方案落地，基础设施完善，RN 现状及未来规划。
---

![header.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3624565740/ab96/d716/535b/378b2a59180d28955d5aab7db03e3eca.jpg)

> 本文作者：[章伟东](https://www.zhihu.com/people/huo-hai-jin-xing-shi)

### 0.33 历史

17 年 3 月份，为了解决商城性能和用户体验问题，云音乐技术团队组建了一只 4 人 ReactNative 开发小分队：我负责 RN 前端开发，安卓和 iOS 两位开发负责在云音乐 App 里面嵌入 RN Native SDK，还有一位 Java 开发来负责部署平台工作。

商城 RN 应用上线后，其他团队表示有兴趣尝试，但当时 RN 项目开发没有脚手架，项目创建通过原始拷贝进行，缺少 forweb 支持，RN 预加载只接入了 iOS 一端。

种种原因，导致 RN 开发效率低下，音乐人业务原本有兴趣用 RN 来开发新应用，开发到一半改成了 H5。

从 17 年 3 月份到 19 年 9 月份，RN 版本始终为 0.33，核心开发团队人员流失一半，部署平台无人维护，项目开发缺少脚手架，缺少 forweb 支持，一共上线 RN 应用为 2.5 个（商城、音乐人、三元音箱）。

### 搅动历史

时间滚滚向前，新技术层出不穷。2 年半的时间对于前端发展来说，恍如隔世。 如果不出任何意外，RN 技术就会躺在历史的尘埃里，无人问津。这种尴尬的局面，直到会员收银台到达率优化项目才被打破。

会员收银台页面即下图，是云音乐会员购买页面，重要性不言而喻。这个页面最开始是一个 React 服务端渲染开发的 H5 页面。
![收银台](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3584299058/3c21/7fce/9ae5/fc77e7913210cac7e97a42fbb59b63c8.png)

为了能让用户更加顺利购买会员，提高用户体验和到达率，整个技术团队采用 web 通用优化技术结合云音乐自身技术设施，花了一个月对这个 H5 页面进行优化，将到达率从 72% 提高到 89%，提高了 17 个百分点。与竞品比较如下（单位是秒）。

![竞品比较](https://p1.music.126.net/ceaJj5ZjEKBplXbiIs47Sw==/109951165050815225.png)

> 到达率计算公式= 收银台可视埋点/客户端点击埋点

虽然优化结果喜人，但是存在几个问题：

1. 到达率目标未完成。当初技术团队定的是至少 90% 以上，差了一个百分点。
2. ROI 太差。H5 优化投入了前后端开发众多人力，花了将近一个月。如果再去优化其他页面，目前方案自动化程度低，仍需大量人工操作。
3. 0.33 RN 到达率为 93%。我们统计了商城 RN 版本的到达率，未做任何优化，轻松破 90。

此时放在团队面前有 3 条路：
1. 在 H5 页面上投入更多资源优化，突破 90% 完成任务。但这种方案耗费大量的人力物力，对优化其他页面用处不大，属于一锤子买卖。
2. 在 RN 0.33 版本上重置收银台页面。 这样虽然能达到目标，但是 RN 基础设施仍然停留在 3 年前。
3. 将 RN 基础建设补齐，升级到最新 0.6 版本，实现三端方案，构建完整的 RN 开发体系。在此基础上，基于 0.6 版本重置收银台，借助这个项目将 RN 整个技术栈更新换代。这种方案虽然收益大，但时间跨度长、困难大、复杂性高。

经过激烈讨论和痛苦抉择，团队决定向更高目标发起冲击，不满足于只完成到达率目标，而是要重建整个 RN 技术体系，为以后的开发铺平道路，一劳永逸解决整个前端开发的性能和体验问题。

### 自动部署

#### 旧部署平台

原有 RN 部署平台没有实现自动部署，发布一个 RN 应用需要做以下事情

##### 执行兼容性脚本

为了支持低版本如 iOS8，需要手动修改本地 node_modules 里面相关源码。

```js
    sed -i -e 's/function normalizePrefix(moduleName: string)/const normalizePrefix = function(moduleName: string)/g' ./node_modules/react-native/Libraries/BatchedBridge/BatchedBridgedModules/NativeModules.js

    sed -i -e 's/function normalizePrefix(moduleName: string)/const normalizePrefix = function(moduleName: string)/g' ./node_modules/react-native/Libraries/Utilities/UIManager.js

    sed -i -e 's/function handleError(e, isFatal)/var handleError = function(e, isFatal)/g' ./node_modules/react-native/Libraries/JavaScriptAppEngine/Initialization/InitializeJavaScriptAppEngine.js

```

##### 执行打包脚本
    
本地执行`release.test.sh`（测试）和`release.sh`（线上）。release 脚本分别调用 iOS 和 Android 打包脚本，然后打出对应的 bundle。

![打包脚本](https://p1.music.126.net/GQsDY8b6GzDa_S4BEBEFTA==/109951164658054293.png)

![打包结果](https://p1.music.126.net/yV6thsmnMdvWL1cTjPeGlg==/109951164658047785.png)

因为两端 bundle 用同一个名字，所以很容易出现传错情况，每次上传都小心翼翼。

##### 上传发布平台

![旧发布平台截图](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3751687602/9fd8/a90a/889d/5f5b8b4dcd66f1d5a6352af8300e269a.jpg)

这里需要填写相关内容，然后点击发布。

可以看到上面三步有本地污染风险，操作繁琐，容易遗漏步骤和填错。

##### 自动部署流程

针对上面手动部署缺陷，我们重新梳理和设计了整个自动部署流程

```
git 克隆 -> 依赖安装 -> 自动脚本执行 -> 压缩 -> 上传文件服务器 -> 保存版本信息 -> 发布

```

然后用 Node 取代 Java 开发了新 RN 部署平台

![rn 发布平台](https://p1.music.126.net/3KgXnLzYf6Pc-rMxhNlB8g==/109951165003067142.png)

新 RN 部署平台会自动处理兼容性、打包、上传和发布工作，支持多环境，一键部署完成整个流程。

### 双端预加载

#### RN 加载流程

![RN 应用加载流程](https://p1.music.126.net/0b-1XFJ5fqH8pTGUJr0Z9A==/109951165003086968.png)

 * APP 先启动 RN 容器，RN 容器从服务端请求 JSBundle，然后进行初步渲染。
 * RN 页面初始化完成后，向服务器发请求拿动态数据，完成剩下渲染逻辑

从上图可以看出 JSBundle 请求是整个流程中性能瓶颈。
如果把加载 JSBundle 这个环节提前（在 App 初始化时触发） ， 后续打开 RN 应用， App 会直接从本地加载资源包，极大提高用户体验和性能。

#### RN 离线包平台

基于上述原因，我们设计了 RN 离线包服务平台来负责 JSBundle 下发。 离线包服务和构建部署紧密相关，我们将 2 个平台打通，在构建部署阶段自动生成离线包，减少开发人员部署工作。

下面是 RN 自动部署平台和离线包服务平台整个流程图

![2 个平台](https://p1.music.126.net/Il24pLEqhfLgWpAKkvuBzg==/109951164981951089.png)

主要流程如下：
1. RN 自动部署平台先构建出全量包，传到 CDN 上，然后通知离线包服务平台
2. 离线包服务平台收到全量包信息，用 diff 算法算出差量包，存储相关的信息，发布差量包。
3. APP 启动的时候访问离线包服务，根据返回的信息来读取本地缓存还是去远程取对应的全量包或差量包。

### 0.33 升级 0.6

升级工作主要分两块：RN Native SDK 升级 +  RN 应用升级。

RN Native SDK 指的是集成在云音乐 App 里面 RN 相关原生代码（iOS 和安卓源码）。 由于 0.33 版本和 0.6 版本无法同时兼容，所以我们对于老版本采取了只维护，不升级的策略。

RN 应用指的是例如商城、音箱这种业务应用，也可以等同于 JSBundle。应用升级必须赶在 SDK 升级之前完成，不然会出现 0.6 SDK 加载 0.3 应用的情况，导致 App 崩溃。所以，所有应用必须同时完成升级工作

#### 升级面临问题

##### 依赖问题

RN 0.3 使用的是 React 15.3 版本，0.6 使用的是 16.8。除了 React 的依赖之外，还有其他依赖需要升级，我们根据官方提供 [版本差异比较](https://react-native-community.github.io/upgrade-helper/) 创建了一个脚手架，读取 package.json 里面信息，一一比对，然后修改为对应版本。

##### 废弃组件

RN0.6 版本移除了 2 个组件：`Listview` 和 `navigator-ios`。

对于这种情况，如果我们用新组件比如 `FlatList` 重写，不仅需要理解原来业务逻辑，还要修改源码，重新测试。所以针对这种情况，团队采取措施是：不改动现有代码，从旧版本抽取对应组件。
最终，我们发布了`@music/rn-deprecated-navigator-ios` 和 `@music/rn-deprecated-listview`

#### 语法兼容

RN 语法在 0.6 和 0.33 上不仅写法不同，也不向下兼容。导致的结果就是 0.33 的 JSBundle 跑在 0.6 的 RN Native SDK 上会直接崩溃，下面以背景图举例说明。

![背景图](https://p1.music.126.net/ixJ5sUhFf9nWC77a2ZnlGA==/109951164981979189.png)

在 0.33 中为了实现背景图，是用`Image`包含一个`View`, 而到了 0.6 里面改成了`ImageBackground`，属性也不同。

除了背景图的语法需要修改之外，还有多少语法需要兼容修改我们不得而知。面对这种范围不清楚，改动时间又非常紧张的情况，如果使用人工方式不仅效率低下进度也不可控。因此，我们采用了自动化的处理方式，推出了业界首个 RN  codemod 框架 [mrn-codemod](https://github.com/x-orpheus/mrn-codemod)

其主流程如下：

1. 利用框架先读取 0.33 源码
2. 将 0.33 源码 转为 AST 树。
3. 对 0.33 AST 树进行对应操作，转化成 0.6 的 AST 树。
4. 把 0.6 的 AST 树重新生成源码。

整个框架一共处理了 12 条转译规则

![mrn-codemod](https://p1.music.126.net/MRH44vP3IQZJnfSXJZ5YDA==/109951164981993537.png)

此框架完成后，一天之内完成了所有 RN 应用升级，不仅保证准确性，减少人力成本和时间，还为今后升级提供了扩展。

### 3 端方案

当上面升级完成之后，团队开始投入 3 端方案的研究，经调查主要有 3 种方式：直接转换、桥接模式、底层构建。

#### 直接转换

因为 RN 与 React 只是渲染层面语法的不同，所以如果能够将 RN 的语法直接翻译为 React 语法，那么就可以将 RN 跑在浏览器上。

比如将 RN 的 `View` 转为 React 的 `div`，RN 的点击事件 `onPress` 转为 React 的 `onClick` 等。

这种方案的缺点在于：

1. 工作量太大。RN 里面的`View`，`Text`，`Image`基础组件非常多。
2. 无法做到一一对应。比如`View`里面有一个`onStartShouldSetResponder`方法，React 里面找不到对应事件。

#### 桥接模式

对于 RN 应用，先找到一个支持 forweb 的 三方框架，然后把 RN DSL 转为第三方框架的 DSL 达到最终目的。

这方面比较有代表性的就是 [Taro](https://github.com/NervJS/taro) 和 [ReactXP](https://microsoft.github.io/reactxp/)。

Taro 根据 RN 规范自己实现了一套 DSL，对函数和事件做了自定义。

ReactXP 三端支持非常良好，但是组件非常少，也只好放弃。

#### 底层构建

根据 RN 元素和组件定义，从最底层开始用 WEB 相关特性来实现整套 RN API，这个就是 [react-native-web](https://github.com/necolas/react-native-web)。这种方案也是目前业界主流模式。

我们对这个库进行了封装和扩展，添加了不支持的组件，修复了一些 bug，形成 `@music/react-native-web-suffix`。

#### 新开发流程

我们在三端方案的基础上开发了`rn-cli`脚手架，`rn-util`常用工具库，`rn-template`工程初始化模板等配套工具，形成了一整套 RN 开发的基础设施，目前新开发流程如下

![流程](https://p1.music.126.net/zhJ0Zru5Ovrlwb2dDi1QdQ==/109951165003245939.png)

> `rn-cli`脚手架初始化的时候会调用 `rn-template`。 `rn-template` 内置了 android，ios 和 web 开发容器及一些常用工程配置，集合了`rn-util`（处理请求，环境判断，通用协议）和三端组件库。

#### 收银台 RN 重构结果

经过上述努力，收银台在 RN 0.6 版本上完成了重构，到达率从之前 H5（已优化） 89% 升至 99%。

![到达率比较](https://p1.music.126.net/UVSAMKXNqPqGiF_z31LCaQ==/109951164993118455.png)

### 现状

随着 RN 版本的提升，基础建设完善，越来越多大前端开发人员在新项目中采用了 RN 技术栈。

目前已经上线了 10 多个 RN 应用，例如：

<img src="https://p1.music.126.net/3kekxdBYqiq4ptJxZHi87A==/109951164988913017.png" width="300"/><img src="https://p1.music.126.net/ouuMVd2Zu4Tl9ao62DYv_A==/109951164988908202.png" width="300"/><img src="https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3609741702/8967/18da/26eb/b559b056917358b2ea6e7f6c24ab8246.png"  width="300"/>

### 未来规划

目前 RN 技术已经成为大前端重点发展方向，有专人专项来负责此事，后续的具体规划围绕**性能**、**效率**、**监控**三大方向展开，目标在这块打造成业界第一梯队。

现在有多个专项正在推进中

#### Native RPC

这个专项的主要目的是打通 RN bridge 和 JS bridge，可以让一套数据通信机制同时支持 RN 和 web。

之前的 bridge 主要有 2 个问题：
1. 用法不一致。需要写 2 套语法分别支持 RN 和 web。
2. 支持不一致。有的协议 web 有 RN 没有，反之同样。

所以，针对上面情况，大前端这边统一了两端 API，重构了底层协议来支持上面的功能，下面举一个例子。

```js
// 查看 net.nefetch 是否支持，
mnb.checkSupport({
    module: 'net',
    method: 'nefetch'
}).then(res => {

})

/* 手动添加方法 */
mnb.addMethod({
    schema: 'page.info',
    name: 'getPageInfo'
});

/* 添加之后即可调用 */
mnb.getPageInfo().then((result) => {
    // ...
}).catch((e) => {
    // ...
});

```

RN 和 web 两端都是统一写法，开发人员再也不用担心兼容性问题。

#### RN 拆包

RN 应用在大部分主流机型上性能表现良好，但是在部分 Android 低端机出现卡顿现象。为了解决这个问题，启动拆包专项，主要分成 2 部分。
1. 拆包。将现在的完整 JSBundle 拆成基础包和业务包，分别载入。
2. 容器预加载。在 App 启动的时候就预热 RN 容器，这样可以大幅度减少容器启动时间，提高载入速度。

#### 其他

除了上述专项之外还有 RN 大盘监控、RN 资源包定向下发、文档规范等多个专项正在如火如荼的展开。

### 结束语

写到这里，你是否好奇云音乐 App 里面 RN 的真实体验如何，如果感兴趣，请将云音乐 App 版本升级至最新进行体验。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
