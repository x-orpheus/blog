---
title: 网易云音乐 iOS 14 小组件实战手册
date: 2020-10-26T03:13:53.192Z
description: 苹果在今年的 WWDC20 上发布了小组件（WidgetKit），支持在 iOS、iPadOS 主屏幕展示动态信息和个性化内容。作者刚刚完成云音乐小组件的初版开发工作，本文从实际开发的角度谈谈小组件开发的方方面面，希望能给大家带来帮助。
---

![题图](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404666916/e47e/43ce/d0ff/16641363ab121df02f755894e0c5dc9f.jpg)

图片来源: https://unsplash.com/photos/aWQsnHaITD8/

> 本文作者：[闫冰](http://github.com/yiios)

## 前言

苹果在今年的 WWDC20 上发布了小组件（WidgetKit），支持在 iOS、iPadOS 主屏幕展示动态信息和个性化内容。加上 iOS 系统应用抽屉的加入，苹果对一向保守主屏幕大动干戈，导致用户也对小组件非常期待。但小组件的运行限制很多，如何在有限的机制上怎样做好用户体验就成为需要完成的挑战。

## 小组件简述

小组件可以在主屏幕上实现内容展示和功能跳转。
系统会向小组件获取时间线，根据当前时间对时间线上的数据进行展示。点击正在展示的视觉元素可以跳转到APP内，实现对应的功能。

云音乐的小组件效果如下：

![preview](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4510556346/7933/0441/b987/65a30b0f7b242a48cde7222c6e95ce43.png)


## 开发思路浅谈

![Widget 技术栈](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403656300/6045/b97c/71a3/934a21cb8e33b1686eb06d065adb3469.png)


首先需要明确的是小组件是一个独立于 App 环境(即 App Extension)，小组件的生命周期/存储空间/运行进程都和 App 不同。所以我们需要引入这个环境下的一些基础设施，比如网络通信框架，图片缓存框架，数据持久化框架等。

小组件本身的生命周期是一个很有意思的点。直白的来讲小组件的生命周期是和桌面进程一致的，但这不意味着小组件能随时的执行代码完成业务。小组件使用 Timeline 定义好的数据来渲染视图，我们的代码只能在刷新 Timeline (`getTimeline`)和创建快照（`getSnapshot`）时执行。一般而言，在刷新 Timeline 时获取网络数据，在创建快照时渲染合适的视图。

大多数情况下都需要使用数据来驱动视图展示。这个数据可以通过网络请求获得，也可以利用 App Groups 的共享机制从 App 中获取。

在刷新 Time Line 时获取到数据后，即可按照业务需求合成 Timeline。Timeline 是一个以 `TimelineEntry` 为元素的数组。 `TimelineEntry` 包含一个 `date` 的时间对象，用以告知系统在何时使用此对象来创建小组件的快照。也可以继承 `TimelineEntry` ，加入业务所需要的数据模型或其他信息。

为了使小组件展示视图，需要用 SwiftUI 来完成对小组件的布局和样式搭建。在下面会介绍如何实现布局和样式。

在用户点击小组件后，会打开 App，并调用 `AppDelegate` 的 `openURL:` 方法。我们需要在 `openURL:` 中处理这个事件，使用户直接跳转至所需的页面或调用某个功能。

最后，如果需要开放给用户小组件的自定义选项，则使用 `Intents` 框架，预先定义好数据结构，并在用户编辑小组件提供数据，系统会根据数据来绘制界面。用户选择的自定义数据都会在刷新 Time Line (`getTimeline`)和创建快照（`getSnapshot`）时以参数的形式提供出来，之后根据不同的自定义数据执行不同的业务逻辑即可。


## App Extension

如果你已经有了 App Extension 的开发经验，可以略过这个章节。

按照苹果的说法：App Extension 可以将自定义功能和内容扩展到应用程序之外，并在用户与其他应用程序或系统交互时向用户提供。例如，您的应用可以在主屏幕上显示为小部件。也就是说小组件是一种 App Extension，小组件的开发工作，基本都在 App Extension 的环境中。

App 和 App Extension有什么关系？

本质上是两个独立的程序，你的主程序既不可以访问 App Extension 的代码，也不可以访问其存储空间，这完完全全就是两个进程、两个程序。App Extension 依赖你的 App 本体作为载体，如果将 App 卸载，那么 App Extension 也不会存在于系统中了。而且 App Extension 的生命周期大多数都作用于特定的领域，根据用户触发的事件由系统控制来管理。

### 创建 App Extension 和配置文件

下面简述一下如何创建小组件的 App Extension并配置证书环境。

在 Xcode 中新增一个 Widget Extension（路径如下：File-New-Target-iOS选项卡-Widget Extension）。如果你需要小组件的自定义功能，则不要忘记勾选 `Include Configuration Intent`。
    
![创建 App Extension 第一步](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403686267/d480/dbbb/8273/8a64e3a9a1ed08d38917d3c7c62e4ae2.jpg)

在 Widget Extension 的 Target 中添加 App Groups，并保持和主程序相同的 App Group ID 。如果主程序中还没有App Groups，则需要这个时候同时增加主 App 的 App Groups，并定义好 Group ID。

![创建 App Extension 第二步](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403734752/c597/c074/6172/f186dadce106d73434db96541d474936.jpg)

如果你的开发者账号登录在 Xcode 中，那么此时应用程序的配置文件和 App ID 等配置都会是正确的。如果你没有登录 Xcode 中，则需要前往苹果开发者中心，手动创建 App Extension 的 App ID 和配置文件。此时不要忘记在 App ID 中配置 App Groups。

### App Groups 数据通信

因为 App 和 App Extension 是不能直接通讯的，所以需要共享信息时，需要使用 App Groups 来进行通讯。App Groups 有两种共享数据的方式，`NSUserDefaults`和`NSFileManager`。

#### NSUserDefaults 共享数据

使用 NSUserDefaults 的 `initWithSuiteName:` 初始化实例。 `suitename`传入之前定义好的 App GroupID。

```objc
- (instancetype)initWithSuiteName:(NSString *)suitename;
```

之后即可使用`NSUserDefaults`的实例的存取方法来储存和获取共享数据了。比如我们需要和小组件共享当前的用户信息，则可以如下操作。

```objc
//使用 Groups ID 初始化一个供 App Groups 使用的 NSUserDefaults 对象
NSUserDefaults *userDefaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.company.appGroupName"];

//写入数据
[userDefaults setValue:@"123456789" forKey:@"userID"];

//读取数据
NSString *userIDStr = [userDefaults valueForKey:@"userID"];
```

#### NSFileManager 共享数据

使用 NSFileManager 的 `containerURLForSecurityApplicationGroupIdentifier:` 获取 App Group 共享的储存空间地址，即可进行文件的存取操作。

```objc
- (NSURL *)containerURLForSecurityApplicationGroupIdentifier:(NSString *)groupIdentifier;
```

## SwiftUI 构建组件

应该是基于耗电量等方面的考量，苹果要求小组件只能使用 SwiftUI ，也不能通过 `UIViewRepresentable` 桥接 `UIKit` 来使用。

小组件的交互方式简单，只有点击，且视图较小。开发所需要的 SwiftUI 知识比较简单，合理构建出小组件视图即可，一般而言不会涉及到数据绑定等操作。

这个章节主要介绍如何使用 SwiftUI 构建小组件，我会假设读者已经有了对 SwiftUI 的基础知识。如果你对 SwiftUI 还较为陌生，可以通过参考资料中的两个视频教程来增进了解([【十五分钟搞懂SwiftUI】布局篇](https://www.bilibili.com/video/BV1Ht4y1y7CE)/[【十五分钟搞懂SwiftUI】样式篇](https://www.bilibili.com/video/BV1o54y1i7xJ))。也可以查阅开发文档或者 WWDC19/20 的相关专题获取 SwiftUI 更多知识。

### 使用 SwiftUI 完成小组件视图

下面使用一个简单的开发例子，来帮助大家使用 SwiftUI 开发小组件视图。

首先看小组件的视觉稿：

![小组件视觉稿](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4406974564/7486/bec8/c6f2/8c8e432c39a04f59b364355e5977480f.png)

简单分析一下视觉稿中的视图元素：

1. 铺满全部的背景图片(`Image`)
2. 从底部至上的黑色渐变(`LinearGradient`)
3. 右上角的云音乐 Logo(`Image`)
4. 小组件中间的日历图标(`Image`)
5. 日历图标下面两行文字(`Text`)

通过分析，不难发现要实现视觉稿的效果，需要使用 `Text` 、`Image` 、 `LinearGradient` 三个组件即可完成。

将视觉元素 1/2/3 归为背景视图，方便其他组件复用。随后把组件内容类型相关的 4/5 归为前景视图。

![小组件视图分析](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4406974501/e131/fb32/16fd/8bdb0cb190ea16f2a888e5dc0d881090.png)

先来实现背景视图：

```swift
struct WidgetSmallBackgroundView: View {
    
    // 底部遮罩的占比为整体高度的 40%
    var contianerRatio : CGFloat = 0.4
    
    // 背景图片
    var backgroundImage : Image = Image("backgroundImageName")
    
    // 从上到下的渐变颜色
    let gradientTopColor = Color(hex:0x000000, alpha: 0)
    let gradientBottomColor = Color(hex:0x000000, alpha: 0.35)
    
    // 遮罩视图 简单封装 使代码更为直观
    func gradientView() -> LinearGradient {
        return LinearGradient(gradient: Gradient(colors: [gradientTopColor, gradientBottomColor]), startPoint: .top, endPoint: .bottom)
    }
    
    var body: some View {
        // 使用 GeometryReader 获取小组件的大小
        GeometryReader{ geo in
            // 使用 ZStack 叠放 logo 图标 和 底部遮罩
            ZStack{
                // 构建 logo 图标, 使用 frame 确定图标大小, 使用 position 定位图标位置
                Image("icon_logo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 20, height: 20)
                    .position(x: geo.size.width - (20/2) - 10 , y : (20/2) + 10)
                    .ignoresSafeArea(.all)

                // 构建 遮罩视图, 使用 frame 确定遮罩大小, 使用 position 定位遮罩位置
                gradientView()
                    .frame(width: geo.size.width, height: geo.size.height * CGFloat(contianerRatio))
                    .position(x: geo.size.width / 2.0, y: geo.size.height * (1 - CGFloat(contianerRatio / 2.0)))
            }
            .frame(width: geo.size.width, height: geo.size.height)
            // 添加上覆盖底部的背景图片
            .background(backgroundImage
                            .resizable()
                            .scaledToFill()
            )
        }
    }
}
```

背景视图完成的效果如下图：

![小组件背景视图](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4406974668/f845/cd92/c056/1168fbc8eb3e13a8f9aed89dd4fd48d6.png)

接下来把背景视图放置在小组件的视图中，并实现中间的图标和文案视图，这样就完成了整个组件的视觉构建过程：

```swift
struct WidgetSmallView : View {
    
    // 设置大图标的宽高为小组件高度的 40%
    func bigIconWidgetHeight(viewHeight:CGFloat) -> CGFloat {
        return viewHeight * 0.4
    }
    
    var body: some View {
        
        GeometryReader{ geo in
            VStack(alignment: .center, spacing : 2){
                Image("iconImageName")
                    .resizable()
                    .scaledToFill()
                    .frame(width: bigIconWidgetHeight(viewHeight: geo.size.height), height: bigIconWidgetHeight(viewHeight: geo.size.height))
                
                Text("每日推荐")
                    .foregroundColor(.white)
                    .font(.system(size: 15))
                    .fontWeight(.medium)
                    .lineLimit(1)
                    .frame(height: 21)
                
                Text("为你带来每日惊喜")
                    .foregroundColor(.white)
                    .font(.system(size: 13))
                    .fontWeight(.regular)
                    .opacity(0.8)
                    .lineLimit(1)
                    .frame(height: 18)
            }
            // 增加 padding 使 Text 过长时不会触及小组件边框
            .padding(EdgeInsets(top: 0, leading: 14, bottom: 0, trailing: 14))
            .frame(width: geo.size.width, height: geo.size.height, alignment: .center)
            // 设置背景视图
            .background(WidgetSmallBackgroundView())
        }
    }
}
```

通过上述简单的例子可以发现，在常规的流式布局中，使用 `VStack` 和 `HStack` 即可达到布局效果。而如果想要实现例子中 logo 图标的效果的话，就需要使用 `position/offset` 来改变定位坐标来达成目标了。

### 关于 Link 视图的一点补充

Link 是一个可以点击的视图，如果可能的话，它将在关联的应用程序中打开，否则将在用户的默认Web浏览器中打开。中/大尺寸的小组件可以用它来给点击区域设定不同的跳转参数。因为上面的例子是小尺寸的组件，不能使用 Link 来区分跳转，所以在这里补充一下。

```swift
Link("View Our Terms of Service", destination: URL(string: "https://www.example.com/TOS.html")!)
```

## 获取数据

### 网络请求

小组件中可以使用 `URLSession`，所以网络请求和 App 中基本一致，在此就不赘述了。

需要注意的点：
1. 使用第三方框架需要引入小组件所在的 Target。
2. 在刷新 Timeline 时调用网络请求。
3. 如果需要和 App 共享信息，则需要通过 App Group 的方式存取。


### 图片的加载缓存

图片缓存则和 App 中不同。目前在 SwiftUI 中的 `Image` 视图不支持传入 URL 加载网络图片。也不能使用异步获取网络图片的 `Data`的方式完成网络图片的加载。
只能通过刷新 Timeline ，调用网络请求完成后，再去获取 Timeline 上所有的网络图片的 `data`。

```swift
    func getTimeline(for configuration: Intent, in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        // 发起网络请求
        widgetManager.requestAPI(family : context.family, configuration: configuration) { widgetResponse, date in
            // 在接口回调中生成 Timeline entry
            let entry = WidgetEntry(date: Date(), configuration: configuration, response: widgetResponse, family : context.family)
            // 解析出 Timeline entry 所需要的网络图片
            let urls = entry.urlsNeedDownload()
            // 查询本地缓存以及下载网络图片
            WidgetImageManager().getImages(urls: urls) {
                let entries = [entry]
                let timeline = Timeline(entries: entries, policy: .after(date))
                completion(timeline)
            }
        }
    }
```

`getImages` 方法中，我们需要维护一个队列去依次查询本地缓存以及在缓存未命中时下载网络图片。

```swift
    public func getImages(urls : [String] , complition : @escaping () -> ()){
        
        // 创建目录
        WidgetImageManager.createImageSaveDirIfNeeded()
        
        // 去重
        let urlSet = Set(urls)
        let urlArr = Array(urlSet)
        
        self.complition = complition
        
        self.queue = OperationQueue.main
        self.queue?.maxConcurrentOperationCount = 2

        let finishBlock = BlockOperation {
            self.complition?()
        }
        
        for url in urlArr {
            let op = SwiftOperation { finish in
                self.getImage(url: url) {
                    finish(true)
                }
            }
            
            finishBlock.addDependency(op)
            self.queue?.addOperation(op)
        }
        
        self.queue?.addOperation(finishBlock)
    }
    
    public func getImage(url : String , complition : @escaping () -> ()) -> Void {
        let path = WidgetImageManager.pathFromUrl(url: url)
        if FileManager.default.fileExists(atPath: path) {
            complition()
            return
        }
        
        let safeUrl = WidgetImageManager.filterUrl(url: url)
        WidgetHttpClient.shareInstance.download(url: safeUrl, dstPath: path) { (result) in
            complition()
        }
    }

```


### 预览状态的数据获取

在用户添加小组件时，会在预览界面看到小组件的视图。此时，系统会触发小组件的 `placeholder` 方法，我们需要在这个方法中返回一个 Timeline，用以渲染出预览视图。

为了保证用户的体验，需要为接口调用准备一份本地的兜底数据，确保用户可以在预览界面看到真实的视图，尽量不要展示无数据的骨架屏。

![PreviewStatus](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4405113912/316c/1718/ece0/5dc812bffc1a8939bcb28c5c0010bb5b.png)


## TimeLine

小组件的内容变化都依赖于 Timeline 。小组件本质上是 Timeline 驱动的一连串静态视图。

### 理解 TimeLine

在前面提到过，Timeline 是一个以 `TimelineEntry` 为元素的数组。 `TimelineEntry` 包含一个 `date` 的时间对象，用以告知系统在何时使用此对象来创建小组件的快照。也可以继承 `TimelineEntry` ，加入业务所需要的数据模型或其他信息。

![TimeLine](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403832891/fa8e/c615/2e72/af29c1d5fbdb466382dfb3a4bd16c594.jpg)

在生成新的 Timeline 之前，系统会一直使用上一次生成的 Timeline 来展示数据。

如果 Timeline 数组里面只有一个 entry ，那么视图就是一成不变的。假如需要小组件随着时间产生变化，可以在 Timeline 中生成多个 entry 并赋予他们合适的时间，系统就会在指定的时间使用 entry 来驱动视图。

### Reload

所谓的小组件刷新，其实是刷新了 Timeline ，导致由 Timeline 数据驱动的小组件视图发生了改变。

刷新方法分为两种：
1. System reloads
2. App-driven reloads

#### System reloads

由系统发起的 Timeline 刷新。系统决定每个不同的 Timeline 的 System Reloads 的频次。超过频次的刷新请求将不会生效。高频使用的小组件可以获得更多的刷新频次。

**ReloadPolicy:**
在生成 Timeline 时，我们可以定义一个 ReloadPolicy ，告诉系统更新 Timeline 的时机。ReloadPolicy 有三种形式：
* atEnd
    * 在 Timeline 提供的所有 entry 显示完毕后刷新，也就是说只要还有没有显示的 entry 在就不会刷新当前时间线

![ReloadPolicyAtEnd](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403852714/c1b1/6ab5/9dfc/85029495ab46402d099cd2540e828839.jpg)

* after(date)
    * date 是指定的下次刷新的时间，系统会在这个时间对 Timeline 进行刷新。
    
![ReloadPolicyAfter](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403865293/7d84/d51b/d49e/d0896f84748a44f4500b4f025040d532.jpg)

* never
    * ReloadPolicy 永远不会刷新 Timeline，最后一个 entry 也展示完毕之后 小组件就会一直保持那个 entry 的显示内容

![ReloadPolicyNever](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403873272/b826/1293/b5a8/b79d6b2c3962b6b7c2220993c6c90e1a.jpg)


>  Timeline Reload 的时机是由系统统一控制的，而为了保证性能，系统会根据各个 Reload 请求的重要等级来决定在某一时刻是否按照 APP 要求的刷新时机来刷新 Timeline。因此如果过于频繁的请求刷新 Timeline，很有可能会被系统限制从而不能达到理想的刷新效果。换句话说，上面所说的 atEnd, after(date) 中定义的刷新 Timeline 的时机可以看作刷新 Timeline 的最早时间，而根据系统的安排，这些时机可能会被延后。


#### App-driven reloads

由 App 触发小组件 Timeline 的刷新。当 App 在后台时，后台推送可以触发 reload；当 App 在前台时，通过 WidgetCenter 可以主动触发 reload 。

![App-driven Reloads](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403892720/c23f/b711/0b93/65eff1bfcb14b4991a1da9921823cdcc.jpg)

调用 WidgetCenter 可以根据 `kind` 标识符刷新部分小组件，也可以刷新全部小组件。

```swift
/// Reloads the timelines for all widgets of a particular kind.
/// - Parameter kind: A string that identifies the widget and matches the
///   value you used when you created the widget's configuration.
public func reloadTimelines(ofKind kind: String)

/// Reloads the timelines for all configured widgets belonging to the
/// containing app.
public func reloadAllTimelines()

```

## 点击落地

用户点击了小组件上的内容或功能入口时，需要在打开 App 后正确响应用户的需求，呈现给用户相应的内容或功能。
这需要分两部分来做，首先在小组件中对不同的点击区域定义不同的参数，之后在 App 的 `openURL:` 中根据不同的参数呈现不同的界面。

### 区分不同的点击区域

想要对于不同的区域定义不同的参数，需要把 widgetURL 和 Link 结合使用。

#### widgetURL

widgetURL 作用范围是整个小组件，且一个小组件上只能有一个 widgetURL 。多添加的 widgetURL 参数是不会生效的。

![widgetURL](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403915829/4606/3413/e7c6/3482bd5f93f2280ce8d901d0792ce440.png)

代码如下：

```swift
struct WidgetLargeView : View {
    var body: some View {
        GeometryReader{ geo in
            WidgetLargeTopView()
            ...
        }
        .widgetURL(URL(string: "jump://Large")!)
    }
}
```

#### Link

Link 作用范围是 Link 组件的实际大小。可以添加多个 Link ，在数量上是没有限制的。需要注意的是小组件的 systemSmall 类型下，不能使用 Link API。

![Link](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4403925174/2a48/aa88/0f45/5fba3083e07aa27ccf7d142945f25e40.jpg)

代码如下：

```swift
struct WidgetLargeView : View {
    var body: some View {
        GeometryReader{ geo in
            WidgetLargeTopView()
            Link(destination: URL(string: "自定义的Scheme://Unit")!) {
                WidgetLargeUnitView()
            }
            ...
        }
        .widgetURL(URL(string: "自定义的Scheme://Large")!)
    }
}
```


### URL Schemes

URL Schemes 是小组件跳转到 App 的桥梁，也是 App 之间相互跳转的通道。一般的开发者对其应该并不陌生。

注册自定义 URL Scheme 非常简单，通过 `info.plist` --> `URL Types` --> `item0` --> `URL Schemes` --> `自定义的Scheme` 来设置。

之后，在小组件中，即可通过 `自定义的Scheme://` 拼接成的 URL 对象来打开自己的 App ，在 `://` 后面可以增加参数来表明所需要功能或内容。

需要注意：增加参数时，出现的中文要进行转义。这里可以使用 `NSURLComponents` 和 `NSURLQueryItem` 来拼接跳转 URL 字符串。自带转义效果且操作 URL 更加规范。

```objc
NSURLComponents *components = [NSURLComponents componentsWithString:@"自定义的Scheme://"];
NSMutableArray<NSURLQueryItem *> *queryItems = @[].mutableCopy;
NSURLQueryItem *aItem = [NSURLQueryItem queryItemWithName:@"a" value:@"参数a"];
[queryItems addObject:aItem];
NSURLQueryItem *bItem = [NSURLQueryItem queryItemWithName:@"b" value:@"参数b"];
[queryItems addObject:bItem];
components.queryItems = queryItems;

NSURL *url = components.URL;
```

### 落地 App 后的处理

点击小组件跳转 App 后会触发 AppDelegate 的 openURL 方法。

```objc
- (BOOL)application:(UIApplication *)app openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
```

在 openURL 方法中，通过解析 url 参数，明确用户需要的功能跳转或内容的展示，随后进行对应的实现。这对项目的路由能力提出了一定的要求，因和小组件开发联系不大，不做详述。

## 动态配置小组件

小组件支持用户在不打开应用的情况下配置自定义数据，使用 `Intents` 框架，可以定义用户在编辑小组件时看到的配置页面。
这里用的词的定义而不是绘制，是因为只能通过 `Intents` 来生成配置数据，系统会根据生成的数据来构建配置页面。

![ConfigurationWidget](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4510550828/3988/d43f/48b2/363fd0997da54079cda928815dd215db.png)

### 构建一个简单的自定义功能

构建一个简单的自定义功能需要两步：

1. 创建和配置 IntentDefinition 文件
2. 修改 Widget 的相关参数支持 ConfigurationIntent 。

#### 1. 创建和配置 IntentDefinition 文件

如果你在创建小组件 Target 时勾选了 `Include Configuration Intent` ，Xcode 会自动生成 `IntentDefinition` 文件。

假如没有勾选 `Include Configuration Intent` 选项，那么你需要手动添加 `IntentDefinition` 文件。

菜单 `File` -> `New` -> `File` 然后找到 `Siri Intent Definition File` 之后添加到小组件 Target 中。

![IntentDefinition1](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404040363/cbe2/e3d1/4fe7/8ad0858109670115d2a8f7a1ac9f9509.jpg)

创建文件后，打开 `.intentdefinition` 文件进行配置。

![IntentDefinition2](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404047921/73cb/b73d/cb1f/93b6769928e0968911288ebd4987ac42.jpg)

首先需要记住左侧的 Custom Class 中的类名，Xcode 会根据这个名称，在编译后自动生成一个 ConfigurationIntent 类，这个类储存了用户配置信息。当然这里也可以填写一个你指定的类名，需要注意项目编译过后才会生成这个类。

然后我们需要创建自定义参数模板，点击`Parameter` 下方的 `+` 号即可创建一个参数。
之后可以定义创建出的 Parameter 的 Type ，除了相对直观的系统类型以外，还有两个比较难以理解的 Enums 和 Types 分栏。

![IntentDefinition3](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404058539/e8bb/edc6/57ac/4966033d1ab92bc2a4db126b687816f4.jpg)



**系统类型**

特定的类型有近一步的自定义选项来定制输入 UI。例如，Decimal 类型可以选择采用输入框（Number Field）输入或者是滑块（Slider）输入，同时可以定制输入的上下限；Duration 类型可以定制输入值的单位为秒、分或者时；Date Components 可以指定输入日期还是时间，指定日期的格式等等。

![IntentDefinitionSystemType](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404078962/3c1f/94a2/55b2/0e969fa9b5ed1c7cfa704ba17415321d.jpg)


**Enum**
简单的理解就是 Enums 是写死在 `.intentdefinition` 文件中的静态配置，只有发版才可以更新。

**Type**
Types 就灵活多了，可以在运行时动态的生成，一般而言我们使用 Types 来做自定义选项。

![IntentDefinitionType](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404091464/214c/6e17/96d0/03a322fd79eae5c4c84673a6a99a0dcc.jpg)

**支持输入多个值**

大部分类型的参数支持输入多个值，即输入一个数组。同时，支持根据不同的 Widget 大小，限制数组的固定长度。

![IntentDefinitionFixedSize](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404106402/b8b8/4b17/6500/1ed08e69dda3d30d1042efd84a7f2958.jpg)

**控制配置项的显示条件**

可以控制某一个配置项，只在另一个配置项含有任何/特定值时展示。如下图，日历 App 的 Up Next Widget，仅在 Mirror Calendar App 选项没有被选中时，才会显示 Calendars 配置项。

![IntentDefinitionParametersControl1](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404144573/e6f8/91f1/62c9/6b16d86dc353ae01eb3927251fb79bc4.jpg)

在 Intent 定义文件中，将某一个参数 A，设置为另一个参数 B 的 `Parent Parameter` ，这样，参数 B 的显示与否就取决于参数 A 的值。

例如，在下图中，`calendar` 参数仅在 `mirrorCalendarApp` 参数的值为 `false` 时展示：

![IntentDefinitionParametersControl2](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404162564/edc0/c91c/faa1/ed993d4e3395c94e97f567646a5175d5.jpg)


#### 2. 修改 Widget 的相关参数支持 ConfigurationIntent

**替换 Widget 类中的 `StaticConfiguration` 为 `IntentConfiguration`**

旧：
```swift
@main
struct MyWidget: Widget {
    let kind: String = "MyWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
        }
    }
}
```

新：
```swift
@main
struct MyWidget: Widget {
    let kind: String = "MyWidget"
    var body: some WidgetConfiguration {
        IntentConfiguration(kind: kind, intent: WidgetConfiguratIntent.self, provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
        }
    }
}
```

**在 Timeline Entry 类中增加 ConfigurationIntent 参数**

代码如下：
```swift
struct SimpleEntry: TimelineEntry {
    let date: Date
    let configuration: WidgetConfiguratIntent
}
```

**修改 IntentTimelineProvider 的继承**

`Provider` 的继承改成 `IntentTimelineProvider`，并且增加 `Intent` 的类型别名。

旧：
```swift
struct Provider: TimelineProvider {
    ...
}
```

新：
```swift
struct Provider: IntentTimelineProvider {
    typealias Intent = WidgetConfiguratIntent
    ...
}
```

依次修改 getSnapshot / getTimeline 的入参以增加对自定义的支持。并在创建 Timeline Entry 时，传入 configuration 。



### 使用接口数据构建自定义入口

在 `Intent` Target 中，找到 `IntentHandler` 文件，遵守 ConfigurationIntent 生成类中 `ConfiguratIntentHandling` 协议。

实现协议要求的 `provideModeArrOptionsCollectionForConfiguration:withCompletion:` 方法。

在这个方法中，我们可以调用接口获取自定义数据，生成 `completion` block 所需要的数据源入参。 

```objc
- (void)provideModeArrOptionsCollectionForConfiguration:(WidgetConfiguratIntent *)intent withCompletion:(void (^)(INObjectCollection<NMWidgetModel *> * _Nullable modeArrOptionsCollection, NSError * _Nullable error))completion {
    
    [self apiRequest:(NSDictionary *result){
        // 处理获取到的数据
        ....
        NSMutableArray *allModelArr = ....;
        // 生成配置所需要的数据
        INObjectCollection *collection = [[INObjectCollection alloc] initWithItems:allModeArr];
        completion(collection,nil);
    }];
}

```

### 小组件获取自定义参数

在小组件根据 Timeline Entry 生成视图时，读取 Entry 的 configuration 属性即可获取用户是否自定义属性，以及自定义属性的详细值。

## 总结

### 优势和缺点并存

![WidgetKitWorks](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4404181952/c3e3/f914/33c3/d67943114f86a95cd06c387c97f360af.jpg)

小组件是一个优缺点都非常明显的事物，在桌面即点即用确实方便，但是交互方式的匮乏以及不能实时更新数据又是非常大的缺陷。正如苹果所说："Widgets are not mini-apps"，不要用开发 App 的思维来做小组件，小组件只是由一连串数据驱动的静态视图。

#### 优势：

1. 常驻桌面，大大增加了对产品的曝光。
2. 利用网络接口和数据共享，可以展示与用户相关的个性化内容。
3. 缩短了功能的访问路径。一次点击即可让用户触达所需功能。
4. 可以多次重复添加，搭配自定义和推荐算法，添加多个小组件样式和数据都可以不同。
5. 自定义配置简单。
6. 多种尺寸，大尺寸可以承载复杂度高的内容展示。

#### 缺点：

1. 不能实时更新数据。
2. 只能点击交互。
3. 小组件的背景不能设置透明效果。
4. 不能展示动态图像（视频/动图）。


### 尾巴

小组件的开发实践到此告一段落，可以看到组件虽小，需要的知识还是挺多的。包括 Timeline 、Intents 、SwiftUI 等平时开发很难接触到的框架和概念需要了解学习。

小组件孱弱的交互能力和数据刷新机制是它的硬伤。苹果对于小组件的能力是非常克制的。在开发中，很多构思和需求都受限于框架能力无法实现，希望苹果在后续迭代中可以开放出新的能力。比如支持部分不需要启动 App 的交互形式存在。

但瑕不掩瑜，向用户展示喜欢的内容或提供用户想要的功能入口，放大小组件的优势，才是当前小组件的正确开发方式。

## 参考资料

- [认识小组件](https://developer.apple.com/videos/play/wwdc2020/10028/)
- [Widgets 边看边写-1](https://developer.apple.com/videos/play/wwdc2020/10034)
- [Widgets 边看边写-2](https://developer.apple.com/videos/play/wwdc2020/10035)
- [Widgets 边看边写-3](https://developer.apple.com/videos/play/wwdc2020/10036)
- [使你的 Widget 支持个性化配置 & 智能化展现](https://developer.apple.com/videos/play/wwdc2020/10194/)
- [从开发者的角度看 iOS 14 小组件](https://sspai.com/post/61371)
- [【十五分钟搞懂SwiftUI】布局篇](https://www.bilibili.com/video/BV1Ht4y1y7CE)
- [【十五分钟搞懂SwiftUI】样式篇](https://www.bilibili.com/video/BV1o54y1i7xJ)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
