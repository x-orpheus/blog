---
title: 基于 qiankun 的 CMS 应用微前端实践
date: 2020-10-22T01:43:37.998Z
description: 本文主要介绍 LOOK 直播运营后台基于 qiankun 的微前端落地实践，以及共享公共依赖的预研工作。
---

![](https://p1.music.126.net/80vHXvHJqsaw-d24IyykHw==/109951165072039331.jpg)
> 图片来源：https://zhuanlan.zhihu.com/p/78362028

> 本文作者：史志鹏

## 前言

LOOK 直播运营后台工程是一个迭代了 2+ 年，累计超过 10+ 位开发者参与业务开发，页面数量多达 250+ 的“巨石应用”。代码量的庞大，带来了构建、部署的低效，此外该工程依赖内部的一套 [Regularjs](http://regularjs.github.io/) 技术栈也已经完成了历史使命，相应的 UI 组件库、工程脚手架也被推荐停止使用，走向了少维护或者不维护的阶段。因此， LOOK 直播运营后台基于 React 新建工程、做工程拆分被提上了工作日程。一句话描述目标就是：新的页面将在基于 React 的新工程开发， React 工程可以独立部署，而 LOOK 直播运营后台对外输出的访问地址期望维持不变。  

本文基于 LOOK 直播运营后台的微前端落地实践总结而成。主要介绍在既有“巨石应用”、 Regularjs 和 React 技术栈共存的场景下，使用微前端框架 qiankun ，实现CMS应用的微前端落地历程。

关于 qiankun 的介绍，请移步至[官方](https://qiankun.umijs.org/)查阅，本文不会侧重于介绍有关微前端的概念。


## 一.背景

### 1.1 现状

1. 如上所述，存在一个如下图所示的 CMS 应用，这个应用的工程我们称之为 liveadmin ，访问地址为：`https://example.com/liveadmin`，访问如下图所示。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4133978389/58ea/dc2a/aa18/267d023e7d15f18af1a6bdc4018b4e39.png)

2. 我们希望不再在 liveadmin 旧工程新增新业务页面，因此我们基于内部的一个 React 脚手架新建了一个称为 increase 的新工程，新的业务页面都推荐使用这个工程开发，这个应用可以独立部署独立访问，访问地址为：`https://example.com/lookadmin`，访问如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4134262586/1ace/fc3c/8901/09e649aa1f941c98e63dfd91eff5011b.png)

### 1.2 目标

我们希望使用微前端的方式，集成这两个应用的所有菜单，让用户无感知这个变化，依旧按照原有的访问方式 `https://example.com/liveadmin`，可以访问到 liveadmin 和 increase 工程的所有页面。  
针对这样一个目标，我们需要解决以下两个核心问题：

1. 两个系统的菜单合成展示;
2. 使用原有访问地址访问两个应用的页面。  

对于第 2 个问题，相信对 qiankun 了解的同学可以和我们一样达成共识，至于第 1 个问题，我们在实践的过程中，通过内部的一些方案得到解决。下文在实现的过程会加以描述。这里我们先给出整个项目落地的效果图：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4521106536/685e/4b67/8df5/6a5bce5de51d2e3943f1d77319aa31ea.png)

可以看到， increase 新工程的一级菜单被追加到了 liveadmin 工程的一级菜单后面，原始地址可以访问到两个工程的所有的菜单。

### 1.3 权限管理

说到 CMS，还需要说一下权限管理系统的实现，下文简称 PMS。  

