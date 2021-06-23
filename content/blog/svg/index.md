---
title: SVG基础及其动画应用浅析
date: 2021-06-23T09:10:26.812Z
description: 当你需要开发web动画时，这里可以给你提供一个清晰的思路
---

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9433312341/5fb3/fb4d/6103/ec8afcf714ea018743875fbcd487e434.png)

> 本文作者：钱鸿昌（闪火）
## 一、我们为什么使用svg  

1. 和高清png来做个对比

    ![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9432949540/799a/45ba/25f3/5ed1ac9efeb8aead6ef9c6fa81cf8ce2.png)
    ![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9432949460/690d/aee1/3cbd/7a70382c02c2703da45845304e67678c.png)

    继续对比
    
    ![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9432948534/f1fd/b882/ac94/a689b903df0748e56173edbe427842d9.png)
    ![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9432949505/bf5e/79d6/cbad/9b5fe0891253ecaa35a4d1236f899878.png)

    同样高清的质地，矢量图不畏惧放大，体积小。这里要说明一点就是，因为 SVG 中保存的是点、线、面的信息，与分辨率和图形大小无关，只是跟图像的复杂程度有关，所以图像文件所占的存储空间通常会比 png 小。
    
2. 优化 SEO 和无障碍的利器，因为 SVG 图像是使用XML(可扩展标记语言【英语：Extensible Markup Language，简称：XML】标记指计算机所能理解的信息符号，通过此种标记，计算机之间可以处理包含各种信息的文章等)来标记构建的，浏览器通过绘制每个点和线来打印它们，而不是用预定义的像素填充某些空间。这确保 SVG 图像可以适应不同的屏幕大小和分辨率。

3. 由于是在 XML 中定义的，SVG 图像比 JPG 或 PNG 图像更灵活，而且我们可以使用 CSS 和 JavaScript 与它们进行交互。SVG 图像设置可以包含 CSS 和 JavaScript。在 react、vue 这种数据驱动视图的框架下，对于 SVG 操作就更加如鱼得水了。（下文会跟大家分享一些小的 SVG 动画在我们项目中的实践）  

4. 在运用层面上，SVG 提供了一些图像编辑效果，比如屏蔽和剪裁、应用过滤器等等。并且SVG 只是文本，因此可以使用 GZip 对其进行有效压缩。

## 二、了解 SVG 常用元素及其使用
> 大多数教程网上都能找到，这里写一些我觉得值得提及的点
### 2-1. svg 标签

``` xml
<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg  width="300" height="300" viewBox="0, 0, 100, 200"  xmlns="http://www.w3.org/2000/svg" version="1.1">
    <circle cx="100" cy="50" r="49" stroke="black"
    stroke-width="2" fill="red" />
</svg>
```    

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d845ce28d19c4092be6a7dd53093ae7c~tplv-k3u1fbpfcp-zoom-1.image)

这就是我们从设计手里拿到的 SVG 源文件，我们掰开揉碎了说。首先我们把 SVG 内部代码全部去掉不看，于是成了这样  
    
```xml
<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="300" height="300" viewBox="0, 0, 100, 200"  xmlns="http://www.w3.org/2000/svg" version="1.1">
</svg>
```

这是99% SVG 都会表现出来的形式和及一些属性，其中包含 width、height 这两个视口属性，viewBox 视图属性，xmlns 属性。我们一行一行看   

> 第一行：包含了 XML 声明，XML 声明其实和 HTML 文档的 DTD 声明是类似的。类比 HTML5 的声明方式
```html
<!DOCTYPE html>
```
SVG 的文档声明方式（划重点：一般如果 SVG 运用在 HTML 里，我们可以不写这样的文档声明，但如果是单独的 SVG 文件，那就需要写了，否则浏览器可能会不认识）
```html
<?xml version="1.0" standalone="no"?>
```
我们看到的 **standalone** 属性是在表明该 xml 声明是否是独立的，如果不是即 standalone="no"，那后面会引入外部的 dtd ，如第二行第三行所示。 **version** 属性用于指明 SVG 文档遵循规范的版本。 它只允许在根元素`<svg>` 上使用。 它纯粹是一个说明，对渲染或处理没有任何影响。虽然它接受任何数字，但是只有1.0 和 1.1.这两个有效的选择。


> 第三行：这是 SVG 内容的开始

``` xml
<svg width="300" height="300" viewBox="0, 0, 100, 200"  xmlns="http://www.w3.org/2000/svg" version="1.1">
</svg>
```

