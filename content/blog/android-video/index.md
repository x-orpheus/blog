---
title: 云音乐 Android 视频「无缝」播放实现总结
date: 2020-12-09T03:01:01.035Z
description: 本文介绍网易云音乐 Android 客户端中几种视频无缝播放的实现方案和一些注意事项。
---

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4891330256/65f9/f4b5/a9b9/aff53a306ad53e2512d45c131850a6c2.png)

> 图片来源：https://bz.zzzmh.cn/

> 本文作者：王永亮

在网易云音乐 8.0 改版中，接到一个播放中的视频可以点击「小窗」按钮收起到 mini 播放条中继续播放的需求，刚接到这个需求时内心是崩溃的，要知道网易云音乐的 mini 播放条是一个可能会出现在 App 中的任何 Activity 上的 View，在不同 Activity 之间跳转时，如何能保证视频可以从一个 Activity “无缝”转移到另一个 Activity 呢？

### MediaPlayer 换绑

一般简单的视频播放功能我会使用系统自带的 VideoView，只需几行代码就可以让视频播放起来，系统自带的 VideoView 继承自 SurfaceView，并且将 MediaPlayer 的具体调用，包括 Surface 和 MediaPlayer 的绑定封装在里面，这样封装的优势是简单易用，但是也存在一些问题，SurfaceView 和 MediaPlayer 完全绑定在一起，一个 MediaPlayer 只能对应一个 SurfaceView，而小窗播放想做到的是 MediaPlayer 和 SurfaceView 可以一对多，在页面切换时 MediaPlayer 可以绑定新的 SurfaceView，就像一台电脑对应多个显示器。我们的视频播放框架很好的解决了这个问题，如下图所示：

![视频播放架构](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4889673828/8bdc/7dcf/9374/68c6ee1619aa03332d6bc6a5e8e38b07.png)

由于 App 中有一些对视频做动画的场景，所以框架中使用的是 TextureView，TextureView 和 MediaPlayer 使用 AIDL 进行通信，如下图所示：

![aidl通信架构](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4889672410/0a99/b236/b555/fa5a35b770dcd5d63eaf6f788f9d8ad0.png)

从上面两图可以看出，视频播放框架中把所有的 MediaPlayer 放到了一个单独的 Video 进程的缓存池中来管理，正在使用的放在 Active 的池子中，闲置在 idle 池子中，闲置的 MediaPlayer 超过上限时会被回收，启动新页面时 VideoView 可以从 Video 进程的池子中获取闲置的 MediaPlayer，其他进程中的 VideoView 通过 AIDL 同 Video 进程中的 MediaPlayer 通信。

这种架构使不同 Activity 中的 VideoView 可以很方便的替换其绑定的 MediaPlayer，由于播放能力都在 MediaPlayer 中，所以在 MediaPlayer 同 TextureView 解绑时并不会导致播放的中断，新页面启动时，只要将正在播放的 MediaPlayer 同 TextureView 重新绑定，新的页面就能立刻展示播放中的画面了。实际上视频播放框架最早并不是服务于无缝播放的场景，设计最早是出于以下原因：
1. 自研的 MediaPlayer 在上线早期稳定性并没有那么好，使用多进程可以防止播放器异常影响主进程其他功能
2. 普通 VideoView 只能支持一个 TextureView 一个 MediaPlayer，而视频播放优化需要额外的视频播放器实现视频预加载的能力
3. 减少主进程内存占用，避免视频播放对音频播放等重要业务产生影响
4. 播放器复用减少对象创建

所以综合以上需求我们设计了这套 MediaPlayer 和 TextureView 隔离的方案，如果是比较简单场景也可以考虑使用单例持有 MediaPlayer，由于这套方案已经很好的将 MediaPlayer 和 TextureView 隔离，所以我们只需要通过给 MediaPlayer 池子增加一些获取被复用播放器的方法就可以很容易的支持 VideoView 和 MediaPlayer的换绑，从获得无缝播放的效果了。

具体的换绑 MediaPlayer 流程如下图：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4889672100/a425/7c85/c58e/243a7f6a94a2c0c1d9166b47f143852e.png)

