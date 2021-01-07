---
title: 剖析 lottie-web 动画实现原理
date: 2021-01-07T02:23:01.219Z
description: lottie-web 可以帮我们实现非常炫酷的动画效果，那么它是如何实现的呢？笔者对动画实现和原理做了一次梳理，整理了下面的文档供大家参考。
---

![BodyMovin](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5427398960/6ea4/342f/5239/3494fa4d71eca344f28e4354798f99ab.png)

> 图片来源：<https://aescripts.com/bodymovin/>

> 本文作者：[青舟](https://juejin.cn/user/2770425031698359)


## 前言

[Lottie](http://airbnb.io/lottie/#/) 是一个复杂帧动画的解决方案，它提供了一套从设计师使用 AE（Adobe After Effects）到各端开发者实现动画的工具流。在设计师通过 AE 完成动画后，可以使用 AE 的扩展程序 [Bodymovin](https://exchange.adobe.com/creativecloud.details.12557.bodymovin.html) 导出一份 JSON 格式的动画数据，然后开发同学可以通过 Lottie 将生成的 JSON 数据渲染成动画。



## 1、如何实现一个 Lottie 动画

![实现一个 Lottie 动画流程](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487209356/ac5a/a22e/198c/e1bce057b196de671fcf6c3f0d3849de.png)

1. 设计师使用 AE 制作动画。
2. 通过 Lottie 提供的 AE 插件 Bodymovin 把动画导出 JSON 数据文件。
3. 加载 Lottie 库结合 JSON 文件和下面几行代码就可以实现一个 Lottie 动画。

```javascript
import lottie from 'lottie-web';
import animationJsonData from 'xxx-demo.json';  // json 文件

const lot = lottie.loadAnimation({
   container: document.getElementById('lottie'), 
   renderer: 'svg',
   loop: true,
   autoplay: false,
   animationData: animationJsonData,
 });

// 开始播放动画
lot.play();
```

更多动画 JSON 模板可以查看 <https://lottiefiles.com/>



## 2、解读 JSON 文件数据格式

笔者自己制作了 Lottie Demo -> [点我预览](https://codepen.io/qingzhou_coder/pen/ZEpXXgw)

- 0s 至 3s，`scale` 属性值从 100%  变到 50%。
- 3s 至 6s，`scale` 属性值从 50%  变到 100%，完成动画。

![动画变化路径](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487234864/14f7/8c13/ef9f/5c28183ef9c6ea73ae82323390a4a2c5.png)

通过 Bodymovin 插件导出 JSON 数据结构如下图所示：

![JSON 数据结构](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487257033/fa32/35ce/799e/49e25544a6c228e823de7f8ad160b7d6.png)

详细 JSON 信息可以通过 Demo 查看，JSON 信息命名比较简洁，第一次看可能难以理解。接下来结合笔者自己制作的 Demo 进行解读。

### 2.1 全局信息

![全局信息](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487275005/307f/cdc2/e484/bf712c90a876fcfe2aac7d685a64d205.png)

左侧为使用 AE 新建动画合成需要填入的信息，和右面第一层 JSON 信息对应如下：

- `w` 和 `h`： 宽 200、高 200
- `v`：Bodymovin 插件版本号 4.5.4
- `fr`：[帧率](https://baike.baidu.com/item/%E5%B8%A7%E7%8E%87) 30fps
- `ip` 和 `op`：开始帧 0、结束帧 180
- `assets`：静态资源信息（如图片）
- `layers`：图层信息（动画中的每一个图层以及动作信息）
- `ddd`：是否为 3d
- `comps`：合成图层

其中 `fr`、`ip`、`op` 在 Lottie 动画过程中尤为重要，前面提到我们的动画 Demo 是 0 - 6s，但是 Lottie 是以帧率计算动画时间的。Demo 中设置的帧率为 30fps，那么 0 - 6s 也就等同于 0 - 180 帧。

### 2.2 图层相关信息

理解 JSON 外层信息后，再来展开看下 JSON 中 `layers` 的具体信息，首先  [demo](%20https://codepen.io/qingzhou_coder/pen/ZEpXXgw)  制作动画细节如下：

![动画细节](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487291207/664d/9b6c/af13/d0b5205361c0e63cc625a9405ca17758.png)

主要是 3 个区域：

- 内容区域，包含形状图层的大小、位置、圆度等信息。
- 变化区域，包含 5 个变化属性（锚点、位置、缩放、旋转、不透明度）。
- 缩放 3 帧（图中绿色区域），在 0 帧、90 帧、180 帧对缩放属性进行了修改，其中图中所示为第 90 帧，图层缩放至 50%。

对应上图动画制作信息，便可以对应到 JSON 中的 `layers` 了。如下图所示：

![layers](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5594419045/72c9/4f63/13d4/9120e14b3cf841ec353c7392f140bfc6.png)


### 2.3 属性变化信息

接下来再看 `ks`（变化属性） 中的 `s` 展开，也就是缩放信息。

![ks信息](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487329397/1651/cd00/b838/6250d247acb79d664171a68cb6c9a4d0.png)

其中:

- `t` 代表关键帧数
- `s` 代表变化前（图层为二维，所以第 3 个值 固定为 100）。
- `e` 代表变化后（图层为二维，所以第 3 个值 固定为 100）。



## 3、Lottie 如何把 JSON 数据动起来

前面简单理解了 JSON 的数据意义，那么 Lottie 是如何把 JSON 数据动起来的呢？接下来结合 Demo 的 Lottie 源码阅读，只会展示部分源码，重点是理清思路即可，不要执着源代码。

以下源码介绍主要分为 2 大部分：

- 动画初始化（3.1小节 - 3.3小节）
- 动画播放（3.4 小节）

### 3.1 初始化渲染器

如 [Demo](https://codepen.io/qingzhou_coder/pen/ZEpXXgw) 所示，Lottie 通过 `loadAnimation` 方法来初始化动画。渲染器初始化流程如下：

![loadAnimation](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5594679187/b364/f1e9/c512/fca13d8718d2aacdddf33a7aea57349b.png)

```javascript
function loadAnimation(params){
    // 生成当前动画实例
    var animItem = new AnimationItem();
    // 注册动画
    setupAnimation(animItem, null);
    // 初始化动画实例参数
    animItem.setParams(params);
    return animItem;
}

function setupAnimation(animItem, element) {
    // 监听事件
    animItem.addEventListener('destroy', removeElement);
    animItem.addEventListener('_active', addPlayingCount);
    animItem.addEventListener('_idle', subtractPlayingCount);
    // 注册动画
    registeredAnimations.push({elem: element, animation:animItem});
    len += 1;
}
```

- `AnimationItem` 这个类是 Lottie 动画的基类，`loadAnimation` 方法会先生成一个 `AnimationItem` 实例并返回，开发者使用的 [配置参数和方法](http://airbnb.io/lottie/#/web?id=usage-1) 都是来自于这个类。

- 生成 `animItem` 实例后，调用 `setupAnimation` 方法。这个方法首先监听了 `destroy`、`_active`、`_idle` 三个事件等待被触发。由于可以多个动画并行，因此定义了全局的变量 `len`、`registeredAnimations` 等，用于判断和缓存已注册的动画实例。
- 接下来调用 `animItem` 实例的 `setParams` 方法初始化动画参数，除了初始化 `loop` 、 `autoplay` 等参数外，最重要的是选择渲染器。如下：

```javascript
AnimationItem.prototype.setParams = function(params) {
    // 根据开发者配置选择渲染器
    switch(animType) {
        case 'canvas':
            this.renderer = new CanvasRenderer(this, params.rendererSettings);
            break;
        case 'svg':
            this.renderer = new SVGRenderer(this, params.rendererSettings);
            break;
        default:
            // html 类型
            this.renderer = new HybridRenderer(this, params.rendererSettings);
            break;
    }

    // 渲染器初始化参数
    if (params.animationData) {
        this.configAnimation(params.animationData);
    }
}
```

Lottie 提供了 SVG、Canvas 和 HTML 三种渲染模式，一般使用第一种或第二种。

- SVG 渲染器支持的特性最多，也是使用最多的渲染方式。并且 SVG 是可伸缩的，任何分辨率下不会失真。

- Canvas 渲染器就是根据动画的数据将每一帧的对象不断重绘出来。

- HTML 渲染器受限于其功能，支持的特性最少，只能做一些很简单的图形或者文字，也不支持滤镜效果。

每个渲染器均有各自的实现，复杂度也各有不同，但是动画越复杂，其对性能的消耗也就越高，这些要看实际的状况再去判断。渲染器源码在 [player/js/renderers/](https://github.com/airbnb/lottie-web/tree/master/player/js/renderers) 文件夹下，本文 Demo 只分析 SVG 渲染动画的实现。由于 3 种 Renderer 都是基于 `BaseRenderer` 类，所以下文中除了 `SVGRenderer` 也会出现  `BaseRenderer`  类的方法。

### 3.2 初始化动画属性，加载静态资源

确认使用 SVG 渲染器后，调用 `configAnimation` 方法初始化渲染器。

```javascript
AnimationItem.prototype.configAnimation = function (animData) {
    if(!this.renderer) {
        return;
    }
    
    // 总帧数
    this.totalFrames = Math.floor(this.animationData.op - this.animationData.ip);
    this.firstFrame = Math.round(this.animationData.ip);
    
    // 渲染器初始化参数
    this.renderer.configAnimation(animData);

    // 帧率
    this.frameRate = this.animationData.fr;
    this.frameMult = this.animationData.fr / 1000;
    this.trigger('config_ready');
    
    // 加载静态资源
    this.preloadImages();
    this.loadSegments();
    this.updaFrameModifier();
    
    // 等待静态资源加载完毕
    this.waitForFontsLoaded();
};
```

在这个方法中将会初始化更多动画对象的属性，比如总帧数 `totalFrames` 、帧率 `frameMult` 等。然后加载一些其他资源，比如图像、字体等。如下图所示：

![渲染流程](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5594828268/de28/0bda/e308/d7a92868659ce71b19c73a5ddf63786a.png)

同时在 `waitForFontsLoaded` 方法中等待静态资源加载完毕，加载完毕后便会调用 SVG 渲染器的 `initItems` 方法绘制动画图层，也就是将动画绘制出来。

```js
AnimationItem.prototype.waitForFontsLoaded = function(){
    if(!this.renderer) {
        return;
    }
    // 检查加载完毕
    this.checkLoaded();
}

AnimationItem.prototype.checkLoaded = function () {
    this.isLoaded = true;

    // 初始化所有元素
    this.renderer.initItems();
    setTimeout(function() {
        this.trigger('DOMLoaded');
    }.bind(this), 0);

    // 渲染第一帧
    this.gotoFrame();
    
    // 自动播放
    if(this.autoplay){
        this.play();
    }
};
```

在 `checkLoaded` 方法中可以看到，通过 `initItems` 初始化所有元素后，便通过 `gotoFrame` 渲染第一帧，如果开发者配置了 `autoplay` 为 `true`，则会直接调用 `play` 方法播放。这里有个印象就好，会在后面详细讲。接下来还是先看 `initItems` 实现细节。

### 3.3 绘制动画初始图层

`initItems` 方法主要是调用 `buildAllItems` 创建所有图层。`buildItem` 方法又会调用 `createItem` 确定具体图层类型，这里的方法源码中拆分较细，本文只保留了 `createItem` 方法，其他感兴趣可以查看源码细节。

![initItems](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5594976128/4092/2ba8/1e0f/5109a9fc1dd0d10eca711b31ef2086f4.png)

在制作动画时，设计师操作的图层元素有很多种，比如图片、形状、文字等等。所以 `layers` 中每个图层会有一个字段  `ty` 来区分。结合 `createItem` 方法来看，一共有以下 8 中类型。

```javascript
BaseRenderer.prototype.createItem = function(layer) {
    // 根据图层类型，创建相应的 svg 元素类的实例
    switch(layer.ty){
        case 0:
            // 合成
            return this.createComp(layer);
        case 1:
            // 固态
            return this.createSolid(layer);
        case 2:
            // 图片
            return this.createImage(layer);
        case 3:
            // 兜底空元素
            return this.createNull(layer);
        case 4:
            // 形状
            return this.createShape(layer);
        case 5:
            // 文字
            return this.createText(layer);
        case 6:
            // 音频
            return this.createAudio(layer);
        case 13:
            // 摄像机
            return this.createCamera(layer);
    }
    return this.createNull(layer);
};
```

由于笔者以及大多数开发者，都不是专业的 AE 玩家，因此不必不过纠结每种类型是什么，理清主要思路即可。结合笔者的 Demo ，只有一个图层，并且图层的 `ty` 为 4 。是一个 `Shape` 形状图层，因此在初始化图层过程中只会执行 `createShape` 方法。

其他图层类型的渲染逻辑，如 `Image`、`Text`、`Audio` 等等，每一种元素的渲染逻辑都实现在源码  [player/js/elements/](https://github.com/airbnb/lottie-web/tree/master/player/js/elements) 文件夹下，具体实现逻辑这里就不进行展开了，感兴趣的同学自行查看。

接下来便是执行 `createShape` 方法，初始化元素相关属性。

![绘制Shape图层](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5595433052/6ed6/7699/b087/ddafbd02fe0b7bdacd5e84116723881d.png)

除了一些细节的初始化方法，其中值得注意的是 `initTransform` 方法。

```javascript
initTransform: function() {
    this.finalTransform = {
        mProp: this.data.ks
            ? TransformPropertyFactory.getTransformProperty(this, this.data.ks, this)
            : {o:0},
        _matMdf: false,
        _opMdf: false,
        mat: new Matrix()
    };
},
```

利用 `TransformPropertyFactory` 对 `transform` 初始化，结合 Demo 第 0 帧，对应如下：

![动画变化路径](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487234864/14f7/8c13/ef9f/5c28183ef9c6ea73ae82323390a4a2c5.png)

- 不透明度 100%
- 缩放 100%

```css
transform: scale(1);
opacity: 1;
```
那么为什么在初始化渲染图层时，需要初始化 `transform` 和 `opacity` 呢？这个问题会在 3.4 小节中进行回答。

### 3.4 Lottie 动画播放

在分析  Lottie 源码动画播放前，先来回忆下。笔者 Demo 的动画设置：

- 0s 至 3s，`scale` 属性值从 100%  变到 50%。
- 3s 至 6s，`scale` 属性值从 50%  变到 100%。

如果按照这个设置，3s 进行一次改变的话，那动画就过于生硬了。因此设计师设置了帧率为 30fps ，意味着每隔 33.3ms 进行一次**变化**，使得动画不会过于僵硬。那么如何实现这个**变化**，便是 3.3 小节提到的  `transform` 和 `opacity` 。

在 2.2 小节中提到的 5 个变化属性（锚点、位置、缩放、旋转、不透明度）。其中不透明度通过 CSS 的 `opacity` 来控制，其他 4 个（锚点、位置、缩放、旋转）则通过 `transform` 的 `matrix` 来控制。笔者的 Demo 中实际上初始值如下：

```css
transform: matrix(1, 0, 0, 1, 100, 100);
/* 上文的 transform: scale(1); 只是为了方便理解*/
opacity: 1;
```

这是因为无论是旋转还是缩放等属性，本质上都是应用 `transform` 的 `matrix()` 方法实现的，因此 Lottie 统一使用 `matrix` 处理。平时开发者使用的类似于 `transform: scale` 这种表现形式，只是因为更容易理解，记忆与上手。 `matrix` 相关知识点可以学习张鑫旭老师的 [理解CSS3 transform中的Matrix](https://www.zhangxinxu.com/wordpress/2012/06/css3-transform-matrix-%E7%9F%A9%E9%98%B5/)。

![矩阵](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487401057/57e3/2fb6/4eb5/2b9b0cec7584d14613e2742e3ac45ed8.png)

所以 Lottie 动画播放流程可**暂时**小结为：

1. 渲染图层，初始化所有图层的  `transform` 和 `opacity` 
2. 根据帧率 30fps，计算每一帧（每隔 33.3ms ）对应的  `transform` 和 `opacity` 并修改 DOM

然而 Lottie 如何控制 30fps 的时间间隔呢？如果设计师设置 20fps or 40fps 怎么处理？可以通过 `setTimeout`、`setInterval` 实现吗？带着这个问题看看源码是如何处理的，如何实现一个通用的解决方案。

Lottie 动画播放主要是使用 `AnimationItem` 实例的 `play` 方法。如果开发者配置了 `autoplay` 为 `true`，则会在所有初始化工作准备完毕后（3.2 小节有提及），直接调用 `play` 方法播放。否则由开发者主动调用 `play` 方法播放。

接下来从 `play` 方法了解一下整个播放流程的细节：

```javascript
AnimationItem.prototype.play = function (name) {
    this.trigger('_active');  
};
```

去掉多余代码， `play` 方法主要是触发了 `_active`  事件，这个 `_active` 事件便是在 3.1 小节初始化时注册的。

```javascript
animItem.addEventListener('_active', addPlayingCount);

function addPlayingCount(){
    activate();
}

function activate(){
    // 触发第一帧渲染
    window.requestAnimationFrame(first);
}
```

触发后通过调用 [requestAnimationFrame](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame) 方法，不断的调用 `resume` 方法来控制动画。

```javascript
function first(nowTime){
    initTime = nowTime;
    // requestAnimationFrame 每次都进行计算修改 DOM
    window.requestAnimationFrame(resume);
}
```

前文提到的动画参数：

- 开始帧为 0
- 结束帧为 180
- 帧率为 30 fps

`requestAnimationFrame` 在正常情况下能达到 60 fps（每隔 16.7ms 左右）。那么 Lottie 如何保证动画按照 30 fps （每隔 33.3ms）流畅运行呢。这个时候我们要转化下思维，设计师希望按照每隔 33.3ms 去计算变化，那也可以通过 `requestAnimationFrame` 方法，每隔 16.7ms 去计算，也可以计算动画的变化。只不过计算的更细致而已，而且还会使得动画更流畅，这样无论是 20fps or 40fps  都可以处理了，来看下源码是如何处理的。

在不断调用的 `resume` 方法中，主要逻辑如下：

```javascript
function resume(nowTime) {
    // 两次 requestAnimationFrame 间隔时间
    var elapsedTime = nowTime - initTime;

    // 下一次计算帧数 = 上一次执行的帧数 + 本次间隔的帧数
    // frameModifier 为帧率( fr / 1000 = 0.03)
    var nextValue = this.currentRawFrame + value * this.frameModifier;
    
    this.setCurrentRawFrameValue(nextValue);
    
    initTime = nowTime;
    if(playingAnimationsNum && !_isFrozen) {
        window.requestAnimationFrame(resume);
    } else {
        _stopped = true;
    }
}

AnimationItem.prototype.setCurrentRawFrameValue = function(value){
    this.currentRawFrame = value;
    // 渲染当前帧
    this.renderFrame();
};
```

 `resume` 方法：

- 首先会计算当前时间和上次时间的 `diff` 时间。

- 之后计算动画开始到现在的时间的当前帧数。注意这里的**帧数**只是相对 AE 设置的一个计算单位，可以有小数。
- 最后通过 `renderFrame()` 方法更新当前帧对应的 DOM 变化。

举例说明：

假设上一帧为 70.25 帧，本次 `requestAnimationFrame` 间隔时间为 16.78 ms，那么：

```
当前帧数：70.25 +  16.78 * 0.03 =  70.7534帧
```

由于 70.7534 帧在 Demo 中的 0 - 90 帧动画范围内，因此帧比例（代表动画运行时间百分比）的计算如下：

```
帧比例：70.7534 / 90 = 0.786148889
```

0 - 90 帧的动画为图层从 100% 缩放至 50% ，因为仅计算 50% 的变化，所以缩放到如下：

```
缩放比例： 100 - （50 * 0.781666）= 60.69255555%
```

对应计算代码在 `TransformPropertyFactory` 类中：

```javascript
// 计算百分比
perc = fnc((frameNum - keyTime) / (nextKeyTime - keyTime ));
endValue = nextKeyData.s || keyData.e;
// 计算值
keyValue = keyData.s[i] + (endValue[i] - keyData.s[i]) * perc;
```

其中 `fnc` 为计算函数，如果设置了贝塞尔运动曲线函数，那么 `fnc` 也会相应修改计算规则。当前 Demo 为了方便理解，采用的是线性变化。具体源码感兴趣的同学可以自行查看。

计算好当前 `scale` 的值后，再利用 `TransformPropertyFactory` 计算好当前对应的 `transform` 的 `matrix` 值，然后修改对应 DOM 元素上的 CSS 属性。这样通过 `requestAnimationFrame` 不停的计算帧数，再计算对应的 CSS 变化，在一定的时间内，便实现了动画。播放流程如下：

![播放流程](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5610178301/8d17/a32d/0cc6/56d419a6f928d413be2bc1ed6d10eb20.png)

帧数计算这里需要时刻记住，**在 Lottie 中，把 AE 设置的帧数作为一个计算单位**，Lottie 并不是根据设计师设置的 30fps（每隔 33.3ms） 进行每一次变化，而是根据  `requestAnimationFrame ` 的间隔（每隔 16.7ms 左右）计算了更细致的变化，保证动画的流畅运行。

没有通过 `setTimeout`、`setInterval` 实现，是因为它们都有各自的缺点，这里就不展开了，大家自行查阅资料。`requestAnimationFrame` 采用系统时间间隔，保持最佳绘制效率，让动画能够有一个统一的刷新机制，从而节省系统资源，提高系统性能，改善视觉效果。



## 4、总结

虽然我们了解了 Lottie 的实现原理，但是在实际应用中也有一些优势和不足，要按照实际情况进行取舍。

### 4.1 Lottie 的优势

1. 设计师通过 AE 制作动画，前端可以直接还原，不会出现买家秀卖家秀的情况。
2. SVG 是可伸缩的，任何分辨率下不会失真。
3. JSON 文件，可以多端复用（Web、Android、iOS、React Native）。
4. JSON 文件大小会比 GIF 以及 APNG 等文件小很多，性能也会更好。

### 4.2 Lottie 的不足

1. Lottie-web 文件本身仍然比较大，未压缩大小为 513k，轻量版压缩后也有 144k，经过 Gzip 后，大小为39k。所以，需要注意 Lottie-web 的加载。
2. 不必要的序列帧。Lottie 的主要动画思想是绘制某一个图层不断的改变 CSS 属性，如果设计师偷懒用了一些插件实现的动画效果，可能会造成每一帧都是一张图，如下图所示，那就会造成这个 JSON 文件非常大，注意和设计师提前进行沟通。

![不必要的序列帧](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5487460182/1c5f/6d6f/302a/c0f43f391de4a6f55bdd4036246075af.png)

3. 部分AE特效不支持。有少量的 AE 动画效果，Lottie 无法实现，有些是因为性能问题，有些是没有做，注意和设计师提前沟通，[点我查看](http://airbnb.io/lottie/#/supported-features)。



## 5、参考资料

* https://github.com/airbnb/lottie-web/
* http://airbnb.io/lottie/#/
* [理解CSS3 transform中的Matrix](https://www.zhangxinxu.com/wordpress/2012/06/css3-transform-matrix-%E7%9F%A9%E9%98%B5/)
* [window.requestAnimationFrame](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)



> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！ 
