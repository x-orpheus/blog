---
title: Flutter 图片控件适配之路
date: 2021-01-13T03:41:08.113Z
description: 在我们接入 Flutter 技术的时候，必然会用到大量的图片，本文将讨论构建一个图片控件的方案与优化过程。
---

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5532178935/92d7/50a8/977d/4282554fe7a617d7fc4974724ba3e5b7.png)

> 本文作者：[段家顺](http://djs66256.github.io/)

## 背景

目前大部分应用都会使用大量的图片，图片成为当前应用带宽占比最大的一种资源。在我们接入 Flutter 的时候，发现 Flutter 的图片控件缓存完全由自己管理，同时还没有提供磁盘缓存（1.22版本），所以在性能以及体验上均比较差，所以必须对其进一步优化。

## 图片缓存

在目前很多 CDN 实现上，所有资源都是拥有唯一 uri 的，所以很多的客户端实现，是忽略了 HTTP 协议中的 Caches 能力，而是直接将 uri 作为唯一标识符来判断图片资源是否唯一的。这样大大节省了向服务端确认 304 的时间与请求。

而在客户端，一般都会存在至少`内存`和`磁盘`这两级缓存，而我们在接入 Flutter 图片库的时候，就希望能够将客户端的缓存与 Flutter 中的缓存进行打通，从而减少内存和网络的消耗。

而目前复用缓存的方向大致有如下3种：

1. 复用视图，完全由客户端来提供 Flutter 的图片能力，就像 React Native 一样。
2. 复用磁盘缓存，不复用内存缓存，这种方案实现相对简单，但会导致内存中存在两份图片数据。
3. 复用内存缓存，由客户端从磁盘加载到内存，并由客户端来管理整个缓存的生命周期，比如和 SDWebImage 进行深度融合。该方案看似是最完美的复用，而且客户端有能力对整个应用的图片缓存大小进行精确的控制。

那么下面我们来看看这几种方案的实现，哪些看似美好的方案，我们都踩了哪些坑。

## 复用视图

Flutter 提供了一种和客户端原生视图进行无缝拼接的方案，原始的动机其实是为了像地图、WebView 这种场景，Flutter 不可能再去实现一套如此复杂的控件。那么如果我们用这个来做客户端图片桥接方案会怎么样呢？

首先，我们要明白 PlatformView 是如何进行桥接的（以下讨论的都是iOS实现）。在 Widget 中插入一层客户端 View，此时并不是我们想的那样，将此 View 简单的`draw`到 Flutter Root Layer 上。因为 Flutter 的`draw call`并不是发生在主线程上的，而是发生在`raster`线程上的，如果我们想要将客户端的 View 绘制到 Flutter 上，则必须先光栅化为一张图片，然后再进行绘制，这中间的性能开销与延迟显而易见是不可接受的，同时每帧都需要这么做也是不现实的。

所以，Flutter 采用了一种拆分 Flutter Layer 的形式。在插入一个客户端 View 后，Flutter 会自动将自己拆为2层：

```
|-----| Flutter Overlay View 2
|-----| Native View
|-----| Flutter Root View 1
```

客户端 View 就像夹心饼干一样被2个 Flutter view 夹住，此时位于 Platform View 上层以及后续的兄弟 Widget 都会被绘制到上层的 View 上，其他的依旧绘制在底层。这样虽然解决了客户端视图的接入，但也会导致一个问题，当上层视图发生位置等变更的时候，需要重新创建对应的 Overlay View，为了减少这种开销，Flutter 采用了一种比较 trick 的做法，即 Overlay View 会铺满屏幕，而通过移动上面的 mask 来进行控制展示区域。

```c
// The overlay view wrapper masks the overlay view.
// This is required to keep the backing surface size unchanged between frames.
//
// Otherwise, changing the size of the overlay would require a new surface,
// which can be very expensive.
//
// This is the case of an animation in which the overlay size is changing in every frame.
//
// +------------------------+
// |   overlay_view         |
// |    +--------------+    |              +--------------+
// |    |    wrapper   |    |  == mask =>  | overlay_view |
// |    +--------------+    |              +--------------+
// +------------------------+
```

目前已经解决了客户端视图接入 Flutter 的能力，但可以看到，当插入一张客户端 View，Flutter 需要额外创建2个 View 进行分区域绘制。当一个页面存在多张图片的时候，此时额外产生的开销显然也是不可接受的，性能更是不可接受。

下面是 Flutter 官方在 Platform View 上描述的关于性能的考虑。

```
Platform views in Flutter come with performance trade-offs.

For example, in a typical Flutter app, the Flutter UI is composed on a dedicated raster thread. This allows Flutter apps to be fast, as the main platform thread is rarely blocked.

While a platform view is rendered with Hybrid composition, the Flutter UI is composed from the platform thread, which competes with other tasks like handling OS or plugin messages, etc.

Prior to Android 10, Hybrid composition copies each Flutter frame out of the graphic memory into main memory, and then copies it back to a GPU texture. In Android 10 or above, the graphics memory is copied twice. As this copy happens per frame, the performance of the entire Flutter UI may be impacted.

Virtual display, on the other hand, makes each pixel of the native view flow through additional intermediate graphic buffers, which cost graphic memory and drawing performance.
```

## 复用磁盘缓存

让我们都退一步，我们首先解决网络带宽的问题，那么一个简单的方案便是复用磁盘缓存。

复用磁盘缓存的方案相对可以做的非常简单，并且拥有极低的侵入性。我们只需要设计一套 channel 接口，来同步双方缓存的状态和缓存的地址。

```dart
getCacheInfo({ 
    String url,
    double width,
    double height,
    double scale,
    BoxFit fit}) 
-> {String path, bool exists}
```

那么在使用的时候，我们仅需要定制一套新的 ImageProvider，将网络、本地两种 Provider 统一起来即可。

```dart
_CompositeImageStreamCompleter({
    String url,
    double width,
    double height
}) {
    getCacheInfo({url: url, width: width, height:height})
        .then((info) {
        if (info != null && info.path != null && info.path.length > 0) {
        var imageProvider;
        var decode = this.decode;
        if (info.exists) {
            final imageFile = File(info.path);
            imageProvider = FileImage(imageFile, scale: this.scale);
        } else {
            imageProvider = NetworkImage(info.fixUrl ?? this.url,
                scale: this.scale, headers: this.headers);
            decode = (Uint8List bytes,
                {int cacheWidth, int cacheHeight, bool allowUpscaling}) {
            final cacheFile = File(info.path);
            // 缓存到磁盘
            cacheFile.writeAsBytes(bytes).then((value) => { });
            return this.decode(bytes,
                cacheWidth: cacheWidth,
                cacheHeight: cacheHeight,
                allowUpscaling: allowUpscaling);
            };
        }
        _childCompleter = imageProvider.load(imageProvider, decode);
        final listener =
            ImageStreamListener(_onImage, onChunk: _onChunk, onError: _onError);
        _childCompleter.addListener(listener);
        }
    }).catchError((err, stack) {
        print(err);
    });
}
```

这里需要注意的是，当不存在磁盘缓存的时候，这里采用了 Flutter 来下载图片，此时需要我们手动将其保存到磁盘上，以保证磁盘缓存的一致性。

## 复用内存缓存

复用磁盘缓存是风险较低的一种改动，但是代价是无法复用内存缓存，不仅仅需要分别读取，同时会保存多份内存缓存，因为双方的内存缓存部分是完全独立存在的。

那么如果我们想进一步优化，则需要采用复用内存缓存的方案，目前同步内存缓存大致有如下几种方案：

- 利用 channel 通信，将内存传输给 Flutter
- 利用新特性 ffi 通道，将内存直接传递给 Flutter
- 利用 Texture 控件，从纹理层面进行复用

### Channel

Flutter 官方稳定的消息通信方案，兼容性和稳定性都非常高。当我们需要展示缓存图片的时候，只需要将图片数据通过 BinaryMessenger 形式传递到 Flutter 即可。

由于 Channel 本身就必须是异步过程，所以该方式通信会有一定开销。

同时由于 Channel 在客户端是在主线程进行处理，所以也需要注意避免在主线程直接做加载与解码等耗时操作。

而 Channel 在数据传递过程中，由于机制（从安全角度来看也必须这么做）原因，二进制数据必然会被拷贝一份，这样导致的结果是 Flutter 这边维护的内存缓存和客户端自身的缓存依然是两份，并没有完美的达到我们上述的复用效果。

### ffi

从消息通信开销以及消息的内存拷贝问题来看，ffi 的出现似乎能够完美解决 Channel 中所有的问题。

原理和实现过程与 Channel 完全一致，此时只需要替换为 ffi 通道即可。ffi 并没有像 Channel 那么长的通信过程，不需要进行消息序列化与解析，也不需要切换线程处理，就像一个 HTTP 请求和一个简单的 API 调用的区别一样。

这里我们需要注意的是 ffi 接口是同步执行的，也就是说客户端执行的时候是处于 flutter.ui 线程，我们必须注意线程安全问题。而对于 Flutter 来说，由于是在 UI 线程执行，所以该方法必须尽量快的返回，不能执行一些耗时比较长的操作。

但是我们采用 ffi 就真的能够解决上述问题吗？仔细研究发现，其实还是不能解决内存复用的根本性问题，下面可以看下 ffi 转换的过程。

当我们把客户端图片加载到内存的时候，是通过 Buffer 的形式传递给 Flutter 的，比如是这样一个结构：

```c++
struct Buffer {
    int8    *ptr;
    size_t  length;
}
```

对应于 Dart 中的数据类型为`Int8Pointer`和`Int64`，而 Image 控件所需要的数据类型为`Uint8List`，那么我们必须进行一步数据格式转换：

```dart
Pointer<UInt8> bufferPtr;
int length;
Uint8List buffer = bufferPtr.asTypedList(length);
```

而在这次转换过程中，会发生一次内存拷贝(Uint8List 底层保持数据使用的是 std::vector)。

所以，从最终结果来看，并不比 Channel 有更高的缓存复用能力。

### Texture

另一种是共享 PixelBuffer，也就是解码后的图片数据，在 Flutter 这里可以采用 Texture 来实现复用。

具体实现方案阿里已经研究的非常透彻，这里就不再复述了，我们主要分析下其性能与复用能力。

Texture 复用采用的是 TextureId，这是一个 int 值，所以在两端通信上不存在数据量上的性能开销。其主要过程是：

1. 客户端将纹理注册到 Flutter，同时会返回一个 id 作为唯一标识符（i++）。这个过程发生在 Platform 线程，也就是客户端主线程，而真正注册到 TextureRegistry 中则是在 raster 线程中完成的。
2. 在 flutter.ui 线程处理 paint 事件的时候，会将该 id 传递给 TextureLayer。
3. 并在 raster 线程，凭借 TextureId 从 TextureRegistry 中取出并生成 draw call。

从整体流程来看，Flutter 在中间流转过程全程只使用了 TextureId，并不会操作内存与纹理，并不存在多份缓存的问题。所以这种方案比较完美的解决了上述两个问题。

## 内存优化

虽然从上述分析中，缓存利用率最高的是 Texture，但是从内存上来分析，则出现了一个意想不到的结果。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5532110701/8410/a6fc/418a/3b693186cef4cbfa76ecbb9211f7ff32.png)