+ xmlns 属性是 SVG 的 XML 声明空间，这一部分类似于 HTML 中的 xmlns="http://www.w3.org/1999/xhtml"
```html
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
```
+ width & height 属性，可以理解成画布的大小。没错是画布的大小。举个例子：
```html
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width=100 height="100">
    <circle cx="50" cy="50" r="49" stroke="black"
    stroke-width="1" fill="red" />
</svg>
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bbb1c4a55f7b47289e856067d52bf386~tplv-k3u1fbpfcp-zoom-1.image)

当前这个 SVG 的画布大小是 100 * 100 的画布，我们画上一个半径为 49 再加 1 个单位的描边的圆。刚好撑满没毛病。所见即所得。那我们试一下改变 width 和 height。发现
```html
<svg  
    style="background:#007fff"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="300"
    height="300">
    <circle cx="50" cy="50" r="49" stroke="black"
    stroke-width="1" fill="red" />
</svg>
```
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a158ed9af4834c838783fbe9379ca632~tplv-k3u1fbpfcp-zoom-1.image)

我们可以看到蓝色区域就是我们定的 width 和 height ,图形部分依然是那个圆没有变化。这样我们就理解了 width 和 height 的作用。

+ viewBox 属性，接下来配合 viewBox 这个属性我们再来修改下代码
```XML
<svg 
    style="background:#007fff"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    <!-- viewBox定义-->
    viewBox="0, 0, 100, 100"
    width="300"
    height="300" >
    <circle cx="50" cy="50" r="49" stroke="black"
    stroke-width="1" fill="red" />
</svg>
```
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f15f471e91e54af4ba86dda791c99d61~tplv-k3u1fbpfcp-zoom-1.image)

我们可以看到蓝色区域大小不变，而我们的圆却变得很大，大到撑满了整个画布。没错，你的想法是对的，所谓 viewBox 这个属性可以理解为我们微信聊天时的截图操作。viewBox 属性的四个参数，前两个表示截图起点，后面两个表示截图终点，均是以左上角定点为原点。最后把截图再拉伸放在 SVG 画布上，就成了我们上面看到的 SVG 了。下面我们再修改一次 viewBox 成 0, 0, 50, 50 帮助理解
```html
<svg 
    style="background:#007fff"
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    viewBox="0, 0, 50, 50" 
    width="300"
    height="300" >
    <circle cx="50" cy="50" r="49" stroke="black"
    stroke-width="1" fill="red" />
</svg>
```
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/23388bef23724fc89470a0d00c034326~tplv-k3u1fbpfcp-zoom-1.image)

所以整个逻辑大概是这样的

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7995bc331f1949b28df640ce6f53b325~tplv-k3u1fbpfcp-zoom-1.image)

### 2-2.path 标签
在 SVG 里，你可以把 path 看成是最基本的绘制元素，正因为它是最基本的，万变不离其宗，他能演化出各种复杂的绘制效果。所以 path 是最基本也是最复杂的绘制元素。

#### path 的基础属性和其代表的意义
我们知道一个 path 标签，最重要的属性是 d 属性，它是一组指令和参数的集合。在 d 属性的值里，我们能看到一堆非常复杂的指令字符串。

```html
<path d="
    M73.8616812,68.8664775
    L74.5015359,74.5939423
    L68.1746283,71.7969507
    C66.2299599,72.4159872 64.1377269,72.7711218 61.9444643,72.7711218
    C51.9719158,72.7711218 43.8883163,65.7823167 43.8883163,57.1611168
    C43.8883163,48.5399169 51.9719158,41.5511118 61.9444643,41.5511118
    C71.9164005,41.5511118 80,48.5399169 80,57.1611168
    C80,61.8286883 77.6181486,66.006419 73.8616812,68.8664775" id="Fill-1" fill="#FFFFFF"></path>
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5927cf68e3e84dc78310bff91fbb8614~tplv-k3u1fbpfcp-zoom-1.image)

其实完全不用觉得恶心，这里继续掰开揉碎了说
+ d 属性里的那些指令

