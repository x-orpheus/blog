---
title: React 事件系统工作原理
date: 2020-12-23T03:14:37.867Z
description: React 为我们提供了一套虚拟的事件系统，这套虚拟事件系统是如何工作的，笔者对源码做了一次梳理，整理了下面的文档供大家参考。
---
![题图](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5186641256/8d69/190f/7d79/98731dc290d0adeff4679b8ec9664bba.jpg)

> 本文作者: [江水](https://www.zhihu.com/people/li-quan-wei-41)

## 前言

React 为我们提供了一套虚拟的事件系统，这套虚拟事件系统是如何工作的，笔者对源码做了一次梳理，整理了下面的文档供大家参考。

在 [React事件介绍](https://reactjs.org/docs/events.html) 中介绍了合成事件对象以及为什么提供合成事件对象，主要原因是因为 React 想实现一个全浏览器的框架， 为了实现这种目标就需要提供全浏览器一致性的事件系统，以此抹平不同浏览器的差异。

合成事件对象很有意思，一开始听名字会觉得很奇怪，看到英文名更奇怪 `SyntheticEvent`， 实际上合成事件的意思就是使用原生事件合成一个 React 事件， 例如使用原生`click`事件合成了`onClick`事件，使用原生`mouseout`事件合成了`onMouseLeave`事件，原生事件和合成事件类型大部分都是一一对应，只有涉及到兼容性问题时我们才需要使用不对应的事件合成。合成事件并不是 React 的首创，在 iOS 上遇到的 300ms 问题而引入的 fastclick 就使用了 touch 事件合成了 click 事件，也算一种合成事件的应用。

了解了 React 事件是合成事件之后我们看待事件的角度就会有所不同， 例如我们经常在代码中写的这种代码

```
<button onClick={handleClick}>
  Activate Lasers
</button>
```

我们已经知道这个`onClick`只是一个合成事件而不是原生事件， 那这段时间究竟发生了什么？ 原生事件和合成事件是如何对应起来的？

上面的代码看起来很简洁，实际上 React 事件系统工作机制比起上面要复杂的多，脏活累活全都在底层处理了， 简直框架劳模。其工作原理大体上分为两个阶段

1. 事件绑定
2. 事件触发

下面就一起来看下这两个阶段究竟是如何工作的， 这里主要从源码层分析，并以 16.13 源码中内容为基准。

## 1. React 是如何绑定事件的 ?

React 既然提供了合成事件，就需要知道合成事件与原生事件是如何对应起来的，这个对应关系存放在 React 事件插件中`EventPlugin`， 事件插件可以认为是 React 将不同的合成事件处理函数封装成了一个模块，每个模块只处理自己对应的合成事件，这样不同类型的事件种类就可以在代码上解耦，例如针对`onChange`事件有一个单独的`LegacyChangeEventPlugin`插件来处理，针对`onMouseEnter`，  `onMouseLeave` 使用 `LegacyEnterLeaveEventPlugin` 插件来处理。

为了知道合成事件与原生事件的对应关系，React 在一开始就将事件插件全部加载进来， 这部分逻辑在 [ReactDOMClientInjection](https://github.com/facebook/react/blob/v16.13.1/packages/react-dom/src/client/ReactDOMClientInjection.js#L56) 代码如下

```js
injectEventPluginsByName({
    SimpleEventPlugin: LegacySimpleEventPlugin,
    EnterLeaveEventPlugin: LegacyEnterLeaveEventPlugin,
    ChangeEventPlugin: LegacyChangeEventPlugin,
    SelectEventPlugin: LegacySelectEventPlugin,
    BeforeInputEventPlugin: LegacyBeforeInputEventPlugin
});
```

注册完上述插件后， [EventPluginRegistry](https://github.com/facebook/react/blob/v16.13.1/packages/legacy-events/EventPluginRegistry.js) (老版本代码里这个模块唤作`EventPluginHub`)这个模块里就初始化好了一些全局对象，有几个对象比较重要，可以单独说一下。

第一个对象是 **registrationNameModule**， 它包含了 React 事件到它对应的 plugin 的映射， 大致长下面这样，它包含了 React 所支持的所有事件类型，这个对象最大的作用是判断一个组件的 prop 是否是事件类型，这在处理原生组件的 props 时候将会用到，如果一个 prop 在这个对象中才会被当做事件处理。

```js
{
    onBlur: SimpleEventPlugin,
    onClick: SimpleEventPlugin,
    onClickCapture: SimpleEventPlugin,
    onChange: ChangeEventPlugin,
    onChangeCapture: ChangeEventPlugin,
    onMouseEnter: EnterLeaveEventPlugin,
    onMouseLeave: EnterLeaveEventPlugin,
    ...
}
```

第二个对象是 **registrationNameDependencies**， 这个对象长下面几个样子

```js
{
    onBlur: ['blur'],
    onClick: ['click'],
    onClickCapture: ['click'],
    onChange: ['blur', 'change', 'click', 'focus', 'input', 'keydown', 'keyup', 'selectionchange'],
    onMouseEnter: ['mouseout', 'mouseover'],
    onMouseLeave: ['mouseout', 'mouseover'],
    ...
}
```

这个对象即是一开始我们说到的合成事件到原生事件的映射，对于`onClick` 和 `onClickCapture`事件， 只依赖原生`click`事件。但是对于 `onMouseLeave`它却是依赖了两个`mouseout`， `mouseover`， 这说明这个事件是 React 使用 `mouseout` 和 `mouseover` 模拟合成的。正是因为这种行为，使得 React 能够合成一些哪怕浏览器不支持的事件供我们代码里使用。

第三个对象是 **plugins**， 这个对象就是上面注册的所有插件列表。

```js
plugins = [LegacySimpleEventPlugin, LegacyEnterLeaveEventPlugin, ...];
```

看完上面这些信息后我们再反过头来看下一个普通的`EventPlugin`长什么样子。一个 plugin 就是一个对象， 这个对象包含了下面两个属性

```js
// event plugin
{
  eventTypes, // 一个数组，包含了所有合成事件相关的信息，包括其对应的原生事件关系
  extractEvents: // 一个函数，当原生事件触发时执行这个函数
}
```

了解上面这这些信息对我们分析 React 事件工作原理将会很有帮助，下面开始进入事件绑定阶段。

1. React 执行 diff 操作，标记出哪些 **DOM 类型** 的节点需要添加或者更新。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4800330750/b724/a082/d390/beae89013e9dc9bfc6f140c8b3c0e8f6.png)

2. 当检测到需要创建一个节点或者更新一个节点时， 使用 **registrationNameModule** 查看一个 prop 是不是一个事件类型，如果是则执行下一步。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4800583640/cd74/1213/cc37/86fe42a94ebcbb0d71d82628387b224f.png)

4. 通过 **registrationNameDependencies** 检查这个 React 事件依赖了哪些**原生事件类型**。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5094697349/9f49/82c0/a6b2/2d9e66e6e0d5dabf5bf80c37a8cf472a.png)

5. 检查这些一个或多个原生事件类型有没有注册过，如果有则忽略。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5094708393/9963/abca/589a/0f3be5efc574c1fc0c34dec18a275fa2.png)

