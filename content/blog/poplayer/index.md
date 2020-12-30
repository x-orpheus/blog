---
title: Poplayer 云音乐优化实践
date: 2020-12-30T04:21:05.591Z
description: Poplayer 名词来自阿里的一篇文章，结合 Android 场景来看，其实就是页面上层再加一层，称作 Poplayer。通过Poplayer 层我们可以将一些临时业务交由这一层去处理维护，而这一层又交由 WebView 去承载，在增加动态性的同时又不影响既有稳定业务。
---

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5291265189/aa85/fa07/2041/1025254d96b4d24338af0eefed21736a.jpg)

> 本文作者： Codey


## 背景介绍

你是否还在为各种特殊场景特殊逻辑而烦恼，是否还在为各种一次性业务而添加一堆代码，是否还在为各种奇奇怪怪的彩蛋而满心疲惫?  在云音乐不断迭代的过程中，我们不止一次的遇到产品说要在某一个地方加个彩蛋，有的是在触及特殊操作时，有的是在播放特定歌曲时，甚至有的是在特定时间点播放特定歌曲到特定播放进度时。

每次听到这些需求，头都大了，又得在老代码上面加一堆特殊逻辑，又得写那么多代码，重点写那么多代码还不能复用，同时也增加了稳定业务的复杂度，也没有什么实时性、动态性可言。

在经历了几次这种需求之后，我们就在想如何去避免这类临时业务和稳定业务融合到一起，如何去把这类临时业务统一成一套通用可行方案？

在这之前，我们先了解下什么是临时业务，什么是稳定业务。

**临时业务：**特定时间，特定场景，特定配置下需要上线的业务；不可复用，可能只一次使用。对云音乐来说就是彩蛋系列，这里举一个特定的场景，国庆节国歌升旗彩蛋，需要在国庆节期间的天安门升旗时间播放国歌，唤起升旗的视频。对于这类型的场景，基本满足了我们对于临时业务的定义，可以将其认为是临时业务

**稳定业务：**核心功能，基础功能，长期存在，非必要情况下不随意修改。对云音乐来说就是最重要的就是播放业务，包含播放列表，播放页面等播放核心功能，这块逻辑我们其实是不希望去随意改动的，要是随意增加个彩蛋就疯狂改动这块的逻辑，疯狂添加些临时且不可复用的代码，那将会增加这块的逻辑复杂度，维护复杂度，还未引起一些意外的问题。播放业务也是基本满足了我们对稳定业务的定义，可以将其认为是稳定业务。

了解了临时业务和稳定业务之后，就可以想办法去做区分解决了。对于临时业务，需要的通用方案得满足**可配置，可复用，实时性，动态性**等要求，在大家的讨论下，便想到了 Poplayer 这个大杀器。

## 什么是 Poplayer

### 简介

Poplayer ，顾名思义，就是Pop + Layer的组合，结合 Android 场景来看，其实就是页面上层再加一层，称作 Poplayer。通过 Poplayer  层我们可以将一些临时业务交由这一层去处理维护，而这一层又交由 WebView 去承载，在增加动态性的同时又不影响既有稳定业务。

### Poplayer 的设计

#### 设计概要

![设计概要](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5416304987/0097/4d11/adf3/739a9caa389a976dfecfe7b5e3e2ccdc.png)

从上面的图可以非常清晰的看出来，所谓的 Poplayer 就是在客户端页面上增加一层，将这一层作为展示临时业务的容器，二者通过  JSBridge 通信，再结合一些客户端页面配置以及容器配置，达到临时业务热插拔，可复用的要求。

#### 整体流程与设计

![整体流程](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5418086464/eada/668c/1024/431e509fa78f1361e764a3fa30900928.png)

> 配置中心：云音乐基础能力之一，以 key / value 的形式存储业务及功能的特殊配置，支持配置秒级下发及分端下发等功能

从上图可以看出，我们通过配置能力将客户端页面和容器结合到一起，整体流程结构都是非常清晰的。依赖于云音乐完善的基础设施，在完成 Poplayer 组件的时候减少了很多工作。

