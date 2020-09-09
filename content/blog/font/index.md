---
title: 字体构造与文字垂直居中方案探索
date: 2020-09-09T01:39:06.101Z
description: 文字垂直居中是一个 CSS 常见的操作，可是我们平时的方法其实并没有达到真正意义上的垂直居中。本文将介绍字体的相关概念，并说明如何找到真正居中的位置。
---

![题图](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3699828493/1c58/9b24/127e/d4dacf39d7ca7d967094d11eb8ba35e3.jpg)

> 图片来源：https://unsplash.com/photos/GkinCd2enIY

> 本文作者：冯昊

## 1. 引子

垂直居中基本上是入门 CSS 必须要掌握的问题了，我们肯定在各种教程中都看到过“CSS 垂直居中的 N 种方法”，通常来说，这些方法已经可以满足各种使用场景了，然而当我们碰到了需要使用某些特殊字体进行混排、或者使文字对齐图标的情况时，也许会发现，无论使用哪种垂直居中的方法，总是感觉文字向上或向下偏移了几像素，不得不专门对它们进行位移，为什么会出现这种情况呢？

## 2. 常见的垂直居中的方法

下图是一个使用各种常见的垂直居中的方法来居中文字的示例，其中涉及到不同字体的混排，可以看出，虽然这里面用了几种常用的垂直居中的方法，但是在实际的观感上这些文字都没有恰好垂直居中，有些文字看起来比较居中，而有些文字则偏移得很厉害。

![垂直居中示例图](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3699948385/919a/f7d9/775b/5b3c8c7f86332c66600bbcb83da7b878.png)