6. 如果这个原生事件类型没有注册过，则注册这个原生事件到 `document` 上，回调为React提供的[dispatchEvent](https://github.com/facebook/react/blob/v16.13.1/packages/react-dom/src/events/DOMLegacyEventPluginSystem.js#L267)函数。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5094724930/4839/6226/8180/5a2070ecd5dfd0fafc94647b49da3b43.png)

上面的阶段说明:

1. 我们将所有事件类型都注册到 `document` 上。
2. 所有原生事件的 listener 都是`dispatchEvent`函数。
3. 同一个类型的事件 React 只会绑定一次原生事件，例如无论我们写了多少个`onClick`， 最终反应在 DOM 事件上只会有一个`listener`。
4. React 并没有将我们业务逻辑里的`listener`绑在原生事件上，也没有去维护一个类似`eventlistenermap`的东西存放我们的`listener`。

由 3，4 条规则可以得出，我们业务逻辑的`listener`和实际 DOM 事件压根就没关系，React 只是会确保这个原生事件能够被它自己捕捉到，后续由 React 来派发我们的事件回调，当我们页面发生较大的切换时候，React 可以什么都不做，从而免去了去操作`removeEventListener`或者同步`eventlistenermap`的操作，所以其执行效率将会大大提高，相当于全局给我们做了一次事件委托，即便是渲染大列表，也不用开发者关心事件绑定问题。

## 2. React 是如何触发事件的?

我们知道由于所有类型种类的事件都是绑定为React的 `dispatchEvent` 函数，所以就能在全局处理一些通用行为，下面就是整个行为过程。

```js
export function dispatchEventForLegacyPluginEventSystem(
  topLevelType: DOMTopLevelEventType,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
): void {
  const bookKeeping = getTopLevelCallbackBookKeeping(
    topLevelType,
    nativeEvent,
    targetInst,
    eventSystemFlags
  );

  try {
    // Event queue being processed in the same cycle allows
    // `preventDefault`.
    batchedEventUpdates(handleTopLevel, bookKeeping);
  } finally {
    releaseTopLevelCallbackBookKeeping(bookKeeping);
  }
}
```

`bookKeeping`为事件执行时组件的层级关系存储，也就是如果在事件执行过程中发生组件结构变更，并不会影响事件的触发流程。

整个触发事件流程如下:

1. 任意一个事件触发，执行 `dispatchEvent` 函数。
2. `dispatchEvent` 执行 `batchedEventUpdates(handleTopLevel)`， [batchedEventUpdates](https://github.com/facebook/react/blob/v16.13.1/packages/react-reconciler/src/ReactFiberWorkLoop.js#L1150) 会打开批量渲染开关并调用 `handleTopLevel`。
3. [handleTopLevel](https://github.com/facebook/react/blob/v16.13.1/packages/react-dom/src/events/DOMLegacyEventPluginSystem.js#L220) 会依次执行 **plugins** 里所有的事件插件。
4. 如果一个插件检测到自己需要处理的事件类型时，则处理该事件。

对于大部分事件而言其处理逻辑如下，也即 `LegacySimpleEventPlugin` 插件做的工作

1. 通过原生事件类型决定使用哪个合成事件类型（原生 event 的封装对象，例如 `SyntheticMouseEvent`) 。
2. 如果对象池里有这个类型的实例，则取出这个实例，覆盖其属性，作为本次派发的事件对象（事件对象复用），若没有则新建一个实例。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4800772358/cb23/499c/0f53/b6be5e7f3ca9b26174fadb9380ca9561.png)


3. 从点击的原生事件中找到对应 DOM 节点，从 DOM 节点中找到一个最近的React组件实例， 从而找到了一条由这个实例父节点不断向上组成的链， 这个链就是我们要触发合成事件的链，(只包含原生类型组件， `div`， `a` 这种原生组件)。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5095016994/ad90/0556/823d/b4ea1e5d50903358f226d11b289b24ed.png)

