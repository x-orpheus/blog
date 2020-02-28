---
title: 支持动态路由的 React Server Side Rendering 实现
date: "2020-02-28T01:31:58.069Z"
description: "服务端渲染有很多坑会踩，针对路由本文提出一种解决方案，在服务端不使用中心化的路由配置，结合 Code Splitting ，通过一次预渲染，获取当前 URL 对应的模块名和数据获取方法。"
---

![](https://p1.music.126.net/YqeZUoezozlvQEcpfK1A6g==/109951164575937529.png)

> 本文作者 Bermudarat

> _头图来自 [Level up your React architecture with MVVM](https://cobe.tech/blog/post/level-up-your-react-architecture-with-mvvm), 作者 [Danijel Vincijanovic](https://cobe.tech/blog/author/danijel-vincijanovic)_

## 1. 前言

在开始正文前，先介绍几个概念（已经了解的朋友可以跳过）：

**Server Side Rendering（SSR）**：服务端渲染，简而言之就是后台语言通过模版引擎生成 HTML 。实现方式依赖于后台语言，例如 Python Flask 的 Jinja、Django 框架、Java 的 VM、Node.js 的 Jade 等。

- 优点：SEO 友好、更短的白屏时间；
- 缺点：每次都需请求完整页面、前后端开发职责不清；

**Client Side Rendering（CSR）**：客户端渲染，服务器只提供接口，路由以及渲染都丢给前端。

- 优点：服务端计算压力小、可以实现页面的局部刷新：无需每次都请求完整页面、前后端分离；
- 缺点：SEO 难度高、用户白屏时间长；

**同构**：前后端共用一套代码逻辑，所有渲染功能均由前端实现。在服务端输出含最基本的 HTML 文件；在客户端进一步渲染时，判断已有的 DOM 节点和即将渲染出的节点是否相同。如不同，重新渲染 DOM 节点，如相同，则只需绑定事件即可（这个过程，在 React 中称之为 **注水**）。同构是实现 SSR 的一种方式，侧重点在于代码复用。

**静态路由**：静态路由需要在页面渲染前声明好 URL 到页面的映射关系。如 Angular、Ember 中的路由，React Router v4 之前版本也采用此种路由。

**动态路由**：动态路由抛开了静态路由在渲染前定义映射关系的做法，在渲染过程中动态生成映射。React Router v4 版本提供了对动态路由的支持。

**Code Splitting**：也就是代码分割，是由诸如 Webpack，Rollup 和 Browserify（factor-bundle）这类打包器支持的一项技术，能够在打包文件时创建多个包并在运行时动态加载。

[Next.js](https://nextjs.org/)、 [Nuxt.js](https://zh.nuxtjs.org/) 是目前成熟的同构框架，前者基于 React，后者基于 Vue。有了这些框架，开发者可以方便地搭建一个同构应用：只对首屏同构直出，满足 SEO 需求，减少白屏时间；使用前端路由进行页面跳转，实现局部渲染。这些同构框架，已经在工程中得到了广泛应用。然而知其然也要知其所以然，对于一个功能完善的同构应用，需要解决以下几个方面的问题：

1. **服务端**：如何匹配 URL；页面数据预获取；响应字符串的组装与返回。
2. **客户端**：应用如何进行数据管理；如何使用服务端获取的数据进行渲染；客户端和服务端的数据获取方式不同，如何保持一致。
3. **工程化**：如何结合 Code Splitting，区分服务端和客户端，输出分块合理的 JS/CSS 文件；对于无法 SSR 的深层组件，如何延迟到客户端再初始化。

上述问题的解决过程中，有很多坑会踩，本文主要讨论第一点。此外，提出一种解决方案，在服务端不使用中心化的路由配置，结合 Code Splitting ，通过一次预渲染，获取当前 URL 对应的模块名和数据获取方法。

## 2. 基于 React 的 SSR 实现

### 2.1 通用思路

React 提供了 [四个方法](https://reactjs.org/docs/react-dom-server.html) 用来在服务端渲染 React 组件。其中，`renderToStaticMarkup`、`renderToStaticNodeStream` 不会在 React 内部创建额外的 DOM 属性，通常用于生成静态页面。同构中常用的是 `renderToString` 、 `renderToNodeStream` 这两个方法：前者将应用渲染成字符串；后者将应用渲染为 Stream 流，可以显著降低首字节响应时间（[TTFB](https://en.wikipedia.org/wiki/Time_to_first_byte)）。

实现一个同构的 React 应用，需要以下几个步骤（**下文均以字符串渲染为例**）：

1. 获取匹配当前 URL 的路由，进而获取对应的数据获取方法；
2. 调用第一步获得的方法请求数据；
3. 结合上一步获取的数据（此处可以使用 Redux 等数据管理模块），调用 React 提供的 `renderToString` 方法，将应用渲染成字符串；
4. 将序列化的数据、上一步获得的字符串、客户端渲染所需的 JS/CSS 文件路径组装成 HTML 字符串，然后返回；
5. 浏览器获取响应后，进行解析。

这是实现同构的通用思路，Next.js 框架也是这种思路。
以上步骤的第一步，是获取匹配当前 URL 的路由。不同的路由对应不同的数据获取方法，这是后续步骤的前提。

### 2.2 使用 React Router

React Router v4 提供了 [React Router Config](
https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) 实现中心化的静态路由配置，用于获取 React 应用的路由信息，方便在服务端渲染时获取数据：
>With the introduction of React Router v4, there is no longer a centralized route configuration. There are some use-cases where it is valuable to know about all the app's potential routes such as:
>
> - **Loading data on the server or in the lifecycle before rendering the next screen**
> - Linking to routes by name
> - Static analysis

React Router Config 提供了 `matchRoutes` 方法实现路由匹配。如何使用，在 [文档](https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) 中有详细的说明:

```js
// routes 为中心化的路由配置文件
const routes = [
  {
    path: "/",
    component: Root,
    loadData: () => getSomeData()
  }
];
const loadBranchData = location => {
    const branch = matchRoutes(routes, location.pathname);
    // 调用 route 上定义的数据获取方法
    const promises = branch.map(({route, match}) => {
        return route.loadData ? route.loadData(match): Promise.resolve(null);
    });
    return Promise.all(promises);
};

// 预获取数据，并在 HTML 文件中写入数据
loadBranchData(req.URL).then(data => {
    putTheDataSomewhereTheClientCanFindIt(data);
});

```

`loadData` 方法除了作为路由的属性外，也可以在 `Root` 的静态方法中定义。

```jsx
// Root 组件
const Root = () => {
    ...
};
Root.loadData = () => getSomeData();
// 路由配置
const routes = [
  {
    path: "/",
    component: Root
  }
];
// 页面匹配
const loadBranchData = location => {
    // routes 为中心化的路由配置文件
    const branch = matchRoutes(routes, location.pathname);
    // 调用 component 上的静态数据获取方法
    const promises = branch.map(({route, match}) => {
        return route.component.loadData ? route.component.loadData(match): Promise.resolve(null);
    });
    return Promise.all(promises);
};
```

接下就可以使用预获取的数据进行渲染。

HTML 字符串中需要包含客户端渲染所需的 JS/CSS 标签。对于没有 Code Splitting 的应用，很容易定位这些资源文件。然而对于一个复杂的单页应用，不进行 Code Splitting 会导致 JS 文件体积过大，增加了传输时间和浏览器解析时间，从而导致页面性能下降。在 SSR 时，如何筛选出当前 URL 对应的 JS/CSS 文件，是接下来要解决的问题。

### 2.3 Code Splitting 与 SSR

![](
https://p1.music.126.net/ZAXt_475DpwYP72jrLOBxA==/109951164575357202.png)

Webpack 根据 ECMAScript 提案实现了用于动态加载模块的 `import` 方法。React v16.6 版本提供了 `React.lazy` 和 `Suspend`，用于动态加载组件。然而 `React.lazy` 和 `Suspend` 并不适用于 SSR，我们仍需要引入第三方的动态加载库：
>React.lazy and Suspense are not yet available for server-side rendering. If you want to do code-splitting in a server rendered app, we recommend Loadable Components. It has a nice guide for bundle splitting with server-side rendering.

目前已有很多成熟的第三方的动态加载库： 早期的 React 官方文档中推荐的 [react-loadable](https://github.com/jamiebuilds/react-loadable)，最新推荐的 [@loadable/component](https://github.com/gregberge/loadable-components#readme)，以及 [react-universal-component](https://github.com/faceyspacey/react-universal-component) 等等，他们提出这样一种解决方案：

1. 在 Webpack 打包时，输出每一个动态加载组件对应的 JS/CSS 配置。Webpack 提供了输出包含所有模块信息的 json 文件的 [CLI 命令](https://webpack.js.org/api/stats/):
`webpack --profile --json > compilation-stats.json`。除了命令行的方式，配置文件也可以通过 [webpack-stats-plugin](https://github.com/FormidableLabs/webpack-stats-plugin#readme) 插件生成。此外，一些第三方动态加载库也提供了插件生成这些配置（例如 [react-loadable](https://github.com/jamiebuilds/react-loadable) 提供的 [`ReactLoadablePlugin`](https://github.com/jamiebuilds/react-loadable#webpack-plugin)）；
2. 渲染时，通过 [React Context](https://reactjs.org/docs/context.html) 获取此次渲染中所有动态加载的组件的模块名 `chunkNames`；
3. 从第一步产生的配置文件中，提取 `chunkNames` 对应的分块代码信息，并组装成 JS/CSS 标签。

以 [react-universal-component](https://github.com/faceyspacey/react-universal-component) 为例，代码实现如下：

```jsx
import {ReportChunks} from 'react-universal-component'
import flushChunks from 'webpack-flush-chunks'
import ReactDOM from 'react-dom/server'
// webpackStats 中包含了应用中所有模块的数据信息，可以通过 webpack 打包获得
import webpackStats from './dist/webpackstats.json';

function renderToHtml () => {
    // 保存匹配当前 URL 的组件 chunk
    let chunkNames = [];
    const appHtml = ReactDOM.renderToString(
        // ReportChunks 通过 React Context 将 report 方法传递至每个动态加载组件上。组件在加载时，执行 report 方法，从而将组件的模块名传递至外部。
        <ReportChunks report={chunkName => chunkNames.push(chunkName)}>
            <App />
        </ReportChunks>
    );
    // 提取 webpacStats 中 chunkNames 的信息，并组装为标签；
    const {scripts} = flushChunks(webpackStats, {
        chunkNames,
    });
    // 后续省略
}
```

综上，使用 React Router 进行服务端渲染，需要执行以下步骤：

1. Webpack 打包时，输出包含所有动态加载组件对应 JS/CSS 信息的配置文件；
2. 使用 React Router 的中心化配置文件，获取当前 URL 对应组件的静态数据获取方法；
3. 使用动态加载库，结合第一步的配置文件，在应用渲染过程中，获取代码分块信息；
4. HTML 字符串组装。

上述过程，流程如下：
![](
https://p1.music.126.net/zF63lSccBv6C4JvqwpVIgQ==/109951164575350461.png)

## 3 动态路由匹配

### 3.1 静态路由 Vs 动态路由

上述讨论中，在进行 URL 匹配时，我们使用了中心化的静态路由配置。React Router v4 版本的最大改进，就是提出了动态路由。`Route` 作为一种真正的 React 组件，与 UI 展示紧密结合，而不是之前版本中的伪组件。有了动态路由组件，我们不再需要中心化的路由配置。

与静态路由相比，动态路由在设计上有很多 [改进之处](https://www.gistia.com/comprehensive-guide-to-react-router-4/)。此外，动态路由在深层路由的书写上，也比中心化的静态路由要方便。
使用 React Router Config 进行中心化的静态路由配置需要提供如下的路由配置文件：

```js
const routes = [
    {
        component: Root,
        routes: [
            {
                path: "/",
                exact: true,
                component: Home
            },
            {
                path: "/child/:id",
                component: Child,
                routes: [
                    {
                        path: "/child/:id/grand-child",
                        component: GrandChild
                    }
                ]
            }
        ]
    }
];
```

采用动态路由，则完全不需要上述配置文件。 以 `Child` 组件为例， 可以在组件中配置子路由。

```jsx
function Child() {
    // 使用 match.path，可以避免前置路径的重复书写
    let match = useRouteMatch();
    return (
        <div>
            <h>Child</h>
            <Route path={`${match.path}/grand-child`} />
        </div>
    )
}
```

但是如果使用动态路由的话，该如何与当前 URL 匹配呢？

### 3.2. 动态加载库的改进

前面介绍了，[react-universal-component](https://github.com/faceyspacey/react-universal-component) 等动态加载组件， 可以通过一次渲染，获取对应当前 URL 的模块名。

```jsx
    let chunkNames = [];
    const appHtml = ReactDOM.renderToString(
        <ReportChunks report={chunkName => chunkNames.push(chunkName)}>
            <App />
        </ReportChunks>
    );
```

我们是否可以使用类似的方式，通过一次渲染，将定义在组件上的数据获取方法传递至外部呢？比如下面的书写方式：

```jsx
    let chunkNames = [];
    let loadDataMethods = [];
    const appHtml = ReactDOM.renderToString(
        <ReportChunks report={(chunkName, loadData) => {
            chunkNames.push(chunkName);
            loadDataMethods.push(loadData);
        }}>
            <App />
        </ReportChunks>
    );
```

[react-universal-component](https://github.com/faceyspacey/react-universal-component) 中， `ReportChunks` 组件使用 [React Context](https://reactjs.org/docs/context.html) 将 `report` 方法传递至每个动态加载组件上。组件在加载时，执行 `report` 方法，将组件的模块名传递至外部。

因此，我们只需要修改动态加载方法，使其在执行 `report` 方法时，同时将模块名 `chunkName` 和组件上的静态方法返回即可：

```js
// AsyncComponent 提供在服务端同步加载组件的功能
class AsyncComponent extends Component {
    constructor(props) {
        super(props);
        const {report} = props;
        // syncModule 为内置函数，不对用户暴露，主要功能是使用 webpack 提供的 require.resolveWeak 方法实现模块的同步加载；
        const comp = syncModule(resolveWeak, load);
        if (report && comp) {
            const exportStatic = {};
            // 将 comp 的静态方法复制至 exportStatic
            hoistNonReactStatics(exportStatic, comp);
            exportStatic.chunkName = chunkName;
            // 将 chunkName 和静态方法传递给外部
            report(exportStatic);
        }
    }
    // ...
}
```

完整的实现可以参考 [react-asyncmodule](https://github.com/caoren/react-asyncmodule/blob/master/packages/react-asyncmodule/src/index.js#L80-L90)。[react-asyncmodule](https://github.com/caoren/react-asyncmodule/blob/master/packages/react-asyncmodule/src/index.js#L80-L90) 提供了 `AsyncChunk` 组件，与 [react-universal-component](https://github.com/faceyspacey/react-universal-component) 提供的 `ReportChunks` 组件相似，作用是将 `report` 方法传递至每个动态加载组件上。使用方法如下：

```jsx
    let modules = [];
    const saveModule = (m) => {
        // m 中包含 chunkName 和静态数据获取方法；
        const { chunkName } = m;
        // 过滤重复的 chunkName
        if (modules.filter(e => e.chunkName === chunkName).length) return;
        modules.push(m);
    };
    const appHtml = ReactDOM.renderToString(
        <AsyncChunk report={saveModule}>
            <App />
        </AsyncChunk>
    );
```

完整流程如下：
![](
https://p1.music.126.net/9yrSb91rOcEZTFljsqFsLA==/109951164575352405.png)

## 4. 局限性和解决办法

通过一次预渲染，获取对应当前 URL 的模块名和数据获取方法，适用于大部分动态路由的场景。但是如果动态加载组件本身是否渲染依赖于数据，那么在预渲染时，这个组件的模块名和静态方法不能正常获取。如下：

```jsx
const PageA = AsyncComponent(import('./PageA'));
const BasicExample = (props) => {
        const {canRender} = props;
        return (
            <Router>
                <Route exact path="/">
                {
                    canRender ? <PageA /> : <div>Render Nothing!</div>
                }
                </Route>
            </Router>
        );
};
BasicExample.getInitialProps = () => {
    // 此处获取 canRender，用于确定 PageA 组件是否渲染
};
```

预渲染时 `canRender` 为 `undefined`, 不会渲染 `PageA` ，所以也不能获取到 `PageA` 对应的模块名和静态方法。正式渲染时，服务端渲染出的页面中会缺少 `PageA` 中的数据信息。为了解决这个问题，业务代码需要在 `PageA` 的 `componentDidMount` 生命周期中，进行数据的获取，以正确展示页面。

此外，预渲染可以使用 `renderToStaticMarkup` 方法，相比 `renderToString`，`renderToStaticMarkup` 不会生成额外的 React 属性，因此减少了 HTML 字符串的大小。但是预渲染本身增加了服务端的计算压力，所以可以考虑缓存预渲染结果，实现思路如下：

1. 定义缓存 `moduleCache`；
2. 对于每次请求，使用 React Router 的 [`matchPath`](https://github.com/ReactTraining/react-router/blob/master/packages/react-router/modules/matchPath.js) 方法，在 `moduleCache` 中查找是否有此 path string 模式（例如 `/user/:name`）的缓存，如果有，则使用缓存的方法进行数据获取；
3. 如果没有，则进行预渲染，并将获取的模块信息存入缓存。

使用这种方法，对于不同的 path string 模式，只需在第一次请求时进行一次预渲染。之后再次请求，使用缓存数据即可。

## 5. 参考资料

均以外链形式列出

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