指令 | 参数 | 含义
-------- | --- | ----
**M**|	**x y** | **将画笔移动到点(x,y)**
**L**|	**x y**|	**画笔从当前的点绘制线段到点(x,y)**
**H**|	**x**|	**画笔从当前的点绘制水平线段到点(x,y0)，y0 表示绘制前画笔所在 y 轴坐标，也就是 y 轴不变**
**V**|	**y**|	**画笔从当前的点绘制竖直线段到点(x0,y)，x0 表示绘制前画笔所在 x 轴坐标，也就是 x 轴不变**
**A**|	**rx ry x-axis-rotation large-arc-flag sweep-flag x y** | **画笔从当前的点绘制一段圆弧到点(x,y)**
C|	x1 y1, x2 y2, x y|	画笔从当前的点绘制一段三次贝塞尔曲线到点(x,y)
S|	x2 y2, x y|	特殊版本的三次贝塞尔曲线(省略第一个控制点)
Q|	x1 y1, x y|	绘制二次贝塞尔曲线到点(x,y)
T|	x y| 特殊版本的二次贝塞尔曲线(省略控制点)
**Z**|	**无参数**|	**绘制闭合图形，如果 d 属性不指定Z命令，则绘制线段，而不是封闭图形**

以上是 path 路径中的全部指令，其中加粗部分为常用基础指令，相对来说比较好理解。每个指令都有对应的小写指令。例如M 10,10 有对应的 m 10,10 。大写代表绝对位置，**所谓绝对位置即对 SVG 画布左上角原点的绝对**。小写代表相对位置，**所谓相对位置是以当前画笔所在位置进行定位**。

+ A(arc)画弧指令  
```html
A rx ry x-axis-rotation large-arc-flag sweep-flag x y

<svg width="100%" height="100%">
    <path d="M0 0 A 45 45, 0, 0, 0, 45 45 L 45 0 Z" fill="green"/>
</svg>
```   
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9c1f3c4317604d9da1e05e424a4ae705~tplv-k3u1fbpfcp-zoom-1.image)

画了张图，帮助理解

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8a6f3e14147f4245a3fe06e19d45e36e~tplv-k3u1fbpfcp-zoom-1.image)

按照图中的步骤，我们可以画出两个圆都满足，于是再看到其中A指令有三个0我们没有解释，回顾下 A 指令，并结合这张图我们可以更好的理解

**A rx ry x-axis-rotation large-arc-flag sweep-flag x y**

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/70e9722c409449648602c473294e333d~tplv-k3u1fbpfcp-zoom-1.image)


+ 贝塞尔曲线  
关于贝塞尔曲线，张老师这篇文章已经说得非常清楚了，说得非常易懂[深度理解 SVG 路径](https://www.zhangxinxu.com/wordpress/2014/06/deep-understand-svg-path-bezier-curves-command/)，推荐给希望更多了解 svg 路径的同学  

### 2-3.基本图形

基本图形这块相对比较好理解，我们直接一张表总结下，不做过多赘述

图形 |标签 | 模板 | 含义
------ |-------- | --- | ----
矩形|< rect >| ```<rect x="60" y="10" rx="10" ry="10" width="30" height="30"/>``` |	x:起点横坐标，y:起点纵坐标，rx:倒角x轴方向半径，ry:倒角x轴方向半径，width:宽度，height:高度
圆形|< circle >| ```<circle cx="100" cy="100" r="50" fill="#fff"></circle>``` |	cx:圆心横坐标，cy:圆心纵坐标，r:半径
椭圆|< ellipse >| ```<ellipse cx="75" cy="75" rx="20" ry="5"/>``` |	cx:椭圆心横坐标，cy:椭圆心纵坐标，rx:椭圆x轴方向半径，ry:椭圆y轴方向半径
直线|< line >| ```<line x1="10" x2="50" y1="110" y2="150"/>``` |	x1，y1:起点，x2，y2:终点
折线|< polyline >| ```<polyline points="60 110, 65 120, 70 115, 75 130, 80 125, 85 140, 90 135, 95 150, 100 145"/>``` |	每两个点以空格配对为一个坐标点，逗号隔开形成坐标集合。连成折线。
多边形|< polygon >| ```<polygon points="50 160, 55 180, 70 180, 60 190, 65 205, 50 195, 35 205, 40 190, 30 180, 45 180"/>``` |	类似折线，不同的是，最后一个点会自动闭合第一个点，形成闭环。

### 2-4.symbol标签
symbol 标签是我们直播团队 icon 管理平台实现的核心技术点，它的作用说白话点就是相当于是一个元件，放在我们的工具箱里，就像下面这样：
```html
<svg class="svg-sprite">[工具箱]
	<symbol id="icon-wave_add" viewBox="0 0 76 76"><path d="M38 0a4 4 0 014 4v30h30a4 4 0 110 8H41.999L42 72a4 4 0 11-8 0l-.001-30H4a4 4 0 110-8h30V4a4 4 0 014-4z" fill="currentColor" fill-rule="evenodd" opacity="none"></path></symbol>
	<symbol id="icon-time" viewBox="0 0 10 10"><path d="M5 0a5 5 0 110 10A5 5 0 015 0zm0 1.5a.5.5 0 00-.5.5v3.02l.008.088a.5.5 0 00.238.343L7.02 6.794l.082.039a.5.5 0 00.603-.215l.039-.082a.5.5 0 00-.216-.603L5.5 4.735V2l-.008-.09A.5.5 0 005 1.5z" fill="rgba(153,153,153,1)" fill-rule="evenodd" class=" "></path></symbol>
	<symbol id="icon-wave_delete" viewBox="0 0 40 40"><g fill="none" fill-rule="evenodd"><circle fill="#000" opacity="0.2" cx="20" cy="20" r="20"></circle><path stroke="#FFF" stroke-width="4" stroke-linecap="round" d="M13 13l14 14M27 13L13 27"></path></g></symbol>
</svg>
```

放一份就可以无限引用。当它在工具箱里时，我们是看不到它的（页面不会渲染它），只有我们使用了```<use>```标签对其进行实例引用时，我们才可以在页面上看到它：
```
<use xlink:href="#icon-time"></use>
```

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9432981068/798e/48b8/d0d1/8fd74d42f92dfc20f63e822414fdcfb3.png)