在原有 Activity 中，如果播放器是要被复用的，我们会将播放器的唯一 id 和正在播放的资源 id 保存在一个全局位置，以此作为播放器可复用的标志。在新页面启动时，新页面的 VideoView 被创建，在新页面中会调用 VideoView 的 setDataSource 设置要播放的内容，setDataSource 会根据当前播放的内容和保存的全局播放器 id 在播放器池子中重新找到原来正在播放的播放器，并将 Surface 通过 AIDL 发送给被复用的 MediaPlayer 重新绑定，这样在不打断当前播放的情况下，视频播放的画面就无缝被转移到新的 Activity 中了。其中要注意的一个知识点是Surface本身就是支持跨进程传递的：

```
public class Surface implements Parcelable
```
另外这个方案中使用 MediaPlayer 对象的 hashCode 作为播放器的唯一 id，如果使用这个方案，大家也可以结合自己的情况设计唯一id。

换绑方案的核心是 MediaPlayer 同 VideoView 的重新绑定，重新绑定只需要做到下面两步：
1. 使用当前页面中定义的 onPrepare、onPause 等回调设置给播放器替换原有回调
2. 重新绑定 Surface，需要注意的是有时 SurfaceTexture 并不是立刻就能准备好，没准备好时可以在 onSurfaceAvailable 中重新绑定 SurfaceTexture。

这个方案基本上能满足绝大部分的无缝播放需求，不过也并非没有缺点，这个方案主要有以下几个问题：

1. 在视频暂停时 MediaPlayer 重新绑定 TextureView，Surface 上会没有内容，这种情况可以先使用视频封面覆盖 TextureView，等重新播放时再移除封面。
2. 原来的方案设计中将 AudioFocus 的获取封装在了 VideoView 中，在新的页面使用 MediaPlayer 开始播放时，由于原来持有 MediaPlayer 页面还继续持有着 MediaPlayer 的引用，所以会因为 AudioFocus 抢占而调用 MediaPlayer 的 pause 方法，从而造成在新的页面播放也会暂停，解决方案是将 AudioFocus 的监听放在 Video 进程中的 MediaPlayer 中，大家在使用这个方案时也可以注意下有没有类似问题。 
3. 原来播放器使用完成会跟随页面销毁而被回收，在复用场景是不能回收的，这时要注意避免播放器泄漏。

终实现效果如下图：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5067307537/a03c/21cc/0a40/458b5d4fa318c4b2e36b3f0acdeaf060.gif)

### “假”页面切换方案

在换绑方案之外，网易云音乐中也有一些其他的无缝播放方案实现，首先介绍一种实现比较简单，也是在网易云中比较早使用的一种方案，“假”页面切换方案，由名字可以知道，这种方案不是真正的在 Activity 之间进行跳转，而是利用 TextureView 可以像普通 View 一样移动、做动画的特性，利用过渡动画，让效果看起来像是从一个页面跳转到了另一个页面，效果如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5014468981/ef23/84d5/1691/824b8cbda02ddd26ffcaad3c42d16a5a.gif)

在网易云音乐的视频 Feed 流中，视频播放时，点击热区可以在不暂停播放的情况下“展开”到播放详情页，具体的实现方法是将视频播放的 View 放在 Fragment 中，Fragment 的 Container 放在整个 ViewTree 的最顶层，点击播放时，将视频播放 Fragment 移动到需要展示视频的位置并开始播放，需要点击进入详情页时，只需要对视频播放的 Fragment 做平移和缩放动画，在视频播放的 Fragment 下方再添加评论等其他的 Fragment。这里可以参考 Android 原生的 VideoView 的封装思想来实现：

```
public class VideoView extends SurfaceView
        implements MediaPlayerControl, SubtitleController.Anchor {
```

参考 VideoView 源码可以将 SurfaceView 替换为 TextureView ，再对应处理下 onSurfaceTextureAvailable 等回调即可。这种方案应用还是比较广泛的，比如京东、淘宝等的商品详情的介绍视频。这种方案虽然简单但是局限也比较大，只能解决在同一个 Activity 中的场景，如果需求是在不同 Activity 中无缝播放切换这个方案就无法满足了。


