---
title: 基于 qiankun 的微前端应用实践
date: 2021-03-11T02:04:10.716Z
description: 本文通过云音乐广告合约系统的微前端落地来介绍 qiankun 的应用实践
---

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7840022886/a56d/0d31/2f29/59ccfc6c03a345d57a0f4c132504815a.jpg)

> 本文作者：张延卿

## 业务背景

云音乐广告 Dsp（需求方平台）平台分为合约平台（Vue 框架）和竞价平台（React 框架），因历史原因框架选型未能统一，最近来了新需求，需要同时在两个平台增加一样的模块，因为都是 Dsp 平台，后期这样的需求可能会很多，所以考虑到组件复用以及降低维护成本，在想怎么统一技术栈，把 React 系统塞到 Vue 项目中进行呈现。

![项目应用结构](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5628081081/cee2/ea4b/acbe/671fbacddfbd3a3fca861eaf3dbcd07b.png)

> 系统是传统的左右布局，左侧侧边栏展示菜单栏，头部导航展示基础信息，应用内容全部填充到蓝色的内容区。

说实话，第一反应我直接想嵌套 iframe ，但是应用过 iframe 技术的，大家都知道它的痛：

*   **浏览器历史栈问题前进 / 后退**<div style="margin-top:5px" />
    无论你在 iframe 里潜行了多深，你退一步就是一万步，这个体验真的很难受
      <div style="margin-top:5px" />
*   **应用通信**<div style="margin-top:5px" >
      有时候主应用可能只想知道子系统的 URL 参数，但是 iframe 应用跟它不同源，你就得想点其他办法去获取参数了，我们最常用的就是 `postMessage` 了
      <div style="margin-top:5px">
*   **缓存**<div style="margin-top:5px" />
      `iframe` 应用更新上线后，打开系统会发现系统命中缓存显示旧内容，需要用时间戳方案解决或强制刷新

<br/>另外就是使用 MPA + 路由分发，当用户访问页面时，由 Nginx 等负责根据路由分发到不同的业务应用，由各个业务应用完成资源的组装后返回给浏览器，这种方式就需要把界面、导航都做成类似的样子。</br>
<div style="margin-top:5px" />

*   **优点**：
    *   多框架开发；
    *   独立部署运行；
    *   应用之间完全隔离。
*   **缺点**：
    *   体验差，每个独立应用加载时间较长；
    *   因为完全隔离，导致在导航、顶部这些通用的地方改动大，复用性变的很差。

<br/> 还有就是目前比较主流的几种微前端方案：<div style="margin-top:5px" /></br>

*   **基座模式**：主要基于路由分发，由一个基座应用监听路由，按照路由规则去加载不同的应用，以实现应用间解耦
*   **EMP**：Webpack5 Module Federation，去中心化的微前端方案，可以在实现应用隔离的基础上，轻松实现应用间的资源共享和通信；

> 总的来说，iframe 主要用于简单并且性能要求不高的第三方系统；MPA 无论在实现成本和体验上面都不能满足当前业务需求；基座模式和 EMP 都是不错的选择，因 qiankun 在业内使用比较广，较为成熟，最后还是选择了 qiankun

## 乾坤（qiankun）

