---
title: rrweb 带你还原问题现场
date: 2022-01-06T02:37:46.404Z
description: 为了快速定位并解决CMS使用过程中遇到的问题，开发了问题一键上报插件，用于还原问题现场。本文会简要阐述问题上报插件的设计，以问题上报插件作为一个入口去探索rrweb库的实现原理，主要会从事件监听、DOM 序列化、自定义计时器三方面去着重阐述。
---

![Baker_Street](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12204956629/603d/3a1b/3855/f840616524854851802a795016600354.jpg)

> 本文作者：[吴硕硕](https://juejin.cn/user/3861140566978014)

# 背景

云音乐内部有许多内容管理系统 (Content Management System，CMS)，用来支撑业务的运营配置等工作，运营同学在使用过程中遇到问题时，期望开发人员可以及时给予反馈并解决问题；痛点是开发人员没有问题现场，很难去快速定位到问题，通常的场景是：
- 运营同学 Watson：「Sherlock，我在配置 mlog 标签的时候提示该标签不存在，快帮我看下，急。」
- 开发同学 Sherlock：「不慌，我看看。」*（打开测试环境的运营管理后台，一顿操作，一切非常的正常…）*
- 开发同学 Sherlock：「我这儿正常的啊，你的工位在哪，我去你那看看」
- 运营同学 Watson：「我在北京…」
- 开发同学 Sherlock：「我在杭州…」

为了对运营同学在使用中遇到的相关问题及时给予反馈，尽快定位并解决 CMS 用户遇到的使用问题，设计实现了问题一键上报插件，用于还原问题现场，主要包括录制和展示两部分：
*   ThemisRecord 插件：上报用户基础信息、用户权限、API 请求 & 结果、错误堆栈、录屏
*   倾听平台承接展示：显示录屏回放、用户、请求和错误堆栈信息

# 上报流程

问题一键上报插件设计的主要流程如下图所示，在录屏期间，插件需要分别收集用户基础信息、API 请求数据、错误堆栈信息和录屏信息，并将数据上传到 NOS 云端和倾听平台。
![插件设计](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12204634442/66d0/2f60/b77e/b1ab6c69b7f554f502cbe452c12a3dc0.png)
在整个上报的流程中，如何实现操作录屏和回放是一个难点，经过调研，发现 [rrweb](https://github.com/rrweb-io/rrweb) 开源库可以很好的满足我们的需求。rrweb 库支持的场景有录屏回放、自定义事件、console 录制播放等多种场景，其中录屏回放是最常用的使用场景，具体使用详见[场景示例](https://github.com/rrweb-io/rrweb/blob/master/docs/recipes/index.zh_CN.md)。

本文主要介绍的是 rrweb 库的录屏回放实现原理。

# rrweb 库

rrweb 主要由 `rrweb` 、 `rrweb-player` 和 `rrweb-snapshot` 三个库组成：

*   rrweb：提供了 record 和 replay 两个方法；record 方法用来记录页面上 DOM 的变化，replay 方法支持根据时间戳去还原 DOM 的变化。
*   rrweb-player：基于 svelte 模板实现，为 rrweb 提供了回放的 GUI 工具，支持暂停、倍速播放、拖拽时间轴等功能。内部调用了 rrweb 的提供的 replay 等方法。
*   rrweb-snapshot：包括 snapshot 和 rebuilding 两大特性，snapshot 用来序列化 DOM 为增量快照，rebuilding 负责将增量快照还原为 DOM。

了解 rrweb 库的原理，可以从下面几个关键问题入手：

*   如何实现事件监听
*   如何序列化 DOM
*   如何实现自定义计时器

## 如何实现事件监听

基于 rrweb 去实现录屏，通常会使用下面的方式去记录 event，通过 emit 回调方法可以拿到 DOM 变化对应所有 event。拿到 event 后，可以根据业务需求去做处理，例如我们的一键上报插件会上传到云端，开发者可以在倾听平台拉取云端的数据并回放。

```js
let events = [];

rrweb.record({
  // emit option is required
  emit(event) {
    // push event into the events array
    events.push(event);
  },
});
```

`record` 方法内部会根据事件类型去初始化事件的监听，例如 DOM 元素变化、鼠标移动、鼠标交互、滚动等都有各自专属的事件监听方法，本文主要关注的是 DOM 元素变化的监听和处理流程。

要实现对 DOM 元素变化的监听，离不开浏览器提供的 `MutationObserver` API，该 API 会在一系列 DOM 变化后，通过**批量异步**的方式去触发回调，并将 DOM 变化通过 `MutationRecord` 数组传给回调方法。详细的 `MutationObserver` 介绍可以前往 [MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver) 查看。

rrweb 内部也是基于该 API 去实现监听，回调方法为 `MutationBuffer` 类提供的 `processMutations` 方法：

```js
  const observer = new MutationObserver(
    mutationBuffer.processMutations.bind(mutationBuffer),
  );
```

`mutationBuffer.processMutations` 方法会根据 `MutationRecord.type` 值做不同的处理：

*   `type === 'attributes'`: 代表 DOM 属性变化，所有属性变化的节点会记录在 `this.attributes` 数组中，结构为 `{ node: Node, attributes: {} }`，attributes 中仅记录本次变化涉及到的属性；
*   `type === 'characterData'`: 代表 characterData 节点变化，会记录在 `this.texts` 数组中，结构为 `{ node: Node, value: string }`，value 为 characterData 节点的最新值；
*   `type === 'childList'`: 代表子节点树 childList 变化，比起前面两种类型，处理会较为复杂。

### childList 增量快照
childList 发生变化时，若每次都完整记录整个 DOM 树，数据会非常庞大，显然不是一个可行的方案，所以，rrweb 采用了增量快照的处理方式。

有三个关键的 Set：`addedSet`、 `movedSet`、 `droppedSet`，对应三种节点操作：新增、移动、删除，这点和 `React diff` 机制相似。此处使用 Set 结构，实现了对 DOM 节点的去重处理。

### 节点新增
遍历 `MutationRecord.addedNodes` 节点，将未被序列化的节点添加到 `addedSet` 中，并且若该节点存在于被删除集合 `droppedSet` 中，则从 `droppedSet` 中移除。

示例：创建节点 n1、n2，将 n2 append 到 n1 中，再将 n1 append 到 body 中。

    body
      n1
        n2

上述节点操作只会生成一条 `MutationRecord` 记录，即增加 n1，「n2 append 到 n1」的过程不会生成`MutationRecord` 记录，所以在遍历 `MutationRecord.addedNodes` 节点，需要去遍历其子节点，不然 n2 节点就会被遗漏。

遍历完所有 `MutationRecord` 记录数组，会统一对 `addedSet` 中的节点做序列化处理，每个节点序列化处理的结果是：

```js
export type addedNodeMutation = {
  parentId: number;
  nextId: number | null;
  node: serializedNodeWithId;
}
```

DOM 的关联关系是通过 `parentId` 和 `nextId` 建立起来的，若该 DOM 节点的父节点、或下一个兄弟节点尚未被序列化，则该节点无法被准确定位，所以需要先将其存储下来，最后处理。
![双向链表](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12204726077/a5b3/d9db/a0b3/e15da6d76c10db3e0fedf304af4a2e54.png)

rrweb 使用了一个双向链表 `addList` 用来存储父节点尚未被添加的节点，向 `addList` 中插入节点时：

1.  若 DOM 节点的 previousSibling 已存在于链表中，则插入在 `node.previousSibling` 节点后
2.  若 DOM 节点的 nextSibling 已存在于链表中，则插入在 `node.nextSibling` 节点前
3.  都不在，则插入链表的头部

通过这种添加方式，可以保证兄弟节点的顺序，DOM 节点的 `nextSibling` 一定会在该节点的后面，`previousSibling` 一定在该节点的前面；`addedSet` 序列化处理完成后，会对 `addList` 链表进行倒序遍历，这样可以保证 DOM 节点的 `nextSibling` 一定是在 DOM 节点之前被序列化，下次序列化 DOM 节点的时候，就可以拿到 `nextId`。

### 节点移动
遍历 `MutationRecord.addedNodes` 节点，若记录的节点有 `__sn` 属性，则添加到 `movedSet` 中。有 `__sn` 属性代表是已经被序列化处理过的 DOM 节点，即意味着是对节点的移动。

在对 `movedSet` 中的节点序列化处理之前，会判断其父节点是否已被移除：

1.  父节点被移除，则无需处理，跳过；
2.  父节点未被移除，对该节点进行序列化。

### 节点删除
遍历 `MutationRecord.removedNodes` 节点：

1.  若该节点是本次新增节点，则忽略该节点，并且从 `addedSet` 中移除该节点，同时记录到 `droppedSet` 中，在处理新增节点的时候需要用到：虽然我们移除了该节点，但其子节点可能还存在于 `addedSet` 中，在处理 `addedSet` 节点时，会判断其祖先节点是否已被移除；
2.  需要删除的节点记录在 `this.removes` 中，记录了 parentId 和节点 id。

## 如何序列化 DOM

`MutationBuffer` 实例会调用 `snapshot` 的 `serializeNodeWithId` 方法对 DOM 节点进行序列化处理。
`serializeNodeWithId` 内部调用 `serializeNode` 方法，根据 `nodeType` 对 Document、Doctype、Element、Text、CDATASection、Comment 等不同类型的 node 进行序列化处理，其中的关键是对 Element 的序列化处理:

- 遍历元素的 `attributes` 属性，并且调用 `transformAttribute` 方法将资源路径处理为绝对路径；

```js
    for (const { name, value } of Array.from((n as HTMLElement).attributes)) {
        attributes[name] = transformAttribute(doc, tagName, name, value);
    }
```

- 通过检查元素是否包含 `blockClass` 类名，或是否匹配 `blockSelector` 选择器，去判断元素是否需要被隐藏；为了保证元素隐藏不会影响页面布局，会给返回一个同等宽高的空元素；

```js
    const needBlock = _isBlockedElement(
        n as HTMLElement,
        blockClass,
        blockSelector,
    );
```

- 区分外链 style 文件和内联 style，对 CSS 样式序列化，并对 css 样式中引用资源的相对路径转换为绝对路径；对于外链文件，通过 CSSStyleSheet 实例的 cssRules 读取所有的样式，拼接成一个字符串，放到 `_cssText` 属性中；

```js
    if (tagName === 'link' && inlineStylesheet) {
        // document.styleSheets 获取所有的外链style
        const stylesheet = Array.from(doc.styleSheets).find((s) => {
            return s.href === (n as HTMLLinkElement).href;
        });
        // 获取该条css文件对应的所有rule的字符串
        const cssText = getCssRulesString(stylesheet as CSSStyleSheet);
        if (cssText) {
            delete attributes.rel;
            delete attributes.href;
            // 将css文件中资源路径转换为绝对路径
            attributes._cssText = absoluteToStylesheet( 
                cssText,
                stylesheet!.href!,
            );
        }
    }
```

- 对用户输入数据调用 `maskInputValue` 方法进行加密处理；
- 将 canvas 转换为 base64 图片保存，记录 media 当前播放的时间、元素的滚动位置等；
- 返回一个序列化后的对象 `serializedNode`，其中包含前面处理过的 attributes 属性，序列化的关键是每个节点都会有唯一的 id，其中 `rootId` 代表所属 document 的 id，帮助我们在回放的时候识别根节点。

```js
    return {
        type: NodeType.Element,
        tagName,
        attributes,
        childNodes: [],
        isSVG,
        needBlock,
        rootId,
    };
```

### Event 时间戳
拿到序列化后的 DOM 节点，会统一调用`wrapEvent`方法给事件添加上时间戳，在回放的时候需要用到。
``` js
function wrapEvent(e: event): eventWithTime {
  return {
    ...e,
    timestamp: Date.now(),
  };
}
```

### 序列化 id
`serializeNodeWithId` 方法在序列化的时候会从 DOM 节点的 `__sn.id` 属性中读取 id，若不存在，就调用 genId 生成新的 id，并赋值给 `__sn.id` 属性，该 id 是用来唯一标识 DOM 节点，通过 id 建立起 `id -> DOM` 的映射关系，帮助我们在回放的时候找到对应的 DOM 节点。

```js
function genId(): number {
  return _id++;
}

const serializedNode = Object.assign(_serializedNode, { id });
```

若 DOM 节点存在子节点，则会递归调用 `serializeNodeWithId` 方法，最后会返回一个下面这样的 tree 数据结构：

```js
{
    type: NodeType.Document,
    childNodes: [{
        {
            type: NodeType.Element,
            tagName,
            attributes,
            childNodes: [{
                //...
            }],
            isSVG,
            needBlock,
            rootId,
        }
    }],
    rootId,
};
```

## 如何实现自定义计时器

![replay](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12269671785/a676/40d2/f7ed/6d8280be8fea2510b196d649bf24457c.png)
回放的过程中为了支持进度条的随意拖拽，以及回放速度的设置（如上图所示），自定义实现了高精度计时器 Timer ，关键属性和方法为：

```js
export declare class Timer {
    // 回放初始位置，对应进度条拖拽到的任意时间点
    timeOffset: number;
    // 回放的速度
    speed: number;
    // 回放Action队列
    private actions;
    // 添加回放Action队列
    addActions(actions: actionWithDelay[]): void;
    // 开始回放
    start(): void;
    // 设置回放速度
    setSpeed(speed: number): void;
}
```

### 回放入口
通过 Replayer 提供的 `play` 方法可以将上文记录的事件在 iframe 中进行回放。

```js
const replayer = new rrweb.Replayer(events);
replayer.play();
```

第一步，初始化 `rrweb.Replayer` 实例时，会创建一个 iframe 作为承载事件回放的容器，再分别调用创建两个 service： `createPlayerService` 用于处理事件回放的逻辑，`createSpeedService` 用于控制回放的速度。

第二步，会调用 `replayer.play()` 方法，去触发 `PLAY` 事件类型，开始事件回放的处理流程。

```js
// this.service 为 createPlayerService 创建的回放控制service实例
// timeOffset 值为鼠标拖拽后的时间偏移量
this.service.send({ type: 'PLAY', payload: { timeOffset } });
```

### 基线时间戳生成
![时间轴](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12204711165/3e3f/fd0a/61d4/96c6b64a1357f664ef04497b4dd30ba7.png)

回放支持随意拖拽的关键在于传入时间偏移量 `timeOffset` 参数：
- 回放的总时长 = events[n].timestamp - events[0].timestamp，`n` 为事件队列总长度减一；
- 时间轴的总时长为回放的总时长，鼠标拖拽的起始位置对应时间轴上的坐标为`timeOffset`；
- 根据初始事件的 `timestamp` 和 `timeOffset` 计算出拖拽后的 `基线时间戳(baselineTime)`；
- 再从所有的事件队列中根据事件的 `timestamp` 截取 `基线时间戳(baselineTime)` 后的事件队列，即需要回放的事件队列。


### 回放 Action 队列转换

拿到事件队列后，需要遍历事件队列，根据事件类型转换为对应的回放 Action，并且添加到自定义计时器 Timer 的 Action 队列中。
``` js
actions.push({
    doAction: () => {
        castFn();
    },
    delay: event.delay!,
});
```
- `doAction` 为回放的时候要调用的方法，会根据不同的 `EventType` 去做回放处理，例如 DOM 元素的变化对应增量事件 `EventType.IncrementalSnapshot`。若是增量事件类型，回放 Action 会调用 `applyIncremental` 方法去应用增量快照，根据序列化后的节点数据构建出实际的 DOM 节点，为前面序列化 DOM 的反过程，并且添加到iframe容器中。
- `delay` = event.timestamp - baselineTime，为当前事件的时间戳相对于`基线时间戳`的差值


### requestAnimationFrame 定时回放

Timer 自定义计时器是一个**高精度**计时器，主要是因为 `start` 方法内部使用了 `requestAnimationFrame` 去异步处理队列的定时回放；与浏览器原生的 `setTimeout` 和 `setInterval` 相比，`requestAnimationFrame` 不会被主线程任务阻塞，而执行 `setTimeout` 、 `setInterval` 都有可能会有被阻塞。

其次，使用了 `performance.now()` 时间函数去计算当前已播放时长；`performance.now()`会返回一个用浮点数表示的、精度高达微秒级的时间戳，精度高于其他可用的时间类函数，例如 `Date.now()`只能返回毫秒级别。

```js
 public start() {
    this.timeOffset = 0;
    // performance.timing.navigationStart + performance.now() 约等于 Date.now()
    let lastTimestamp = performance.now();
    // Action 队列
    const { actions } = this;
    const self = this;
    function check() {
      const time = performance.now();
      // self.timeOffset为当前播放时长：已播放时长 * 播放速度(speed) 累加而来
      // 之所以是累加，因为在播放的过程中，速度可能会更改多次
      self.timeOffset += (time - lastTimestamp) * self.speed;
      lastTimestamp = time;
      // 遍历 Action 队列
      while (actions.length) {
        const action = actions[0];
        // 差值是相对于`基线时间戳`的，当前已播放 {timeOffset}ms
        // 所以需要播放所有「差值 <= 当前播放时长」的 action
        if (self.timeOffset >= action.delay) {
          actions.shift();
          action.doAction();
        } else {
          break;
        }
      }
      if (actions.length > 0 || self.liveMode) {
        self.raf = requestAnimationFrame(check);
      }
    }
    this.raf = requestAnimationFrame(check);
  }
```
完成回放 Action 队列转换后，会调用 `timer.start()` 方法去按照正确的时间间隔依次执行回放。在每次 `requestAnimationFrame` 回调中，会正序遍历 Action 队列，若当前 Action 相对于`基线时间戳`的差值小于当前的播放时长，则说明该 Action 在本次异步回调中需要被触发，会调用 `action.doAction` 方法去实现本次增量快照的回放。回放过的 Action 会从队列中删除，保证下次 `requestAnimationFrame` 回调不会重新执行。

# 总结

在了解了「如何实现事件监听」、「如何序列化 DOM」、「如何实现自定义计时器」这几个关键问题后，我们基本掌握了 rrweb 的工作流程，除此之外，rrweb 在回放的时候还使用的 iframe 的沙盒模式，去实现对一些 JS 行为的限制，感兴趣的同学可以进一步去了解。

总之，基于 rrweb 可以方便地帮助我们实现录屏回放功能，例如现在在 CMS 业务中落地使用的一键上报功能，通过结合 API 请求、错误堆栈信息和录屏回放功能，可以帮助开发对问题进行定位并解决，让你也成为一个 Sherlock。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe (at) corp.netease.com！
