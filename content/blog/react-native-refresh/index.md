---
title: React Native 实现自定义下拉刷新组件
date: "2020-07-21T02:17:58.060Z"
description: "Web 应用如果要更新列表数据，一般会选择点击左上角刷新按钮，或使用快捷键 Ctrl+F5，进行页面资源和数据的全量更新。如果页面提供了刷新按钮或是翻页按钮，也可以点击只做数据更新。但移动客户端屏幕寸土寸金，无论是加上一个刷新按钮，还是配合越来越少的手机按键来做刷新操作，都不是十分便捷的方案。"
---

![](https://p1.music.126.net/_MOHJiIt7l2Jgoe_8yybrQ==/109951165021833487.png)

> 本文作者：李磊

# 背景
Web 应用如果要更新列表数据，一般会选择点击左上角刷新按钮，或使用快捷键 Ctrl+F5，进行页面资源和数据的全量更新。如果页面提供了刷新按钮或是翻页按钮，也可以点击只做数据更新。

但移动客户端屏幕寸土寸金，无论是加上一个刷新按钮，还是配合越来越少的手机按键来做刷新操作，都不是十分便捷的方案。

于是，在这方寸之间，各种各样的滑动方案和手势方案来触发事件，成了移动客户端的普遍趋势。在刷新数据方面，移动端最常用的方案就是下拉刷新的机制。

# 什么是下拉刷新？
下拉刷新的机制最早是由 Loren Brichter 在 Tweetie 2 中实现。Tweetie 是 Twitter 的第三方客户端，后来被 Twitter 收购，Loren Brichter 也成为 Twitter 员工（现已离开）。

Loren Brichter 在 2010 年 4 月 8 日为下拉刷新申请了专利，并获得授权[United States Patent: 8448084](http://patft.uspto.gov/netacgi/nph-Parser?Sect1=PTO2&Sect2=HITOFF&p=1&u=%2Fnetahtml%2FPTO%2Fsearch-bool.html&r=19&f=G&l=50&co1=AND&d=PTXT&s1=8448084&OS=8448084&RS=8448084)。但他很愿意看到这个机制被其他 app 采用，也曾经说过申请是防御性的。

![](https://p1.music.126.net/meC8U0vGNuOwj55dVcx24Q==/109951165022006158.png)

我们看下专利保护范围最大的主权项是：
- 在一种布置中，显示包含内容项的滚动列表；
- 可以接受与滚动命令相关联的输入；
- 根据滚动命令，显示一个滚动刷新的触发器；
- 基于滚动命令，确定滚动刷新的触发器被激活后，刷新滚动列表中的内容。

简单来说，下拉加载的机制包含三个状态：
- “下拉更新”：展示用户下拉可扩展的操作。
- “松开更新”：提示用户下拉操作的临界点。
- “数据更新动画”：手势释放，提醒用户数据正在更新。

在那之后，很多以 news feed 为主的移动客户端都相继采用了这个设计。

# React Native 支持下拉刷新么？
React Native 提供了 [RefreshControl](https://reactnative.cn/docs/refreshcontrol) 组件，可以用在 ScrollView 或 FlatList 内部，为其添加下拉刷新的功能。

RefreshControl 内部实现是分别封装了 iOS 环境下的 `UIRefreshControl` 和安卓环境下的 `AndroidSwipeRefreshLayout`，两个都是移动端的原生组件。

![](https://p1.music.126.net/2D7SVLFvBavEFHeEGbqwDw==/109951165022008758.png)

由于适配的原生方案不同，RefreshControl 不支持自定义，只支持一些简单的参数修改，如：刷新指示器颜色、刷新指示器下方字体。并且已有参数还受不同平台的限制。

![](https://p1.music.126.net/S-SL2nt4G0LcY8i8YhWBMg==/109951165022032386.png)

最常见的需求会要求下拉加载指示器有自己特色的 loading 动画，个别的需求方还会加上操作的文字说明和上次加载的时间。只支持修改颜色的 RefreshControl 肯定是无法满足的。

那想要自定义下拉刷新要怎么做呢？

# 解决方案1
[ScrollView](https://reactnative.cn/docs/scrollview) 是官方提供的一个封装了平台 ScrollView （滚动视图）的组件，常用于显示滚动区域。同时还集成了触摸的“手势响应者”系统。

[手势响应系统](https://reactnative.cn/docs/gesture-responder-system)用来判断用户的一次触摸操作的真实意图是什么。通常用户的一次触摸需要经过几个阶段才能判断。比如开始是点击，之后变成了滑动。随着持续时间的不同，这些操作会转化。

另外，手势响应系统也可以提供给其他组件，可以使组件在不关心父组件或子组件的前提下自行处理触摸交互。`PanResponder` 类提供了一个对触摸响应系统的可预测的包装。它可以将多点触摸操作协调成一个手势。它使得一个单点触摸可以接受更多的触摸操作，也可以用于识别简单的多点触摸手势。

它在原生事件外提供了一个新的 `gestureState` 对象：

```js
onPanResponderMove: (nativeEvent, gestureState) => {}
```

nativeEvent 原生事件对象包含以下字段：
- changedTouches - 在上一次事件之后，所有发生变化的触摸事件的数组集合（即上一次事件后，所有移动过的触摸点）
- identifier - 触摸点的 ID
- locationX - 触摸点相对于父元素的横坐标
- locationY - 触摸点相对于父元素的纵坐标
- pageX - 触摸点相对于根元素的横坐标
- pageY - 触摸点相对于根元素的纵坐标
- target - 触摸点所在的元素 ID
- timestamp - 触摸事件的时间戳，可用于移动速度的计算
- touches - 当前屏幕上的所有触摸点的集合

gestureState 对象为了描绘手势操作，有如下的字段：
- stateID - 触摸状态的 ID。在屏幕上有至少一个触摸点的情况下，这个 ID 会一直有效。
- moveX - 最近一次移动时的屏幕横坐标
- moveY - 最近一次移动时的屏幕纵坐标
- x0 - 当响应器产生时的屏幕坐标
- y0 - 当响应器产生时的屏幕坐标
- dx - 从触摸操作开始时的累计横向路程
- dy - 从触摸操作开始时的累计纵向路程
- vx - 当前的横向移动速度
- vy - 当前的纵向移动速度
- numberActiveTouches - 当前在屏幕上的有效触摸点的数量

可以看下 `PanResponder` 的基本用法：

```js
componentWillMount: function() {
  this._panResponder = PanResponder.create({
    // 要求成为响应者：
    onStartShouldSetPanResponder: (evt, gestureState) => true,
    onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => true,
    onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
    onPanResponderGrant: (evt, gestureState) => {
      // 开始手势操作。给用户一些视觉反馈，让他们知道发生了什么事情！
      // gestureState.{x,y} 现在会被设置为0
    },
    onPanResponderMove: (evt, gestureState) => {
      // 最近一次的移动距离为gestureState.move{X,Y}
      // 从成为响应者开始时的累计手势移动距离为gestureState.d{x,y}
    },
    onPanResponderTerminationRequest: (evt, gestureState) => true,
    onPanResponderRelease: (evt, gestureState) => {
      // 用户放开了所有的触摸点，且此时视图已经成为了响应者。
      // 一般来说这意味着一个手势操作已经成功完成。
    },
    onPanResponderTerminate: (evt, gestureState) => {
      // 另一个组件已经成为了新的响应者，所以当前手势将被取消。
    },
    onShouldBlockNativeResponder: (evt, gestureState) => {
      // 返回一个布尔值，决定当前组件是否应该阻止原生组件成为JS响应者
      // 默认返回true。目前暂时只支持android。
      return true;
    },
  });
},

render: function() {
  return (
    <View {...this._panResponder.panHandlers} />
  );
},
```

结合上面状态分析，看到 `onPanResponderMove` 和 `onPanResponderRelease` 这两个参数，基本是可以满足下拉刷新机制的操作流程的。

`onPanResponderMove` 处理滑动过程。
```js
onPanResponderMove(event, gestureState) {
  // 最近一次的移动距离为 gestureState.move{X,Y}
  // 从成为响应者开始时的累计手势移动距离为 gestureState.d{x,y}
  if (gestureState.dy >= 0) {
    if (gestureState.dy < 120) {
      this.state.containerTop.setValue(gestureState.dy);
    }
  } else {
    this.state.containerTop.setValue(0);
    if (this.scrollRef) {
      if (typeof this.scrollRef.scrollToOffset === 'function') {
        // inner is FlatList
        this.scrollRef.scrollToOffset({
          offset: -gestureState.dy,
          animated: true,
        });
      } else if(typeof this.scrollRef.scrollTo === 'function') {
        // inner is ScrollView
        this.scrollRef.scrollTo({
          y: -gestureState.dy,
          animated: true,
        });
      }
    }
  }
}
```

`onPanResponderRelease` 处理释放时的操作。
```js
onPanResponderRelease(event, gestureState) {
  // 用户放开了所有的触摸点，且此时视图已经成为了响应者。
  // 一般来说这意味着一个手势操作已经成功完成。
  // 判断是否达到了触发刷新的条件
  const threshold = this.props.refreshTriggerHeight || this.props.headerHeight;
  if (this.containerTranslateY >= threshold) {
    // 触发刷新
    this.props.onRefresh();
  } else {
    // 没到刷新的位置，回退到顶部
    this._resetContainerPosition();
  }
  // 检查 scrollEnabled 开关
  this._checkScroll();
}
```

剩下的就是如何区分容器的滑动，和下拉刷新的触发。

当 ScrollView 的 `scrollEnabled` 属性设置为 false 时，可以禁止用户滚动。因此，可以将 ScrollView 作为内容容器。当滚动到容器顶部的时候，关闭 ScrollView 的 `scrollEnabled` 属性，通过设置 Animated.View 的 `translateY`，显示自定义加载器。

```js
<Animated.View style={[{ flex: 1, transform: [{ translateY: this.state.containerTop }] }]}>
  {child}
</Animated.View>
```

[expo pulltorefresh1](https://snack.expo.io/@jarry/pulltorefresh1)

经过试用，发现这个方案有以下几个致命性问题：
1. 由于下拉过程是通过触摸响应系统经前端反馈给原生视图的，大量的数据通讯和页面重绘会导致页面的卡顿，在页面数据量较大时会更加明显；
2. 上滑和下拉的切换时通过 ScrollView 的 Enable 的属性控制的，这样会造成手势操作的中断；
3. 手势滑动过程缺少阻尼函数，表现得不如原生下拉刷新自然；
另外还有 ScrollView 的滑动和模拟的下拉过程滑动配合不够默契的问题。

# 解决方案2
ScrollView 在 iOS 设备下有个特性，如果内容范围比滚动视图本身大，在到达内容末尾的时候，可以弹性地拉动一截。可以将加载指示器放在页面的上边缘，弹性滚动时露出。这样既不需要利用到手势影响渲染速度，又可以将滚动和下拉过程很好的融合。

因此，只要处理好滚动操作的各阶段事件就好。

```js
onScroll = (event) => {
  // console.log('onScroll()');
  const { y } = event.nativeEvent.contentOffset
  this._offsetY = y
  if (this._dragFlag) {
    if (!this._isRefreshing) {
      const height = this.props.refreshViewHeight
      if (y <= -height) {
        this.setState({
          refreshStatus: RefreshStatus.releaseToRefresh,
          refreshTitle: this.props.refreshableTitleRelease
        })
      } else {
        this.setState({
          refreshStatus: RefreshStatus.pullToRefresh,
          refreshTitle: this.props.refreshableTitlePull
        })
      }
    }
  }
  if (this.props.onScroll) {
    this.props.onScroll(event)
  }
}

onScrollBeginDrag = (event) => {
  // console.log('onScrollBeginDrag()');
  this._dragFlag = true
  this._offsetY = event.nativeEvent.contentOffset.y
  if (this.props.onScrollBeginDrag) {
    this.props.onScrollBeginDrag(event)
  }
}

onScrollEndDrag = (event) => {
  // console.log('onScrollEndDrag()',  y);
  this._dragFlag = false
  const { y } = event.nativeEvent.contentOffset
  this._offsetY = y
  const height = this.props.refreshViewHeight
  if (!this._isRefreshing) {
    if (this.state.refreshStatus === RefreshStatus.releaseToRefresh) {
      this._isRefreshing = true
      this.setState({
        refreshStatus: RefreshStatus.refreshing,
        refreshTitle: this.props.refreshableTitleRefreshing
      })
      this._scrollview.scrollTo({ x: 0, y: -height, animated: true });
      this.props.onRefresh()
    }
  } else if (y <= 0) {
    this._scrollview.scrollTo({ x: 0, y: -height, animated: true })
  }
  if (this.props.onScrollEndDrag) {
    this.props.onScrollEndDrag(event)
  }
}
```

唯一美中不足的就是，iOS 支持超过内容的滑动，安卓不支持，需要单独适配下安卓。

将加载指示器放在页面内，通过 `scrollTo` 方法控制页面距顶部距离，来模拟下拉空间。（iOS 和安卓方案已在 expo pulltorefresh2 给出）

[expo pulltorefresh2](https://snack.expo.io/@jarry/pulltorefresh2)

（demo 建议在移动设备查看，Web 端适配可尝试将 `onScrollBeginDrag onScrollEndDrag` 更换为 `onTouchStart onTouchEnd`）

# 总结

本文主要介绍了在 React Native 开发过程中，下拉刷新组件的技术调研和实现过程。 Expo demo 包含了两个方案的主要实现逻辑，读者可根据自身业务需求做定制，有问题欢迎沟通。

# 参考链接
- [下拉刷新是哪个设计师想出来的？](https://www.zhihu.com/question/20138829)
- [United States Patent: 8448084](http://patft.uspto.gov/netacgi/nph-Parser?Sect1=PTO2&Sect2=HITOFF&p=1&u=%2Fnetahtml%2FPTO%2Fsearch-bool.html&r=19&f=G&l=50&co1=AND&d=PTXT&s1=8448084&OS=8448084&RS=8448084)
- [「下拉刷新」被申请专利保护之后，为什么还有如此多的应用使用它？](https://www.zhihu.com/question/20315481)
-  [React Native 中文网/RefreshControl](https://reactnative.cn/docs/refreshcontrol/)
- [GitHub facebook/React Native/RefreshControl](https://github.com/facebook/react-native/blob/884c86ae02b0be7ea1e4b258dab39f4c5aee0b9d/Libraries/Components/RefreshControl/RefreshControl.js)
- [React Native 自定义下拉刷新组件](https://juejin.im/post/5d2acdb6e51d4510a7328157)
- [React Native 中文网/panresponder](https://reactnative.cn/docs/panresponder/)
- [react-native-ultimate-listview](https://github.com/gameboyVito/react-native-ultimate-listview)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，可自由转载，转载请在标题标明转载并在显著位置保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
