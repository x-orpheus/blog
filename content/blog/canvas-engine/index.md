---
title: 动手打造一款 canvas 排版引擎
date: 2022-02-08T03:46:24.217Z
description: 在canvas中进行排版布局的一些实践，方案在web以及各类小程序如微信小程序上适用。
---

![题图](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12859709732/d4f1/d1a0/9fae/a6d80481df8c678777a4717188b4c57e.jpeg)

> 图片来源：<https://unsplash.com>

> 本文作者：[金飞扬](https://github.com/Gitjinfeiyang)

# 背景

> [在线示例](https://codesandbox.io/s/demo-forked-k1p71?file=/main.js)

> [Demo](https://gitjinfeiyang.github.io/easy-canvas/example/ui.html)

作为前端开发尤其是偏 c 端的前端开发者（如微信小程序），相信大家都碰到过分享活动图片、分享海报图类似的功能

![分享图](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334261622/9534/3641/c805/ced2da0ffdcd5b2db1ff0890a842f49d.png)

一般这种需求的解决方案大体上可以分为以下几种：

1. 依赖服务端，比如写一个 `node` 服务，用 `puppeteer` 访问提前写好的网页来截图。

2. 直接使用 `CanvasRenderingContext2D` 的 api 或者使用辅助绘图的工具如 `react-canvas` 等来绘制。

3. 使用前端页面截图框架，比如 `html2canvas`、`dom2image`，用 html 将页面结构写好，再在需要的时候调用框架 api 截图

_方案分析：_

1. 依赖服务端这种方案会消耗一定的服务端资源，尤其截图这种服务，对 cpu 以及带宽的消耗都是很大的，因此在一些可能高并发或者图片比较大的场景用这种方案体验会比较差，等待时间很长，这种方案的优点是还原度非常高，由于服务端无头浏览器版本是确定的，所以可以确保所见即所得，并且从开发上来说，无其他学习成本，如果业务还不是很大访问量不高用这种方案是最可靠的。

2. 这种方案比较硬核，比较费时费力，大量的代码来计算布局的位置，文字是否换行等等，并且当开发完成后，如果 ui 后续有一些调整，又要在茫茫代码中寻找你要修改的那个它。 这个方案的优点是细节很可控，理论上各种功能都可以完成，如果头发够用的话。

3. 这应该也是目前 web 端使用最广的一种方案了，截止目前 `html2canvas` star 数量已经 25k。`html2canvas` 的原理简单来说就是遍历 dom 结构中的属性然后转化到 canvas 上来渲染出来，所以它必然是依赖宿主环境的，那么在一些老旧的浏览器上可能会遇到兼容性问题，当然如果是开发中就遇到了还好，毕竟我们是万能的前端开发(狗头)，可以通过一些 hack 手段来规避，但是 c 端产品会运行在各种各样的设备上，很难避免发布后在其他用户设备上兼容问题，并且出了问题除非用户上报，一般难以监控到，并且在国内小程序用户量基数很大，这个方案也不能在小程序中使用。所以这个方案看似一片祥和，但是会有一些兼容的问题。

在这几年不同的工作中，基本都遇到了需要分享图片的需求，虽然需求一般都不大频次不高，但是印象中每次做都不是很顺畅，上面几种方案也都试过了，多多少少都有一些问题。

_萌生想法：_

在一次需求评审中了解到在后续迭代有 ui 统一调整的规划，并且会涉及到几个分享图片的功能，当时的业务是涉及到小程序以及 h5 的。会后打开代码，看到了像山一样的分享图片代码，并且穿插着各种兼容胶水代码，如此庞大的代码只是为了生成一个小卡片的布局，如果是 html 布局，应该 100 行就能写完，当时就想着怎么来进行重构。

鉴于开发时间还很充裕，我在想有没有其他更便捷、可靠、通用一点的解决方案，并且自己对这块也一直很感兴趣，秉持着学习的态度，于是萌生了自己写一个库的想法，经过考虑后我选择了 `react-canvas` 的实现思路，但是`react-canvas`依赖于`React`框架，为了保持通用性，我们本次开发的引擎不依赖特定web框架、不依赖 dom 的 api，能根据类似 css 的样式表来生成布局渲染，并且支持进阶功能可以进行交互。

在梳理了要做的功能后，一个简易的 canvas 排版引擎浮现脑海。

# 什么是排版引擎

![排版引擎](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334804050/d560/5e9b/43d3/9bd6a60120196895773c9c6aa567bd44.jpeg)

> 排版引擎（layout engine），也称为浏览器引擎（browser engine）、页面渲染引擎（rendering engine）或样版引擎，它是一种软件组件，负责获取标记式内容（如 HTML、XML 及图像文件等等）、整理信息（如 CSS 及 XSL 等），并将排版后的内容输出至显示器或打印机。所有网页浏览器、电子邮件客户端、电子阅读器以及其它需要根据表示性的标记语言（Presentational markup）来显示内容的应用程序都需要排版引擎。

摘自 Wikipedia 对浏览器排版引擎的描述，对于前端同学来说这些概念应该是比较熟悉的，常见的排版引擎比如 webkit、Gecko 等。

# 设计

## 目标

本次需求承载了以下几个目标：

1. 框架支持“文档流布局”，这也是我们的核心需求，不需要开发者指定元素的位置，以及自动宽高。
2. 过程式调用转为声明式调用，即不需要调用繁琐的 api 来绘制图形，只需要编写 template 就可以生成图形。
3. 跨平台，这里主要是指可以在 web 以及各种小程序上运行，不依赖特定框架。
4. 支持交互，即可以增加事件，并且可以对 UI 进行修改。

总结下来就是在可以在 canvas 里写“网页”。

## api 设计

在最初的设想里，打算使用`类似 vue template 语法`来作为结构样式数据，但是这么做会增加编译成本，对于我想要实现的核心功能来说它的起点有点太远了。在权衡过后，最终打算使用`类似 React createElement 的语法 + Javascript style object`的形式的 api，优先实现核心功能。

另外需要注意的是，我们的目标不是在 canvas 里实现浏览器标准，而是尽可能贴近 css 的 api，以提供一套方案能实现文档流布局。

目标 api 长这样

```javascript
// 创建图层
const layer = lib.createLayer(options);

// 创建节点树
// c(tag,options,children)
const node = lib.createElement((c) => {
  return c(
    "view", // 节点名
    {
      styles: {
        backgroundColor: "#000",
        fontSize: 14,
        padding: [10, 20],
      }, // 样式
      attrs: {}, // 属性 比如src
      on: {
        click(e) {
          console.log(e.target);
        },
      }, // 事件 如click load
    },
    [c("text", {}, "Hello World")] // 子节点
  );
});

// 挂载节点
node.mount(layer);
```

如上所示，api 的核心在于创建节点的三个参数：

1. `tagName` 节点名，这里我们支持基本的元素，像`view`,`image`,`text`,`scroll-view`等，另外还支持自定义标签，通过全局`component`api 来注册一个新的组件，利于扩展。

```javascript
function button(c, text) {
  return c(
    "view",
    {
      styles: {
        // ...
      },
    },
    text
  );
}

// 注册一个自定义标签
lib.component("button", (opt, children, c) => button(c, children));

// 使用
const node = lib.createElement((c) => {
  return c("view", {}, [c("button", {}, "这是全局组件")]);
});
```

2. `options`，即标签的参数，支持`styles`,`attrs`,`on`，分别为*样式*、_属性_、_事件_

3. `children`，即子节点，同时也可以是文字。

我们期望执行以上 api 后可以在 canvas 中渲染出文字，并且点击后可以响应相应事件。

## 流程架构

![架构图](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334261619/4105/2a0a/b747/c8b68a238d2515ba8adb82bc80ebb7be.jpeg)

框架的首次渲染将按以下流程执行，后面也会按照这个顺序进行讲解：

![流程图](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12849379315/4a60/8f35/e568/5b36e37fa5336059d4178fad1a685e65.png)

下面会将流程图中的关键细节进行讲述，代码中涉及到一些算法以及数据结构需要注意。

# 模块细节

## 预处理

在拿到视图模型（即开发者通过`createElement`api 编写的模型）后，需要首先对其进行预处理，这一步是为了过滤用户输入，用户输入的模型只是告诉框架意图的目标，并不能直接拿来使用：

1. 节点预处理

   - 支持简写字符串，这一步需要将字符串转为`Text`对象
   - 由于我们后面需要频繁访问兄弟节点以及父节点，所以这一步将兄弟节点以及父节点都保存在当前节点，并且标记出所在父容器中的位置，这一点很重要，这个概念类似于 React 中的`Fiber`结构，在后续计算中频繁使用到，并且为我们实现`可中断渲染`打下了基础。

2. 样式预处理

   - 一些样式是支持多种简写方式的，需要将其转换为目标值。如`padding:[10,20]`，在预处理器中需要转换成`paddingLeft`、`paddingRight`、`paddingTop`、`paddingBottom`4 个值。
   - 设置节点默认值，如`view`节点默认`display`属性为`block`
   - 继承值处理，如`fontSize`属性默认继承父级

3. 异常值处理，用户填写了不符合预期的值在这一步进行提醒。
4. 初始化事件挂载、资源请求等。
5. 其他为后续计算以及渲染的准备工作（后面会讲到）。

```javascript
initStyles() {
    this._extendStyles()

    this._completeStyles()

    this._initRenderStyles()
}
```

## 布局处理

在上一步预处理过后，我们就得到了一个带有完整样式的节点树，接下来需要计算布局，计算布局分为尺寸和位置的计算，这里需要注意的是，流程里为什么要先计算尺寸呢？仔细思考一下，如果我们先计算位置，像文字，图片这种之后的节点，是需要在上一个尺寸位置计算完毕再去参考计算。所以这一步是所有节点原地计算尺寸完毕后，再计算所有节点的位置。

整个过程如下动画。

![盒模型](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334260988/3b1a/b3b2/48b7/0db1a79b5f2d52bd7309730d8913f107.gif)

### 计算尺寸

更专业一点的说法应该是计算盒模型，说到盒模型大家应该是耳熟能详了，基础面试几乎必问的。

![盒模型](https://mdn.mozillademos.org/files/16558/box-model.png)

> 图片来源：<https://mdn.mozillademos.org/files/16558/box-model.png>

在 css 中，可以通过`box-sizing`属性来使用不同的盒模型，但是我们本次不支持调整，默认为`border-box`。

对于一个节点，他的尺寸可以简化为几种情况：

1. 参考父节点，如`width:50%`。
2. 设置了具体值，如`width:100px`。
3. 参考子节点，如`width:fit-content`，另外像`image` `text`节点也是由内容决定尺寸。

梳理好这几种模式之后就可以开始遍历计算了，对于一个树我们有多种遍历模式。

_广度优先遍历_:

![广度优先遍历](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12467000387/9b65/ab96/4c82/0b3bd29a20953b186e58181963dfa7b8.png)

_深度优先遍历_:

![深度优先遍历](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12467000388/f211/991a/ed38/60314594a970f2fef2118b4dacf62cfb.png)

这里我们对上面几种情况分别做考虑：

1. 因为是参考父节点所以需要从父到子遍历。
2. 没有遍历顺序要求。
3. 父节点需要等所有子节点计算完成后再进行计算，因此需要广度优先遍历，并且是从子到父。

这里出现了一个问题，第 1 种和第 3 种所需遍历方式出现了冲突，但是回过头来看预处理部分正是从父到子的遍历，因此 1、2 部分计算尺寸的任务可以提前在预处理部分计算好，这样到达这一步的时候只需要计算第3部分，即根据子节点计算。

```javascript
class Element extends TreeNode {
  // ...

  // 父节点计算高度
  _initWidthHeight() {
    const { width, height, display } = this.styles;
    if (isAuto(width) || isAuto(height)) {
      // 这一步需要遍历，判断一下
      this.layout = this._measureLayout();
    }

    if (this._InFlexBox()) {
      this.line.refreshWidthHeight(this);
    } else if (display === STYLES.DISPLAY.INLINE_BLOCK) {
      // 如果是inline-block  这里仅计算高度
      this._bindLine();
    }
  }

  // 计算自身的高度
  _measureLayout() {
    let width = 0; // 需要考虑原本的宽度
    let height = 0;
    this._getChildrenInFlow().forEach((child) => {
      // calc width and height
    });

    return { width, height };
  }

  // ...
}
```

代码部分就是遍历在文档流中的直接子节点来累加高度以及宽度，另外处理上比较麻烦的是对于一行会有多个节点的情况，比如`inline-block`和`flex`，这里增加了`Line`对象来辅助管理，在`Line`实例中会对当前行内的对象进行管理，子节点会绑定到一个行实例，直到这个`Line`实例达到最大限制无法加入，父节点计算尺寸时如果读取到`Line`则直接读取所在行的实例。

这里`Text` `Image`等自身有内容的节点就需要继承后重写`_measureLayout`方法，`Text`在内部计算换行后的宽度与高度，`Image`则计算缩放后的尺寸。

```javascript
class Text extends Element {
  // 根据设置的文字大小等来计算换行后的尺寸
  _measureLayout() {
    this._calcLine();
    return this._layout;
  }
}
```

### 计算位置

计算完尺寸后就可以计算位置了，这里遍历方式需要从父到子进行广度优先遍历，对于一个元素来说，只要确定了父元素以及上一个元素的位置，就可以确定自身的位置。

这一步只需要考虑根据父节点已经上一个节点的位置来确认自身的位置，如果不在文档流中则根据最近的参考节点进行定位。

相对复杂的是如果是绑定了`Line`实例的节点，则在`Line`实例内部进行计算，在`Line`内部的计算则是类似的，不过需要另外处理对齐方式以及自动换行等逻辑。

```javascript
// 代码仅保留核心逻辑
_initPosition() {
    // 初始化ctx位置
    if (!this._isInFlow()) {
      // 不在文档流中处理
    } else if (this._isFlex() || this._isInlineBlock()) {
      this.line.refreshElementPosition(this)
    } else {
      this.x = this._getContainerLayout().contentX
      this.y = this._getPreLayout().y + this._getPreLayout().height
    }
  }
```

```javascript
class Line {
  // 计算对齐
  refreshXAlign() {
    if (!this.end.parent) return;
    let offsetX = this.outerWidth - this.width;
    if (this.parent.renderStyles.textAlign === "center") {
      offsetX = offsetX / 2;
    } else if (this.parent.renderStyles.textAlign === "left") {
      offsetX = 0;
    }
    this.offsetX = offsetX;
  }
}
```

好了这一步完成后布局处理器的工作就完成了，接下来框架会将节点输入渲染器进行渲染。

## 渲染器

对于绘制单个节点来说分为以下几个步骤：

- 绘制阴影,因为阴影是在外面的，所以需要在裁剪之前绘制
- 绘制裁剪以及边框
- 绘制背景
- 绘制子节点以及内容，如 `Text` 和 `Image`

对于渲染单个节点来说，功能比较常规，渲染器基本功能是根据输入来绘制不同的图形、文字、图片，因此我们只需要实现这些 api 就可以了，然后将节点的样式通过这些 api 按顺序来渲染出来，这里又说到顺序了，那么渲染这一步我们应该按照什么顺序呢。这里给出答案*深度优先遍历*。

canvas 默认合成模式下，在同一位置绘制，后渲染的会覆盖在上面，也就是说后渲染的节点的`z-index`更大。（由于复杂度原因，目前没有实现像浏览器*合成层*的处理，暂时是不支持手动设置`z-index`的。）

另外我们还需要考虑一种情况，如何去实现`overflow:hidden`效果呢，比如圆角，在 canvas 中超出的内容我们需要进行裁剪显示，但是仅仅对父节点裁剪是不符合需求的，在浏览器中父节点的裁剪效果是可以对子节点生效的。

在 canvas 中一个完整的裁剪过程调用是这样的.

```javascript
// save ctx status
ctx.save();

// do clip
ctx.clip();

// do something like paint...

// restore ctx status
ctx.restore();
//
```

需要了解的是，`CanvasRenderingContext2D`中的状态以栈的数据结构保存，当我们多次执行`save`后，每执行一次`restore`就会恢复到最近的一次状态

![CanvasRenderingContext2D.save()](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334262478/ba21/4778/496c/6743257609d66d02d2f0d6136ac1bdd2.png)

也就是说只有在`clip`到`restore`这个过程内绘制的内容才会被裁减，因此如果要实现父节点裁剪对子节点也生效，我们不能在渲染一个节点后马上`restore`，需要等到内部子节点都渲染完后再调用。

下面通过图片讲解

![渲染](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334261624/fcfe/db82/33dc/59a0b65cef5efe49357365c8b2310859.png)

如图，数字是渲染顺序

- 绘制节点 1，由于还有子节点，所以不能马上 restore
- 绘制节点 2，还有子节点，绘制节点 3，节点 3 没有子节点，因此执行 restore
- 绘制节点 4，没有子节点，执行 restore，注意啦，此时节点 2 内的节点都已经绘制完毕，因此需要再次执行 restore，恢复到节点 1 的绘制上下文
- 绘制节点 5，没有子节点，执行 restore，此时节点 1 内都绘制完毕，再次执行 restore

由于我们在预处理中已经实现了`Fiber`结构，并且知道节点所在父节点的位置，只需要在每个节点渲染完成后进行判断，需要调用多少次`restore`。

至此，经过漫长的 debug 以及重构，已经能正常将输入的节点渲染出来了，另外需要做的是增加对其他 css 属性的支持，此时内心已经是激动万分，但是看着控制台里输出的渲染节点，总觉得还能做点什么。

对了！每个图形的模型都保存了，那是不是可以对这些模型进行修改以及交互呢，首先定一个小目标，实现事件系统。

## 事件处理器

canvas 中的图形并不能像 dom 元素那样响应事件，因此需要对 dom 事件进行代理，判断在 canvas 上发生事件的位置，再分发到对应的 canvas 图形节点。

如果按照常规的事件总线设计思路，我们只需要将不同的事件保存在不同的`List`结构中，在触发的时候遍历判断点是否在节点区域，但是这种方案肯定不行，究其原因还是性能问题。

在浏览器中，事件的触发分为*捕获*与*冒泡*，也就是说要按照节点的层级从顶至下先执行*捕获*，触及到最深的节点后，再以相反的顺序执行*冒泡*过程，`List`结构无法满足，遍历这个数据结构的时间复杂度会很高，体现到用户体验上就是操作有延迟。

经过一阵的头脑风暴后想到事件其实也可以保存在树结构中，将有事件监听的节点抽离出来组成一个新的树，可以称之为“事件树”，而不是保存在原节点树上。

![Event Tree](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334263220/8f8d/ef09/fabb/e22a62d5da464fe0b616e1c055109e75.png)

如图，在 1、2、3 节点挂载 click 事件，会在事件处理器内生成另一个回调树结构，在回调时只需要对这个树进行遍历，并且可以进行剪枝优化，如果父节点没有触发，则这个父节点下的子元素都不需要遍历，提高性能表现。

另外一个重点就是判定事件点是否在元素内，对于这个问题，已经有了许多成熟的算法，如*射线法*：

时间复杂度：O(n) 适用范围：任意多边形

算法思想：
以被测点 Q 为端点，向任意方向作射线（一般水平向右作射线），统计该射线与多边形的交点数。如果为奇数，Q 在多边形内；如果为偶数，Q 在多边形外。

但是对于我们这个场景，除了圆角外都是矩形，而圆角处理起来会比较麻烦，因此初版都是使用矩形来进行判断，后续再作为优化点改进。

按照这个思路就可以实现我们简易的事件处理器。

```javascript
class EventManager {
  // ...

  // 添加事件监听
  addEventListener(type, callback, element, isCapture) {
    // ...
    // 构造回调树
    this.addCallback(callback, element, tree, list, isCapture);
  }

  // 事件触发
  _emit(e) {
    const tree = this[`${e.type}Tree`];
    if (!tree) return;

    /**
     * 遍历树，检查是否回调
     * 如果父级没有被触发，则子级也不需要检查，跳到下个同级节点
     * 执行capture回调，将on回调添加到stack
     */
    const callbackList = [];
    let curArr = tree._getChildren();
    while (curArr.length) {
      walkArray(curArr, (node, callBreak, isEnd) => {
        if (
          node.element.isVisible() &&
          this.isPointInElement(e.relativeX, e.relativeY, node.element)
        ) {
          node.runCapture(e);
          callbackList.unshift(node);
          // 同级后面节点不需要执行了
          callBreak();
          curArr = node._getChildren();
        } else if (isEnd) {
          // 到最后一个还是没监测到，结束
          curArr = [];
        }
      });
    }

    /**
     * 执行on回调，从子到父
     */
    for (let i = 0; i < callbackList.length; i++) {
      if (!e.currentTarget) e.currentTarget = callbackList[i].element;
      callbackList[i].runCallback(e);
      // 处理阻止冒泡逻辑
      if (e.cancelBubble) break;
    }
  }

  // ...
}
```

事件处理器完成后，可以来实现一个`scroll-view`了，内部实现原理是用两个 view，外部固定宽高，内部可以撑开，外部通过事件处理器注册事件来控制渲染的`transform`值，需要注意的是，`transform`渲染后，子元素的位置就不在原来的位置了，所以如果在子元素挂载了事件会偏移，这里在`scroll-view`内部注册了相应的捕获事件，当事件传入`scroll-view`内部后，修改事件实例的相对位置，来纠正偏移。

```javascript
class ScrollView extends View {
  // ...

  constructor(options, children) {
    // ...
    // 内部再初始化一个scroll-view，高度自适应，外层宽高固定
    this._scrollView = new View(options, [this]);
    // ...
  }

  // 为自己注册事件
  addEventListener() {
    // 注册捕获事件，修改事件的相对位置
    this.eventManager.EVENTS.forEach((eventName) => {
      this.eventManager.addEventListener(
        eventName,
        (e) => {
          if (direction.match("y")) {
            e.relativeY -= this.currentScrollY;
          }
          if (direction.match("x")) {
            e.relativeX -= this.currentScrollX;
          }
        },
        this._scrollView,
        true
      );
    });

    // 处理滚动
    this.eventManager.addEventListener("mousewheel", (e) => {
      // do scroll...
    });

    // ...
  }
}
```

## 重排重绘

除了生成静态布局功能外，框架也有重绘重排的过程，当修改了节点的属性后会触发，内部提供了`setStyle`,`appendChild`等 api 来修改样式或者结构，会根据属性值来确认是否需要重排，如修改`width`会触发重排后重绘，修改`backgroundColor`则只会触发重绘,比如 scroll-view 滚动时，只是改变了 transform 值，只会进行重绘。

## 兼容性

虽然框架本身不依赖 dom，直接基于`CanvasRenderingContext2D`进行绘制，但是一些场景下仍需要作兼容性处理，下面举几个例子。

- 微信小程序平台绘制图片 api 与标准不同，因此在 image 组件判断了平台，如果是微信则调用微信特定 api 进行获取
- 微信小程序平台设置字体粗细在 iOS 真机上不生效，内部判断平台后，会将文字绘制两次，第二次在第一次基础上进行偏移，形成加粗效果。

## 自定义渲染

虽然框架本身已经支持大部分场景的布局，但是业务需求场景复杂多变，所以提供了自定义绘制的能力，即只进行布局，绘制方法交给开发者自行调用，提供更高的灵活性。

```javascript
engine.createElement((c) => {
  return c("view", {
    render(ctx, canvas, target) {
      // 这里可以获取到ctx以及布局信息，开发者绘制自定义内容
    },
  });
});
```

# web 框架中使用

虽然 api 本身相对简单，但是仍然需要写一些重复的代码，结构复杂的时候不便于阅读。

当在现代 web 框架中使用时，可以采用相应的框架版本，比如 vue 版本，内部会将 vue 节点转换为 api 调用，使用起来会更易于阅读，但是需要注意，由于内部会有节点转换过程，相比直接使用会有性能损耗，在结构复杂时差异会较明显。

```html
<i-canvas :width="300" :height="600">
  <i-scroll-view :styles="{height:600}">
    <i-view>
      <i-image
        :src="imageSrc"
        :styles="styles.image"
        mode="aspectFill"
      ></i-image>
      <i-view :styles="styles.title">
        <i-text>Hello World</i-text>
      </i-view>
    </i-view>
  </i-scroll-view>
</i-canvas>
```

# 调试

鉴于业务场景比较简单，框架目前提供的调试工具还比较基础，通过设置`debug`参数可以开启节点布局的调试，框架会将所有节点的布局绘制出来，如果需要查看单个节点的布局，需要通过挂载事件后打印到控制台进行调试。后续核心功能完善后会提供更全面的可视化调试工具。

# 成果

经过亲身体验，在一般页面的开发效率上，已经与写 html 不相上下，这里为了展示成果，我写了一个简单的组件库 demo 页。

![在canvas中开发组件库](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334260990/2812/5614/fb67/1b21997c3528fa750459ad06d6e21319.png)

> [源码](https://github.com/Gitjinfeiyang/easy-canvas)

> [组件库Demo](https://gitjinfeiyang.github.io/easy-canvas/example/ui.html)

# 性能

框架在经过几次重构后已经取得了不错的表现，性能表现如下

![性能测试](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12334260989/039d/c99d/b4f7/ef4f95bc62133ac4468ab5fba28ee532.png)

已经做了的优化：

- 遍历算法优化
- 数据结构优化
- scroll-view 重绘优化
  - scroll-view 重绘只渲染范围内的元素
  - scroll-view 可视范围外的元素不会渲染
- 图片实例缓存，虽然有 http 缓存，但是对于同样的图片会产生多个实例，内部做了实例缓存

待优化：

- 可中断渲染，由于我们已经实现了类似`Fiber`结构，所以后续有需要加上这个特性也比较方便
- 预处理器还需要增强，增强对于用户输入的样式与结构的兼容，增强健壮性

# 总结

从最初想实现一个简单的图片渲染功能，最后实现了一个简易的 canvas 排版引擎，虽然实现的 feature 有限并且还有不少细节与 bug 需要修复，但是已经具有基本的布局以及交互能力，其中还是踩了不少坑，重构了很多次，同时也不禁感叹浏览器排版引擎的强大。并且从中也体会到了算法与数据结构的魅力，良好的设计是性能高、维护性佳的基石，也获得不少乐趣。

另外这种模式经过完善后个人觉得还是有不少想象力，除了简单的图片生成，还可以用于 h5 游戏的列表布局、海量数据的表格渲染等场景，另外后期还有一个想法，目前社区渲染这块已经有很多做的不错的库，所以想将布局以及计算换行、图片缩放等功能独立出来一个单独的工具库，通过集成其他库来进行渲染。

本人表达能力有限，可能还是有很多细节没有得到澄清，也欢迎大家评论交流。

# 感谢阅读

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