我们使用```<symbol>``` + ```<use>```的组合，来实现svg雪碧图，是不是觉得很easy。

有的同学会有疑问，symbol 标签和 g 标签，放在 defs 里仿佛都是在定义一个可复用的模块，那么两者之间有什么区别呢？在我的理解里，symbol 相对于g 标签最大的不同在于 symbol 可以给可复用代码块增加视图属性和视口属性。方便在服用的时候直接调整到合适的运用(打印)尺寸。  



## 三、svg 动画及其运用
### 3-1.svg 动画概要
> 其实关于 SVG 动画，要说的有很多，本文我们主要说一下 SVG 动画的一些基本属性和运用技巧    
> 1、SMIL 驱动  
> 2、JavaScript 驱动  
> 3、CSS 驱动  

| 技术 | 描述 |备注  
-------- | --- | ----
| SMIL | 很强大且纯粹的标签化动画 | 虽然 Chrome 45以后弃用了SMIL，但是依然支持，各大浏览器的支持度都挺好的  
| CSS | CSS 还只能实现简单的动画 |  offset-path 的兼容性很差。css 动画不适合做交互性很强的动画
| JavaScript| 复杂动画就要用到 JS 了，包括世面上的一些 SVG 动画库，也都是 JS 去实现的   

SVG 是基于 XML 的矢量图形描述语言，可以近似理解成 HTML，所以能和 JS 以及 CSS 进行交互。 特 
    别是 CSS，我们可以使用 CSS3 来对 SVG 做动画处理。但是要记住的是仅当 HTML 内联包含 SVG 文件
    时,我们才可以使用 CSS 对其做样式开发。**本文我们针对平时 CSS3 + HTML不容易实现，
    而利用 SVG 可以快速简便实现的几种场景做相应介绍**
 

### 3-2.SVG 动画实践  