1. 权限：目前在我们的 PMS 里定义了两种类型的权限：页面权限（决定用户是否可以看到某个页面）、功能权限（决定用户是否可以访问某个功能的 API ）。前端负责页面权限的实现，功能权限则由服务端进行管控。  
2. 权限管理：本文仅阐述页面权限的管理。首先每个前端应用都关联一个 PMS 的权限应用，比如 liveadmin 关联的是 appCode = live_backend 这个权限应用。在前端应用工程部署成功后，通过后门的方式推送前端工程的页面和页面关联的权限码数据到 PMS。风控运营在 PMS 系统中找到对应的权限应用，按照角色粒度分配页面权限，拥有该角色的用户即可访问该角色被分配的页面。  
3. 权限控制：在前端应用被访问时，最外层的模块负责请求当前用户的页面权限码列表，然后根据此权限码列表过滤出可以访问的有效菜单，并注册有效菜单的路由，最后生成一个当前用户权限下的合法菜单应用。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4148260284/a4f3/59b5/ba78/92730fbaeade7a8a4f5bd7c3690438e4.png)

## 二.实现

### 2.1 lookcms 主应用

1. 首先，新建一个 CMS 基础工程，定义它为主应用 lookcms，具有基本的请求权限和菜单数据、渲染菜单的功能。  
入口文件执行以下请求权限和菜单数据、渲染菜单的功能。

```javascript
// 使用 Redux Store 处理数据
const store = createAppStore(); 
// 检查登录状态
store.dispatch(checkLogin());
// 监听异步登录状态数据
const unlistener = store.subscribe(() => {
    unlistener();
    const { auth: { account: { login, name: userName } } } = store.getState();
    if (login) { // 如果已登录，根据当前用户信息请求当前用户的权限和菜单数据
        store.dispatch(getAllMenusAndPrivileges({ userName }));
        subScribeMenusAndPrivileges();
    } else {
        injectView(); // 未登录则渲染登录页面
    }
});
// 监听异步权限和菜单数据
const subScribeMenusAndPrivileges = () => {
    const unlistener = store.subscribe(() => {
        unlistener();
        const { auth: { privileges, menus, allMenus, account } } = store.getState();
        store.dispatch(setMenus(menus)); // 设置主应用的菜单，据此渲染主应用 lookcms 的菜单
        injectView(); // 挂载登录态的视图
        // 启动qiankun，并将菜单、权限、用户信息等传递，用于后续传递给子应用，拦截子应用的请求
        startQiankun(allMenus, privileges, account, store); 
    });
};
// 根据登录状态渲染页面
const injectView = () => {
    const { auth: { account: { login } } } = store.getState();
    if (login) {
        new App().$inject('#j-main');
    } else {
        new Auth().$inject('#j-main');
        window.history.pushState({}, '', `${$config.rootPath}/auth?redirect=${window.location.pathname}`);
    }
};

```

2. 引入 qiankun，注册 liveadmin 和 increase 这两个子应用。  

定义好子应用，按照 qiankun 官方的文档，确定 name、entry、container 和 activeRule 字段，其中 entry 配置注意区分环境，并接收上一步的 menus， privileges等数据，基本代码如下：