### 不同页面间播放器 Seek 方案

实现跨 Activity 场景无缝播放的另一个方案是打开新的页面时，在新的页面中使用新播放器重新打开资源，并根据原来保存的进度重新 seek 后再续播，这种方案其实并不能保证真正的“无缝”播放，毕竟 Activity 启动也要消耗一两百毫秒的时间，不过这个方案最大的优势是一些老逻辑进行很少的更改就可以支持无缝播放功能，比如在一些不是很重要的页面中，视频播放功能可能已经存在并且播放逻辑耦合了很重的业务逻辑，这时 seek 方案就比较合适了。

这个方案虽然简单但是也有一些需要注意的地方：
1. 缓存复用提升体验。播放在线视频时可以使用播放缓存复用来提升用户体验，视频播放缓存可以采用 url 代理下载的方式实现，一般做法是启动 Local Http Server 将视频播放的请求代理到本地 server，在本地 server 中将视频文件存储到指定的位置，这也是视频播放中比较常用的方案，缓存功能的可以参考 [AndroidVideoCache](https://github.com/danikula/AndroidVideoCache) 。
2. 系统提供的 MediaPlayer 只能 Seek 到关键帧的问题。使用系统播放器重新打开视频资源 seek 时，有时会无法 seek 到原来播放的位置，甚至会直接跳转到视频播放的开始或者结束位置，视频越短压缩率越高就会越明显，这就是关键帧的问题。关键帧问题的解决方案是可以是基于 MediaCodec 自己实现播放器，可以参考或直接使用Google开源的 [ExoPlayer](https://github.com/google/ExoPlayer)。

> 关键帧被称为 I 帧，可以被看做是一帧没有压缩过的画面，解码的时候无需依赖其他帧，关键帧之间还存在 B 帧和 P 帧这样的压缩帧，需要依赖其他帧才能解码出完整的画面，两个关键帧之间的间隔被称为一个 GOP，在 GOP 内的帧系统播放器是没办法直接 seek 的。

### 4. View 跨 Activity 复用方案

View 跨 Activity 复用是指手动使用 ApplicationContext 创建需要被复用的 View，并且使用单例 Manager 持有该 View，添加删除可复用 View 可以统一在 Activity 生命周期函数中实现，示例代码如下：
```
object Manager : ActivityLifecycleCallbacks
    override fun onActivityStarted(activity: Activity) {
        ...
        removePlayerBarFromWindow(activity)
        addPlayerBarToWindow(activity)
    }

    override fun onActivityPaused(activity: Activity) {
        ...
        if (activity.isFinishing && getMiniPlayerBarParentContext() == activity) {
            removePlayerBarFromWindow(activity, true)
        }
    }
```

```
    private fun getPlayerBar(activityBase: Activity): MiniPlayerBar {
        synchronized(this) {
            if (miniPlayerBar == null) {
                miniPlayerBar = MiniPlayerBar(activityBase.applicationContext)
            }
            ...
            return miniPlayerBar!!
        }
    }
```
理论上这是一种更加灵活的方案，使用 Application 作为 View 的 Context 也不用担心泄漏问题，不过由于在这次小窗的需求中涉及到老的页面和新页面的播放器复用，在很多场景下并不是一个统一的播放View，所以没有采用这种方案，不过这个方案在网易云音乐的音街 App 的 mini 播放条上已经被使用，有兴趣的小伙伴也可以尝试下。

## 总结

以上是网易云音乐中一些无缝播放的方案的总结，主要介绍了一下网易云音乐中几种无缝播放能力的实现思路，给大家方案选型做参考，如果有其他的方案也欢迎交流。网易云音乐中的方案是从简单到复杂逐渐演进而来，随着需求不断迭代变成今天的样子，个人理解设计方案时不用过分的追求大而全，适合当前场景的才是最好的，好的架构不仅要靠好的设计，也要靠不断的改进优化。 

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