## Poplayer云音乐优化实践

### 内存优化

>在云音乐实际应用过程中，遇到一个问题，当使用 Poplayer 去播放视频时，快速点击 WebView 会导致视频出现卡顿，也就是因为这个问题，我们开始了 Poplayer 的内存优化

使用 Poplayer 的时候，其中一个技术点就是： **根据触摸坐标获取该处弹框的 ARGB 值, 判断 A 分量的值是否超过阈值，超过则交给 HTML5 处理**

那么我们如何去获取点击位置的 alpha 值呢，一般我们想到的是使用类似截图的方式去获取 View 的整个视图。

如下：

```kotlin
// view 是 webView
private fun captureView(view: View): Bitmap {
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        view.draw(canvas)
        return bitmap
}

fun getViewTouchAlpha(ev: MotionEvent, view: View): Float {
        if (view.alpha <= 0f) {
            return 0f
        }
        val drawingCache = captureView(view)
        return drawingCache.getPixel(ev.x.toInt(), ev.y.toInt()).alpha.toFloat()
    }
```

如此去获取 bitmap，宽高是 Webview 的宽高，在这里相当于屏幕高度。首先，bitmap 占用内存会很大，**4 * 1080 * 2248byte** ，同时去绘制整个 Webview，也会非常耗时，平均时间 **90ms** 左右。

#### 事件冲突

某些 Activity 在 `dispatchTouchEvent` 的时候会拦截事件，进行一些操作，举个云音乐播放页面的例子：

```java
 @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        // ...
        // Poplayer处理
        if (Poplayer.isContainerWebViewInterceptTouch(event, this)) {
            DebugLogUtils.log(TAG, "isContainerWebViewInterceptTouch");
            return super.dispatchTouchEvent(event);
        }
        return ... || commentGestureHelper.handleDispatchTouchEvent(event)
                || super.dispatchTouchEvent(event);
    }
```

其中一个就是拦截事件，上滑的时候进入评论页。所以我们在这里首先要判断 WebView 是否会拦截这个事件，那么也就会调用 `captureView` 方法去绘制，那么也就会多一次  `captureView` 的调用，如果 WebView 未拦截事件，最终事件回到 Activity 又会导致一次 `captureView` 调用。

总共就是三次调用，所耗费的时间是三倍的绘制时间 **3 * 90ms** ，申请的内存也是 **3** 倍。

##### 优化措施

新增位置及 alpha 值的缓存：

```kotlin
data class AlphaCache(var eventX: Int = -1, var eventY: Int = -1, var alpha: Float = 0f)
```

记录上次点击的 X, Y 及 alpha 值，如果下次方法调用和之前的点击点一致的话，就不重新计算

```kotlin
    fun getViewTouchAlpha(ev: MotionEvent, view: View): Float {
        if (view.alpha <= 0f) {
            return 0f
        }
        if (alphaCache.eventX == ev.x.toInt() && alphaCache.eventY == ev.y.toInt()) {
            return alphaCache.alpha
        }
        val drawingCache = captureView(view)
        return drawingCache.getPixel(ev.x.toInt(), ev.y.toInt()).alpha.toFloat()
    }
```

这样可以减少 **2** 次内存申请和 2 次绘制，性能优化了 **4** 倍。

#### Bitmap 大小优化

bitmap 如果大小是屏幕宽高的话，申请的内存会非常大，那我们是不是可以缩小 bitmap 的大小，于是想到了一种方案

#####  优化措施一：

```kotlin
// BITMAP_WIDTH = 10 
private fun captureView(evX: Int, evY: Int, view: View): Bitmap {
        val bitmap = Bitmap.createBitmap(BITMAP_WIDTH, BITMAP_WIDTH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.translate(-evX + BITMAP_WIDTH / 2f, -evY + BITMAP_WIDTH / 2f)
        view.draw(canvas)
        return bitmap
}
```