```javascript
// 定义子应用集合
const subApps = [{ // liveadmin 旧工程
    name: 'music-live-admin', // 取子应用的 package.json 的 name 字段
    entrys: { // entry 区分环境
        dev: '//localhost:3001',
        // liveadmin这里定义 rootPath为 liveadminlegacy，便于将原有的 liveadmin 释放给主应用使用，以达到使用原始访问地址访问页面的目的。
        test: `//${window.location.host}/liveadminlegacy/`,
        online: `//${window.location.host}/liveadminlegacy/`,
    },
    pmsAppCode: 'live_legacy_backend', // 权限处理相关
    pmsCodePrefix: 'module_livelegacyadmin', // 权限处理相关
    defaultMenus: ['welcome', 'activity']
}, { // increase 新工程
    name: 'music-live-admin-react',
    entrys: {
        dev: '//localhost:4444',
        test: `//${window.location.host}/lookadmin/`,
        online: `//${window.location.host}/lookadmin/`,
    },
    pmsAppCode: 'look_backend',
    pmsCodePrefix: 'module_lookadmin',
    defaultMenus: []
}];
// 注册子应用
registerMicroApps(subApps.map(app => ({
    name: app.name,
    entry: app.entrys[$config.env], // 子应用的访问入口
    container: '#j-subapp', // 子应用在主应用的挂载点
    activeRule: ({ pathname }) => { // 定义加载当前子应用的路由匹配策略，此处是根据 pathname 和当前子应用的菜单 key 比较来做的判断
        const curAppMenus = allMenus.find(m => m.appCode === app.pmsAppCode).subMenus.map(({ name }) => name);
        const isInCurApp = !!app.defaultMenus.concat(curAppMenus).find(headKey => pathname.indexOf(`${$config.rootPath}/${headKey}`) > -1);
        return isInCurApp;
    },
    // 传递给子应用的数据：菜单、权限、账户，可以使得子应用不再请求相关数据，当然子应用需要做好判断
    props: { menus: allMenus.find(m => m.appCode === app.pmsAppCode).subMenus, privileges, account }
})));
// ...
start({ prefetch: false });
```

3. 主应用菜单逻辑

我们基于已有的 menus 菜单数据，使用内部的 UI 组件完成了菜单的渲染，对每一个菜单绑定了点击事件，点击后通过 pushState 的方式，变更窗口的路径。比如点击 a-b 菜单，对应的路由便是 `http://example.com/liveadmin/a/b`，qiankun 会响应路由的变化，根据定义的 activeRule 匹配到对应的的子应用，接着子应用接管路由，加载子应用对应的页面资源。详细的实现过程可以参考 qiankun 源码，基本的思想是清洗子应用入口返回的 html 中的 `<script>` 标签 ，fetch 模块的 Javascript 资源，然后通过 eval 执行对应的 Javascript。

### 2.2 liveadmin 子应用

1. 按照 qiankun 官方文档的做法，在子应用的入口文件中导出相应的生命周期钩子函数。

```javascript
if (window.__POWERED_BY_QIANKUN__) { // 注入 Webpack publicPath, 使得主应用正确加载子应用的资源
    __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}

if (!window.__POWERED_BY_QIANKUN__) { // 独立访问启动逻辑
    bootstrapApp({});
}

export const bootstrap = async () => { // 启动前钩子
    await Promise.resolve(1);
};

export const mount = async (props) => { // 集成访问启动逻辑，接手主应用传递的数据
    bootstrapApp(props);
};

export const unmount = async (props) => {  // 卸载子应用的钩子
    props.container.querySelector('#j-look').remove();
};
```

2. 修改 Webpack 打包配置。

```javascript
output: {
    path: DIST_PATH,
    publicPath: ROOTPATH,
    filename: '[name].js',
    chunkFilename: '[name].js',
    library: `${packageName}-[name]`,
    libraryTarget: 'umd', // 指定打包的 Javascript UMD 格式
    jsonpFunction: `webpackJsonp_${packageName}`,
},
```
    
3. 处理集成访问时，隐藏子应用的头部和侧边栏元素。

```javascript
const App = Regular.extend({
    template: window.__POWERED_BY_QIANKUN__
    ? `
        <div class="g-wrapper" r-view></div>
    `
    : `
        <div class="g-bd">
            <div class="g-hd mui-row">
                <AppHead menus={headMenus}
                    moreMenus={moreMenus}
                    selected={selectedHeadMenuKey}
                    open={showSideMenu}
                    on-select={actions.selectHeadMenu($event)}
                    on-toggle={actions.toggleSideMenu()}
                    on-logout={actions.logoutAuth}></AppHead>
            </div>
            <div class="g-main mui-row">
                <div class="g-sd mui-col-4" r-hide={!showSideMenu}>
                    <AppSide menus={sideMenus} 
                        selected={selectedSideMenuKey}
                        show={showSideMenu}
                        on-select={actions.selectSideMenu($event)}></AppSide>
                </div>
                <div class="g-cnt" r-class={cntClass}>
                    <div class="g-wrapper" r-view></div>
                </div>
            </div>         
        </div>  
    `,
    name: 'App',
    // ...
})
```

