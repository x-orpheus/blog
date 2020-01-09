---
title: 一个简洁、有趣的无限下拉方案
date: "2019-12-03T01:42:40.869Z"
description: "长列表渲染、无限下拉也算是前端开发老生常谈的问题之一了，本文将介绍一种简洁、巧妙、高效的方式来实现。"
---

![](https://p1.music.126.net/YM0Qw_a36DltlnVg7Y60dA==/109951164524578608.jpg)

## 本文主旨

长列表渲染、无限下拉也算是前端开发老生常谈的问题之一了，本文将介绍一种**简洁、巧妙、高效**的方式来实现。话不多说，看下图，也许你可以发现什么？

![无限下拉示意图](https://p1.music.126.net/pJ_RZghrsOLO2UK8hlN6Pw==/109951164458290045.gif)

不知你是否从上面这张图中注意到了什么，比如只是渲染了可视区域的部分 DOM ，滚动过程中只是外层容器的 padding 在改变？

前一点很好理解，我们考虑到性能，不可能将一个长列表（甚至是一个无限下拉列表）的所有列表元素都进行渲染；而后一点，则是本文所介绍方案的核心之一！

不卖关子，提前告诉你该方案的要素就是两个：

* **Intersection Observer**
* **padding**

说明了要素，也许你可以尝试着开始思考，看你是否能猜到具体的实现方案。


## 方案介绍

### Intersection Observer

#### 基本概念

一直以来，**检测元素的可视状态或者两个元素的相对可视状态**都不是件容易事。传统的各种方案不但复杂，而且性能成本很高，比如需要监听滚动事件，然后查询 DOM , 获取元素高度、位置，计算距离视窗高度等等。

这就是 Intersection Observer 要解决的问题。它为开发人员提供一种便捷的新方法来**异步查询**元素相对于其他元素或视窗的位置，消除了昂贵的 DOM 查询和样式读取成本。


#### 兼容性

主要在 Safari 上兼容性较差，需要 12.2 及以上才兼容，不过还好，有 [polyfill](https://www.npmjs.com/package/intersection-observer)  可食用。

#### 一些应用场景

* 页面滚动时的懒加载实现。
* 无限下拉（本文的实现）。
* 监测某些广告元素的曝光情况来做相关数据统计。
* 监测用户的滚动行为是否到达了目标位置来实现一些交互逻辑（比如视频元素滚动到隐藏位置时暂停播放）。

### padding 方案实现

基本了解 Intersection Observer 之后，接下来就看下如何用 Intersection Observer + padding 来实现无限下拉。

先概览下总体思路：

* 监听一个固定长度列表的首尾元素是否进入视窗；
* 更新当前页面内渲染的第一个元素对应的序号；
* 根据上述序号，获取目标数据元素，列表内容重新渲染成对应内容；
* 容器 padding 调整，模拟滚动实现。

**核心：利用父元素的 padding 去填充随着无限下拉而本该有的、越来越多的 DOM 元素，仅仅保留视窗区域上下一定数量的 DOM 元素来进行数据渲染**。

#### 1、监听一个固定长度列表的首尾元素是否进入视窗

```js
// 观察者创建
this.observer = new IntersectionObserver(callback, options);

// 观察列表第一个以及最后一个元素
this.observer.observe(this.firstItem);
this.observer.observe(this.lastItem);
```

我们以在页面中渲染固定的 20 个列表元素为例，我们对第一个元素和最后一个元素，用 Intersection Observer 进行观察，当他们其中一个重新进入视窗时，callback 函数就会触发：

```js
const callback = (entries) => {
    entries.forEach((entry) => {
        if (entry.target.id === firstItemId) {
            // 当第一个元素进入视窗
        } else if (entry.target.id === lastItemId) {
            // 当最后一个元素进入视窗
        }
    });
};
```

#### 2、更新当前页面渲染的第一个元素对应的序号 (firstIndex)

拿具体例子来说明，我们用一个数组来维护需要渲染到页面中的数据。数组的长度会随着不断请求新的数据而不断变大，而渲染的始终是其中一定数量的元素，比如 20 个。
那么：

* 1、最开始渲染的是数组中序号为 0 - 19 的元素，即此时对应的 firstIndex 为 0；

* 2、当序号为 19 的元素（即上一步的 lastItem ）进入视窗时，我们就会往后渲染 10 个元素，即渲染序号为 10 - 29 的元素，那么此时的 firstIndex 为 10；

* 3、下一次就是，当序号为 29 的元素进入视窗时，继续往后渲染 10个元素，即渲染序号为 20 - 39 的元素，那么此时的 firstIndex 为 20，以此类推。。。

```js
// 我们对原先的 firstIndex 做了缓存
const { currentIndex } = this.domDataCache;

// 以全部容器内所有元素的一半作为每一次渲染的增量
const increment = Math.floor(this.listSize / 2);

let firstIndex;

if (isScrollDown) {
    // 向下滚动时序号增加
    firstIndex = currentIndex + increment;
} else {
    // 向上滚动时序号减少
    firstIndex = currentIndex - increment;
}
```

**总体来说，更新 firstIndex，是为了根据页面的滚动情况，知道接下来哪些数据应该被获取、渲染。**

#### 3、根据上述序号，获取对应数据元素，列表重新渲染成新的内容

```js
const renderFunction = (firstIndex) => {
    // offset = firstIndex, limit = 10 => getData
    // getData Done =>  new dataItems => render DOM
 };
```

这一部分就是根据 firstIndex 查询数据，然后将目标数据渲染到页面上即可。

#### 4、padding 调整，模拟滚动实现

既然数据的更新以及 DOM 元素的更新我们已经实现了，那么无限下拉的效果以及滚动的体验，我们要如何实现呢？

想象一下，抛开一切，最原始最直接最粗暴的方式无非就是我们再又获取了 10 个新的数据元素之后，再塞 10 个新的 DOM 元素到页面中去来渲染这些数据。

但此时，对比上面这个粗暴的方案，我们的方案是：**这 10个新的数据元素，我们用原来已有的 DOM 元素去渲染，替换掉已经离开视窗、不可见的数据元素；而本该由更多 DOM 元素进一步撑开容器高度的部分，我们用 padding 填充来模拟实现。**

![img](https://p1.music.126.net/pHzUHeEAfQ9DRmqGY6S23g==/109951164482823721.png)

* 向下滚动

```js
// padding的增量 = 每一个item的高度 x 新的数据项的数目
const remPaddingsVal = itemHeight * (Math.floor(this.listSize / 2));

if (isScrollDown) {
    // paddingTop新增，填充顶部位置
    newCurrentPaddingTop = currentPaddingTop + remPaddingsVal;

    if (currentPaddingBottom === 0) {
        newCurrentPaddingBottom = 0;
    } else {
        // 如果原来有paddingBottom则减去，会有滚动到底部的元素进行替代
        newCurrentPaddingBottom = currentPaddingBottom - remPaddingsVal;
    }
}
```

![向下滚动示意图](https://p1.music.126.net/Ysl6Q9rioYbyXQ0DLCr2JA==/109951164458279864.gif)

* 向上滚动

```js
// padding的增量 = 每一个item的高度 x 新的数据项的数目
const remPaddingsVal = itemHeight * (Math.floor(this.listSize / 2));

if (!isScrollDown) {
    // paddingBottom新增，填充底部位置
    newCurrentPaddingBottom = currentPaddingBottom + remPaddingsVal;

    if (currentPaddingTop === 0) {
        newCurrentPaddingTop = 0;
    } else {
        // 如果原来有paddingTop则减去，会有滚动到顶部的元素进行替代
        newCurrentPaddingTop = currentPaddingTop - remPaddingsVal;
    }
}
```

![向上滚动示意图](https://p1.music.126.net/k_UYjP6cffJ02K1aolQBow==/109951164458289551.gif)

* 最后是 padding 设置更新以及相关缓存数据更新

```js
// 容器padding重新设置
this.updateContainerPadding({
    newCurrentPaddingBottom,
    newCurrentPaddingTop
})

// DOM元素相关数据缓存更新
this.updateDomDataCache({
    currentPaddingTop: newCurrentPaddingTop,
    currentPaddingBottom: newCurrentPaddingBottom
});
```

## 思考总结

#### 方案总结：

利用 Intersection Observer 来监测相关元素的滚动位置，异步监听，尽可能得减少 DOM 操作，触发回调，然后去获取新的数据来更新页面元素，并且用调整容器 padding 来替代了本该越来越多的 DOM 元素，最终实现列表滚动、无限下拉。

#### 相关方案的对比

这里和较为有名的库 - [iScroll](https://github.com/cubiq/iscroll) 实现的无限下拉方案进行一个基本的对比，对比之前先说明下 iScroll infinite 的实现概要：
* iScroll 通过对传统滚动事件的监听，获取滚动距离，然后：
    1. 设置父元素的 translate 来实现整体内容的上移（下移）；
    2. 再基于这个滚动距离进行相应计算，得知相应子元素已经被滚动到视窗外，并且判断是否应该将这些离开视窗的子元素移动到末尾，从而再对它们进行 translate 的设置来移动到末尾。这就像是一个循环队列一样，随着滚动的进行，顶部元素先出视窗，但又将移动到末尾，从而实现无限下拉。

* 相关对比：
    * 实现对比：一个是 Intersection Observer 的监听，来通知子元素离开视窗，只要定量设置父元素 padding 就行；另一个是对传统滚动事件的监听，滚动距离的获取，再进行一系列计算，去设置父元素以及子元素的 translate。显而易见，前者看起来更加简洁明了一些。
    * 性能对比：我知道说到对比，你脑海中肯定一下子会想到性能问题。其实性能对比的关键就是 Intersection Observer。因为单就 padding 设置还是 translate 设置，性能方面的差距是甚小的，只是个人感觉 padding 会简洁些？而 Intersection Observer 其实抽离了所有滚动层面的相关逻辑，你不再需要对滚动距离等相应 DOM 属性进行获取，也不再需要进行一系列滚动距离相关的复杂计算，并且同步的滚动事件触发变成异步的，你也不再需要另外去做防抖之类的逻辑，这在性能方面还是有所提升的。

#### 存在的缺陷：

* padding 的计算依赖列表项固定的高度。
* 这是一个同步渲染的方案，也就是目前容器 padding 的计算调整，无法计算异步获取的数据，只跟用户的滚动行为有关。这看起来与实际业务场景有些不符。解决思路：
    * 思路 1、利用 [Skeleton Screen Loading](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a) 来同步渲染数据元素，不受数据异步获取的影响。即在数据请求还未完成时，先使用一些图片进行占位，待内容加载完成之后再进行替换。
    * 思路 2、滚动到目标位置，阻塞容器 padding 的设置（即无限下拉的发生）直至数据请求完毕，用 loading gif 提示用户加载状态，但这个方案相对复杂，你需要全面考虑用户难以预测的滚动行为来设置容器的 padding。

#### 延伸拓展

* 请大家思考一下，无限下拉有了，那么无限上拉基于这种方案要如何调整实现呢？
* 如果将 Intersection Observer 用到 iScroll 里面去，原有方案可以怎样优化？

#### 代码实现

* [完整代码实现参考](https://github.com/Guohjia/listScroll)


## 参考文章

* [Intersection Observer API](https://developer.mozilla.org/zh-CN/docs/Web/API/Intersection_Observer_API)
* [IntersectionObserver’s Coming into View](https://developers.google.com/web/updates/2016/04/intersectionobserver)
* [Infinite Scroll’ing the right way](https://medium.com/walmartlabs/infinite-scrolling-the-right-way-11b098a08815)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)