4. 反向触发这条链，父-> 子，模拟捕获阶段，触发所有 props 中含有 `onClickCapture` 的实例。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5095025806/0f50/abbc/5d67/0d143b068f21bbafb49c5089476657e7.png)

5. 正向触发这条链，子-> 父，模拟冒泡阶段，触发所有 props 中含有 `onClick` 的实例。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5095033054/15cf/567e/5504/4c5e82a1c65aaf393d43993588842a32.png)

这几个阶段说明了下面的现象:

1. React 的合成事件只能在事件周期内使用，因为这个对象很可能被其他阶段复用， 如果想持久化需要手动调用`event.persist()` 告诉 React 这个对象需要持久化。( React17 中被废弃)
2. React 的冒泡和捕获并不是真正 DOM 级别的冒泡和捕获
3. React 会在一个原生事件里触发所有相关节点的 `onClick` 事件， 在执行这些`onClick`之前 React 会打开批量渲染开关，这个开关会将所有的`setState`变成异步函数。
5. 事件只针对原生组件生效，自定义组件不会触发 `onClick`。

## 3. 从React 的事件系统中我们学到了什么

1. React16 将原生事件都绑定在 `document` 上.

这点很好理解，React的事件实际上都是在`document`上触发的。

2. 我们收到的 event 对象为 React 合成事件， event 对象在事件之外不可以使用