4. 处理集成访问时，屏蔽权限数据和登录信息的请求，改为接收主应用传递的权限和菜单数据，避免冗余的 HTTP 请求和数据设置。

```javascript
if (props.container) { // 集成访问时，直接设置权限和菜单
    store.dispatch(setMenus(props.menus))
    store.dispatch({
        type: 'GET_PRIVILEGES_SUCCESS',
        payload: {
            privileges: props.privileges,
            menus: props.menus
        }
    });
} else { // 独立访问时，请求用户权限，菜单直接读取本地的配置
    MixInMenus(props.container);
    store.dispatch(getPrivileges({ userName: name }));
}
if (props.container) {  // 集成访问时，设置用户登录账户
    store.dispatch({
        type: 'LOGIN_STATUS_SUCCESS',
        payload: {
            user: props.account,
            loginType: 'OPENID'
        }
    });
} else { // 独立访问时，请求和设置用户登录信息
    store.dispatch(loginStatus());
}

```

5. 处理集成访问时，路由 base 更改

因为集成访问时要统一 rootPath 为 liveadmin，所以集成访问时注册的路由要修改成主应用的 rootPath 以及新的挂载点。

```javascript
const start = (container) => {
    router.start({
        root: config.base,
        html5: true,
        view: container ? container.querySelector('#j-look') : Regular.dom.find('#j-look')
    });
};
```

### 2.3 increase 子应用

同 liveadmin 子应用做的事类似。

1.  导出相应的生命周期钩子。


```javascript
if (window.__POWERED_BY_QIANKUN__) {
    __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}

const CONTAINER = document.getElementById('container');

if (!window.__POWERED_BY_QIANKUN__) {
    const history = createBrowserHistory({ basename: Config.base });
    ReactDOM.render(
        <Provider store={store()}>
            <Symbol />
            <Router path="/" history={history}>
                {routeChildren()}
            </Router>
        </Provider>,
        CONTAINER
    );
}

export const bootstrap = async () => {
    await Promise.resolve(1);
};

export const mount = async (props) => {
    const history = createBrowserHistory({ basename: Config.qiankun.base });
    ReactDOM.render(
        <Provider store={store()}>
            <Symbol />
            <Router path='/' history={history}>
                {routeChildren(props)}
            </Router>
        </Provider>,
        props.container.querySelector('#container') || CONTAINER
    );
};
export const unmount = async (props) => {
    ReactDOM.unmountComponentAtNode(props.container.querySelector('#container') || CONTAINER);
};
```

2. Webpack 打包配置。

```javascript
output: {
    path: DIST_PATH,
    publicPath: ROOTPATH,
    filename: '[name].js',
    chunkFilename: '[name].js',
    library: `${packageName}-[name]`,
    libraryTarget: 'umd',
    jsonpFunction: `webpackJsonp_${packageName}`,
},
```
3.  集成访问时，去掉头部和侧边栏。

```javascript
if (window.__POWERED_BY_QIANKUN__) { // eslint-disable-line
    return (
        <BaseLayout location={location} history={history} pms={pms}>
            <Fragment>
                {
                    curMenuItem && curMenuItem.block
                        ? blockPage
                        : children
                }
            </Fragment>
        </BaseLayout>
    );
}

```

4.  集成访问时，屏蔽权限和登录请求，接收主应用传递的权限和菜单数据。

```javascript
useEffect(() => {
    if (login.status === 1) {
        history.push(redirectUrl);
    } else if (pms.account) { // 集成访问，直接设置数据
        dispatch('Login/success', pms.account);
        dispatch('Login/setPrivileges', pms.privileges);
    } else { // 独立访问，请求数据
        loginAction.getLoginStatus().subscribe({
            next: () => {
                history.push(redirectUrl);
            },
            error: (res) => {
                if (res.code === 301) {
                    history.push('/login', {
                        redirectUrl,
                        host
                    });
                }
            }
        });
    }
});
```