我们把 bitmap 的大小改为了 10 * 10 ，同时移动画布，使绘制的位置刚好在这个 bitmap 内，通过传入的点击位置去确定画布的位置

此时内存变为 **4 * 10 * 10byte**，内存减少了 **20000** 多倍。

##### 优化措施二

在优化了 bitmap 内存之后，发现快速点击视频还是会出现一点卡顿，于是测试了 `view.draw(canvas)`  方法，发现其在每一次触发的时候需要消耗的时间平均在 90ms 左右，所以会导致卡顿出现

draw 绘制的时候是否可以只去绘制一小部分：

```kotlin
    private fun captureView(evX: Int, evY: Int, view: View): Bitmap {
        val bitmap = Bitmap.createBitmap(BITMAP_WIDTH, BITMAP_WIDTH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.translate(-evX + BITMAP_WIDTH / 2f, -evY + BITMAP_WIDTH / 2f)
        canvas.clipRect(evX - BITMAP_WIDTH / 2f, evY - BITMAP_WIDTH / 2f ,evX + BITMAP_WIDTH / 2f, evY + BITMAP_WIDTH / 2f)
        view.draw(canvas)
        return bitmap
    }
```

使用 clipRect 的方式，让其在绘制的时候只去绘制一小部分。

优化后实测在 100 * 100 的 Rect 中绘制只需 **9ms** ，而在10 * 10的 rect 中绘制平均只需 **1ms** ，这里速度优化了 90 倍！

#####  优化措施三

bitmap 的大小为 4 * 10 * 10byte，这个 4 是 ARGB_8888 中来的，但是我们这一次只是用到了其中的 alpha 值，那是不是不用这么多？

```kotlin
    private fun captureView(evX: Int, evY: Int, view: View): Bitmap {
        // 使用 ALPHA_8
        val bitmap = Bitmap.createBitmap(BITMAP_WIDTH, BITMAP_WIDTH, Bitmap.Config.ALPHA_8)
        val canvas = Canvas(bitmap)
        //...
        return bitmap
    }
```

使用这种方式，又把内存占用优化到了原本的**四分之一**。

#### 优化总结

整体优化下来，内存占用少了 **80000** 多倍，绘制耗时少了 **90** 倍，快速点击 web 页面在播放视频时完全感觉不到卡顿，非常完美！

### WebView 增强

在实际上线之后，发现有很多WebView出现 `android.webkit.WebViewFactory$MissingWebViewPackageException: Failed to load WebView provider: No WebView installed` 异常，这个异常在平时也能看到，但都没有引起重视，由于我们 Poplayer 用在了流量非常大的一个页面，所以该问题直接暴露。

解决方法其实很简单：

```kotlin
// Poplayer容器由一个Fragment包裹
val rootView = runCatching {
            super.onCreateView(inflater, container, savedInstanceState)
        }.getOrElse {
            activity?.supportFragmentManager?.beginTransaction()?.remove(this)?.commitAllowingStateLoss()
            return null
        }
```

当然需要注意的是 `onCreateView` 返回之后，一些 super 的逻辑执行不到，可能引发一些问题，需要在开发的时候规避。

## 总结

当你一直在做一些重复工作，感觉到恶心时，就必须考虑，这些工作是否存在一定的共通性，是否有办法可以进行优化，是否可以借助一些工具来提升效率，而不是又双叒叕的去重复着这些事情。

很多场景不只是自己会遇到，也许业界早已经有了相对成熟的方案可以使用，平时也可以多关注业界的发展，拓宽自己的思路。当然在参考一些方案的时候也要去适配自己的一些特性，达到高可用状态。

## 后续改进

目前 Poplayer 容器还是 HTML5 来承载，HTML5 本身的性能以及不稳定性问题仍然存在，后续可以考虑使用 ReactNative 容器，对于非动态化场景，也可以考虑 Flutter 容器来做，只需要容器层去接入，同时传递点击事件即可。

## 参考资料

[利用 Poplayer 在手淘中实现稳定业务和临时业务分离](https://developer.aliyun.com/article/59050)



> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