> **1、直线的变化**  
> **2、path 路径实现图形的平滑变幻**  
> **3、描边动画**  
> **4、指定轨迹运动** 
  
 #### **3-2-1、直线的变化**
  下面这张图是一个 GIF 的 icon,体积大约是 156KB,压缩之后。
  
  ![living.gif](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7592a074655844968fca5dc021c9c543~tplv-k3u1fbpfcp-watermark.image)  

  如果我们用 SVG 去实现的话。应该怎么做呢。我们分为以下两种方式，亲测兼容性都 OK

  [CSS+SVG 实现的代码实践](https://codesandbox.io/s/vigilant-brown-uurpf?file=/src/App.js)  

  [基于 SMIL 实现的代码实践](https://codesandbox.io/s/divine-darkness-obnt4?file=/src/App.js)
  
  > **总结&说明**：     
  
  **知识点1：** 
  
  SVG 中有很多属性我们是可以用 CSS 去描述的。在基于 CSS 动画三剑客（animation, transform, transition）的基础上。我们对一些属性进行控制，就达到我们想要的动画效果。下面两点值得说明：  

  - **transform**：transform 有两种用法，一个是在 SVG 标签里写的 transform 属性、另一种是在 CSS 文件里写的 transform，他们有着本质的区别。
```CSS
<rect transform="rotate(45deg) ..."  ... />

rect {
    transform: rotate(45deg)
}
/** 行内的 transform 属性，他的执行基点是在我们 svg 元素的左上角也就是 svg 的坐标原点。**/
/** 而 CSS 的 transform 原点则在元素本身的中心点。**/
```
  - **CSS可描述属性**： 很多文章告诉我们 CSS 可以控制 SVG 去做动画，但是实际开发过程中我们会更想知道，到底哪些属性我们可以做css控制，这里给大家列出一些常用属性并且可以放心使用的属性
  
   | CSS 可控属性名 |可实现场景
   | --- | --- |
   | 理论上所有的显示属性，都可以使用 CSS 控制包括：比如 stroke-width、color、fill 等等[ SVG 的显示属性](https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute)|大部分的显示样式动态变化
   |x|我们知道矩形有 x、y 属性，其含义是起始点，控制 x，我们可以动态控制矩形的X轴位移
   |y|控制 y，我们可以动态控制矩形的 Y 轴向位移
   |cx|`<circle cx="100" cy="100" r="50" fill="#fff" />`这是一个圆形，控制 cx 可以控制圆形(或者椭圆)的 X 轴位移|
   |cy|控制 cy 可以控制圆形(或者椭圆)的 Y 轴位移
   |r|r 是圆的半径，控制 r 可以控制圆形的大小
   |rx|rx 是椭圆的 X 轴方向半径，控制 rx 可以控制椭圆的大小
   |ry|ry 是椭圆的 Y 轴方向半径，控制 ry 可以控制椭圆的大小
   |d|path 标签的 d 属性，控制 d 的路径信息，可以控制图形的变幻（***d 属性在 safari 上是不支持 css 描述的。我们下文会详细的说明***）|
   |PS:如果各位看官们在日常开发中，不清楚该属性是否可以通过 css 去控制，这边给大家提供一个查询链接|[不支持 CSS 控制的 SVG 相关属性](https://www.w3.org/TR/SVG/attindex.html)  
  

   **知识点2：** 
   
   可以利用 SMIL 对 SVG 做动画处理，举个例子，同样的动画效果，下面这段代码不用 CSS 也可以实现
  
   ```js
    export default function App() {
      return (
        <div className="App">
          <svg width="100%" height="100%" viewBox="0 0 100% 100%">
            {[1, 2, 3, 4, 5].map((it, index) => (
              <line
                key={index}
                stroke="#000"
                strokeWidth="2"
                x1={15 + index * 5}
                y1="8"
                x2={15 + index * 5}
                y2="22"
              >
                <animate
                  attributeName="y1"
                  values="8; 15; 8"
                  dur="1s"
                  begin={`${(5 % (index + 1)) * 0.2}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y2"
                  values="22; 15; 22"
                  dur="1s"
                  begin={`${(5 % (index + 1)) * 0.2}s`}
                  repeatCount="indefinite"
                />
              </line>
            ))}
          </svg>
        </div>
      );
    }
   ```
   - **那么[什么是 SVG 的 SMIL 呢](https://developer.mozilla.org/en-US/docs/Web/SVG/SVG_animation_with_SMIL)？** 
    这里不想再对其做大篇幅的赘述，因为网上有很多文章都已经说得比较详细了[SMIL 动画指栏](https://css-tricks.com/guide-svg-animations-smil/)、[SVG SMIL animation 动画详解](https://www.zhangxinxu.com/wordpress/2014/08/so-powerful-svg-smil-animation/)。 本文更想和大家交流的是在SMIL驱动和CSS驱动如何做选择的问题。  
   虽然说早在 Chrome 45,chrome 就已经官宣要弃用 SMIL，但是到目前位置，各大浏览器厂商对它的支持度是这样的
  
![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0deab924bd2c4c40a5ad1936cab9d5da~tplv-k3u1fbpfcp-watermark.image)
   Chrom 宣布弃用 SMIL 是因为要支持 CSS Animation 与 Web Animation 的发展，所以我们可以理解为当前是在一个过渡状态，确实有一些暂时CSS 还没法支持或者支持度很差的动画效果，SMIL 可以轻松完成。但是基于 web 动画技术发展的大趋势，还是建议我们 SVG 动画实现方案的选择优先级是CSS 驱动 -> JS 驱动（我们可以采用一些框架，文末会给大家推荐一些好用的框架） -> SMIL 驱动

 #### **3-2-2、path 路径的变化(图形平滑变化)**
 
 ![image.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9433024753/d34d/5b67/0fad/1304a99c38c2ee1cc64ac9483dfb50a6.gif)
 ![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/98058068fb034ef484ac39ce5b060264~tplv-k3u1fbpfcp-watermark.image)

  [CSS+SVG 实现的代码实践 Logo 变化](https://codesandbox.io/s/smil-logo-change-nr7ie)  

  [基于 SMIL 实现的代码实践 Logo 变化](https://codesandbox.io/s/css-logo-change-pyjcc)
  
  [CSS+SVG 实现的代码实践播放暂停](https://codesandbox.io/s/thirsty-frost-oeqzs?file=/src/index.less)  

  [基于 SMIL 实现的代码实践播放暂停](https://codesandbox.io/s/youthful-wilson-7jpxr?file=/src/App.js)
  
 > **总结&说明**：     
  
  **知识点1：**  
  
  通过对`<path/>` d 属性的控制，我们可以实现很多动画效果，对于 d 属性的控制目前有两种方式，一种是通过 CSS 控制，另一种是通过 SMIL 控制，但是目前由于 **safari 不支持**用 CSS 来描述`<path>`标签的 d 属性。所以在实现这种平滑的形状变形效果上不推荐使用 CSS。更加推荐使用SMIL或者第三方库去实现  

基于 CSS：

```css
    path {
      transition: ease all 0.3s; // 就像对dom一样的对待svg

      &.play { //这里是播放状态下的<path />路径
        d: path("M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z");
      }

      &.pause { //这里是播放状态下的<path />路径
        d: path(
          "M 12,26 16.33,26 16.33,10 12,10 z M 20.66,26 25,26 25,10 20.66,10 z"
        );
      }
    }
