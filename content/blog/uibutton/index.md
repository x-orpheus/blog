---
title: UIButton 状态新解
date: 2020-10-14T01:58:50.147Z
description: UIButton 做为 iOS 开发中最常用的控件，它的状态只有 normal、highlighted、selected、disabled 吗？
---

![题图](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4362427093/7ea0/f0e9/e27e/9a59b574ac3cb3e0c5121716d2c336b0.jpg)

> 本文作者：谭歆

## 0x0 控件状态

作为 **iOS** 开发者，一提到控件，就不得不提到 `UIButton`，它做为 **iOS** 系统最常用的响应用户点击操作的控件，为我们提供了相当丰富的功能以及可定制性。而我们的日常工作的 80% ~ 90% 做是在与 **UI** 打交道，处理控件在用户的不同操作下的不同状态，最简单的，比如用户没有登录时，按钮置灰不可点击，用户点击时出现一个反色效果反馈到用户等等。对常用状态的定义，系统在很早的时候就给出了：

```objective-c
typedef NS_OPTIONS(NSUInteger, UIControlState) {
    UIControlStateNormal       = 0,
    UIControlStateHighlighted  = 1 << 0,                  // used when UIControl isHighlighted is set
    UIControlStateDisabled     = 1 << 1,
    UIControlStateSelected     = 1 << 2,                  // flag usable by app (see below)
    UIControlStateFocused API_AVAILABLE(ios(9.0)) = 1 << 3, // Applicable only when the screen supports focus
    UIControlStateApplication  = 0x00FF0000,              // additional flags available for application use
    UIControlStateReserved     = 0xFF000000               // flags reserved for internal framework use
};
```

我们一般预先设置好 `UIButton` 在不同状态下的样式，然后直接改对应状态的 `bool` 值即可，使用上比较方便。

```objective-c
UIButton *button = [UIButton buttonWithType:UIButtonTypeCustom];
// 正常状态
[button setTitleColor:[UIColor blueColor] forState:UIControlStateNormal];
// 点击高亮
[button setTitleColor:[UIColor whiteColor] forState:UIControlStateHighlighted];
[button setBackgroundImage:[UIImage imageNamed:@"btn_highlighted"] forState:UIControlStateHighlighted];
// 不可用
[button setTitleColor:[UIColor grayColor] forState:UIControlStateDisabled];

// 用户登录状态变化时，修改属性值
if (/* 用户未登录 */) {
  button.enabled = NO;
} else {
  button.enabled = YES;
}
```

那么 `UIButton` 只有四种状态可用吗？真实开发中，控件的状态可能很多，四种是一定不够用的。

## 0x1 状态组合

首先我们注意到，`UIControlState` 的定义是一个 **NS_OPTIONS**，而不是 **NS_ENUM**，三个有效的 **bit** 两两组合应该有 8 种状态。正好我们可以写个 **Demo** 测试一下：

```objective-c
UIButton *btn = [UIButton buttonWithType:UIButtonTypeCustom];

[btn setTitle:@"Normal" forState:UIControlStateNormal];
[btn setTitle:@"Selected" forState:UIControlStateSelected];
[btn setTitle:@"Highlighted" forState:UIControlStateHighlighted];
[btn setTitle:@"Highlighted & Disabled" forState:UIControlStateHighlighted | UIControlStateDisabled];
[btn setTitle:@"Disabled" forState:UIControlStateDisabled];
[btn setTitle:@"Selected & Disabled" forState:UIControlStateSelected | UIControlStateDisabled];
[btn setTitle:@"Selected & Highlighted & Disabled" forState:UIControlStateSelected | UIControlStateHighlighted | UIControlStateDisabled];
[btn setTitle:@"Selected & Highlighted" forState:UIControlStateSelected | UIControlStateHighlighted];
```

实践证明，

* `UIControlStateHighlighted` 跟 `UIControlStateHighlighted | UIControlStateDisabled`
* `UIControlStateSelected | UIControlStateHighlighted` 跟 `UIControlStateSelected | UIControlStateHighlighted | UIControlStateDisabled`

效果是一样的，相互覆盖掉。

![ControlState](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4362443652/c74f/4a2b/c1a5/89e7e5eaca4f867d57f3d6577783f4b3.png)

其实也好理解，因为 `UIControlStateDisabled` 与 `UIControlStateHighlighted` 本来语义上就不应该共存，所以剩下六种可用的状态组合。另外，在实践中发现，当某个状态没有设置样式时，它会以 `Normal` 状态的样式兜底，因此在日常开发中，我们最好将所有用到的状态都设置上对应的样式。

## 0x2 自定义状态

有了以上组合后，我们基本上可以覆盖 90% 的日常开发，但是如果需要用到更多状态呢？