所以下面就是错误用法

```js
function onClick(event) {
    setTimeout(() => {
        console.log(event.target.value);
    }， 100);
}
```

3. React 会在派发事件时打开批量更新， 此时所有的 `setState` 都会变成异步。

```js
function onClick(event) {
    setState({a: 1}); // 1
    setState({a: 2}); // 2
    setTimeout(() => {
        setState({a: 3}); // 3
        setState({a: 4}); // 4
    }， 0);
}
```

此时 1， 2 在事件内所以是异步的，二者只会触发一次 render 操作，3， 4 是同步的，3，4 分别都会触发一次 render。

4.  React `onClick`/`onClickCapture`， 实际上都发生在原生事件的冒泡阶段。

```js
document.addEventListener('click'， console.log.bind(null， 'native'));

function onClickCapture() {
    console.log('capture');
}

<div onClickCapture={onClickCapture}/>
```

这里我们虽然使用了`onClickCapture`， 但实际上对原生事件而言依然是冒泡，所以 React 16 中实际上就不支持绑定捕获事件。

5. 由于所有事件都注册到顶层事件上，所以多实个 `ReactDOM.render` 会存在冲突。

如果我们渲染一个子树使用另一个版本的 React 实例创建， 那么即使在子树中调用了 `e.stopPropagatio` 事件依然会传播。所以多版本的 React 在事件上存在冲突。



**最后我们就可以轻松理解 React 事件系统的架构图了**

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5095097288/1f71/b28e/6bf2/315796acd6fc1a0807cccc30ad25ea41.png)

## 4. React 17 中事件系统有哪些新特性

React 17 目前已经发布了， 官方称之为没有新特性的更新， 对于使用者而言没有提供类似 Hooks 这样爆炸的特性，也没有 Fiber 这样的重大重构，而是积攒了大量 Bugfix，修复了之前存在的诸多缺陷。其中变化最大的就数对事件系统的改造了。

下面是笔者列举的一些事件相关的特性更新

### 调整将顶层事件绑在container上，ReactDOM.render(app， container);

![react_17_delegation](https://reactjs.org/static/bb4b10114882a50090b8ff61b3c4d0fd/31868/react_17_delegation.png)


将顶层事件绑定在 `container` 上而不是 `document` 上能够解决我们遇到的多版本共存问题，对微前端方案是个重大利好。

### 对齐原生浏览器事件

React 17 中终于支持了原生捕获事件的支持， 对齐了浏览器原生标准。

同时`onScroll` 事件不再进行事件冒泡。

`onFocus` 和 `onBlur` 使用原生 `focusin`， `focusout` 合成。

> Aligning with Browsers
We’ve made a couple of smaller changes related to the event system:
The onScroll event no longer bubbles to prevent common confusion.
React onFocus and onBlur events have switched to using the native focusin and focusout events under the hood， which more closely match React’s existing behavior and sometimes provide extra information.
Capture phase events (e.g. onClickCapture) now use real browser capture phase listeners.

### 取消事件复用

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4787039040/4767/5b08/8a09/466e5a5070defa58a1746209185647d8.png)

官方的解释是事件对象的复用在现代浏览器上性能已经提高的不明显了，反而还很容易让人用错，所以干脆就放弃这个优化。

*参考*

1. https://reactjs.org/docs/events.html
2. https://reactjs.org/docs/handling-events.html
3. https://github.com/facebook/react

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