在线查看：[CodePen](https://codepen.io/iwyvi/pen/GRoXpJM)（字体文件直接引用了谷歌字体，如果没有效果需要注意网络情况)

> 通过设置 `vertical-align:middle` 对文字进行垂直居中时，父元素需要设置 `font-size: 0`，因为 `vertical-align:middle` 是将子元素的中点与父元素的 `baseline + x-height / 2` 的位置进行对齐的，设置字号为 0 可以保证让这些线的位置都重合在中点。

我们用鼠标选中这些文字，就能发现选中的区域确实是在父层容器里垂直居中的，那么为什么文字却各有高低呢？这里就涉及到了字体本身的构造和相关的度量值。

## 3. 字体的构造和度量

这里先提出一个问题，我们在 CSS 中给文字设置了 `font-size`，这个值实际设置的是字体的什么属性呢？

下面的图给出了一个示例，文字所在的标签均为 `span`，对每种字体的文字都设置了红色的 `outline` 以便观察，且设有 `line-height: normal`。从图中可以看出，虽然这些文字的字号都是 40px，但是他们的宽高都各不相同，所以字号并非设置了文字实际显示的大小。

![文字大小示意图](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3699828576/c206/3840/b81c/1926b9811d14fc249d6b67412f075f2f.png)

为了解答这个问题，我们需要对字体进行深入了解，以下这些内容是西文字体的相关概念。首先一个字体会有一个 EM Square（也被称为 UPM、em、em size）[4]，这个值最初在排版中表示一个字体中大写 M 的宽度，以这个值构成一个正方形，那么所有字母都可以被容纳进去，此时这个值实际反映的就成了字体容器的高度。在金属活字中，这个容器就是每个字符的金属块，在一种字体里，它们的高度都是统一的，这样每个字模都可以放入印刷工具中并进行排印。在数码排印中，em 是一个被设置了大小的方格，计量单位是一种相对单位，会根据实际字体大小缩放，例如 1000 单位的字体设置了 16pt 的字号，那么这里 1000 单位的大小就是 16pt。Em 在 OpenType 字体中通常为 1000 ，在 TrueType 字体中通常为 1024 或 2048（2 的 n 次幂）。

![金属活字](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3699828507/4be4/1dc5/020e/182a467f00418859950ec66af5fb7bfa.png)

> 金属活字，图片来自 [http://designwithfontforge.com/en-US/The_EM_Square.html](http://designwithfontforge.com/en-US/The_EM_Square.html)

### 3.1 字体度量

字体本身还有很多概念和度量值（metrics），这里介绍几个常见的概念，以维基百科的这张图为例（下面的度量值的计量单位均为基于 em 的相对单位）：

![字体结构](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053467/c1e3/60d9/c36f/09fee043c5e22775372aaba48ed2efc0.png)

- baseline：Baseline（基线）是字母放置的水平线。
- x height：X height（x字高）表示基线上小写字母 x 的高度。
- capital height：Capital height（大写高度）表示基线上一个大写字母的高度。
- ascender / ascent：Ascender（升部）表示小写字母超出 x字高的字干，为了辨识性，ascender 的高度可能会比 capital height 大一点。Ascent 则表示文字顶部到 baseline 的距离。

![字符升部](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053462/ff82/0e2b/0961/14a46add593e52581b9dd844abfb6268.png)

- descender / descent：Descender（降部）表示扩展到基线以下的小写字母的字干，如 j、g 等字母的底部。Descent 表示文字底部到 baseline 的距离。
- line gap：Line gap 表示 descent 底部到下一行 ascent 顶部的距离。这个词我没有找到合适的中文翻译，需要注意的是这个值不是行距（leading），行距表示两行文字的基线间的距离。

接下来我们在 [FontForge](https://fontforge.org/en-US/) 软件里看看这些值的取值，这里以 `Arial` 字体给出一个例子：

![Arial Font Information](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053450/8f4b/9610/b345/870395efa10d2f4e042544bf47b6c43c.png)

从图中可以看出，在 General 菜单中，Arial 的 em size 是 2048，字体的 ascent 是1638，descent 是410，在 OS/2 菜单的 Metrics 信息中，可以得到 capital height 是 1467，x height 为 1062，line gap 为 67。

然而这里需要注意，尽管我们在 General 菜单中得到了 ascent 和 descent 的取值，但是这个值应该仅用于字体的设计，它们的和永远为 em size；而计算机在实际进行渲染的时候是按照 OS/2 菜单中对应的值来计算，一般操作系统会使用 hhea（Horizontal Header Table）表的 HHead Ascent 和 HHead Descent，而 Windows 是个特例，会使用 Win Ascent 和 Win Descent。通常来说，实际用于渲染的 ascent 和 descent 取值要比用于字体设计的大，这是因为多出来的区域通常会留给注音符号或用来控制行间距，如下图所示，字母顶部的水平线即为第一张图中 ascent 高度 1638，而注音符号均超过了这个区域。根据资料的说法[5]，在一些软件中，如果文字内容超过用于渲染的 ascent 和 descent，就会被截断，不过我在浏览器里实验后发现浏览器并没有做这个截断（Edge 86.0.608.0 Canary (64 bit), MacOS 10.15.6）。

![ascent](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053443/9c02/63c3/92fd/3a0baf8f50c8b01b0cfea373adf3f934.png)

在本文中，我们将后面提到的 ascent 和 descent 均认为是 OS/2 选项中读取到的用于渲染的 ascent 和 descent 值，同时我们将 ascent + descent 的值叫做 content-area。

> 理论上一个字体在 Windows 和 MacOS 上的渲染应该保持一致，即各自系统上的 ascent 和 descent 应该相同，然而有些字体在设计时不知道出于什么原因，导致其确实在两个系统中有不同的表现。以下是 Roboto 的例子：

[Differences between Win and HHead metrics cause the font to be rendered differently on Windows vs. iOS (or Mac I assume) · Issue #267 · googlefonts/roboto](https://github.com/googlefonts/roboto/issues/267)

那么回到本节一开始的问题，CSS 中的 `font-size` 设置的值表示什么，想必我们已经有了答案，那就是一个字体 em size 对应的大小；而文字在设置了 `line-height: normal` 时，行高的取值则为 content-area + line-gap，即文本实际撑起来的高度。

知道了这些，我们就不难算出一个字体的显示效果，上面 Arial 字体在 `line-height: normal` 和 `font-size: 100px` 时撑起的高度为 `(1854 + 434 + 67) / 2048 * 100px = 115px`。 

> 在实验中发现，对于一个行内元素，鼠标拉取的 selection 高度为当前行 `line-height` 最高的元素值。如果是块状元素，当 `line-height` 的值为大于 content-area 时，selection 高度为 `line-height`，当其小于等于 content-area 时，其高度为 content-area 的高度。

### 3.2 验证 metrics 对文字渲染的影响

在中间插一个问题，我们应该都使用过 `line-height` 来给文字进行垂直居中，那么 `line-height` 实际是以字体的哪个部分的中点进行计算呢？为了验证这个问题，我新建了一个很有“设计感”的字体，em size 设为 1000，ascent 为 800，descent 为 200，并对其分别设置了正常的和比较夸张的 metrics：

![TestGap normal](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053460/a396/2d98/271d/43a9abd5663e9805104b8177650a6c02.png)

![TestGap exaggerate](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053456/02a1/2125/2cc0/30e67343fd1729277785196683fafc1f.png)

上面图中左边是 FontForge 里设置的 metrics，右边是实际显示效果，文字字号设为 100px，四个字母均在父层的 flex 布局下垂直居中，四个字母的 `line-height` 分别为 0、1em、normal、3em，红色边框是元素的 `outline`，黄色背景是鼠标选取的背景。由上面两张图可以看出，字体的 metrics 对文字渲染位置的影响还是很大的。同时可以看出，在设置 `line-height` 时，虽然 line gap 参与了撑起取值为 `normal` 的空间，但是不参与文字垂直居中的计算，即垂直居中的中点始终是 content-area 的中点。

![TestGap trimming](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3835053457/7d42/11a0/33c6/5ca8e8be956369fedd90eff191c45b09.png)

我们又对字体进行了微调，使其 ascent 有一定偏移，这时可以看出 1em 行高的文字 outline 恰好在正中间，因此可以得出结论：在浏览器进行渲染时，em square 总是相对于 content-area 垂直居中。

说完了字体构造，又回到上一节的问题，为什么不同字体文字混排的时候进行垂直居中，文字各有高低呢？

在这个问题上，本文给出这样一个结论，那就是因为不同字体的各项度量值均不相同，在进行垂直居中布局时，content-area 的中点与视觉的中点不统一，因此导致实际看起来存在位置偏移，下面这张图是 Arial 字体的几个中线位置：

![Arial center line](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3699828579/e988/6e01/4ce2/98ed4d9cb09b7677d60c27f92f7e4f52.png)

从图上可以看出来，大写字母和小写字母的视觉中线与整个字符的中线还是存在一定的偏移的。这里我没有找到排版相关学科的定论，究竟以哪条线进行居中更符合人眼观感的居中，以我个人的观感来看，大写字母的中线可能看起来更加舒服一点（尤其是与没有小写字母的内容进行混排的时候）。

> 需要注意一点，这里选择的 Arial 这个字体本身的偏移比较少，所以使用时整体感觉还是比较居中的，这并不代表其他字体也都是这样。

### 3.3 中文字体

对于中文字体，本身的设计上没有基线、升部、降部等说法，每个字都在一个方形盒子中。但是在计算机上显示时，也在一定程度上沿用了西文字体的概念，通常来说，中文字体的方形盒子中文字体底端在 baseline 和 descender 之间，顶端超出一点 ascender，而标点符号正好在 baseline 上。

## 4. CSS 的解决方案

我们已经了解了字体的相关概念，那么如何解决在使用字体时出现的偏移问题呢？

通过上面的内容可以知道，文字显示的偏移主要是视觉上的中点和渲染时的中点不一致导致的，那么我们只要把这个不一致修正过来，就可以实现视觉上的居中了。

为了实现这个目标，我们可以借助 `vertical-align` 这个属性来完成。当 `vertical-align` 取值为数值的时候，该值就表示将子元素的基线与父元素基线的距离，其中正数朝上，负数朝下。

这里介绍的方案，是把某个字体下的文字通过计算设置 `vertical-align` 的数值偏移，使其大写字母的视觉中点与用于计算垂直居中的点重合，这样字体本身的属性就不再影响居中的计算。

具体我们将通过以下的计算方法来获取：首先我们需要已知当前字体的 em-size，ascent，descent，capital height 这几个值（如果不知道 em-size，也可以提供其他值与 em-size 的比值），以下依然以 Arial 为例：

```jsx
const emSize = 2048;
const ascent = 1854;
const descent = 434;
const capitalHeight = 1467;

// 计算前需要已知给定的字体大小
const fontSize = FONT_SIZE;

// 根据文字大小，求得文字的偏移
const verticalAlign = ((ascent - descent - capitalHeight) / emSize) * fontSize;

return (
	<span style={{ fontFamily: FONT_FAMILY, fontSize }}>
		<span style={{ verticalAlign }}>TEXT</span>
	</span>
)
```

由此设置以后，外层 span 将表现得像一个普通的可替换元素参与行内的布局，在一定程度上无视字体 metrics 的差异，可以使用各种方法对其进行垂直居中。

由于这种方案具有固定的计算步骤，因此可以根据具体的开发需求，将其封装为组件、使用 CSS 自定义属性或使用 CSS 预处理器对文本进行处理，通过传入字体信息，就能修正文字垂直偏移。

## 5. 解决方案的局限性

虽然上述的方案可以在一定程度上解决文字垂直居中的问题，但是在实际使用中还存在着不方便的地方，我们需要在使用字体之前就知道字体的各项 metrics，在自定义字体较少的情况下，开发者可以手动使用 FontForge 等工具查看，然而当字体较多时，挨个查看还是比较麻烦的。

目前的一种思路是我们可以使用 Canvas 获取字体的相关信息，如现在已经有开源的获取字体 metrics 的库 [FontMetrics.js](https://soulwire.github.io/FontMetrics/)。它的核心思想是使用 Canvas 渲染对应字体的文字，然后使用 `getImageData` 对渲染出来的内容进行分析。如果在实际项目中，这种方案可能导致潜在的性能问题；而且这种方式获取到的是渲染后的结果，部分字体作者在构建字体时并没有严格将设计的 metrics 和字符对应，这也会导致获取到的 metrics 不够准确。

另一种思路是直接解析字体文件，拿到字体的 metrics 信息，如 [opentype.js](https://github.com/opentypejs/opentype.js) 这个项目。不过这种做法也不够轻量，不适合在实际运行中使用，不过可以考虑在打包过程中自动执行这个过程。

此外，目前的解决方案更多是偏向理论的方法，当文字本身字号较小的情况下，浏览器可能并不能按照预期的效果渲染，文字会根据所处的 DOM 环境不同而具有 1px 的偏移[9]。

## 6. 未来也许可行的解决方案 - CSS Houdini

CSS Houdini 提出了一个 Font Metrics 草案[6]，可以针对文字渲染调整字体相关的 metrics。从目前的设计来看，可以调整 baseline 位置、字体的 em size，以及字体的边界大小（即 content-area）等配置，通过这些可以解决因字体的属性导致的排版问题。

```typescript
[Exposed=Window]
interface FontMetrics {
  readonly attribute double width;
  readonly attribute FrozenArray<double> advances;

  readonly attribute double boundingBoxLeft;
  readonly attribute double boundingBoxRight;

  readonly attribute double height;
  readonly attribute double emHeightAscent;
  readonly attribute double emHeightDescent;
  readonly attribute double boundingBoxAscent;
  readonly attribute double boundingBoxDescent;
  readonly attribute double fontBoundingBoxAscent;
  readonly attribute double fontBoundingBoxDescent;

  readonly attribute Baseline dominantBaseline;
  readonly attribute FrozenArray<Baseline> baselines;
  readonly attribute FrozenArray<Font> fonts;
};
```

![css houdini](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3699828580/ebda/3f71/9f5b/9ef614210f602a7d0692a47aa47116fd.png)

从 [https://ishoudinireadyyet.com/](https://ishoudinireadyyet.com/) 这个网站上可以看到，目前 Font Metrics 依然在提议阶段，还不能确定其 API 具体内容，或者以后是否会存在这一个特性，因此只能说是一个在未来也许可行的文字排版处理方案。

## 7.总结

文本垂直居中的问题一直是 CSS 中最常见的问题，但是却很难引起注意，我个人觉得是因为我们常用的微软雅黑、苹方等字体本身在设计上比较规范，在通常情况下都显得比较居中。但是当一个字体不是那么“规范”时，传统的各种方法似乎就有点无能为力了。

本文分析了导致了文字偏移的因素，并给出寻找文字垂直居中位置的方案。

由于涉及到 IFC 的问题本身就很复杂[7]，关于内联元素使用 `line-height` 与 `vertical-align` 进行居中的各种小技巧因为与本文不是强相关，所以在文章内也没有提及，如果对这些内容比较感兴趣，也可以通过下面的参考资料寻找一些相关介绍。

## 相关资料

 - [Deep dive CSS: font metrics, line-height and vertical-align - Vincent De Oliveira](https://iamvdo.me/en/blog/css-font-metrics-line-height-and-vertical-align)
 - [字母'x'在CSS世界中的角色和故事](https://www.zhangxinxu.com/wordpress/2015/06/about-letter-x-of-css/)
 - [CSS深入理解vertical-align和line-height的基友关系](https://www.zhangxinxu.com/wordpress/2015/08/css-deep-understand-vertical-align-and-line-height/)
 - [EM Square](http://designwithfontforge.com/zh-CN/The_EM_Square.html)
 - [Win Ascent / Win Descent](https://typedrawers.com/discussion/3189/win-ascent-win-descent)
 - [Font Metrics API Level 1](https://drafts.css-houdini.org/font-metrics-api-1/#intro)
 - [Inline formatting model](https://meyerweb.com/eric/css/inline-format.html)
 - [FontForge OS/2 Metrics](https://fontforge.org/docs/ui/dialogs/fontinfo.html#os-2-metrics)
 - [图标如何对齐文本](https://zhuanlan.zhihu.com/p/30624268)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