5. 集成访问时，更改 react-router base。

```javascript
export const mount = async (props) => {
    const history = createBrowserHistory({ basename: Config.qiankun.base });
    ReactDOM.render(
        <Provider store={store()}>
            <Symbol />
            <Router path='/' history={history}>
                {routeChildren(props)}
            </Router>
        </Provider>,
        props.container.querySelector('#container') || CONTAINER
    );
};
```

### 2.4 权限集成（可选步骤）

1. 上文提到，一个前端应用关联一个 PMS 权限应用，那么如果通过微前端的方式组合了每个前端应用，而每个前端子应用如果还依然对应自己的 PMS 权限应用的权限，那么站在权限管理人员的角度而言，就需要关注多个 PMS 权限应用，进行分配权限、管理角色，操作起来都很麻烦，比如两个子应用的页面区分，两个子应用同一权限的角色管理等。因此，需要考虑将子应用对应的 PMS 权限应用也统一起来，这里仅描述我们的处理方式，仅供参考。
2. 要尽量维持原有的权限管理方式（权限管理人员通过前端应用后门推送页面权限码到 PMS，然后到 PMS 进行页面权限分配），则微前端场景下，权限集成需要做的事情可以描述为：
    1. 各个子应用先推送本工程的菜单和权限码数据到到各自的 PMS 权限应用。
    2. 主应用加载各子应用的菜单和权限码数据，修改每个菜单和权限码的数据为主应用对应的 PMS 权限应用数据，然后统一推送到主应用对应的 PMS 权限应用，权限管理人员可以在主应用对应的 PMS 权限应用内进行权限的统一分配管理。  
3. 在我们的实践中，为了使权限管理人员依旧不感知这种拆分应用带来的变化，依旧使用原 liveadmin 应用对应的 appCode = live_backend PMS 权限应用进行权限分配，我们需要把 liveadmin 对应的 PMS 权限应用更改为 lookcms 主应用对应的 PMS 权限应用，而为 liveadmin 子应用新建一个 appCode = live_legacy_backend 的 PMS 权限应用，新的 increase 子应用则继续对应 appCode = look_backend 这个PMS 权限应用。以上两个子应用的菜单和权限码数据按照上一步描述的第 2 点各自上报给对应的 PMS 权限应用。最后 lookcms 主应用同时获取 appCode = live_legacy_backend 和  appCode = look_backend 这两个 PMS 权限应用的前端子应用菜单和权限码数据，修改为 appCode = live_backend 的 PMS 权限应用数据，推送到 PMS，整体的流程如下图所示，左边是原有的系统设计，右边是改造的系统设计。
    
![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4149186794/3671/70a2/c6c7/12ad7ed2fc12fc73591d234e8c112b3e.png)

### 2.5 部署

1. liveadmin 和 increase 各自使用云音乐的前端静态部署系统进行独立部署，主应用 lookcms 也是独立部署。
2. 处理好主应用访问子应用资源跨域的问题。在我们的实践过程中，由于都部署在同一个域下，资源打包遵循了同域规则。

### 2.6 小结

自此，我们已经完成了基于 qiankun LOOK 直播运营后台的微前端的实现，主要是新建了主工程，划分了主应用的职责，同时修改了子工程，使得子应用可以被集成到主应用被访问，也可以保持原有独立访问功能。整体的流程，可以用下图描述：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4197467780/c62e/5b98/25f8/c66c4c8b4be7f1d4e294e456f511b03a.png)


## 三.依赖共享

qiankun 官方并没有推荐具体的依赖共享解决方案，我们对此也进行了一些探索，结论可以总结为：对于 Regularjs，React 等 Javascript 公共库的依赖的可以通过 Webpack 的 externals 和 qiankun 加载子应用生命周期函数以及 import-html-entry 插件来解决，而对于组件等需要代码共享的场景，则可以使用 Webapck 5 的 module federation plugin 来解决。具体方案如下：

