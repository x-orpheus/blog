---
title: 捕获 React 异常
date: "2020-01-14T01:55:01.704Z"
description: "韩国某著名男子天团之前在我们平台上架了一张重磅数字专辑，本来是一件喜大普奔的好事，结果上架后投诉蜂拥而至。部分用户反馈页面打开就崩溃，紧急排查后发现真凶就是下面这段代码。"
---

<img src="https://p1.music.126.net/yQQYPREBOFr9d_1MQJfLiQ==/109951164622691316.png">


> 此项目为云音乐营收组稳定性工程的前端部分，本文作者 [章伟东](https://github.com/xff1874)，项目其他参与者[赵祥涛](https://sylvenas.github.io/)

## 一个 bug 引发的血案

韩国某著名男子天团之前在我们平台上架了一张重磅数字专辑，本来是一件喜大普奔的好事，结果上架后投诉蜂拥而至。部分用户反馈页面打开就崩溃，紧急排查后发现真凶就是下面这段代码。

```js
  render() {
     const { data, isCreator, canSignOut, canSignIn } = this.props;
     const {  supportCard, creator, fansList, visitorId, memberCount } = data;
     let getUserIcon = (obj) => {
         if (obj.userType == 4) {
             return (<i className="icn u-svg u-svg-yyr_sml" />);
         } else if (obj.authStatus == 1) {
             return (<i className="icn u-svg u-svg-vip_sml" />);
         } else if (obj.expertTags && creator.expertTags.length > 0) {
             return (<i className="icn u-svg u-svg-daren_sml" />);
         }
         return null;
     };
     ...
  }
```

这行 `if (obj.expertTags && creator.expertTags.length )` 里面的 `creator` 应该是 `obj`，由于手滑，不小心写错了。

对于上面这种情况，`lint` 工具无法检测出来，因为 `creator` 恰好也是一个变量，这是一个纯粹的逻辑错误。

后来我们紧急修复了这个 bug，一切趋于平静。事情虽然到此为止，但是有个声音一直在我心中回响 **如何避免这种事故再次发生**。 对于这种错误，堵是堵不住的，那么我们就应该思考设计一种兜底机制，能够隔离这种错误，保证在页面部分组件出错的情况下，不影响整个页面。

<span id = "ein"></span>
## ErrorBoundary 介绍

从 React 16 开始，引入了 Error Boundaries 概念，它可以捕获它的**子组件**中产生的错误，记录错误日志，并展示降级内容，具体 [官网地址](https://reactjs.org/docs/error-boundaries.html)。

> Error boundaries are React components that **catch JavaScript errors anywhere in their child component tree, log those errors, and display a fallback UI** instead of the component tree that crashed

这个特性让我们眼前一亮，精神为之振奋，仿佛在黑暗中看到了一丝亮光。但是经过研究发现，`ErrorBoundary` 只能捕获子组件的 render 错误，有一定的局限性，以下是无法处理的情况：

- [事件处理函数](https://github.com/facebook/react/issues/11409)（比如 onClick,onMouseEnter)
- [异步代码](https://github.com/facebook/react/issues/11334)（如 requestAnimationFrame，setTimeout,promise)
- 服务端渲染
- ErrorBoundary 组件本身的错误。

<span id="jump"></span>
### 如何创建一个 `ErrorBoundary` 组件

只要在 `React.Component` 组件里面添加 `static getDerivedStateFromError()` 或者 `componentDidCatch()` 即可。前者在错误发生时进行降级处理，后面一个函数主要是做日志记录，[官方代码](https://reactjs.org/docs/error-boundaries.html) 如下

```js
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    logErrorToMyService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}
```

可以看到 `getDerivedStateFromError` 捕获子组件发生的错误，设置 `hasError` 变量，`render` 函数里面根据变量的值显示降级的ui。

至此一个 ErrorBoundary 组件已经定义好了，使用时只要包裹一个子组件即可，如下。

<span id = "errorwrap"></span>
```js
<ErrorBoundary>
  <MyWidget />
</ErrorBoundary>
```

### Error Boundaries 的普遍用法。

看到 Error Boundaries 的使用方法之后，大部分团队的都会遵循官方的用法，写一个 `errorBoundaryHOC`,然后包裹一下子组件。下面 scratch 工程的一个例子

```js
export default errorBoundaryHOC('Blocks')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(Blocks)
);
```
其中 `Blocks` 是一个 UI 展示组件，`errorBoundaryHOC` 就是错误处理组件，
具体源码可以看 [这里](https://github.com/LLK/scratch-gui/blob/develop/src/containers/blocks.jsx)

### 普遍用法的困境

上面的方法在 export 的时候包裹一个 `errorBoundaryHOC`。
对于新开发的代码，使用比较方便，但是对于已经存在的代码，会有比较大的问题。

因为 export 的格式有 [多种](https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export)

```js
export class ClassName {...}
export { name1, name2, …, nameN };
export { variable1 as name1, variable2 as name2, …, nameN };
export * as name1 from …

```

所以如果对原有代码用 `errorBoundaryHOC` 进行封装，会改变原有的代码结构，如果要后续不再需要封装删除也很麻烦，方案实施成本高，非常棘手。

所以，我们在考虑是否有一种方法可以比较方便的处理上面的问题。

## 青铜时代 - BabelPlugin

在碰到上诉困境问题之后，我们的思路是：通过脚手架自动对子组件包裹错误处理组件。设计框架如下图：


![](https://p1.music.126.net/tysmu4OsQHxfA8SFMPVvlg==/109951164599347997.png)


简而言之分下面几步：

1. 判断是否是 React 16 版本
2. 读取配置文件
3. 检测是否已经包裹了 `ErrorBoundary` 组件。 如果没有，走 patch 流程。如果有，根据 `force` 标签判断是否重新包裹。
4. 走包裹组件流程（图中的 patch 流程）：

   > a. 先引入错误处理组件

   > b. 对子组件用 `ErrorBoundary` 包裹

配置文件如下（.catch-react-error-config.json）：

```json
{
  "sentinel": {
    "imports": "import ServerErrorBoundary from '$components/ServerErrorBoundary'",
    "errorHandleComponent": "ServerErrorBoundary",
    "filter": ["/actual/"]
  },
  "sourceDir": "test/fixtures/wrapCustomComponent"
}
```

patch 前源代码：

```js
import React, { Component } from "react";

class App extends Component {
  render() {
    return <CustomComponent />;
  }
}
```

读取配置文件 patch 之后的代码为：

```js
//isCatchReactError
import ServerErrorBoundary from "$components/ServerErrorBoundary";
import React, { Component } from "react";

class App extends Component {
  render() {
    return (
      <ServerErrorBoundary isCatchReactError>
        {<CustomComponent />}
      </ServerErrorBoundary>
    );
  }
}
```

可以看到头部多了

`import ServerErrorBoundary from '$components/ServerErrorBoundary'`

然后整个组件也被 `ServerErrorBoundary` 包裹，`isCatchReactError` 用来标记位，主要是下次 patch 的时候根据这个标记位做对应的更新，防止被引入多次。

这个方案借助了 [babel plugin](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)，在代码编译阶段自动导入 ErrorBoundary 并批量组件包裹，核心代码：

```js
const babelTemplate = require("@babel/template");
const t = require("babel-types");

const visitor = {
  Program: {
    // 在文件头部导入 ErrorBoundary
    exit(path) {
      // string 代码转换为 AST
      const impstm = template.default.ast(
        "import ErrorBoundary from '$components/ErrorBoundary'"
      );
      path.node.body.unshift(impstm);
    }
  },
  /**
   * 包裹 return jsxElement
   * @param {*} path
   */
  ReturnStatement(path) {
    const parentFunc = path.getFunctionParent();
    const oldJsx = path.node.argument;
    if (
      !oldJsx ||
      ((!parentFunc.node.key || parentFunc.node.key.name !== "render") &&
        oldJsx.type !== "JSXElement")
    ) {
      return;
    }

    // 创建被 ErrorBoundary 包裹之后的组件树
    const openingElement = t.JSXOpeningElement(
      t.JSXIdentifier("ErrorBoundary")
    );
    const closingElement = t.JSXClosingElement(
      t.JSXIdentifier("ErrorBoundary")
    );
    const newJsx = t.JSXElement(openingElement, closingElement, oldJsx);

    // 插入新的 jxsElement, 并删除旧的
    let newReturnStm = t.returnStatement(newJsx);
    path.remove();
    path.parent.body.push(newReturnStm);
  }
};
```

此方案的核心是对子组件用自定义组件进行包裹，只不过这个自定义组件刚好是 ErrorBoundary。如果需要，自定义组件也可以是其他组件比如 log 等。

完整 GitHub 代码实现 [这里](https://github.com/xff1874/react-error-sentinel)

虽然这种方式实现了错误的捕获和兜底方案，但是非常复杂，用起来也麻烦，要配置 Webpack 和 `.catch-react-error-config.json` 还要运行脚手架，效果不令人满意。


## 黄金时代 - Decorator

在上述方案出来之后，很长时间都找不到一个优雅的方案，要么太难用（babelplugin）, 要么对于源码的改动太大（HOC）, 能否有更优雅的实现。

于是就有了装饰器 (Decorator) 的方案。

装饰器方案的源码实现用了 TypeScript，使用的时候需要配合 Babel 的插件转为 ES 的版本，具体看下面的使用说明

TS 里面提供了装饰器工厂，类装饰器，方法装饰器，访问器装饰器，属性装饰器，参数装饰器等多种方式，结合项目特点，我们用了类装饰器。

### 类装饰器介绍

> 类装饰器在类声明之前被声明（紧靠着类声明）。 类装饰器应用于类构造函数，可以用来监视，修改或替换类定义。

下面是一个例子。

```ts
function SelfDriving(constructorFunction: Function) {
    console.log('-- decorator function invoked --');
    constructorFunction.prototype.selfDrivable = true;
}

@SelfDriving
class Car {
    private _make: string;
    constructor(make: string) {
        this._make = make;
    }
}
let car: Car = new Car("Nissan");
console.log(car);
console.log(`selfDriving: ${car['selfDrivable']}`);
```

output:

```ts
-- decorator function invoked --
Car { _make: 'Nissan' }
selfDriving: true
```

上面代码先执行了 `SelfDriving` 函数，然后 car 也获得了 `selfDrivable` 属性。

可以看到 Decorator 本质上是一个函数，也可以用`@+函数名`装饰在类，方法等其他地方。 装饰器可以改变类定义，获取动态数据等。

完整的 TS 教程 Decorator 请参照 [官方教程](https://www.tslang.cn/docs/handbook/decorators.html)

于是我们的错误捕获方案设计如下

```jsx
@catchreacterror()
class Test extends React.Component {
  render() {
    return <Button text="click me" />;
  }
}
```

`catchreacterror` 函数的参数为 `ErrorBoundary` 组件，用户可以使用自定义的 `ErrorBoundary`，如果不传递则使用默认的 `DefaultErrorBoundary` 组件；

`catchreacterror` 核心代码如下：
```js
import React, { Component, forwardRef } from "react";

const catchreacterror = (Boundary = DefaultErrorBoundary) => InnerComponent => {
  class WrapperComponent extends Component {
    render() {
      const { forwardedRef } = this.props;
      return (
        <Boundary>
          <InnerComponent {...this.props} ref={forwardedRef} />
        </Boundary>
      );
    }
  }
};
```

返回值为一个 HOC，使用 `ErrorBoundary` 包裹子组件。

### 增加服务端渲染错误捕获

在 [介绍](#ein) 里面提到，对于服务端渲染，官方的 `ErrorBoundary` 并没有支持，所以对于 SSR 我们用 `try/catch` 做了包裹：

1. 先判断是否是服务端 `is_server`：

```js
function is_server() {
  return !(typeof window !== "undefined" && window.document);
}
```

2. 包裹

```js
if (is_server()) {
  const originalRender = InnerComponent.prototype.render;

  InnerComponent.prototype.render = function() {
    try {
      return originalRender.apply(this, arguments);
    } catch (error) {
      console.error(error);
      return <div>Something is Wrong</div>;
    }
  };
}
```

最后，就形成了 `catch-react-error` 这个库，方便大家捕获 React 错误。

<span id ="usage"></span>
### catch-react-error 使用说明

#### 1. 安装 `catch-react-error`

```sh
npm install catch-react-error
```

#### 2. 安装 ES7 Decorator babel plugin

```sh
npm install --save-dev @babel/plugin-proposal-decorators
npm install --save-dev @babel/plugin-proposal-class-properties

```

添加 babel plugin

```json
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", { "legacy": true }],
    ["@babel/plugin-proposal-class-properties", { "loose": true }]
  ]
}
```

#### 3. 导入 catch-react-error

```jsx
import catchreacterror from "catch-react-error";
```

#### 4. 使用 `@catchreacterror` Decorator

```jsx
@catchreacterror()
class Test extends React.Component {
  render() {
    return <Button text="click me" />;
  }
}
```

`catchreacterror` 函数接受一个参数：`ErrorBoundary`（不提供则默认采用 `DefaultErrorBoundary`)


#### 5. 使用 `@catchreacterror` 处理 FunctionComponent

上面是对于`ClassComponent`做的处理，但是有些人喜欢用函数组件，这里也提供使用方法，如下。

```js
const Content = (props, b, c) => {
  return <div>{props.x.length}</div>;
};

const SafeContent = catchreacterror(DefaultErrorBoundary)(Content);

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>这是正常展示内容</h1>
      </header>
      <SafeContent/>
    </div>
  );
}

```

#### 6. 如何创建自己所需的 Custom Error Boundaries

参考上面 [如何创建一个 `ErrorBoundary` 组件](#jump), 然后改为自己所需即可，比如在 `componentDidCatch` 里面上报错误等。


完整的 GitHub 代码在此 [catch-react-error](https://github.com/x-orpheus/catch-react-error)。


> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！