```
基于 SMIL(即通过`<animate>`实现对`<path>` d 属性的动态控制)：

```js
  const pathMap = {
    from: "M 12,26 16.33,26 16.33,10 12,10 z M 20.66,26 25,26 25,10 20.66,10 z",
    to: "M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z"
  };
  <svg class="icon" viewBox="0 0 120 120" width="400" height="400">
    <path
      d="M 12,26 16.33,26 16.33,10 12,10 z M 20.66,26 25,26 25,10 20.66,10 z"
      fill="#000000"
    >
      <animate
        attributeName="d"
        from={play ? pathMap.from : pathMap.to}
        to={play ? pathMap.to : pathMap.from}
        dur="0.3s"
        begin="indefinite" // 这里设置开始时间为无限以达到不自动播放的效果
        fill="freeze"
      />
    </path>
  </svg>
```

 以上两个 path 路径的切换，就可以带来这种平滑过渡的效果。  
 
 ![play.gif](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/98058068fb034ef484ac39ce5b060264~tplv-k3u1fbpfcp-watermark.image)  
  
  **知识点2：**
  
  我们看到的图形变幻，都需要遵循一个原则就是点数对齐原则，什么意思呢？我们可以看下面的demo，五角星到 10 边形(多边形画的不好，抱歉...😜)。，都是 10 个控制点到 10 个控制点的过度。所以效果平滑
 
  ![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ca69e00bb30d4a01b1d00c01fcb1efe3~tplv-k3u1fbpfcp-watermark.image)
  
  ![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8ac3459005aa46f59743c27f3d655a55~tplv-k3u1fbpfcp-watermark.image)  

   而下图的 10 个点到 3 个点就没有这种平滑的过渡效果了(当然现在很多的 SVG 动画框架已经解决了这个问题。***见文末的框架推荐*** )
   
   ![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1c78fe516bf64d67b47335e9d022c691~tplv-k3u1fbpfcp-watermark.image)


 #### **3-2-3、描边动画的应用**
   
   ![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fa169b4e8a7a411b9cd06869819149cf~tplv-k3u1fbpfcp-watermark.image)
   
   ![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/71f5463877704ad1b4dba7cf274b8104~tplv-k3u1fbpfcp-watermark.image)

  [CSS+SVG 实现的代码实践-星环](https://codesandbox.io/s/happy-star-znohq)  
  
  [CSS+SVG 实现的代码实践- LOGO 描边](https://codesandbox.io/s/css-logo-stroke-wd7xd)  

  [基于 SMIL 实现的代码实践-进度环](https://codesandbox.io/s/smil-circle-progress-7rms7)
  
  > **总结&说明**： 
  
  **知识点1：**  
  
  类似的描边动画我们可以拿来做很多效果，比如各种形状的进度条、比如文字的描边、比如霓虹灯流水灯光等等流动动画效果。而描边动画的核心点就在于 SVG 的两个显示属性分别是 stroke-dasharray、stroke-dashoffset，我们上文说了，几乎所有的显示属性都可以用 CSS 去控制，所以这种动画，建议使用 CSS 去开发。
  
| 属性 | 值举例 | 描述 | 支持范围 |
| --- | --- | -- | -- |
| stroke-dasharray | 1 3 4 4 | 它的值是一个序列，可以传入多个值，分别指定描边短线的长度和描边线间距，多个值依次循环，如果传入3个值，类似于 stroke-dasharray: 1,2,3。则会自动复制一份再生效 |`<circle>, <ellipse>, <line>, <mesh>, <path>, <polygon>, <polyline>, <rect> <altGlyph>, <altGlyphDef>, <altGlyphItem>, <glyph>, <glyphRef>, <textPath>, <text>, <tref>, <tspan>`
| stroke-dashoffset | 10 | 描边线段的起始位置距离图形绘制起点的偏移量。正负值可以决定顺时针还是逆时针走向| 跟stroke-dasharray一致  

设想一个场景，一个倒计时需要从 100 到 0，对应的视觉效果也就是从全描边到无描边。那么我们初始状态将 stroke-dasharray 的第一个值设为 2πr (周长)，第二个值设也设为 2πr (周长)。那么我们会得到一个整圆。

![image.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f7c5456840bb45c7a1f9ce33b9ee7847~tplv-k3u1fbpfcp-watermark.image) 

这时如果我们把圆展开就能看到这样的场景   

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/213e5db2813144218fd3d1853013b37e~tplv-k3u1fbpfcp-watermark.image)
所以要实现进度的动态变化其实有两种方案  
第一种是将stroke-dasharray的第一个值从2πr(周长)调整到0。原展开图中的黑色部分没有了（可以理解为变成了一个点如下图，看不见了），只剩下虚线部分是空白间隙了。    

第二种是将stroke-dashoffset的值从0调整到-2πr（或者增加到2πr）。对比第一张图成下图的样子   
![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d2e1d58400e4656aeaf406abc3c86dd~tplv-k3u1fbpfcp-watermark.image)

**知识点2：**  

在实际开发中，我们会遇到一些比较复杂的图形需要做描边，这个时候我们没办法去得到它的周长是多少，这时候分两种场景处理。一种是在CSS里我们可以将stroke-dasharray的第二个值设置成一个非常大的数字，然后再去调整第一个值比如：
```css
    path {
        stroke-dasharray: 0(调整到合适的值) 99999999999999
    }