3.1. 我们整理出的公共依赖分为两类

3.1.1.  一类是基础库，比如 Regularjs，Regular-state，MUI，React，React Router 等期望在整个访问周期中不要重复加载的资源。

3.1.2.  另一类是公共组件，比如 React 组件需要在各子应用之间互相共享，不需要进行工程间的代码拷贝。

3.2. 对于以上两类依赖，我们做了一些本地的实践，因为还没有迫切的业务需求以及 Webpack 5 暂为发布稳定版（截至本文发布时，Webpack 5 已经发布了 release 版本，后续看具体的业务需求是否上线此部分 feature ），因此还没有在生产环境验证，但在这里可以分享下处理方式和结果。

3.2.1.  对于第一类公共依赖，我们实现共享的期望的是：在集成访问时，主应用可以动态加载子应用强依赖的库，子应用自身不再加载，独立访问时，子应用本身又可以自主加载自身需要的依赖。这里就要处理好两个问题：a. 主应用怎么搜集和动态加载子应用的依赖 b. 子应用怎么做到集成和独立访问时对资源加载的不同表现。

3.2.1.1. 第一个问题，我们需要维护一个公共依赖的定义，即在主应用中定义每个子应用所依赖的公共资源，在 qiankun 的全局微应用生命周期钩子 beforeLoad 中通过插入 `<script>` 标签的方式，加载当前子应用所需的 Javascript 资源，参考代码如下。

```javascript
// 定义子应用的公共依赖
const dependencies = {
    live_backend: ['regular', 'restate'],
    look_backend: ['react', 'react-dom']
};
// 返回依赖名称
const getDependencies = appName => dependencies[appName];
// 构建script标签
const loadScript = (url) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.setAttribute('ignore', 'true'); // 避免重复加载
    script.onerror = () => {
        Message.error(`加载失败${url}，请刷新重试`);
    };
    document.head.appendChild(script);
};
// 加载某个子应用前加载当前子应用的所需资源
beforeLoad: [
    (app) => {
        console.log('[LifeCycle] before load %c%s', 'color: green;', app.name);
        getDependencies(app.name).forEach((dependency) => {
            loadScript(`${window.location.origin}/${$config.rootPath}${dependency}.js`);
        });
    }
],
```

这里还要注意通过 Webpack 来生产好相应的依赖资源，我们使用的是 copy-webpack-plugin 插件将 node_modules 下的 release 资源转换成包成可以通过独立 URL 访问的资源。

```javascript
// 开发
plugins: [
    new webpack.DefinePlugin({
        'process.env': {
            NODE_ENV: JSON.stringify('development')
        }
    }),
    new webpack.NoEmitOnErrorsPlugin(),
    new CopyWebpackPlugin({
        patterns: [
            { from: path.join(__dirname, '../node_modules/regularjs/dist/regular.js'), to: '../s/regular.js' },
            { from: path.join(__dirname, '../node_modules/regular-state/restate.pack.js'), to: '../s/restate.js' },
            { from: path.join(__dirname, '../node_modules/react/umd/react.development.js'), to: '../s/react.js' },
            { from: path.join(__dirname, '../node_modules/react-dom/umd/react-dom.development.js'), to: '../s/react-dom.js' }
        ]
    })
],
// 生产
new CopyWebpackPlugin({
    patterns: [
        { from: path.join(__dirname, '../node_modules/regularjs/dist/regular.min.js'), to: '../s/regular.js' },
        { from: path.join(__dirname, '../node_modules/regular-state/restate.pack.js'), to: '../s/restate.js' },
        { from: path.join(__dirname, '../node_modules/react/umd/react.production.js'), to: '../s/react.js' },
        { from: path.join(__dirname, '../node_modules/react-dom/umd/react-dom.production.js'), to: '../s/react-dom.js' }
    ]
})
```

