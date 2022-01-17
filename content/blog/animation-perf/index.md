---
title: 从浏览器渲染原理谈动画性能优化
date: 2022-01-17T02:37:46.404Z
description: 设备硬件性能的提升、浏览器内核的升级给在网页端实现流畅动画提供了可能。目前，常规设备的刷新频率是 60HZ，也就是说，如果要让用户感受不到明显卡顿，浏览器的渲染流水线需要每秒输出 60 张图片（60 FPS）。本文会从基础的渲染树出发，介绍浏览器渲染流水线，以及常用的优化动画性能的方法。
---

![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12353861854/f123/3b6d/a2ba/117fe261e033b9609d503fd41ebfc0a3.png)

> 图片来源：<https://colachan.com/post/3444>

> 本文作者：[Bermudarat](https://github.com/Bermudarat)

# 前言

在越来越多的业务中，前端页面除了展示数据和提供用户操作的 UI，也需要带给用户更丰富的交互体验。动画作为承载，已经成为日常前端开发，尤其是 C 端开发的必选项。设备硬件性能的提升、浏览器内核的升级也给在页面端实现流畅动画提供了可能。目前，常规设备的刷新频率通常是 60HZ，也就是说，如果要让用户感受不到明显卡顿，浏览器的渲染流水线需要每秒输出 60 张图片（60 FPS）。
接下来，文章会从基础的渲染树出发，介绍浏览器渲染流水线，以及常用的优化动画性能的方法。

# 渲染基础

## 渲染树

尽管不同的渲染引擎渲染流程不同，但是都需要解析 HTML 和 CSS 用于生成渲染树。前端开发接触最多的渲染引擎是 WebKit（以及在其基础上派生的 Blink)，接下来本文会以 Webkit 为基础介绍渲染树。

![The Compositing Forest](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12021949166/7c3a/2fae/e3aa/0d4a76f2c154f32a6609c7676909ae15.png)

图片来自[GPU Accelerated Compositing in Chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome)

上图中，除了我们熟悉的 DOM 树外，还有 `RenderObject` 树，`RenderLayer` 树，`GraphicsLayer` 树，它们共同构成了 "渲染森林"。

### `RenderObject`

`RenderObject` 保存了绘制 DOM 节点所需要的各种信息，与 DOM 树对应，`RenderObject` 也构成了一颗树。但是`RenderObject` 的树与 DOM 节点并不是一一对应关系。《Webkit 技术内幕》指出，如果满足下列条件，则会创建一个 `RenderObject`：

*   DOM 树中的 `document` 节点；
*   DOM 树中的可见节点（webkit 不会为非可视节点创建 `RenderObject` 节点）；
*   为了处理需要，Webkit 建立匿名的 `RenderObject` 节点，如表示块元素的 `RenderBlock`（`RenderObject` 的子类）节点。

将 DOM 节点绘制在页面上，除了要知道渲染节点的信息外，还需要各渲染节点的层级。浏览器提供了 `RenderLayer` 来定义渲染层级。

### `RenderLayer`

`RenderLayer` 是浏览器基于 `RenderObject` 创建的。`RenderLayer` 最初是用来生成层叠上下文 (stacking context)，以保证页面元素按照正确的层级展示。同样的， `RenderObject` 和 `RenderLayer` 也不是一一对应的，`RenderObject` 如果满足以下条件，则会创建对应的 `RenderLayer` （ [GPU Accelerated Compositing in Chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome)）：

*   文档的根节点；
*   具有明确 CSS 定位信息的节点（如 `relative`，`absolute` 或者 `transform`）
*   透明节点；
*   有 `overflow`，`mask` 或者 `reflection` 属性的节点；
*   有 `filter` 属性的节点；
*   有 3D Context 或者加速的 2D Context 的 `Canvas` 节点；
*   对应 `Video` 元素的节点。

我们可以将每一个 `RenderLayer` 想象成一个图层。渲染就是在每个 `RenderLayer` 图层上，将 `RenderObject` 绘制出来。这个过程可以使用 CPU 绘制，这就是软件绘图。但是软件绘图是无法处理 3D 的绘图上下文，每一层的 `RenderObject` 中都不能包含使用 3D 绘图的节点，例如有 3D Contex 的 `Canvas` 节点，也不能支持 CSS 3D 变化属性。此外，页面动画中，每次元素尺寸或者位置变动，都要重新去构造 `RenderLayer` 树，触发 Layout 及其后续的渲染流水线。这样会导致页面帧率的下降，造成视觉上的卡顿。所以现代浏览器引入了由 GPU 完成的硬件加速绘图。