```
如果在js里我们需要动态去获取周长的话，SVG提供了原生的api可以去获取path的周长。
```js
    const inPath = document.getElementById("inner-path");
    console.log(inPath.getTotalLength());
```
ps：有些资料说该方法只能用于`<path />`，但是笔者亲测了在safair和chrome上，基本可以支持所有的基础图形以及`<path />`，但是`<text />`不支持，浏览器会报not a function。  

既然说到了`getTotalLength()`,那么顺带说下`getPointAtLength()`。getPointAtLength，顾名思义就是根据距离获取点坐标。意思就是根据到起始点的距离，获取该指定距离对应的点的坐标。坐标系原点为该图形的起始点。在一些指向型的动画上我们可能会运用到这个api。


  #### **3-2-4、轨迹运动动画的应用** 

![fly.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9451572923/613f/5c28/10c7/e11b04956ee46a3607636a7501de9b17.gif)


[基于SMIL实现的代码实践-轨迹运动](https://codesandbox.io/s/elastic-wiles-u8k9p)

> **总结&说明**：
```html
{/* 我们将整个飞机图形元件用g标签包起 */}
<g transform="translate(-100, -35) scale(0.1)">
  <path
    d="M164.485419 578.709313L196.274694 794.731891c0.722484 5.53904 8.188147 7.224835 11.078081 2.408278l75.860772-121.377234 740.063969-363.409219L164.485419 578.709313z"
    fill="#F68206"
  ></path>
  <path
    d="M2.167451 440.233302l159.668861 132.214487 857.828787-260.334901zM289.475071 679.375353l191.217309 153.407337 542.344309-518.743179z"
    fill="#FF9900"
  ></path>
  <path
    d="M204.222013 800.030103l125.23048-80.677328-48.888053-39.014111-76.342427 118.4873"
    fill="#D3650B"
  ></path>
  {/* 然后在这里，我们利用animateMotion，去做这个轨迹运动 */}
  <animateMotion
    path="M 0 450 Q 150 50 250 50 Q 350 0 400 50 Q 500 50 450 200 C 300 350 250 200 500 50 C 600 50 750 200 650 250 A 50 50 0 1 1 800 50 "
    begin="0s"
    rotate="auto"
    dur="20s"
    repeatCount="indefinite"
  />