上图是使用 Flutter Image 控件，加载几张大图的一个内存图，总共增加了 10M 内存消耗。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5532110704/ebb7/6fb1/8ff7/eea729811b6b884184dda4dbac9df749.png)

上图是使用 Texture 方案，加载同样图片所产生的内存消耗，达到了 37M，相差巨大。

同时可以看到原生 Flutter 图片在初始阶段有一个比较大的波峰，同样纹理也有，但相对平缓一些。

产生这样大的区别主要还是要从 Flutter Image 控件的渲染流程中说起。

1. ImageProvider 将图片加载到内存后，首先会进行解码，而这个事情是在 flutter.io 线程完成的。
2. 图片数据解码之后，会造成一个非常大的内存消耗，因为此时的图片数据是以 pixel buffer 的形式存储的。而 Flutter 在这一过程会进行一个优化，此时解码的数据将不是 100% 大小的，而是会当前 widget size进行调整，计算出一个最优的大小，然后在这一大小上进行解码，所以原生的 Image 反而在内存占用这个方面会比客户端更优秀。
3. 在图片移除后，Flutter 会立刻回收解码后的内存，即 Flutter 仅对图片的原始压缩数据进行存储，并不缓存 pixel buffer。而我们客户端（SDWebImage）则会缓存解码后的全部数据，这也是另一个 Flutter 内存表现比客户端要优的地方。