[qiankun](https://github.com/umijs/qiankun)（乾坤）是由蚂蚁金服推出的基于[Single-Spa](https://github.com/single-spa/single-spa)实现的前端微服务框架，本质上还是**路由分发式**的服务框架，不同于原本 Single-Spa 采用 JS Entry 加载子应用的方案，qiankun 采用 HTML Entry 方式进行了替代优化。

**`JS Entry`的使用限制要求**：

*   限制一个 JS 入口文件
*   图片、CSS 等静态资源需要打包到 JS 里
*   Code Splitting 无法应用

<br/>对比 JS Entry， HTML Entry 使用就方便太多了，项目配置给定入口文件后，qiankun 会自行 Fetch 请求资源，解析出 JS 和 CSS 文件资源后，插入到给定的容器中，完美～</br>

![HTML Entry](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5628082051/3440/71e0/d39b/12c8d79871a48baf448b287690cd356c.png)

> JS Entry 的方式通常是子应用将资源打成一个 Entry Script， 类似 Single-Spa 的 [例子](https://github.com/joeldenning/simple-single-spa-webpack-example/blob/master/src/root-application/root-application.js)；<div style="margin-top:5px" />
 HTML Entry 则是使用 HTML 格式进行子应用资源的组织，主应用通过 Fetch html 的方式获取子应用的静态资源，同时将 HTML Document 作为子节点塞到主应用的容器中。可读性和维护性更高，更接近最后页面挂载后的效果，也不存在需要双向转义的问题。

## 方案实践

由于 Vue 项目已经开发完成，我们需要在原始项目中进行改造，很明显选定 Vue 项目作为基座应用，新需求开发采用 Create React App 搭建 React 子应用，接下来我们看一下具体实现

### 基座应用改造

基座（main）采用是的 vue-cli 搭建的，我们保持其原本的代码结构和逻辑不变，在此基础上单独为子应用提供一个挂载的容器 DIV，同样填充在相同的内容展示区域。

qiankun 只需要在基座应用中引入，为了方便管理，我们新增目录，命名为 micro ，标识目录里面是微前端改造代码，进行全局配置初始化，改造如下：

**路由配置文件 app.js**

```JavaScript
// 路由配置
const apps = [
  {
    name: 'ReactMicroApp',
    entry: '//localhost:10100',
    container: '#frame',
    activeRule: '/react'
  }
];
```

**应用配置注册函数**

```javascript
import { registerMicroApps, start } from "qiankun";
import apps from "./apps";

// 注册子应用函数，包装成高阶函数，方便后期如果有参数注入修改app配置
export const registerApp = () => registerMicroApps(apps);

// 导出 qiankun 的启动函数
export default start;
```

**Layout 组件**

```html
<section class="app-main">
  <transition v-show="$route.name" name="fade-transform" mode="out-in">
    <!-- 主应用渲染区，用于挂载主应用路由触发的组件 -->
    <router-view />
  </transition>

  <!-- 子应用渲染区，用于挂载子应用节点 -->
  <div id="frame" />
</section>
```

```javascript
import startQiankun, { registerApp } from "../../../micro";
export default {
  name: "AppMain",
  mounted() {
    // 初始化配置
    registerApp();
    startQiankun();
  },
};
```

这里会用到 qiankun 的两个重要的 API ：

*   registerMicroApps
*   start

> 注意点：我们选择在 mounted 生命周期中进行初始化配置，是为了保证挂载容器一定存在

我们来通过图示具体理解一下 qiankun 注册子应用的过程：
![启动流程图](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5628082531/0bb0/355e/ea97/c2266e7406ae62828d0db5a1ba9ec583.png)

*   依赖注入后，会先初始化标识变量参数 `xx_QIANKUN__`，用于子应用判断所处环境等
*   当 qiankun 会通过 `activeRule` 的规则来判断是否激活子应用
    *   `activeRule` 为字符串时，以路由拦截方式进行自主拦截
    *   `activeRule` 为函数时，根据函数返回值判断是否激活

<!---->

*   当激活子应用时，会通过 HTML-Entry 来解析子应用静态资源地址，挂载到对应容器上
*   创建沙箱环境，查找子应用生命周期函数，初始化子应用

## 打造 qiankun 子应用

我们基于 Create React App 创建一个 React 项目应用，由上述的流程描述，我们知道子应用得向外暴露一系列生命周期函数供 qiankun 调用，在 index.js 文件中进行改造：

**增加 public-path.js 文件**

    目录外层添加 `public-path.js` 文件，当子应用挂载在主应用下时，如果我们的一些静态资源沿用了 `publicPath=/` 的配置，我们拿到的域名将会是主应用域名，这个时候就会造成资源加载出错，好在 Webpack 提供了修改方法，如下：

```javascript
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
```

**路由 base 设置**

    因为通常来说，主应用会拦截浏览器路由变化以激活加载子应用。比如，上述的代码里我们的路由配置，激活规则写了 `activeRule: /react`，这是什么意思呢？这意味着，当浏览器 `pathname` 匹配到 `/react` 时，会激活子应用，但是如果我们的子应用路由配置是下面这样的：

```jsx
<Router>     
  <Route exact path="/" component={Home} />
  <Route path="/list" component={List} />  
</Router>      
```

我们怎么实现域名 `/react` 能正确加载对应的组件呢？大家一定经历过用域名二级目录访问的需求，这里是一样的，我们判断是否在 qiankun 环境下，调整下 base 即可，如下：

```jsx
const BASE_NAME = window.__POWERED_BY_QIANKUN__ ? "/react" : "";
...
<Router base={BASE_NAME}>
...
</Router>     
```

**增加生命周期函数**

    子应用的入口文件加入生命周期函数初始化，方便主应用调用资源完成后按应用名称调用子应用的生命周期

```javascript
/**
 * bootstrap 只会在微应用初始化的时候调用一次，下次微应用重新进入时会直接调用 mount 钩子，不会再重复触发 bootstrap。
 * 通常我们可以在这里做一些全局变量的初始化，比如不会在 unmount 阶段被销毁的应用级别的缓存等。
 */
export async function bootstrap() {
  console.log("bootstraped");
}

/**
 * 应用每次进入都会调用 mount 方法，通常我们在这里触发应用的渲染方法
 */
export async function mount(props) {
  console.log("mount", props);
  render(props);
}

/**
 * 应用每次切出/卸载 会调用的方法，通常在这里我们会卸载微应用的应用实例
 */
export async function unmount() {
  console.log("unmount");
  ReactDOM.unmountComponentAtNode(document.getElementById("root"));
}
```

> 注意：所有的生明周期函数都必须是 Promise

**修改打包配置**

```javascript
module.exports = {
  webpack: (config) => {
    // 微应用的包名，这里与主应用中注册的微应用名称一致
    config.output.library = `ReactMicroApp`;
    // 将你的 library 暴露为所有的模块定义下都可运行的方式
    config.output.libraryTarget = "umd";
    // 按需加载相关，设置为 webpackJsonp_ReactMicroApp 即可
    config.output.jsonpFunction = `webpackJsonp_ReactMicroApp`;

    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },

  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      // 关闭主机检查，使微应用可以被 fetch
      config.disableHostCheck = true;
      // 配置跨域请求头，解决开发环境的跨域问题
      config.headers = {
        "Access-Control-Allow-Origin": "*",
      };
      // 配置 history 模式
      config.historyApiFallback = true;

      return config;
    };
  },
};
```

> 注意：配置的修改为了达到两个目的，一个是暴露生命周期函数给主应用调用，第二点是允许跨域访问，修改的注意点可以参考代码的注释。

*   **暴露生命周期**： UMD 可以让 qiankun 按应用名称匹配到生命周期函数
*   **跨域配置**： 主应用是通过 Fetch 获取资源，所以为了解决跨域问题，必须设置允许跨域访问

> 小结：跳转流程梳理，在主应用 router 中定义子应用跳转 path ，如下图，在调用组件 mounted 生命周期中使用 qiankun 暴露的 `loadMicroApp` 方法加载子应用，跳转到子应用定义的路由，同时使用 `addGlobalUncaughtErrorHandler` 和 `removeGlobalUncaughtErrorHandler` 监听并处理异常情况（例如子应用加载失败），当子应用监听到跳转路由时，加载子应用（上述 `<Router>` 组件中）定义的 component，完成主应用到子应用的跳转。

```javascript
{
    path: '/xxx',
    component: Layout,
    children: [
      {
        path: '/xxx',
        component: () => import('@/micro/app/react'),
        meta: { title: 'xxx', icon: 'user' }
      }
    ]
  },
```

## 项目中遇到的问题

1、**子应用未成功加载** 

   如果项目启动完成后，发现子应用系统没有加载，我们应该打开控制台分析原因：
   *  控制台无报错：子应用未激活，检查激活规则配置是否正确
   *  [挂载容器未找到](https://qiankun.umijs.org/faq#application-died-in-status-not_mounted-target-container-with-container-not-existed-after-xxx-mounted)：检查容器 DIV 是否在 qiankun  **start** 时一定存在，如不能保证需设法在 DOM 挂载后执行。

<br/>2、**基座应用路由模式**</br>

   基座应用项目是 hash 模式路由，这种情况下子应用的路由模式必须跟主应用保持一致，否则会加载异常。原因很简单，假设子应用采用 history 模式，每次切换路由都会改变 pathname，这个时候很难再通过激活规则去匹配到子应用，造成子应用 unmount

3、**CSS 样式错乱** 

   由于默认情况下 qiankun 并不会开启 CSS 沙箱进行样式隔离，当主应用和子应用产生样式错乱时，我们可以启用 `{ strictStyleIsolation: true }` 配置开启严格隔离样式，这个时候会用 Shadow Dom 节点包裹子应用，相信大家看到这个也很熟悉，和微信小程序中页面和自定义组件的样式隔离方案一致。

4、**另外，在接入过程中，总结了几个需要注意的点**

*   虽然 qiankun 支持 jQuery，但对多页应用的老项目接入不是很友好，需要每个页面都修改，成本也很高，这类老项目接入还是比较推荐 iframe ；
*   因为 qiankun 的方式，是通过 HTML-Entry 抽取 JS 文件和 DOM 结构的，实际上和主应用共用的是同一个 Document，如果子应用和主应用同时定义了相同事件，会互相影响，如，用 `onClick` 或 `addEventListener` 给 `<body>`添加了一个点击事件，JS 沙箱并不能消除它的影响，还得靠平时的代码规范
*  部署上有点繁琐，需要手动解决跨域问题

<br/>5、**未来可能需要考虑一些问题**</br>

*   **公用组件依赖复用**：项目中避免不了的比如请求库的封装，我可能并不想在子应用中再写一套同样的请求封装代码
*   **自动化注入**：每一个子应用改造的过程其实也是挺麻烦的事情，但是其实大多的工作都是标准化流程，在考虑通过脚本自动注册子应用，实现自动化

## 总结

其实写下来整个项目，最大的感受 qiankun 的开箱可用性非常强，需要更改的项目配置基本很少，当然遇到的一些坑点也肯定是踩过才能更清晰。

如果文章有什么问题或者错误，欢迎指正交流，谢谢！

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe (at) corp.netease.com！