3.2.1.2. 关于子应用集成和独立访问时，对公共依赖的二次加载问题，我们采用的方法是，首先子应用将主应用已经定义的公共依赖通过 copy-webpack-plugin 和 html-webpack-externals-plugin 这两个插件使用 external 的方式独立出来，不打包到 Webpack bundle 中，同时通过插件的配置，给 `<script>` 标签加上 ignore 属性，那么在 qiankun 加载这个子应用时使用，qiankun 依赖的 import-html-entry 插件分析到 `<script>` 标签时，会忽略加载有 ignore 属性的 `<script>` 标签，而独立访问时子应用本身可以正常加载这个 Javascript 资源。
                

```javascript
plugins: [
    new CopyWebpackPlugin({
        patterns: [
            { from: path.join(__dirname, '../node_modules/regularjs/dist/regular.js'), to: '../s/regular.js' },
            { from: path.join(__dirname, '../node_modules/regular-state/restate.pack.js'), to: '../s/restate.js' },
        ]
    }),
    new HtmlWebpackExternalsPlugin({
        externals: [{
            module: 'remoteEntry',
            entry: 'http://localhost:3000/remoteEntry.js'
        }, {
            module: 'regularjs',
            entry: {
                path: 'http://localhost:3001/regular.js',
                attributes: { ignore: 'true' }
            },
            global: 'Regular'
        }, {
            module: 'regular-state',
            entry: {
                path: 'http://localhost:3001/restate.js',
                attributes: { ignore: 'true' }
            },
            global: 'restate'
        }],
    })
],
```

3.2.2. 针对第二类共享代码的场景，我们调研了 Webpack 5 的 module federation plugin， 通过应用之间引用对方导入导出的 Webpack 编译公共资源信息，来异步加载公共代码，从而实现代码共享。

3.2.2.1. 首先，我们实践所定义的场景是：lookcms 主应用同时提供基于 Regularjs 的 RButton 组件和基于 React 的 TButton 组件分别共享给 liveadmin 子应用和 increase 子应用。

3.2.2.2. 对于 lookcms 主应用，我们定义 Webpack5 module federation plugin 如下：

```javascript
plugins: [
        // new BundleAnalyzerPlugin(),
        new ModuleFederationPlugin({
            name: 'lookcms',
            library: { type: 'var', name: 'lookcms' },
            filename: 'remoteEntry.js',
            exposes: {
                TButton: path.join(__dirname, '../client/exports/rgbtn.js'),
                RButton: path.join(__dirname, '../client/exports/rcbtn.js'),
            },
            shared: ['react', 'regularjs']
        }),
],
```

定义的共享代码组件如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4157571456/cff3/fca5/2029/f0a743c6935049260ee76a56ef513342.png)

3.2.2.3. 对于 liveadmin 子应用，我们定义 Webpack5 module federation plugin 如下：
        
```javascript
plugins: [
    new BundleAnalyzerPlugin(),
    new ModuleFederationPlugin({
        name: 'liveadmin_remote',
        library: { type: 'var', name: 'liveadmin_remote' },
        remotes: {
            lookcms: 'lookcms',
        },
        shared: ['regularjs']
    }),
],
```

使用方式上，子应用首先要在 html 中插入源为 `http://localhost:3000/remoteEntry.js` 的主应用共享资源的入口，可以通过 html-webpack-externals-plugin 插入，见上文子应用的公共依赖 external 处理。  

对于外部共享资源的加载，子应用都是通过 Webpack 的 import 方法异步加载而来，然后插入到虚拟 DOM 中，我们期望参考 Webapck 给出的 React 方案做 Regularjs 的实现，很遗憾的是 Regularjs 并没有相应的基础功能帮我们实现 Lazy 和 Suspense。

通过一番调研，我们选择基于 Regularjs 提供的 r-component API 来条件渲染异步加载的组件。  

