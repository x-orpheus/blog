---
title: 漫谈 React Fiber
date: 2020-12-16T02:55:23.965Z
description: 本文来自于内部分享，整理成文，涉及两部分内容，ReactFiber 和 Custom Renderer，探究一些 Fiber 的起因及 Fiber 衍生产物 Custom Renderer 的实施。
---

![head](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4998532939/c792/24d6/4d93/9fd1555b980bb76f2fe02efb17faafba.png)

> 本文作者：[葛星](https://www.zhihu.com/people/windy_home)

## 背景

React 实现了使用 Virtual DOM 来描述 UI 的方式，通过对比两棵树的差异最小化的更新 DOM，这样使得用户的代码变的傻瓜，但是同时也来带了一些问题。这个核心的问题就在于 diff 计算并非是免费的，在元素较多的情况下，整个 diff 计算的过程可能会持续很⻓时间，造成动画丢帧或者很难响应用户的操作，造成用户体验下降。

为什么会出现这个问题，主要是因为下面两个原因：

1. React < 15 的版本一直采用 Stack Reconciler 的方式进行 UI 渲染(之所以叫 Stack Reconciler 是相对于
   Fiber Reconciler 而言) , 而 Stack Reconciler 的实现是采用了递归的方式，我们知道递归是无法被打断，每当有需要更新的时候，React 会从需要更新的节点开始一直执行 diff ，这会消耗大量的时间。
2. 浏览器是多线程的，包含渲染线程和 JS 线程，而渲染线程和 JS 线程是互斥的，所以当 JS 线程占据大量时间的时候，UI 的响应也会被 block 住。

上面两个原因缺一不可，因为如果 JS 执行， UI 不会阻塞 ，其实用户也不会有所感知。下面让我们看下比较常见的性能优化手段。

## 常见的性能优化手段

一般我们会采用下面的方式来优化性能

### 防抖

对函数使用防抖的方式进行优化。这种方式将 UI 的更新推迟到用户输入完毕。这样用户在输入的时候就不会感觉到卡顿。

```jsx
class App extends Component {
  onChange = () => {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(
      () =>
        this.setState({
          ds: [],
        }),
      200
    );
  };
  render() {
    return (
      <div>
        <input onChange={this.onChange} />
        <list ds={this.state.ds} />
      </div>
    );
  }
}
```

### 使用 PureComponent || shouldComponentUpdate

通过 shouldComponentUpdate 或者 PureComponent 的方式进行优化。这种方式通过浅对比前后两次的 props 和 state 让 React 跳过不必要的 diff 计算。

```jsx
class App extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    return (
      !shallowEqual(nextProps, this.props) ||
      !shallowEqual(nextState, this.state)
    );
  }
  render() {
    return (
      <div>
        <input onChange={this.onChange} />
        <list ds={this.state.ds} />
      </div>
    );
  }
}
```

这种方式有下面三个需要注意的点：

a. 只能采用**浅比较**的方式，这样更深层次的对象更新的时候无法比较，而如果采用深比较的方式，如果你比较对象的时间比 React diff 的时间还要久，得不偿失。

b. 对象的引用关系，在对于 state 的赋值的时候，主要注意**对象的引用关系**，比如下面的代码就会让这个组件无法更新

```jsx
class App extends PureComponent {
  state = {
    record: {},
  };
  componentDidMount() {
    const { record } = this.state;
    record.name = "demo";
    this.setState({
      record,
    });
  }
  render() {
    return <>{this.state.record.name}</>;
  }
}
```

c. **函数的执行值发生改变**。这种情况在于函数里面用到了 props 和 state 之外的变量，这些变量可能发生了改变

```jsx
class App extends PureComponent {
  cellRender = (value, index, record) => {
    return record.name + this.name;
  };
  render() {
    return <List cellRender={this.cellRender} />;
  }
}
```

### 对象劫持

通过类似于 Vue@2.x 和 Mobx 的方式实现观察对象来进行局部更新。这种方式要求用户在使用的时候避免使用 setState 方法。

```jsx
@inject("color")
@observer
class Btn extends React.Component {
  render() {
    return (
      <button style={{ color: this.props.color }}>{this.props.text}</button>
    );
  }
}

<Provider color="red">
  <MessageList>
    <Btn />
  </MessageList>
</Provider>;
```

对于这个例子，color 变化的时候, 只有 Button 会重新渲染。

其实对于80%的情况，上面的三种方式已经满足这些场景的性能优化，但是上面所说的都是在应用层面的优化，其实对于开发者提出了一定的要求，有什么方式可以在底层进行一些优化呢?

## RequestIdleCallback

非常庆幸的是浏览器推出了**requestIdleCallback** 的 API, 这个 API 可以让浏览器在空闲时期的时候执行脚本，大概以下面的方式使用:

```jsx
requestIdleCallback((deadline) => {
  if (deadline.timeRemaining() > 0) {
  } else {
    requestIdleCallback(otherTasks);
  }
});
```

上面的例子主要是说如果浏览器在当前帧没有空闲时间了，则开启另一个空闲期调用。（注：大概在 2018 年的时候， Facebook 抛弃了 requestIdleCallback 的原生 API，[讨论](https://github.com/facebook/react/issues/13206?source=post_page---------------------------#issuecomment-418923831)）

![image.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4999083437/79f0/daeb/02b3/6eceff5c872ff28a3d3486a46384309a.png)

之前我们说过 React 的 diff 计算会花费大量的时间，所以我们思考下如果我们将 diff 计算放在里面执行是否就能解决体验的问题呢?答案是肯定的，但是这会面临下面几个问题:

1. 因为每次空闲的时间有限，所以要求程序在执行 diff 的时候需要将当前状态保留下来，等待下次空闲的时候再次调用。这里就涉及到可中断，可恢复。
2. 程序需要有优先级的概念。简单的来说就是需要标志哪些任务是高优先级的，哪些任务是低优先级的， 这样才有调度的依据。
   所以 **React Fiber 就是基于优先级的调度策略**。看上面两个问题，最重要的部分其实是可以**中断和恢复**，如何实现中断和恢复？

## 斐波那契数列的 Fiber

再看 React 的 Fiber 之前我们先来研究下怎么使用 Fiber 的思维方式来改写斐波那契数列，在计算机科学里，有这样一句话“任何递归的程序都可以使用循环实现”。为了让程序可以中断，递归的程序必须改写为循环。

递归下斐波那契数列写法：

```jsx
function fib(n) {
  if (n <= 2) {
    return 1;
  } else {
    return fib(n - 1) + fib(n - 2);
  }
}
```

如果我们采用 Fiber 的思路将其改写为循环，就需要展开程序，保留执行的中间态，这里的中间态我们定义为下面的结构，虽然这个例子并不能和 React Fiber 的对等。

```jsx
function fib(n) {
  let fiber = { arg: n, returnAddr: null, a: 0 };
  // 标记循环
  rec: while (true) {
    // 当展开完全后，开始计算
    if (fiber.arg <= 2) {
      let sum = 1;
      // 寻找父级
      while (fiber.returnAddr) {
        fiber = fiber.returnAddr;
        if (fiber.a === 0) {
          fiber.a = sum;
          fiber = { arg: fiber.arg - 2, returnAddr: fiber, a: 0 };
          continue rec;
        }
        sum += fiber.a;
      }
      return sum;
    } else {
      // 先展开
      fiber = { arg: fiber.arg - 1, returnAddr: fiber, a: 0 };
    }
  }
}
```

实际上 React Fiber 正是受到了上面的启发，我们可以看到由于 Fiber 的思路对执行程序进行了展开，大概类似于下面的结构，和程序执行的堆栈非常相似，这段代码的意思是先像左边一样展开整个结构，当 `fiber` 的入参小于 2 的时候，再不断的寻找父级知道没有父节点，最后得到 `sum` 值。

左侧是展开的结构，右侧是向上堆叠的调用栈示意图

![image.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4999008639/76d0/1a2a/f69d/ea20ab675bd2dd7956dfbd785784cf66.png)![image.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4999008622/f060/df35/ad88/7e5d37d02fcea55cbbb2cec83c98e932.png)

所以 Fiber 比 Stack 的方式要花费更多的内存占用和执行性能。这个[例子](http://jsbin.com/muzaxehedi/edit?html,js,output)有更直观的展示。 但是为什么 React 基于 Fiber 的思路会让 JS 执行性能提升呢，这是因为有其他的优化在其中，比如不需要兼容旧有的浏览器，代码量的缩减等等。

## React Fiber 的结构

现在我们来看一看一个 Fiber Node 的结构，如下图所示，一个非常典型的链表的结构，这种设计方式实际也受上面展开堆栈方式的启发，而相对于 15 版本而言，增加了很多属性。

![image.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4999046763/5098/23dc/9c1f/dbd35deec856e04ae59618f3df0f3502.png)

```jsx
{
  tag, // 标记一些特殊的组件类型，比如Fragment，ContextProvider等
  type, // 组件的节点的真实的描述，比如div, Button等
  key, // key和15一样，如果key一致，下次这个节点可以被复用
  child, // 节点的孩子
  sibling, // 节点的兄弟节点
  return, // 实际上就是该节点的父级节点
  pendingProps, // 开始的时候设置pendingProps
  memoizedProps, // 结束的时候设置memoizedProps, 如果两者相同的话，直接复用之前的stateNode
  pendingWorkPriority, // 当前节点的优先级,
  stateNode, // 当前节点关联的组件的instance
  effectTag // 标记当前的fiber需要被操作的类型，比如删除，更新等等
  ...
}

```

我们可以采用上面类似遍历展开的斐波那契数列一样遍历 Fiber Node 的 root ，其实就是一个比较简单的链表遍历方法。

## Fiber 的衍生产物 Custom Renderer

在实施 Fiber 的过程中，为了更好的实现扩展性的需求，衍生出了 React Reconciler 这个独立的包，我们可以通过这个玩意自定义一个 Custom Renderer。它定义了一系列标准化的接口，使我们不必关心 Fiber 内部是如何工作的，就可以通过虚拟 DOM 的方式驱动宿主环境。

一个较为完整的探索 Custom Renderer 的[例子](https://codesandbox.io/s/custom-react-renderer-demo-7mqwt?fontsize=14&hidenavigation=1&theme=dark)

### 启动方式

下面一个标准化的 Custom Renderer 的启动代码，我们只需要实现 HostConfig 的部分就可以使用 React Reconclier 的调度能力：

```jsx
import Reconciler from 'react-reconclier';

const HostConfig = {};
const CustomRenderer = Reconciler(HostConfig)
let root;
const render = function(children, container) {
    if(!root) {
        root = CustomRenderer.createContainer(container);
    }
    CustomRenderer.updateContainer(children, root);
}

render(<App/>, doucment.querySelector('#root')
```

HostConfig 中最核心的方法是 `createInstance`，为 type 类型创建一个实例，如果宿主环境是 Web ，可以直接调用 `createElement` 方法

```jsx
createInstance(type,props,rootContainerInstance,hostContext) {
   // 转换props
   return document.createElement(
      type,
      props,
    );
 }
```

### 跨端实现

衍生一下，现在跨端的方案，基本上这种运行时的方案都可以利用 CustomRenderer 的思路，来实现一码多端。举个简单的例子，假设了我写了下面的代码

```jsx
function App() {
  return <Button />;
}
```

Button 具体应该使用什么对应的实现渲染，可以在`createInstance`里做个拦截，当然也可以对不同的端实现不同的 Renderer 。 下面一个伪代码

Mobile Renderer

```jsx
import { MobileButton } from 'xxx';

createInstance(type,props,rootContainerInstance,hostContext) {
   const components = {
   	Button: MobileButton
   }
   return new components[type](props) // 伪代码
 }
```

### API 设计的问题

虽然看起来 CustomRenderer 很好，实际上在整个 API 的设计上，为了 Web 做了一些妥协。比如单独为文本设计的 `shouldSetTextContent` ，  `createTextInstance` 方法，基本上是因为 Web 对某些元素文本操作的原因，没有办法使用统一的 `document.createElement`，而必须使用`document.createTextNode`，其实在很多其他的渲染场景下都不需要单独实现这些方法或者直接返回 `false`

React DOM 的实现
```jsx
export function shouldSetTextContent(type: string, props: Props): boolean {
  return (
    type === 'textarea' ||
    type === 'option' ||
    type === 'noscript' ||
    typeof props.children === 'string' ||
    typeof props.children === 'number' ||
    (typeof props.dangerouslySetInnerHTML === 'object' &&
      props.dangerouslySetInnerHTML !== null &&
      props.dangerouslySetInnerHTML.__html != null)
  );
}
```

其他的一些 Renderer

```jsx
export function shouldSetTextContent() {
  return false;
}
```

## 小结

本文主要探寻下 React Fiber 想要解决的问题，包括 Fiber 架构受到的一些启发，及在实施了 Fiber 架构后的衍生产物 Custom Renderer 的应用，希望有更多的场景可以利用到 Custom Renderer 的能力, 这里提供一些社区常见的 [Custom Renderer](https://github.com/chentsulin/awesome-react-renderer)。最后，本文仅代表个人观点，如有错误欢迎批评指正。

**参考资料**

[ReactFiber](https://github.com/acdlite/react-fiber-architecture/blob/master/README.md)

[CallStack](https://en.wikipedia.org/wiki/Call_stack#Structure)

[requestIdleCallback](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback)

[React Reconclier](https://github.com/facebook/react/tree/master/packages/react-reconciler)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