我们在开发 [音街](https://apps.apple.com/cn/app/id1492692771) 的个人主页时就遇到了状态不够用的问题，对一个关注按钮，它有以下几种不同的状态（如下图）：

1. 当前登录用户没有关注该用户
2. 当前登录用户正在关注该用户
3. 当前登录用户已经关注该用户
4. 当前登录用户与该用户互相关注

![关注状态](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4158035740/b0d7/f189/a495/99e9f2c56e04117d234cf544e06105a5.png)

这样一来用户可以操作的状态就有三种了，而且每种可操作的状态都有相应的高亮样式，于是我们无法仅仅用 `selected` 状态来表示是否已经关注。对于这种需求，一个比较容易想到的办法是在不同数据下，修改同一种状态下的样式：

```objective-c
[button setTitle:@"关注" forState:UIControlStateNormal];
[button setTitle:@"已关注" forState:UIControlStateSelected];

// 关注状态变化时
button.selected = YES;
if (/* 对方也关注了我 */) {
    [button setTitle:@"互相关注" forState:UIControlStateSelected];
}
```

需求是实现了，但控件的使用上不再简单，我们不能在初始化时设置完所有的状态，然后以数据驱动状态，状态驱动样式了，而要增加其他逻辑，并且这种增加很容易产生 **Bug**。

有没有更好的办法来自定义状态，以实现==样式只设置一次==？

回头看一下 `UIControlState` 的定义，有一个 `UIControlStateApplication` 好像从来没有用过，是不是可以用来自定义呢？

我们重用 `selected` 状态作为我们的已关注 `followed` 状态，同时新增 `loading` 关注中状态，和 `mutual` 互相关注状态。

```objective-c
enum {
    NKControlStateFollowed  = UIControlStateSelected,
    NKControlStateMutual    = 1 << 16 | UIControlStateSelected,
    NKControlStateLoading   = 1 << 17 | UIControlStateDisabled,
};


@interface NKLoadingButton : UIButton
@property (nonatomic, getter=isLoading) BOOL loading;
@property (nonatomic) UIActivityIndicatorView *spinnerView;
@end


@interface NKFollowButton : NKLoadingButton
@property (nonatomic, getter=isMutual) BOOL mutual;
@end
```

这里的定义需要作以下说明：

首先，为什么做移位 16 的操作？因为 `UIControlStateApplication` 的值是 **0x00FF0000**，移位 16 （16 到 23 均为合法值）正好让状态位落在它的区间内。

其次，`loading` 时用户应该是不能点击操作的，所以它要  **或** 上 `disabled` 状态，`mutual` 时一定是已经 `followed` 的了（即 `selected`），所以它要 **或** 上 `selected`。

最后，`loading` 状态应该其他地方也能复用，因此在继承关系上单独又拆了一层 `NKLoadingButton`。

`NKLoadingButton` 的实现比较简单，需要注意的是，我们要重写 `-setEnabled:` 方法让它在 `loading` 时同时处于不可点击状态。

```objective-c
@implementation NKLoadingButton

 - (UIControlState)state
{
    UIControlState state = [super state];
    
    if (self.isLoading) {
        state |= NKControlStateLoading;
    }
    
    return state;
}

- (void)setEnabled:(BOOL)enabled
{
    super.enabled = !_loading && enabled;
}

- (void)setLoading:(BOOL)loading
{
    if (_loading != loading) {
        _loading = loading;
        
        super.enabled = !loading;
        
        if (loading) {
            [self.spinnerView startAnimating];
        } else {
            [self.spinnerView stopAnimating];
        }
        
        [self setNeedsLayout];
        [self invalidateIntrinsicContentSize];
    }
}

@end
```

`NKFollowButton` 的实现如下：

```objective-c

@implementation NKFollowButton

- (instancetype)initWithFrame:(CGRect)frame
{
    self = [super initWithFrame:frame];
    if (self) {        
        [self setTitle:@"关注" forState:UIControlStateNormal];
        [self setTitle:@"已关注" forState:UIControlStateSelected];
        [self setTitle:@"已关注" forState:UIControlStateSelected | UIControlStateHighlighted];
        [self setTitle:@"互相关注" forState:NKControlStateMutual];
        [self setTitle:@"互相关注" forState:NKControlStateMutual | UIControlStateHighlighted];

        [self setTitle:@"" forState:NKControlStateLoading];
        [self setTitle:@"" forState:NKControlStateLoading | UIControlStateSelected];

        [self setTitle:@"" forState:NKControlStateMutual | NKControlStateLoading];
        
        // 以下省略颜色相关设置
    }
    return self;
}

- (UIControlState)state
{
    UIControlState state = [super state];
    
    if (self.isMutual) {
        state |= NKControlStateMutual;
    }
    
    return state;
}

- (void)setSelected:(BOOL)selected
{
    super.selected = selected;
    if (!selected) {
        self.mutual = NO;
    }
}

- (void)setMutual:(BOOL)mutual
{
    if (_mutual != mutual) {
        _mutual = mutual;
        
        if (mutual) {
            self.selected = YES;
        }
        
        [self setNeedsLayout];
        [self invalidateIntrinsicContentSize];
    }
}

@end
```

我们需要重写 `-state` 方法让外界拿到完整、正确的值，重写 `-setSelected:` 方法和 `-setMutual:` 方法，让它们在某些条件下互斥，某些条件下统一。

如此，我们实现了只在 `-init` 中设置一次样式，后续仅仅依据服务端返回的数据修改 `.selected` `.loading` `.mutual` 的值即可！

## 0x3 总结

本文从单一状态，到组合状态，到自定义状态层层深入了介绍了 `UIButton` 的状态在日常开发中的应用，只用状态来驱动 **UI** 一直是程序员开发中的美好设想，本文算是从一个基本控件上给出了实现参考。另外，我们在查看一些系统提供的 **API** 时，一定要多思考苹果这么设计的意图是什么？他们希望我们怎么使用，以及如何正确使用？

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