在获得了每一层的信息后，需要将其合并到同一个图像上，这个过程就是合成（Compositing），使用了合成技术的称之为合成化渲染。

在软件渲染中，实际上是不需要合成的，因为软件渲染是按照从前到后的顺序在同一个内存空间完成每一层的绘制。在现代浏览器尤其是移动端设备中，使用 GPU 完成的硬件加速绘图更为常见。由 GPU 完成的硬件加速绘图需要合成，而合成都是使用 GPU 完成的，这整个过程称之为硬件加速的合成化渲染。
现代浏览器中，并不是所有的绘图都需要使用 GPU 来完成，《Webkit 技术内幕》中指出：

> 对于常见的 2D 绘图操作，使用 GPU 来绘图不一定比使用 CPU 绘图在性能上有优势，例如绘制文字、点、线等，原因是 CPU 的使用缓存机制有效减少了重复绘制的开销而不需要 GPU 并行性。

### `GraphicsLayer`

为了节省 GPU 的内存资源，Webkit 并不会为每个 `RenderLayer` 分配一个对应的后端存储。而是按照一定的规则，将一些 `RenderLayer` 组合在一起，形成一个有后端存储的新层，用于之后的合成，称之为合成层。合成层中，存储空间使用 `GraphicsLayer` 表示。对于一个 `RenderLayer` 对象，如果没有单独提升为合成层，则使用其父对象的合成层。如果一个 `RenderLayer` 具有以下几个特征之一 （ [GPU Accelerated Compositing in Chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome)），则其具有自己的合成层：

*   有 3D 或者透视变换的 CSS 属性；
*   包含使用硬件加速的视频加码技术的 `Video` 元素；
*   有 3D Contex 或者加速的 2D Context 的 `Canvas` 元素；(注：普通的 2D Context 不会提升为合成层)；
*   有 `opacity`、`transform` 改变的动画；
*   使用了硬件加速的 CSS filter 技术；
*   后代包含一个合成层；
*   Overlap 重叠：有一个 Z 坐标比自己小的兄弟节点，且该节点是一个合成层。