</g>
```

这里我们用到了SMIL里的`<animateMotion />`，animateMotion里的path属性，我们也可以像这样去使用
```html
    <defs>
        <path id="theMotionPath" d="xxx" />
    </defs>
    <animateMotion>
        <mpath xlink:href="#theMotionPath"/>
    </animateMotion>
```
实际生产中，我们这种轨迹运动的需求，是建议使用SMIL去实现的，当然CSS也是有实现方案的[《使用CSS offset-path让元素沿着不规则路径运动》](http://www.zhangxinxu.com/wordpress/2017/03/offset-path-css-animation/)。但是CSS的兼容实在不敢恭维，劝退一波。


## 四、写在最后
**1**、 建议将CSS动画用于无变形的过渡或简单动画。尤其是在硬件加速时。CSS不需要加载其他资源（一般指三方库），并且悬停时的小变换可以为交互带来更好的效果。特别是当你不需要3d、物理体感、或进行大量堆叠动画效果时建议选用CSS。另外，CSS方便调试也是很大的一个优势。  

**2**、对于较长的动画，开发时会变得非常复杂且需要花精力去调试，而CSS调整时间尺度很困难，尤其是当你需要操纵一些细微帧时，个人觉得SMIL更合适做有序的，复杂的堆叠动画群的场景。 

**3**、对于变形的动画，建议使用SMIL或者第三方库。推荐的比较优秀的三方库有以下几个。  


| 库名 | 描述|   
   | --- | --- |     
  | [GSAP](https://greensock.com/gsap/)  | 全称是GreenSock Animation Platform，以前流行用 flash 的时候，GSAP就叱咤江湖的存在，GSAP有两个版本一个是 flash 版本，一个是 javascript 版本，也就是我们说的 GSAP js。GSAP 速度快。GSAP专门优化了动画性能，使之实现和css一样的高性能动画效果；轻量与模块化；|  
  | [Snap.svg](http://snapsvg.io/)、[SVG.js](https://svgjs.dev/docs/3.0/)、[Velocity.js](http://www.velocityjs.org/)  | 这三个库一直会被开发者拿来对比，基本上会用jQuery，就会使用这三个库，也就是说入手友好，Snap.svg 更偏向于支持现代浏览器，所以它的体量也会小一些。对比 Snap.svg 来看 SVG.js ，SVG.js 的写法更加的清晰，使用时会有更好的体验，且自称提供接近完整的 SVG 规范覆盖。Snap.svg 风格就更像一个侠客，写起来会很潇洒但是不好读，Velocity 也很强大，简单易用、高性能、功能丰富
  | [anime.js](https://www.animejs.cn/) | anime.js 虽然功能没有 GASP 强大，但是体积很乐观，gzip压缩完只有9kb左右，满足日常需求开发还是足够的
  | [D3](https://d3js.org/)  | Data-Driven Documents 顾名思义，更加适合用于创建数据可视化图形场景去使用

**4**、如何使用 SMIL 进行硬件加速，使用 <animateTransform>代替<animate>，并设置 x、y、z 值（z 为 0）。原理与 CSS 类似，这会将元素移到它自己的层，从而在其发生运动时不会重新绘制。


## 参考资料

- [SVG 动画指栏（SMIL）](https://css-tricks.com/guide-svg-animations-smil/)
- [SVG 教程](https://developer.mozilla.org/zh-CN/docs/Web/SVG/Tutorial)
- [CSS 支持的 SVG 属性查寻](https://www.w3.org/TR/SVG/attindex.html)
- 以及文章内提及的一些文章

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