基本的思想是定义一个 Regularjs 组件，这个 Regularjs 组件在初始化阶段从 props 中获取要加载的异步组件 name ，在构建阶段通过 Webpack import 方法加载 lookcms 共享的组件 name，并按照 props 中定义的 name 添加到 RSuspense 组件中，同时修改 RSuspense 组件 r-component 的展示逻辑，展示 name 绑定的组件。  

由于 Regularjs 的语法书写受限，我们不便将上述 RSuspense 组件逻辑抽象出来，因此采用了 Babel 转换的方式，通过开发人员定义一个组件的加载模式语句，使用 Babel AST 转换为 RSuspense 组件。最后在 Regularjs 的模版中使用这个 `RSuspense` 组件即可。

```javascript
// 支持定义一个 fallback
const Loading = Regular.extend({
    template: '<div>Loading...{content}</div>',
    name: 'Loading'
});
// 写成一个 lazy 加载的模式语句
const TButton = Regular.lazy(() => import('lookcms/TButton'), Loading);
// 模版中使用 Babel AST 转换好的 RSuspense 组件
`<RSuspense origin='lookcms/TButton' fallback='Loading' />`
```

通过 Babel AST 做的语法转换如下图所示：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4521054999/349e/649e/0c60/38614f3d89eb0c65342671892fec87ca.png)

实际运行效果如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4159789027/aa74/187e/bb1b/e86499cd6aa94727172af70116663448.png)

3.2.2.4. 对于 increase 子应用，我们定义 Webpack 5 module federation plugin 如下：

```javascript
plugins: [
    new ModuleFederationPlugin({
        name: 'lookadmin_remote',
        library: { type: 'var', name: 'lookadmin_remote' },
        remotes: {
            lookcms: 'lookcms',
        },
        shared: ['react']
    }),
],
```

使用方式上，参考 Webpack 5 的官方文档即可，代码如下：

```
const RemoteButton = React.lazy(() => import('lookcms/RButton'));
const Home = () => (
    <div className="m-home">
        欢迎
        <React.Suspense fallback="Loading Button">
            <RemoteButton />
        </React.Suspense>
    </div>
);
```

实际运行效果如下图所示：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4159787994/71b5/09c1/605b/73fe961f37a3ccc3f9375e973bc6ae54.png)

3. 总结

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4158009312/6597/6e27/8fbd/4a8b2aa16cac1fb0035694f1798c2231.png)

## 四.注意事项

1. 跨域资源
    如果你的应用内通过其他方式实现了跨域资源的加载，请注意 qiankun 是通过 fetch 的方式加载所有子应用资源的，因此跨域的资源需要通过 CORS 实现跨域访问。
2. 子应用的 html 标签
    可能你的某个子应用的 html 标签上设置了某些属性或者附带了某些功能，要注意 qiankun 实际处理中剥离掉了子应用的 html 标签，因此如果由设置 rem 的需求，请注意使用其他方式适配。

## 五.未来

1. 自动化
    子应用的接入通过平台的方式接入，当然这需要子应用遵守的规范行程。
2. 依赖共享
    Webpack 5 已经发布了其正式版本，因此对于 module federation plugin 的使用可以提上工作日程。 

## 六.总结

LOOK 直播运营后台基于实际的业务场景，使用 qiankun 进行了微前端方式的工程拆分，目前在生产环境平稳运行了近 4 个月，在实践的过程中，确实在需求确立和接入 qiankun 的实现以及部署应用几个阶段碰到了一些难点，比如开始的需求确立，我们对要实现的主菜单功能有过斟酌，在接入 qiankun 的过程中经常碰到报错，在部署的过程中也遇到内部部署系统的抉择和阻碍，好在同事们给力，项目能顺利的上线和运行。

## 参考资料

- [qiankun](https://qiankun.umijs.org/)
- [Regularjs](http://regularjs.github.io/)
- [Module Federation Plugin](https://webpack.js.org/concepts/module-federation/)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