对于 Overlap 重叠造成的合成层提升，[Compositing in Blink / WebCore: From WebCore::RenderLayer to cc:Layer](https://docs.google.com/presentation/d/1dDE5u76ZBIKmsqkWi2apx3BqV8HOcNf4xxBdyNywZR8/edit#slide=id.gccb6cccc\_097) 给出了三幅图片：
![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12022847399/2efa/8508/1dec/89f2a3d9e278a7859cb4a0ff51a4d0c1.jpg)
图 1 中，顶部的绿色矩形和底部的蓝色矩形是兄弟节点，蓝色矩形因为某种原因被提升为合成层。如果绿色矩形不进行合成层提升的话，它将和父节点共用一个合成层。这就导致在渲染时，绿色矩形位于蓝色矩形的底部，出现渲染出错（图 2）。所以如果发生重叠，绿色矩形也需要被提升为合成层。

对于合成层的提升条件，[无线性能优化：Composite](https://fed.taobao.org/blog/taofed/do71ct/performance-composite/) 中有更详细的介绍。结合 `RenderLayer` 和 `GraphicsLayer` 的创建条件，可以看出动画（尺寸、位置、样式等改变）元素更容易创建 `RenderLayer`，进而提升为合成层（这里要注意，并不是所有的 CSS 动画元素都会被提升为合成层，这个会在后续的渲染流水线中介绍）。这种设计使浏览器可以更好使用 GPU 的能力，给用户带来流畅的动画体验。

使用 Chrome 的 DevTools 可以方便地查看页面的合成层：
选择 “More tools -> Layers”
![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12021950074/7022/d08e/8aab/7c9f085e604e1d36eab3da73a5af8a85.jpg)
上图中，不仅可以看到云音乐首页的合成层，也可以详细看到每个合成层创建的原因。例如，页面底部的播放栏被提升为合成层的原因是 “Overlaps other composited content”，这对应 “Overlap 重叠：有一个 Z 坐标比自己小的兄弟节点，且该节点是一个合成层”。

在前端页面，尤其是在动画过程中，由于 Overlap 重叠导致的合成层提升很容易发生。如果每次都将重叠的顶部 `RenderLayer` 提升为合成层，那将消耗大量的 CPU 和内存（Webkit 需要给每个合成层分配一个后端存储）。为了避免 “层爆炸” 的发生，浏览器会进行层压缩（Layer Squashing）：如果多个 `RenderLayer` 和同一个合成层重叠时，这些 `RenderLayer` 会被压缩至同一个合成层中，也就是位于同一个合成层。但是对于某些特殊情况，浏览器并不能进行层压缩，就会造成创建大量的合成层。[无线性能优化：Composite](https://fed.taobao.org/blog/taofed/do71ct/performance-composite/) 中介绍了会导致无法进行合成层压缩的几种情况。篇幅原因，就不在此文中进行介绍。

`RenderObjectLayer`、 `RenderLayer`、 `GraphicsLayer` 是 Webkit 中渲染的基础，其中 `RenderLayer` 决定了渲染的层级顺序，`RenderObject` 中存储了每个节点渲染所需要的信息，`GraphicsLayer` 则使用 GPU 的能力来加速页面的渲染。

## 渲染流水线

在浏览器创建了渲染树，会如何将这些信息呈现在页面上，这就要提到渲染流水线。
对于下面的代码：

```html
<body>
    <div id="button">点击增加</div>
    <script>
        const btn = document.getElementById('button');
        btn.addEventListener('click', () => {
            const div = document.createElement("div");
            document.body.appendChild(div);
        });
    </script>
 </body>
```

在 DevTools 中的 Performance 标签可以记录并查看页面的渲染过程（所示图片宽度限制，没有截取合成线程获取事件输入部分）。
![chrome流水线](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12143849683/d5f2/2e0b/d6de/fe06e96038deccdd2dff44673e5b7caa.jpg)
这个过程，与[Aerotwist - The Anatomy of a Frame](https://aerotwist.com/blog/the-anatomy-of-a-frame/) 给出的渲染流水线的示意图几乎是一致的。
![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12057062127/6cea/3fde/7d2a/77dd40417b48679bce308950554f8d71.jpg)

渲染流水线的示意图中有两个进程：渲染进程（Renderer Process）和 GPU 进程（GPU Process）。
每个页面 Tab 都有单独的渲染进程，它包括以下的线程（池）:

*   **合成线程（Compositor Thread）**: 负责接收浏览器的垂直同步信号（Vsync，指示前一帧的结束和后一帧的开始），也负责接收滚动、点击等用户输入。在使用 GPU 合成情况下，产生绘图指令。
*   **主线程（Main Tread）**: 浏览器的执行线程，我们常见的 Javascript 计算，Layout，Paint 都在主线程中执行。
*   **光栅化线程池（Raster/Tile worker）**：可能有多个光栅化线程，用于将图块（tile）光栅化。（如果主线程只将页面内容转化为绘制指令列表，在在此执行绘制指令获取像素的颜色值）。

GPU 进程（GPU Process）不是在 GPU 中执行的，而是负责将渲染进程中绘制好的 tile 位图作为纹理上传至 GPU，最终绘制至屏幕上。

下面详细介绍下整个渲染流程:

### 1. 帧开始（Frame Start）

浏览器发送垂直同步信号（Vsync)， 表明新一帧的开始。

### 2. 处理输入事件（Input event handlers）

合成线程将输入事件传递给主线程，主线程处理各事件的回调（包括执行一些 Javascript 脚本）。在这里，所有的输入事件（例如 `touchmove`、`scroll`、`click`）在每一帧只会被触发一次。

### 3. `requestAnimiationFrame`

如果注册了 `requestAnimiationFrame`（rAF）函数，rAF 函数将在这里执行。

### 4. HTML 解析（Parse HTML）

如果之前的操作造成了 DOM 节点的变更（例如 `appendChild`），则需要执行 HTML 解析。

### 5. 样式计算（Recalc Styles）

如果在之前的步骤中修改了 CSS 样式，浏览器需要重新计算修改的 DOM 节点以及子节点样式。

### 6. 布局（Layout）

计算每一个可见元素的尺寸、位置等几何信息。通常需要对整个 `document` 执行 Layout，部分 CSS 属性的修改不会触发 Layout（参考 [CSS triggers](https://csstriggers.com/)）。[避免大型、复杂的布局和布局抖动 ](https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing?hl=zh-cn)指出，对浏览器几何元计算，在 Chrome、Opera、Safari 和 Internet Explorer 中称为布局（Layout）。 在 Firefox 中称为自动重排（Reflow），但实际上其过程是一样的。

### 7. 更新渲染树（Update Layer Tree）

接下来就需要更新渲染树。DOM 节点和 CSS 样式的改变都会导致渲染树的改变。

### 8. 绘制（Paint）

实际上的绘制有两步，这里指的是第一步：生成绘制指令。浏览器生成的绘制指令与 `Canvas` 提供的绘制 API 很相似。DevTools 中可以进行查看：
![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12058893713/dfe3/cfc6/e95f/bef9375801f2d47352d20a77c38b887f.jpg)
这些绘制指令形成了一个绘制列表，在 Paint 阶段输出的内容就是这些绘制列表（`SkPicture`）。

> The SkPicture is a serializable data structure that can capture and then later replay commands, similar to a display list.

### 9. 合成（Composite）

在 DevTools 中这一步被称为 Composite Layers，主线程中的合成并不是真正的合成。主线程中维护了一份渲染树的拷贝（`LayerTreeHost`），在合成线程中也需要维护一份渲染树的拷贝（`LayerTreeHostImpl`）。有了这份拷贝，合成线程可以不必与主线程交互来进行合成操作。因此，当主线程在进行 Javascript 计算时，合成线程仍然可以正常工作而不被打断。

在渲染树改变后，需要进行着两个拷贝的同步，主线程将改变后的渲染树和绘制列表发送给合成线程，同时阻塞主线程保证这个同步能正常进行，这就是 Composite Layers。这是渲染流水线中主线程的最后一步，换而言之，这一步只是生成了用于合成的数据，并不是真正的合成过程。

### 10. 光栅化（Raster Scheduled and Rasterize）

合成线程在收到主线程提交的信息（渲染树、绘制指令列表等），就将这些信息进行位图填充，转化为像素值，也就是光栅化。Webkit 提供了一个线程池来进行光栅化，线程池中线程数和平台和设备性能有关。由于合成层每一层大小是整个页面大小，所以在光栅化之前，需要先对页面进行分割，将图层转化为图块（tile）。这些图块的大小通常是 256\*256 或者 512\*512。在 DevTools 的 “More tools -> Rendering” 中，选择 “Layer borders” 可以查看。
![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12059260054/6088/dfd1/9347/190a70a5f6256b35f32f848f0fd3b657.jpg)
上图展示了一个页面被划分的图块，橙色是合成层的边框，青色是分块信息。光栅化是针对于每一个图块进行的，不同图块有不同的光栅化优先级，通常位于浏览器视口（viewpoint）附近的图块会首先被光栅化（更详细的可以参考 [Tile Prioritization Design
](https://docs.google.com/document/d/1tkwOlSlXiR320dFufuA_M-RF9L5LxFWmZFg5oW35rZk/edit#)。现代浏览器里，光栅化并不是在合成线程里进行的，渲染进程维护了一个光栅化的线程池，也就是图中的（Compositor Tile Workers)， 线程池中线程数取决于系统和设备兼容性。

光栅化可以分为软件光栅化（Software Rasterization）和硬件光栅化（Hardware Rasterization）， 区别在于位图的生成是在 CPU 中进行，之后再上传至 GPU 合成，还是直接在 GPU 中进行绘图和图像素填充。硬件光栅化的过程如下图所示：
![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/11967198413/644a/135a/c680/371b5fa654d59f0c8ccb2f4f0658c20a.png)

图片来自[Raster threads creating the bitmap of tiles and sending to GPU](https://developers.google.com/web/updates/2018/09/inside-browser-part3)

我们可以在[chrome://gpu/ ](chrome://gpu/)中查看 Chrome 的硬件光栅化是否开启。
![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12063745998/f784/fd0c/9427/93fc7b186615d3c88b09379c01d1ff2d.jpg)

### 11. 帧结束（Frame End）

图块的光栅化完成后，合成线程会收集被称为 draw quads 的图块信息用于创建合成帧（compositor frame）。合成帧被发送给 GPU 进程，这一帧结束。

> Draw quads: Contains information such as the tile's location in memory and where in the page to draw the tile taking in consideration of the page compositing.
> Compositor frame: A collection of draw quads that represents a frame of a page.

### 12. 图像显示

GPU 进程负责与 GPU 通信，并完成最后图像的绘制。GPU 进程接收到合成帧，如果使用了硬件光栅化，光栅化的纹理已经存储在 GPU 中。浏览器中提供了用于绘图的 3D API（如 Webkit 的 `GraphicsContext3D` 类）将各纹理合并绘制到同一个位图中。

前文中提过，对于设置了透明度等动画的元素，会单独提升为合成层。而这些变化，实际是设置在合成层上的，在纹理合并前，浏览器通过 3D 变形作用到合成层上，即可以完成特定的效果。所以我们才说使用 `transfrom` 和透明度属性的动画，可以提高渲染效率。因为这些动画在执行过程中，不会改变布局结构和纹理，也就是不会触发后续的 Layout 和 Paint。

# 动画性能优化

上面介绍了浏览器的渲染流水线，但是并不是每次一次渲染都会触发整个流水线。其中的某些步骤也不一定只会被触发一次。下面按照渲染流水线的顺序，来介绍提高渲染效率的几种方式：

## 合理处理页面滚动

在浏览器的渲染流水线里，合成线程是用户输入事件的入口，当用户的输入事件发生时，合成线程需要确定是否需要由主线程参与后续渲染。比如当用户滚动页面，所有图层已经被光栅化了，合成线程可以直接进行合成帧的生成，并不需要主线程的参与。如果用户在一些元素上绑定了事件处理，那么合成线程会标记这些区域为非快速滚动区域（non-fast scrollable region）。当用户在非快速滚动滚动区域发生输入事件时，合成线程会将此事件传递给主线程进行 Javascript 计算和后续处理。
在前端开发中，经常使用事件委托这种方式将一些元素的事件委托到其父元素或者更外层的元素上（例如 `document`），通过事件冒泡出发其外层元素的绑定事件，在外层元素上执行函数。事件委托可以减少因为多个子元素绑定同样事件处理函数导致的内存消耗，也能支持动态绑定，在前端开发中应用很广。

如果使用事件委托的形式，在 `document` 上绑定事件处理，那么整个页面都会被标记为非快速滚动区域。这就意味合成线程需要将每次用户输入事件都发送给主线程，等待主线程执行 Javascript 处理这些事件，之后再进行页面的合成和显示。在这种情况下，流畅的页面滚动是很难实现的。

为了优化上面的问题，浏览器的 `addEventListener` 的第三个参数提供了`{ passive: true }`（默认为 `false`），这个选项告诉合成线程依然需要将用户事件传递给主线程去处理，但是合成线程也会继续合成新的帧，不会被主线程的执行阻塞，此时事件处理函数中的 `preventDefault` 函数是无效的。

```js
document.body.addEventListener('touchstart', event => {
    event.preventDefault(); // 并不会阻止默认的行为
 }, { passive: true });
```

![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/11987824048/35ab/6b73/16f8/6fda6b7355162ca393787e870630a083.png)

图片来自[Inside look at modern web browser (part 4) ](https://developers.google.com/web/updates/2018/09/inside-browser-part4)

此外，在例如懒加载等业务场景中，经常需要监听页面滚动去判断相关元素是否处于视口中。常见的方法是使用 `Element.getBoundingClientReact()` 获取相关元素的边界信息，进而计算是否位于视口中。主线程中，每一帧都调用 `Element.getBoundingClientReact()` 会造成性能问题（例如不当使用导致页面强制重排）。[Intersection Observer API](https://developer.mozilla.org/zh-CN/docs/Web/API/Intersection_Observer_API) 提供了一种异步检测目标元素与祖先元素或视口相交情况变化的方法。这个 API 支持注册回调函数，当被监视的元素合其他元素的相交情况发生变化时触发回调。这样，就将相交的判断交给浏览器自行管理优化，进而提高滚动性能。

## Javascript 优化

### 减少主线程中 Javascript 的执行时间

针对于帧率为 60FPS 的设备，每个帧需要在 16.66 毫秒内执行完毕，如果无法完成此需求，则会导致内容在屏幕上抖动，也就是卡顿，影响用户体验。在主线程中，需要对用户的输入进行计算，为了保证用户的体验，需要在主线程中避免长时间的计算，防止阻塞后续的流程。
[优化 JavaScript 执行](https://developers.google.com/web/fundamentals/performance/rendering/optimize-javascript-execution?hl=zh-cn)一文中，提出了以下几点来优化 Javascript：

> 1.  对于动画效果的实现，避免使用 setTimeout 或 setInterval，请使用 requestAnimationFrame。
> 2.  将长时间运行的 JavaScript 从主线程移到 Web Worker。
> 3.  使用微任务来执行对多个帧的 DOM 更改。
> 4.  使用 Chrome DevTools 的 Timeline 和 JavaScript 分析器来评估 JavaScript 的影响。

使用 `setTimeout`/`setTimeInterval` 来执行动画时，因为不确定回调会发生在渲染流水线中的哪个阶段，如果正好在末尾，可能会导致丢帧。而渲染流水线中，rAF 会在 Javascript 之后、Layout 之前执行，不会发生上述的问题。而将纯计算的工作转移到 Web Worker，可以减少主线程中 Javascript 的执行时间。对于必须在主线程中执行的大型计算任务，可以考虑将其分割为微任务，并在每帧的 rAF 或者 `RequestIdleCallback` 中处理（参考 React Fiber 的实现）。

### 减少不合理 Javascript 代码导致的强制重排（Force Layout）

渲染流水线中，Javascript/rAF 的操作可能会改变渲染树，进而触发后续的 Layout。如果在 Javascript/rAF 中访问了比如 `el.style.backgroundImage`、`el.style.offsetWidth` 等布局属性或者计算属性，可能会触发强制重排（Force Layout），导致后续的 Recalc styles 或者 Layout 提至此步骤之前执行，[影响渲染效率](https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing?hl=en#avoid-layout-thrashing)。

```js
requestAnimationFrame(logBoxHeight);
function logBoxHeight() {
  box.classList.add('super-big');
  // 为了获取到box的offsetHeight值，浏览器需要在先应用super-big的样式改变，然后进行布局（Layout）
  console.log(box.offsetHeight);
}
```

合理的做法是

```js
function logBoxHeight() {
  console.log(box.offsetHeight);
  box.classList.add('super-big');
}
```

## 减少 Layout 和 Paint

也就是老生常谈的减少重排和重绘。针对渲染流水线的 Layout、Paint 和合成这三个阶段，Layout 和 Paint 相对比较耗时。但是并不是所有的帧变化都需要经过完整的渲染流水线：对于 DOM 节点的修改导致其尺寸和位置发生改变时，会触发 Layout；而如果改变并不影响它在文档流中的位置，浏览器不需要重新计算布局，只需要生成绘制列表，进行 Paint。Paint 是以合成层为单位的，一旦更改了某个会触发 Paint 的元素样式，该元素所在的合成层都会重新 Paint。因此，所以对于某些动画元素，可以将其提升为单独的合成层，减少 Paint 的范围。

### 合成层提升

在介绍渲染树的时候提到满足某些条件的 `RenderObjectLayer` 会被提升为合成层，合成层的绘制是在 GPU 中进行的，比 CPU 的性能更好；如果该合成层需要 Paint，不会影响其他的合成层；一些合成层的动画，不会触发 Layout 和 Paint。下面介绍几种在开发中常用的合成层提升的方式：

#### 使用`transform`和`opacity`书写动画

上文提出，如果一个元素使用了 CSS 透明效果的动画或者 CSS 变换的动画，那么它会被提升为合成层。并且这些动画变换实际上是应用在合成层本身上。这些动画的执行过程不需要主线程的参与，在纹理合成前，使用 3D API 对合成层进行变形即可。

```css
  #cube {
      transform: translateX(0);
      transition: transform 3s linear;
  }

  #cube.move {
      transform: translateX(100px);
  }
```

```html
<body>
    <div id="button">点击移动</div>
    <div id="cube"></div>
    <script>
        const btn = document.getElementById('button');
        btn.addEventListener('click', () => {
            const cube = document.getElementById('cube');
            cube.classList = 'move';
        });
    </script>
 </body>
```

对于上面的动画，只有在动画开始后，才会进行合成层的提升，动画结束后合成层提升也会消失。这也就避免了浏览器创建大量的合成层造成的 CPU 性能损耗。
![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12239620510/7226/4d82/aab6/0dc54023148c82d6098fc0705e46a735.webp)

#### `will-change`

这个属性告诉了浏览器，接下来会对某些元素进行一些特殊变换。当 `will-change` 设置为 `opacity`、`transform`、`top`、`left`、`bottom`、`right`（其中 `top`、`left`、`bottom`、`right` 等需要设置明确的定位属性，如 `relative` 等），浏览器会将此元素进行合成层提升。在书写过程中，需要避免以下的写法：

```css
*{ will-change: transform, opacity; }
```

这样，所有的元素都会被提升为单独的合成层，造成大量的内存占用。所以需要只针对动画元素设定 `will-change`，且动画完成之后，需要手动将此属性移除。

#### `Canvas`

使用具有加速的 2D Context 或者 3D Contex 的 `Canvas` 来完成动画。由于具有独立的合成层，`Canvas` 的改变不会影响其他合成层的绘制，这种情况对于大型复杂动画（比如 HTML5 游戏）更为适用。此外，也可以设置多个 `Canvas` 元素，通过合理的[Canvas 分层](https://developer.ibm.com/tutorials/wa-canvashtml5layering/)来减少绘制开销。

### CSS 容器模块

CSS 容器模块（CSS Containment Module）最近刚发布了[Level 3](https://www.w3.org/TR/css-contain-3/)版本。主要目标通过将特定的 DOM 元素和整个文档的 DOM 树隔离开来，使其元素的更改不会影响文档的其他部分，进而提高页面的渲染性能。CSS 容器模块主要提供了两个属性来支持这样的优化。

#### [contain](https://developer.mozilla.org/zh-CN/docs/Web/CSS/contain)

`contain` 属性允许开发者指定特定的 DOM 元素独立于 DOM 树以外。针对这些 DOM 元素，浏览器可以单独计算他们的布局、样式、大小等。所以当定义了 `contain` 属性的 DOM 元素发生改变后，不会造成整体渲染树的改变，导致整个页面的 Layout 和 Paint。
`contain` 有以下的取值：

**`layout`**

`contain` 值为 `layout` 的元素的布局将与页面整体布局独立，元素的改变不会导致页面的 Layout。

**`paint`**

`contain`值为 `paint` 的 DOM 节点，表明其子元素不会超出其边界进行展示。因此如果一个 DOM 节点是离屏或者不可见的，它的子元素可以被确保是不可见的。它还有以下作用：

*   对于 `position` 值为 `fixed` 或者 `absolute` 的子节点，`contain` 值为 `paint` 的 DOM 节点成为了一个包含块（[containing block](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Containing_block))。
*   `contain` 值为 `paint` 的 DOM 节点会创建一个层叠上下文。
*   `contain` 值为 `paint` 的 DOM 节点会创建一个格式化上下文（BFC）。

**`size`**

`contain`值为 `size` 的 DOM 节点，它的 `size` 不会受其子节点的影响。

**`style`**

`contain`值为 `style` 的 DOM 节点，表明其 CSS 属性不会影响其子节点以外的其他元素。

**`inline-size`**

`inline-size` 是 Level 3 最新增加的值。`contain` 值为 `inline-size` 的 DOM 节点，它的 [principal box](https://www.w3.org/TR/css-display-3/#principal-box)的内联轴的 [intrinsic-size](https://www.w3.org/TR/css-sizing-3/#intrinsic-size) 不受内容影响。

**`strict`**

等同于 `contain: size layout paint`

**`content`**

等同于 `contain: layout paint`

在具有大量 DOM 节点的复杂页面中，对没有在单独的合成层中的 DOM 元素进行修改会造成整个页面的 Layout 和 Paint，此时，对这些元素设置 `contain` 属性（比如 `contain：strict`）可以显著提高页面性能。

[An introduction to CSS Containment](https://blogs.igalia.com/mrego/2019/01/11/an-introduction-to-css-containment/?ref=heydesigner) 中给出了一个[长列表例子](https://blogs.igalia.com/mrego/files/2019/01/css-contain-example.html)，将长列表中的第一个 `item` 的 `contain` 属性设置为 `strict`，并改变这个 `item` 的内容，在此前后手动触发页面的强制重排。相对于没有设置为 `strict`，Javascript 的执行时间从 4.37ms 降低到 0.43ms，渲染性能有了很大的提升。`contain` 的浏览器支持情况如下所示：
![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12580238785/e7a2/3bfa/bc47/476eb25bdf017314fb5e1706de7a93d5.jpg)

#### [content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)

`contain` 属性需要我们在开发的时候就确定 DOM 元素是否需要进行渲染上的优化，并设定合适的值。`content-visibility` 则提供了另外一种方式，将它设定为 `auto`，则浏览器可以自动进行优化。上文中提到，合成线程会对每个页面大小的图层转化为图块（tile），然后针对于图块，按照一定的优先级进行光栅化，浏览器会渲染所有可能被用户查看的元素。`content-visibility` 的值设置为 `auto` 的元素，在离屏情况下，浏览器会计算它的大小，用来正确展示滚动条等页面结构，但是浏览器不用对其子元素生成渲染树，也就是说它的子元素不会被渲染。当页面滚动使其出现在视口中时，浏览器才开始对其子元素进行渲染。
但是这样也会导致一个问题：`content-visibility` 的值设置为 `auto` 的元素，离屏状态下，浏览器不会对其子元素进行 Layout，因此也无法确定其子元素的尺寸，这时如果没有显式指定尺寸，它的尺寸会是 0，这样就会导致整个页面高度和滚动条的显示出错。为了解决这个问题，CSS 提供了另外一个属性 `contain-intrinsic-size`来设置 `content-visibility` 的值为 `auto`时的元素的占位大小。这样，即使其没有显式设置尺寸，也能保证在页面 Layout 时元素仍然占据空间。

```css
.ele {
    content-visibility: auto;
    contain-intrinsic-size: 100px;
}
```

[content-visibility: the new CSS property that boosts your rendering performance](https://web.dev/content-visibility/) 给出了一个旅行博客的例子，通过合理设置 `content-visibility`，页面的首次加载性能有了 7 倍的提升。`content-visibility` 的浏览器支持情况如下所示：
![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12580241665/7b59/d3ab/74d5/462c55eefa600a7364ab4e3fe7a01f5d.jpg)

# 总结

关于浏览器渲染机制，已经有大量的文章介绍。但是部分文章，尤其是涉及到浏览器内核的部分比较晦涩。本文从浏览器底层渲染出发，详细介绍了渲染树和渲染流水线。之后按照渲染流水线的顺序，介绍了提高动画性能的方式：合理处理页面滚动、Javascript 优化、减少 Layout 和 Paint。希望对大家理解浏览器的渲染机制和日常的动画开发有所帮助。

# 参考文章

1.  Webkit 技术内幕 —— 朱永盛
2.  [GPU Accelerated Compositing in Chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome)
3.  [Compositing in Blink / WebCore: From WebCore::RenderLayer to cc:Layer](https://docs.google.com/presentation/d/1dDE5u76ZBIKmsqkWi2apx3BqV8HOcNf4xxBdyNywZR8/edit#slide=id.gccb6cccc\_097)
4.  [无线性能优化：Composite](https://fed.taobao.org/blog/taofed/do71ct/performance-composite/)
5.  [The Anatomy of a Frame](https://aerotwist.com/blog/the-anatomy-of-a-frame/)
6.  [避免大型、复杂的布局和布局抖动 ](https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing?hl=zh-cn)
7.  [Software vs. GPU Rasterization in Chromium](https://www.intel.com/content/www/us/en/developer/articles/technical/software-vs-gpu-rasterization-in-chromium.html)
8.  [优化 JavaScript 执行](https://developers.google.com/web/fundamentals/performance/rendering/optimize-javascript-execution?hl=zh-cn)
9.  [浏览器渲染流水线解析与网页动画性能优化](https://zhuanlan.zhihu.com/p/30534023)
10. [Tile Prioritization Design](https://docs.google.com/document/d/1tkwOlSlXiR320dFufuA_M-RF9L5LxFWmZFg5oW35rZk/edit)
11. [CSS Containment Module Level 3](https://www.w3.org/TR/css-contain-3)
12. [Let’s Take a Deep Dive Into the CSS Contain Property](https://css-tricks.com/lets-take-a-deep-dive-into-the-css-contain-propert)
13. [CSS triggers](https://csstriggers.com/)
14. [浏览器渲染详细过程：重绘、重排和 composite 只是冰山一角](https://juejin.cn/post/6844903476506394638)
15. [仅使用 CSS 提高页面渲染速度](https://juejin.cn/post/6942661408181977118)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe (at) corp.netease.com！