那么 Flutter 这种策略在内存占用上完胜客户端，是否就必然是好的呢？

其实从渲染流程中看，Flutter 仅仅是用解码时间换取了内存空间。在实际 Demo 中，列表快速滑动时，Flutter Image 控件的图片展示会有明显的延迟，而采用 Texture 方案，肉眼几乎无法分辨。所以从整体的表现上来说，Texture 方案并不是没有优点。

## 图片尺寸

从上述中可以看出来，Texture 方案在内存的表现上比较差，那么我们如何去进一步优化呢？

对于很多场景，比如用户头像等，都是有一个固定大小的，那么我们可以将该大小作为参数，传给 CDN，在 CDN 上就进行裁剪成我们需要的大小，这样也会节省大量流量。

但是同样有很多场景，我们是无法得到其控件大小的，比如充满容器大小这种场景。我们如何自动在所有图片上加上 Size 参数呢？

从渲染过程中，`Layout`之后会触发`Paint`，而此时该控件的大小必然已经是完全确定的了，那么我们可以在这里做一个假的占位控件，在计算出大小后，再替换为真正的图片。

```dart
typedef ImageSizeResolve = void Function(Size size);

class ImageSizeProxyWidget extends SingleChildRenderObjectWidget {
  const ImageSizeProxyWidget({Key key, Widget child, this.onResolve})
      : super(key: key, child: child);

  final ImageSizeResolve onResolve;

  @override
  ImageSizeProxyElement createElement() => ImageSizeProxyElement(this);

  @override
  ImageSizeRenderBox createRenderObject(BuildContext context) =>
      ImageSizeRenderBox(onResolve);

  @override
  void updateRenderObject(
      BuildContext context, covariant ImageSizeRenderBox renderObject) {
    super.updateRenderObject(context, renderObject);
    renderObject.onResolve = onResolve;
  }
}

class ImageSizeProxyElement extends SingleChildRenderObjectElement {
  ImageSizeProxyElement(RenderObjectWidget widget) : super(widget);
}

class ImageSizeRenderBox extends RenderProxyBox with RenderProxyBoxMixin {
  ImageSizeRenderBox(ImageSizeResolve onResolve, [RenderBox child])
      : onResolve = onResolve,
        super(child);

  ImageSizeResolve onResolve;

  @override
  void paint(PaintingContext context, ui.Offset offset) {
    if (hasSize) {
      if (onResolve != null) onResolve(size);
    }
    super.paint(context, offset);
  }
}
```

这样，我们就能强制所有图片都必须带上 Size 参数了。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5532110693/6167/5c83/1298/24f2dfd9327f1f94372af2e67dd2c3dd.png)

经过这样的优化处理后，内存占用下降到了 2M 左右（由于我用的测试图都是高清图，所以效果看上去会比较明显）。

## 总结

Flutter 的很多思路和策略和客户端有着明显的区别，从图片这一个能力来看，就可以从各个方面进行适配与优化，如果需要达到完美可用的一个状态，看来还是需要不断的投入与探索。


## 附录

Texture 实现方案可以参考[《Alibaba.com Flutter 探索之路：Flutter 图片性能优化》](https://zhuanlan.zhihu.com/p/102990945)。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
