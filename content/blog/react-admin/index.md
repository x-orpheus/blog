---
title: 从零搭建中后台框架的核心流程
date: "2020-04-17T01:45:21.246Z"
description: "随着 React 生态的快速发展，社区基于 React 的状态管理方案层出不穷，这意味着很多方案开发者依然要做很多选择，没有约定的团队，沟通成本和跨团队协作成本，以及长期的维护是非常高的，这时候统一一套开发模式就显得尤为重要。 "
---


![](https://p1.music.126.net/YGybUqS1Xpw22FQkmdSMJQ==/109951164829382440.jpg)

> 本文作者：鲍观霞

## 背景
随着 React 生态的快速发展，社区基于 React 的状态管理方案层出不穷，这意味着很多方案开发者依然要做很多选择，没有约定的团队，沟通成本和跨团队协作成本，以及长期的维护是非常高的，这时候统一一套开发模式就显得尤为重要。 

本文将介绍如何从零开始搭建一个高可复用的后台框架，让每一个人都能轻松搭出自己的后台，深入了解自己的框架。 

亲手实践一套项目框架有诸多好处：  
1、业务可定制性强（比如，你们团队有一套业务定制型强的 UI 组件库；你们团队有一套自己的状态管理最佳实践；你们团队有一套复杂的权限管理流程等等）  
> PS: 当然你完全可以找个第三方框架改造成自己想要的样子，但是入手成本、后续的维护成本、技术更新成本都会很高  

2、收敛技术栈、屏蔽底层差异、统一开发体验，帮助团队降低开发和维护成本  
3、成为框架掌控者，技术升级、底层改造随心所欲   

## 写在前面
本文拟讲述从零搭建 React 后台开发框架的核心技术和搭建流程，涉及到的技术并非唯一可选技术栈，你可以随时用你熟悉的技术栈代替它。同时我会尽量降低阅读本文的难度，降低前端开发的门槛，但是还是有一些需要具备的知识： 

```js
- React Hooks       
- React-Redux  
- React Router 5.0   
- Ant Design 4.x  
```

该项目基本搭建了一个企业级管理系统的骨架结构，提供通用功能及扩展需求，不涉及业务逻辑开发，不涉及数据请求，所有数据均为 mock。  

## 开始搭建

### 基础结构及配置
1、 创建基本项目目录和结构  
推荐 Create React App 创建基本项目结构。网上很多相关初始化流程，这里不再赘述。官方教程在[这里](https://www.html.cn/create-react-app/docs/getting-started/)。   
> Create React App 是 React 官方推出的构建 React 单页面应用的脚手架工具。它本身集成了 Webpack，并配置了一系列内置的 loader 和基础的 npm 的脚本，可以很轻松的实现零配置就可以快速开发 React 的应用。

默认的项目目录结构如下:    

```js
├── package.json
├── public                  # 静态目录
│   ├── favicon.ico
│   ├── index.html          # 最终的html的基础模板【默认是单页面应】
│   └── manifest.json
├── src
│   ├── App.css             # App根组件的css
│   ├── App.js              # App组件代码
│   ├── App.test.js
│   ├── index.css           # 启动文件样式
│   ├── index.js            # 启动的文件（执行入口）
│   ├── logo.svg
│   └── serviceWorker.js
└── yarn.lock
```

2、执行命令  

```js
npm start
# or
yarn start
```
打开 http://localhost:3000 在浏览器中查看它。

至此，一个简易的 React 项目就成了。  

## 项目进阶

### React Router 

##### 为什么选动态化路由  
大多数人习惯了配置式路由的开发方式，包括像 Angular，Express, Ember 等，近一点的 包括 Ant Design Pro 和 Umi 框架，都是静态路由配置。React Router V4 之前也沿用了这一方式，但是在 React Router V4 版本做了一次不向前兼容的重构升级。  那 React Router V3 配置式路由的痛点在哪里？为何要动态化？  
我理解这块的 React Router V3 的痛点有以下几点：  
> 为了方便介绍，React Router V3 以下简称 V3；React Router V4 以下简称 V4；

- V3 脱离了 React 组件化思想。V3 虽然形式上是 React 组件，但是其实它与 UI 没有任何关系，只是提供了一条配置项而已。  
这一点可以从相关源码追溯  

```js
const Route = createReactClass({
  // 无关代码

  /* istanbul ignore next: sanity check */
  render() {
    invariant(
      false,
      '<Route> elements are for router configuration only and should not be rendered'
    )
  }
});
```
这里 Route 的 render 方法中，没有做任何 UI 渲染相关的工作，不是一个正宗的组件。  

- V3 路由写法需要满足约定的格式，比如不能将 Route 脱离 Router 使用，这与 React 倡导的“可以声明式灵活性进行组件组装”的理念相违背。
- V3 提供了很多类似生命周期的方法，如：onEnter, onUpdate, onLeave 等用来为处于不同阶段的路由提供钩子方法。但是 React 本身有一套完善的生命周期方法。V3 路由方式的问题在于，它在 React 组件思想之外，设计了一套独立的 API，这有侵入性。  
- 集中式路由层层嵌套，在配置中你需要关心路由所属的祖先层级，页面展示由顶级路由来决定，无法体现动态路由的灵活性。 

当然，V4 版本已经解决了这些问题。在 V4 版本中，抛弃了传统的路由概念，Route 回归组件化。  

V4 开始采用单代码仓库模型结构，每个仓库负责不同的功能场景，他们分别相互独立。
- react-router 路由基础库  
- react-router-dom 浏览器中使用的封装  
- react-router-native React native 封装

本文我们只需要用到 react-router-dom 这个仓库，如果你不明白为什么，看[这里](https://itbilu.com/nodejs/npm/react-router.html)；

你需要掌握 react-router-dom 这些组件：  

- BrowserRouter
- Route 
- Switch 
- Link 

你需要掌握 react-router-dom 这些对象及其方法:  

- history   
- location  
- match  

React Router 从 4.0 开始完全移除中心化配置，不再主张集中式路由，让 React 回归组件化开发，它本身只是提供了导航功能的组件。
这里我们根据推荐的动态化思路设计路由，入口只设计一级菜单，业务管理各自子路由。  

篇幅问题，这里只列举二级路由的情况，多级路由同理。  

1、安装依赖

```js
npm install --save react-router-dom
cd src
touch router.js  // 构造我们的一级路由
```

2、构造 src 目录（你可以灵活定制），我希望它是这样的

```js
.
├── src
│   ├── index.js                      // 入口文件
│   ├── pages
│   │   ├── demo1                     // 一级菜单A
│   │   │   ├── index.js
│   │   │   ├── page1                 // A下面的二级页面a
│   │   │   │   └── index.js
│   │   │   └── page2                 // A下面的二级页面b
│   │   │       └── index.js
│   │   └── demo2                     // 一级菜单B
│   │       ├── index.js
│   │       ├── page1                 // B下面的二级页面a
│   │       │   └── index.js
│   │       └── page2                 // B下面的二级页面b
│   │           └── index.js
│   └── router.js
```

3、构造一级路由    
> router.js

```js
import { Switch, Route } from 'react-router-dom';

// 一级菜单
import demo1 from './pages/demo1';
import demo2 from './pages/demo2';

const router = (
    <Route render={() => {
        return (
            <Switch>
                <Route path="/demo1" component={demo1}></Route>
                <Route path="/demo2" component={demo2}></Route>
            </Switch>
        )
    }}></Route>
);
```

4、让一级路由去管理我们的二级路由  
> pages/demo1/index.js（同级页面类似）

```js
import { Switch, Route } from 'react-router-dom';

import page1 from './page1';
import page2 from './page2';

const Router = ({ match }) => (
    <Switch>
        <Route path={`${match.path}`} exact component={page1} />
        <Route path={`${match.path}/page1`} component={page1} />
        <Route path={`${match.path}/page2`} component={page2} />
    </Switch>
);

```
Switch 中包含 Route，只渲染第一个匹配的路由。因此主路由匹配加上 exact 去精确匹配，不会拦截后面的匹配。   

5、入口文件加入路由  
> src/index.js

```js
import React from 'react';
import ReactDom from 'react-dom';
import { BrowserRouter as Router  } from 'react-router-dom';

import routeChildren from './router';

ReactDom.render(
    <Router>
        {routeChildren}
    </Router>,
    document.getElementById('app')
);
```

这里我们用的是 BrowserRouter 组件，打开 BrowserRouter 文件可以看到它声明了实例属性 history 对象，history 对象的创建来自 history 包的 createBrowserHistory 方法。  

```js
import { createBrowserHistory as createHistory } from "history";

class BrowserRouter extends React.Component {
  
  history = createHistory(this.props);

  render() {
    return <Router history={this.history} children={this.props.children} />;
  }
}
```

history 对象上拥有许多的属性和方法，这些将在后面给我们提供很大的便利，如果你想了解更多关于 history 的访问，看[这里](https://medium.com/@pshrmn/a-little-bit-of-history-f245306f48dd)。  

6、修改我们的业务页面  
> pages/demo1/page1/index.js（同级页面类似）

```js
import React from 'react';

const Page1 = history => {
    return (
        <div>demo2 page1</div>
    );
};

export default Page1;
```
至此，我们的路由设计就完成了。  

现在，npm run start 跑起来看看~

![运行结果](https://p1.music.126.net/YPaulB-whtp815dLGPWsUw==/109951164828590080.gif)

项目路由基本配置结束。  

### 配置式菜单管理  
后台项目中，路由和菜单是组织起一个应用的关键骨架。设计完路由，接下来我们考虑导航菜单管理。  
这一步，我们开始搭建框架核心能力： 菜单配置，UI 集成，状态管理，用户登陆，路由鉴权。    
> 导航应集成在 Layout 结构中，和业务逻辑解耦，为了不让开发者菜单耦合到业务逻辑中，这里采用配置式菜单管理，开发者只需要关心菜单配置。     
> 为了方便理解，UI 组件库选用 Ant Design。

1、 菜单配置 & UI 集成    
> 既然打算做配置式菜单，那么我们设计一个菜单配置，根据配置生成菜单。 

```js
cd src
touch menuConfig.js
```

menuConfig.js

```js
const menu = [
    {
        path: 'demo1',
        name: '一级菜单A',
        children: [{
            name: 'subnav1',
            path: 'page1'
        },
        {
            name: 'subnav2',
            path: 'page2'
        }]
    },
    {
        path: 'demo2',
        name: '一级菜单B'
        children: [{
            name: '测试',
            path: 'page2'
        }]
    }
];
```
当然，你可以在配置中加入任意元素来丰富你的配置，比如 icon，redirect 等等； 

2、生成菜单配置  
> 接下来需要根据这份配置，构造我们的导航，看一下 Ant Design 提供的 Menu 组件需要哪些数据？
官方给的 demo 是： 
 
```js
<Menu
    theme="dark"
    mode="inline"
    defaultSelectedKeys={['2']}>
    <Menu.Item key="1">nav1</Menu.Item>
    <Menu.Item key="2">nav2</Menu.Item>
</Menu>
```  
为了让我们的配置能很方便的生成 Menu 组件，我们需要写个方法把我们的菜单转成平铺形式。用 path 作为 key，可以很方便的解析 selectKey。  
我们希望我们的菜单可以根据 path 选中或切换，我们需要根据 MenuConfig 构造这样一份结构：  

```js
{
  "selectMainMenu": {    // 当前访问一级菜单信息【用于标记一级菜单选中】
    "path": "demo1",
    "name": "一级菜单A" 
  },
  "mainMenu": [          // 当前所有一级菜单信息【用于渲染一级导航】
    {
      "path": "demo1",
      "name": "一级菜单A"
    },
    {
      "path": "demo2",
      "name": "一级菜单B" 
    }
  ],
  "subMenu": [           // 当前一级菜单下的所有子菜单【用于渲染子导航】
    {
      "name": "subnav1",
      "path": "page1",
    {
      "name": "subnav2",
      "path": "page2"
    }
  ],
  "paths": [
    {
      "name": "一级菜单A",
      "path": "/demo1"
    }
  ],
  "prePath": "/demo1"   // 一级路由+二级路由作为子菜单唯一 key【标识二级菜单状态】
}
```
生成的 HeadMenu 组件：  

```js
<Menu theme="dark"
    mode="horizontal"
    selectedKeys={[selectMainMenu.path]} >
    {
        mainMenu.map(item => {
            <Menu.Item key={item.path}>
                <Link to={item.path === '/' ? '/' : `/${item.path}`}>{item.name}</Link>
            </Menu.Item>
        })
    }
</Menu>
```
生成的 SideMenu 组件：  

```js
<Menu theme="dark"
    mode="horizontal"
    selectedKeys={[currentPath]} >
    {
        subMenu.map(item => {
            <Menu.Item key={`${prePath}/${item.path}`}>
                <Link to={item.path === '/' ? '/' : `${prePath}/${item.path}`}>
                    <span>{item.name}</span>
                </Link>
            </Menu.Item>
        })
    }
</Menu>
```
> 这一步转换并不复杂，自行实现。主要提供根据路由 path 标记菜单状态的思路。    

3、Layout 集成 Menu 组件  

```js
const BaseLayout = ({ location, children }) => {
    const { pathname } = location;

    const [menuInfo, setMenuInfo] = useState({});

    // 菜单信息随着路径变化
    useEffect(() => {
        const newInfo = pathChange(pathname, menuConfig);
        setMenuInfo(newInfo);
    }, [pathname]);

    return (
        <Layout>
            <Header className="header" >
                <div className="logo" />
                <HeadMenu menuInfo={menuInfo}></HeadMenu>
            </Header>
            <Content>
                <Layout>
                    <Sider width={200}>
                        <SideMenu menuInfo={menuInfo}></SideMenu>
                    </Sider>
                    <Content>{children}</Content>
                </Layout>
            </Content>
        </Layout>
    )
}
```

4、将 Layout 应用于所有路由  
> 改造一下我们的路由入口（加上 Layout 布局结构）：  

```js
import React from 'react';
import { Switch, Route } from 'react-router-dom';

import BaseLayout from './layouts';

// 各个一级路由
import demo1 from './pages/demo1';
import demo2 from './pages/demo2';

const router = (
    <Route render={(props) => {
        return (
            <BaseLayout {...props}>
                <Switch>
                    <Route path="/demo1" component={demo1}></Route>
                    <Route path="/demo2" component={demo2}></Route>
                </Switch>
            </BaseLayout>
        )
    }}></Route>
);

export default router;
```

我们的配置式菜单就完成了，它看起来是这样的：  

![菜单](https://p1.music.126.net/nSHXNqryW2rMHQYKIn1QGw==/109951164828550175.gif)

#### 路由鉴权  
toB 项目最大不同于 toC 的逻辑就在于权限控制，这也几乎是后台框架集成最复杂的部分。  

在一个大型系统中，一个误操作产生的后果可能是非常严重的，权限管理是不可或缺的一个环节。  

权限系统的存在最大程度上避免了这类问题 — 只要是界面上出现的功能，都是可以操作或不会产生严重后果的。
每个帐号登陆后只能看到和自己有关的信息，可以更快速地理解自己工作范围内的业务。 

##### *后台权限的基本构成*
权限设计主要由三个要素构成：帐号，角色，权限。  

```js
- 帐号：登录系统的唯一身份识别，一个账号代表一个用户；  

- 角色：为账号批量分配权限。在一个系统中，不可能为每个帐号订制权限，所以给同一类帐号赋予一个“角色”，以达到批量分配权限的目的；  

- 权限：对于前端来说，权限又分为页面权限和操作权限；其中页面权限分为菜单权限和路由权限；  
```

设计基本思路为： 

![](https://p1.music.126.net/RDHiU8BjnvpyNrp-OdTGHg==/109951164828548221.png)

1、登陆实现

login.js 
 
```js
import { connect } from 'react-redux';

const Login = ({
    loginStatus,
    location,
    setLoginInfo,
    history
}) => {
    let { redirectUrl = '/' } = location.state || {};

    // 获取登录信息伪代码
    const onFinish = values => {
        /**** 此处去获取登录信息并存放在全局 Store ****/
        setLoginInfo({
            username: '小A',
            role: 1
        });
        history.push(redirectUrl);
    };

    return (
        <div className="login layer">
            <Form
                name="basic"
                onFinish={onFinish} >
                <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '输入用户名' }]} >
                    <Input />
                </Form.Item>
                <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: true, message: '输入密码' }]} >
                    <Input.Password />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit">登陆</Button>
                </Form.Item>
            </Form>
        </div>
    );
};

const mapStateToProps = state => ({
    loginStatus: state.login.loginStatus
});

const mapDispatchToProps = dispatch => ({
    setLoginInfo: (...args) => dispatch(setLoginInfo(...args))
});

export default connect(
    mapStateToProps,
	mapDispatchToProps
)(Login);
```
connect() 的作用是将 Store 和 Component 连接起来。connect负责从 Redux state 树中读取部分数据，并通过 Props 来把这些数据提供给要渲染的组件。也传递 action 函数到 Props。  
connect 函数接收两个参数，一个 mapStateToProps，把 Redux 的 state，转为组件的 Props；还有一个参数是 mapDispatchToprops,
把发射 actions 的方法，转为 Props 属性函数。

2、用户状态管理  
store/login.js存储

```js
// 设置state初始值
const initState = {
    loginStatus: false,
    userInfo: {
        username: '',
        role: -1  // 用户权限标识
    }
};

const SET_LOGIN = 'SET_LOGIN';

// action
export const setLoginInfo = (payload) => {
    return {
        payload,
        type: SET_LOGIN
    };
};

// reducer
export const loginReducer = (state = initState, action) => {
    switch (action.type) {
        case SET_LOGIN:
            return {
                ...state,
                loginStatus: true,
                userInfo: action.payload
            };
        default:
            return state;
    }
};
```

store/index.js

```js
import { createStore, combineReducers } from 'redux';
import { loginReducer } from './login';

const allReducers = {
    login: loginReducer
};

const reducers = combineReducers(allReducers);

const store = createStore(reducers);

export default store;
```

入口 index.js 增加 Provider 下发 Store  

```js
import React from 'react';
import ReactDom from 'react-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './redux';
import routeChildren from './router';

ReactDom.render(
    <Provider store={store}>
        <Router>
            {routeChildren}
        </Router>
    </Provider>,
    document.getElementById('app')
);
```
Provider 的作用是让 Store 在整个 App 中可用。

3、登陆校验  
> 我们需要在所有页面访问之前，校验用户登录状态，以免发生重复登陆；
我们的 Layout 管理着所有页面入口，需要改造 layout.js   

layout.js 增加如下逻辑：  

```js
const loginPath = '/login';
const { pathname } = location;
const redirectUrl = pathname === loginPath ? '/' : pathname;

useEffect(() => {
    <!--校验是否登陆-->
    if (loginStatus) {
        history.push(redirectUrl);
    } else {
        history.push('/login', {
            redirectUrl
        });
    }
}, []);

if (pathname === '/login') {
    return <div>{children}</div>;
}
```
这一步需要把当前页面作为 redirectUrl 带到登陆页，登陆后需返回原路径。  

为了看演示效果，我们需要稍微调整我们的样式，样式效果自行添加。 

![登陆拦截](https://p1.music.126.net/Smoh4RHCMuS3NX3ipi3z0w==/109951164828781858.gif)

3、用户鉴权  
> 后台系统鉴权是个复杂且差异化很大的话题，本文只做抛砖引玉，为了方便理解思路，只介绍一种简单的权限方案。  

我们设定，权限标识越小，拥有的权限越高，逐级之间为包含关系。  
构造权限思路如下：  

![](https://p1.music.126.net/MY5_WxbLZh29ddLUpAU3dA==/109951164828550630.png)


根据这份权限方案，menuConfig.js 需要增加权限标识：  

```js
const menu = [
    {
        path: 'demo1',
        name: '一级菜单A',
        role: [4],   // demo1 权限标识
        children: [{
            name: 'subnav1',
            path: 'page1',
            role: [2]     // demo1/page1 权限标识
        },
        {
            name: 'subnav2',
            path: 'page2',
            role: [2]    // demo1/page2 权限标识
        },
        {
            name: 'subnav3',
            path: 'page3',
            role: [3]     // demo1/page3 权限标识
        },
        {
            name: 'subnav4',
            path: 'page4',
            role: [4]      // demo1/page4 权限标识
        }]
    },
    {
        path: 'demo2',
        name: '一级菜单B',
        role: [4],          // demo2 权限标识
        children: [{
            name: '测试',
            path: 'page2',
            role: [3]       // demo1/page2 权限标识
        }]
    }
];
```
layout.js增加鉴权拦截，其余逻辑不变： 
     
```js
let authChildren = children;
const { role = -1 } = userInfo;
const [menuInfo, setMenuInfo] = useState({});

// 用户角色配置，预留
const filterMenu = menus => menus
    .filter(item => (role !== -1 && item.role >= role))
    .map((item) => {
        if (item.children && item.children.length > 0) {
            return { ...item, children: filterMenu(item.children) };
        }
        return item;
    });

useEffect(() => {
    // 过滤菜单权限
    const newMenuInfo = filterMenu(menuConfig);
    
    const curMenuInfo = onPathChange(pathname, newMenuInfo);
    setMenuInfo(curMenuInfo);
}, [pathname]);

// 过滤路由权限
const curPathAuth = menuInfo.paths
    ? menuInfo.paths.find(item => item.path === pathname) : {};

// 路由权限拦截
if (JSON.stringify(curPathAuth) === '{}') {
    authChildren = (
        <div className="n-privileges">
            <p>对不起你没有访问该页面的权限</p>
        </div>
    );
}
```  
为了演示权限效果，我们增加用户权限切换。  

![](https://p1.music.126.net/NUwGo4gj9sW1dHme0JlkMA==/109951164828943304.gif)

框架结构基本形成。  

## 后续
当然，系统还需更多细节的完善，我们仅仅完成了核心流程。   
多人合作的系统发展到后期的时候，我们需要考虑性能问题、跨域配置、数据 mock、eslint 等等。不属于核心流程的内容，在这里仅作讨论。 

1、按需加载  
单页应用的首屏渲染一直都是个大问题。优化资源加载，我们可以参考 React 16.3.0 新增的 Suspense 和 lazy 特性。  
React.lazy 提供了按需加载组件的方法，并且方法内部必须用到 import() 语法导入组件，配合 webpack 特性：遇到 import...from 语法会将依赖的包，合并到 bundle.js 中。可以如此实现：  
```js
const page1 = React.lazy(() => import(/* webpackChunkName: "page1" */'./page1'));
```
即可将 page1 打包为名为 page1.js 的文件。   
配合 React.Suspense 可以很方便的实现懒加载过渡动画。  

2、通用 NotFound  
我们的路由设计使得我们能很方便的处理 Not Found 的情况。  
在每一级 Switch 最后加上 path="*" 可以拦截所有未匹配路由。

```js
<Switch>
    <Route path={`${match.path}`} exact component={Home} />
    <Route path={`${match.path}/page1`} component={page1} />
    <Route path={`${match.path}/page2`} component={page2} />
    <Route path="*" component={NotFound} />
</Switch>
```

3、跨域配置  
当我们本地开发做服务代理的时候，一般会选择在 dev_server 处进行代理。

```js
devServer: {
    proxy: {
        '/api': {
            target: 'http://www.baidu.com/',
            changeOrigin: true,
            secure: false,
        },
        '/api2': {
            .....
        }
    }
}
```

但这种方法在 create-react-app 生成的应用中无效，对于这种情况，create-react-app 的版本在低于 2.0 的时候可以在 package.json 增加 proxy 配置， 配置如下： 

```js
"proxy": {
    '/api': {
        target: 'http://www.baidu.com/',
        changeOrigin: true,
        secure: false,
    },
}
```

create-react-app 的版本高于 2.0 版本的时候在 package.json 只能配置 string 类型，可以考虑用 http-proxy-middleware 代替。

src/setupProxy.js
```js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
    })
  );
};
```

当然，你可以也执行 npm run eject 命令，暴露 webpack 等配置，去修改 devServer。  

4、数据 mock 能力  
项目开发中，前端工程师需要依赖后端工程师的数据接口以及后端联调环境。但是其实我们也可以根据后端接口文档在接口没有开发完成之前自己 mock 数据进行调试，让接口消费者脱离接口生产者进行开发。  

mock 数据常见的解决方案有：  
- 在代码层硬编码
- 在前端JS中拦截
- 代理软件 (Fiddler、Charles)
- mock server

这些方案要么对代码有侵入性，要么数据无法溯源，要么成本较高。  
云音乐已开源一款 mock 平台，能帮助开发者管理接口。欢迎入坑：[NEI](https://github.com/x-orpheus/nei)

本文仅以个人经验产出，如对本文有任何意见和建议，欢迎讨论。  

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
