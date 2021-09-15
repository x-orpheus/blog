---
title: 如何生成稳定的动态 treemap（矩形树图）关键技术揭晓
date: 2021-09-15T06:38:24.217Z
description: 前段时间，网易云音乐上线了一个基于熟人社交投票玩法的 h5 活动，本文主要介绍了该活动是如何基于矩形树图算法来实现一个无缝挤压动效以及在这其中遇到一些问题。
---

![friendface4.gif](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10409306266/a700/11d3/b0ac/6fbb15d1b415c58a721b3e35224d5d9b.jpeg?imageView=1&type=webp&thumbnail=600x600)

> 本文作者：好奇

## 前言

前段时间，网易云音乐上线了一个基于熟人社交投票玩法的 h5 活动，该活动依据投票数权重值来划分格子块，并通过格子块之间无缝挤压动效极大地增加了趣味性。本文将着重介绍如何基于 treemap（矩形树图）来实现一个稳定的动态格子块挤压效果以及在这其中遇到的一些问题。

![friendface4.gif](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381480244/ae6a/4f6c/cb49/b1bcf6f6fa50c174d2d65af0993d6e15.gif)

## 矩形树图探索

输入一组 18 个随机大小数值，如何在一张固定大小 canvas 画布上，让这组数据权重值映射在二维平面上并渲染出 18 个不同大小的格子？在视觉上能够产生明显可区分的边界，让人一眼就能读出，哪几个格子的组成是最大的，哪几个格子组成似乎是微不足道的？在前端工程化实践中，联想到 webpack 打包编译的场景，使用 webpack-bundle-analyzer 插件将生成一个包含所有打包文件的可视化矩形树图。尝试使用矩形树图也许是一个思路，如下图所示：
​

![webpack-analyzer](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381536824/c66b/c913/0633/294bbb01cbb636adabd25b7c3c2a6e0a.png?imageView=1&type=webp&thumbnail=600x600)
​

## 算法的稳定性

treemap（矩形树图）最早由美国计算机科学家 [Ben Shneiderman](http://www.cs.umd.edu/hcil/treemap-history/) 在 1992 年提出。为了应对常见的硬盘已满问题，Ben Shneiderman 创新性地提出生成目录树结构可视化的想法。这种展现形式甚至在后来的矩形艺术领域也有了一席之地。
​

![treeviz.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381762593/70e8/254e/84e0/9132405fe9699ef8a120f0021f057b1d.gif?imageView=1&type=webp&thumbnail=600x600)

### 常见的矩形树图

许多数据集本质上是分层的，一个好的层次可视化有利于快速地多尺度区分：对单个元素的微观层面观察和对整体数据集的宏观层面观察。矩形树图适用于展示具有层级关系的数据，能够直观地体现同级之间的比较。

![treemap-category](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10623379585/6c27/326f/fc70/7f40949c340d8ed7ff2e98cc4183789c.jpg?imageView=1&type=webp&thumbnail=800x800)

以 d3-hierarchy 实现为例：

#### treemapBinary

其思想是递归地将指定节点划分为近似平衡的二叉树，为宽矩形选择水平分区，为高矩形选择垂直分区的布局方式。

```javascript
  function partition(i, j, value, x0, y0, x1, y1) {
    while (k < hi) {
      var mid = k + hi >>> 1;
      if (sums[mid] < valueTarget) k = mid + 1;
      else hi = mid;
    }

    if ((valueTarget - sums[k - 1]) < (sums[k] - valueTarget) && i + 1 < k) --k;

    var valueLeft = sums[k] - valueOffset,
        valueRight = value - valueLeft;
		// 宽矩形
    if ((x1 - x0) > (y1 - y0)) {
      var xk = value ? (x0 * valueRight + x1 * valueLeft) / value : x1;
      partition(i, k, valueLeft, x0, y0, xk, y1);
      partition(k, j, valueRight, xk, y0, x1, y1);
    } else {
      // 高矩形
      var yk = value ? (y0 * valueRight + y1 * valueLeft) / value : y1;
      partition(i, k, valueLeft, x0, y0, x1, yk);
      partition(k, j, valueRight, x0, yk, x1, y1);
    }
  }
}
```

示例图：  
![binary.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403110344/08a0/eab0/5614/44507db2179f275888eb7bd612c9ecfa.png?imageView=1&type=webp&thumbnail=500x500)

#### treemapDice

根据每个指定节点的子节点 value 值，对输入 x0, y0, x1, y1 坐标计算出的矩形区域，按照水平方向进行分割。从给定矩形的左边缘(x0)坐标开始，分割的子元素按顺序排列。

```javascript
export default function (parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        node,
        i = -1,
        n = nodes.length,
        k = parent.value && (x1 - x0) / parent.value

    // 按顺序水平分割排列
    while (++i < n) {
        ;(node = nodes[i]), (node.y0 = y0), (node.y1 = y1)
        ;(node.x0 = x0), (node.x1 = x0 += node.value * k)
    }
}
```

示例图：

![dice.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403112189/8a80/0a96/d713/b39dd5ac7cbf8e10c22381b24ef69b87.png?imageView=1&type=webp&thumbnail=500x500)
​

#### treemapSlice

根据每个指定节点的子节点 value 值，对输入 x0, y0, x1, y1 坐标计算出的矩形区域，按照垂直方向进行分割。从给定矩形的上边缘(y0)坐标开始，分割的子元素按顺序排列。

```javascript
export default function (parent, x0, y0, x1, y1) {
    var nodes = parent.children,
        node,
        i = -1,
        n = nodes.length,
        k = parent.value && (x1 - x0) / parent.value

    // 按顺序垂直分割排列
    while (++i < n) {
        ;(node = nodes[i]), (node.y0 = y0), (node.y1 = y1)
        ;(node.x0 = x0), (node.x1 = x0 += node.value * k)
    }
}
```

示例图：

![slice.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403110686/9145/b759/6658/4c6ad5d0544f3cf83841473dca84e31f.png?imageView=1&type=webp&thumbnail=500x500)

#### treemapSliceDice

如果指定节点的深度值为奇数，则执行 treemapSlice 否则执行 treemapDice。

```javascript
export default function (parent, x0, y0, x1, y1) {
    // 节点深度判定
    ;(parent.depth & 1 ? slice : dice)(parent, x0, y0, x1, y1)
}
```

示例图：

![slicedice.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403111406/d042/43cc/6ff8/5f4e08f3d59e954c9c79b2ea88267398.png?imageView=1&type=webp&thumbnail=500x500)

#### treemapSquarify

这种正方化（squarified）树图布局会尽可能的使用指定的纵横比（ratio）来切分矩形，使生成的矩形尽量接近正方形，拥有更佳的平均长宽比。

```js
export function squarifyRatio(ratio, parent, x0, y0, x1, y1) {
    while (i0 < n) {
        // Find the next non-empty node.
        do sumValue = nodes[i1++].value
        minValue = maxValue = sumValue
        alpha = Math.max(dy / dx, dx / dy) / (value * ratio)
        beta = sumValue * sumValue * alpha
        minRatio = Math.max(maxValue / beta, beta / minValue)

        // Keep adding nodes while the aspect ratio maintains or improves.
        for (; i1 < n; ++i1) {
            sumValue += nodeValue = nodes[i1].value
            if (nodeValue < minValue) minValue = nodeValue
            if (nodeValue > maxValue) maxValue = nodeValue
            beta = sumValue * sumValue * alpha
            newRatio = Math.max(maxValue / beta, beta / minValue)
            if (newRatio > minRatio) {
                sumValue -= nodeValue
                break
            }
            minRatio = newRatio
        }
    }
}
```

![squarify.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10624373153/f017/7317/d0a2/874ffc9cd2c40a850213e846635a0b2d.png?imageView=1&type=webp&thumbnail=500x500)

#### treemapResquarify

treemapResquarify 首次布局采用 squarified 树图方式，保证具有较好的平均长宽比。后续即便是数据变化也只改变节点的大小，而不会改变节点的相对位置。这种布局方式在树图的动画表现上效果将会更好，因为避免了节点变动导致布局不稳定性，而这种不稳定可能会分散了人的注意力。

```javascript
function resquarify(parent, x0, y0, x1, y1) {
    if ((rows = parent._squarify) && rows.ratio === ratio) {
        var rows,
            row,
            nodes,
            i,
            j = -1,
            n,
            m = rows.length,
            value = parent.value
        // 后续布局，只改变节点的大小，而不会改变相对位置
        while (++j < m) {
            ;(row = rows[j]), (nodes = row.children)
            for (i = row.value = 0, n = nodes.length; i < n; ++i) row.value += nodes[i].value
            if (row.dice)
                treemapDice(row, x0, y0, x1, value ? (y0 += ((y1 - y0) * row.value) / value) : y1)
            else treemapSlice(row, x0, y0, value ? (x0 += ((x1 - x0) * row.value) / value) : x1, y1)
            value -= row.value
        }
    } else {
        // 首次布局采用 squarify 算法
        parent._squarify = rows = squarifyRatio(ratio, parent, x0, y0, x1, y1)
        rows.ratio = ratio
    }
}
```

示例图：

![resquarify.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403111362/b0e9/cb3d/424f/1bad4a13bd668b81768bba2d29ae1c9e.png?imageView=1&type=webp&thumbnail=500x500)

详细矩形树图效果可查看 [demo](https://hijiangtao.github.io/d3-treemap-with-react-demo)

#### 总结

平均长宽比是指生成的矩形长宽的比值，越佳的平均长宽比，矩形越接近正方形，用户观感的体验也越好。节点有序性是指输入数据权重值发生变化时，树图节点位置的变化程度。有序的节点，树图的稳定性也更加优秀。

| **​**             | **平均长宽比** | **节点有序性** | **稳定性** |
| ----------------- | -------------- | -------------- | ---------- |
| treemapBinary     | 良好           | 部分有序       | 一般       |
| treemapSlice      | 很差           | 有序           | 优秀       |
| treemapDice       | 很差           | 有序           | 优秀       |
| treemapResquarify | 良好           | 有序           | 优秀       |
| treemapSquarify   | 优秀           | 部分有序       | 一般       |

可以发现，treemapSquarify 拥有更优秀的平均长宽比。相对的，在首次布局时 treemapResquarify 也同样拥有不错的平均长宽比，在后续数据权重值发生变化时，由于节点的有序特性，treemapResquarify 也将有很好的稳定性。

## 让矩形树图更生动

#### 先来个 demo

基于 treemapSquarify 树图思路，开始一组 demo 测试。输入一组随机的带 value 值数据的入参：

```json
[
    { value: 10, color: 'red' },
    { value: 7,  color: 'black' },
    { value: 4,  color: 'blue' },
    ...
]
```

执行 treemapSquarify 计算，对生成的结果进行转化处理，可得到一组带位置坐标和宽高大小的数据列表，如下所示：

```json
[
    {
      x: 0,
      y: 0,
      width: 330.56,
      height: 352.94,
      data: { value: 10, color: 'red' },
    },
    {
      x: 0,
      y: 352.94,
      width: 330.56,
      height: 247.06,
      data: { value: 7, color: 'black' },
    },
    {
      x: 330.56,
      y: 0,
      width: 295.56,
      height: 157.89,
      data: { value: 4, color: 'blue' },
    }
    ...
]
```

可以看到，输入的数据是一组随机的数组，经过 treemapSquarify 计算后，得到一组包含 x、y 坐标，width、height 大小的数据。基于这组初始输入数据，我们给数据加一个偏移量。通过加一个时间 time 自增量，利用三角函数特性，把偏移量限定在初始数据的一定范围内，就能得到一组初始数据偏移后的结果数据。通过不断来回改变输入数据的偏移范围，便可以持续地生成多组初始数据偏移后的结果数据。如下所示：

```javascript
// requestAnimationFrame 循环动画
const builtGraphCanvas = () => {
  // 主逻辑
  treeMapAniLoop();
  requestAnimationFrame(builtGraphCanvas);
};
builtGraphCanvas();

// 主逻辑
treeMapAniLoop() {
  // 通过 time 自增，
  time += 0.02
  for (let i = 0; i < dataInput.length; i++) {
    // 利用三角函数限制范围，来回改变输入
    const increment = i % 2 == 0 ? Math.sin(time + i) : Math.cos(time + i)
    // 赋值偏移量，改变初始数据范围
    dataInput[i].value =
      vote[i] + 0.2 * vote[vote.length - 1] * increment * increment
  }

// treemapSquarify 算法生成结果
const result = getTreemap({
   data: dataInput,      // 带偏移量的数据输入
   width: canvasWidth,   // 画布宽
   height: canvasHeight, // 画布高
 })
}


```

根据获得的多组数据偏移返回的结果，在 canvas 画布上把 x、y 坐标和 width、height 大小绘制出来：

```javascript
treeMapAniLoop() {
  // 绘制 canvas 矩形
  drawStrokeRoundRect() {
    cxt.translate(x, y);
    cxt.beginPath(0);
    cxt.arc(width - radius, height - radius, radius, 0, Math.PI / 2);
    cxt.lineTo(radius, height);
    ...
    cxt.fill();
    cxt.stroke();
  }
}

```

在浏览器 requestAnimationFrame 重绘方法中，由于初始输入数据在时间自增下不断改变偏移量，从而不断地生成一系列的结果数据，渲染动画如下：

![friendface1.gif](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381894399/e9c4/d90f/1970/4616e9eae3dd2d8b9773c94795d8e5d8.gif)

#### 格子重排

如上文所述，输入一组数据值，采用 treemapSquarify 计算生成格子坐标和宽高，利用时间自增使动画持续地“挤压”起来，这看起来很完美。试着更换几组不同的输入数据源，验证在各类输入场景下的渲染效果，其中一组如下所示：

![friendface2.gif](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381892941/cddf/a53e/1545/d2a67d91cf6a2ba5514e76a64d072ff8.gif)

请仔细看，格子块在完美地“挤压”了短暂时间后，出现了跳动的现象。在实际的输入数据源测试中，发现格子出现跳动的概率比较高。这实际上是格子块发生了位置重排。如果我们把初始数据生成的格子块在画布按标号 1-18 排序，发现最初在位置 3 的格子块，经过自增偏移变化后，再次计算生成的该格子块位置已经变成了第 5。如果输入数据源差异较大时，这类位置的偏移将会更加严重。所以直接的表象就是，画布上的格子动画在不间断跳动，稳定性非常差，用户的观感体验也会不好。
​

#### 重排的原因

如上文所述，treemapSquarify 使得生成的矩形尽量接近正方形，拥有很好的平均长宽比。实际上，它并不会在一开始就同时考虑所有层级该如何划分，这能避免带来很大的计算量。  
其思想主要是：

-   将子节点按顺序从大到小进行排列；
-   当一个节点开始填充时，存在 2 种选择：直接添加到当前行，或者固定当前行，在剩余的矩形空间中开始一个新行；
-   最终选择哪种，取决于哪种选择将带来更佳平均长宽比，长宽比越低，越能改善当前布局

以数据集 [3，2，6，4，1，2，6] 为例，排序后的序列为 [6, 6, 4, 3, 2, 2, 1] 。  
步骤 ①，格子块长度 4，宽度 1.5，故长宽比 4/1.5 = 2.6..  
步骤 ②，格子块长度 3，宽度 2，故长宽比 3/2 = 1.5  
...以此类推，采用策略是选择平均长宽比值更低的选择

![progress.jpeg](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10623403881/c10f/1a29/3de7/ba91e0b4d47f128c3f3ab2b36ad017dd.png?imageView=1&type=webp&thumbnail=800x800)

因此，如果对输入数据进行一定的偏移时，treemapSquarify 的计算是贪心的，它只会采用当前最佳的长宽比选择，故当偏移量超过某个边界值时必然会出现输出的格子块位置不一致的情况，从而出现重排的现象。

#### 解决重排

其实，在上文总结矩形树图时就有提到，treemapResquarify 由于在首次布局时采用的是 treemapSquarify，因此也同样拥有很好平均长宽比。当数据权重值发生变化时，由于 treemapResquarify 独有的节点有序特性，将具备良好的稳定性。因此，我们采用 treemapResquarify 算法来对输入值生成结果，如下所示：

```javascript
this.treeMap = d3
    .treemap()
    .size([size.canvasWidth - size.arrowSize * 2, size.canvasHeight - size.arrowSize * 2])
    .padding(0)
    .round(true)
    // 期望最佳长宽比 ratio = 1
    .tile(d3.treemapResquarify.ratio(1))
```

根据输入值，得到 leavseResult 转换输出结果。此时，即便是对输入值做一定的偏移，输出结果的位置也是稳定的。

```javascript
// 生成 treemap 结果
generateTreeMap(voteTree: Array<number>) {
  this.root.sum(function(d) {
    if (d.hasOwnProperty('idx')) {
      return treeData[d.idx - 1];
    }
    return d.value;
  });

  this.treeMap(this.root);
  const leavesResult = this.root.leaves();

  // 转换输出结构
  this.result = leavesResult.map(i => ({
    x: i.x0 + arrowSize,
    y: i.y0 + arrowSize,
    width: i.x1 - i.x0,
    height: i.y1 - i.y0,
    value: i.value,
  }));
}
```

由于实际输入的偏移量并不会偏离初始数据很大，输出结果位置偏移的影响也相对不会很大。

在采用 treemapResquarify 来解决重排问题前，也尝试过一些其他的思路。比如，记录首次生成的计算结果，在执行输入数据自增偏移时，尝试去检查是否有格子“跳变”，如果检查到格子“跳变”的边界时，则尝试从当前格子的周边“借”一点格子空间，并阻止格子跳变，从而强制避免重排问题。但并不能很好解决这个问题，在某些输入数据反差较大时会出现明显动画卡顿。

#### 转场动画

除了上述已知票数的结果挤压动画，我们还做了很多转场动画。细分的话可以分为 6 个场景，为了保证动画的流畅性，这 6 个场景都做在一张 canvas 画布里。以开场动画为例，格子块按顺序逐渐鼓起来再逐渐缩小到白色格子块状态，如下图所示

#### ![open.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381893551/95e9/96ac/fdae/174b22d8f32152a69046fc649036d295.gif)

实现原理是，在一定的时间范围内，从状态 A 过渡到状态 B。则把这段时间作为 BezierEasing 方法的自增变量输出一个贝塞尔动画值，每一帧都根据这个动画值改变状态 A 的 x，y 坐标和 width，height 值，逐步趋向状态 B，核心代码如下所示：

```javascript
e2(t) {
  return BezierEasing(0.25, 0.1, 0.25, 1.0)(t);
}
// 开场动画
if (this.time0 > 1 + timeOffset * result.length) {
  this.time4 += 1.5 * aniSpeed;
  const easing = this.e2(this.time4);
  const resultA = this.cloneDeep(this.result);
  // 转换动画，A 状态转换到 0 票白色状态
  this.setTagByResult(resultA, this.initialZeroResult, easing);
}

//传入的两组 result 及补间参数 easing ，输出混合的 result。
setTagByResult(resultA, resultB, easing) {
  const result = this.result;
  for (let i = 0; i < result.length; i++) {
    result[i].x = resultA[i].x + easing * (resultB[i].x - resultA[i].x);
    result[i].y = resultA[i].y + easing * (resultB[i].y - resultA[i].y);

    result[i].width =
      resultA[i].width + easing * (resultB[i].width - resultA[i].width);
    result[i].height =
      resultA[i].height + easing * (resultB[i].height - resultA[i].height);
  }
}
```

如下图所示，是一个已知的挤压结果页转场到白色格子块的选择状态。实现的原理也是类似的，在一定的时间范围内，通过改变格子的坐标位置和大小，从挤压状态逐步过渡到白色格子块状态。还有更多动画状态的变化，比如从一个“未选择”的格子块状态变成“已选择”状态；格子块选满以后，从“选满”状态过渡到结果挤压状态等，这里就不再详述了。

![reselect.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381893572/9f75/0656/48cf/8b8344d145f4298441487e49d786b387.gif)

## 让排列错落有致

极端场景下的边界处理，永远是一个令人棘手的事情。
​

#### 极端场景显示问题

可以想象，最高票数和最低票数相差很大的情况，就会出现排版完全混乱的情况。
如下图所示，最高票数仅仅是 20 票，最低票数 0 票，就出现了小的票数格子块空间被挤压到快“呼吸”不过来的情况。

![luanqibazao.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403288890/49e5/882d/8700/e7d47308cf1f8cf8e776aa5cf78a0714.gif)

如果区分再明显一点，最高票数 140 票，最小票数 0 票，将变得更加混乱，如下图所示：

![luanqibazao2.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403288871/a5f1/e7d1/343c/37330febdcbdf5e74941a959f489d07c.gif)

因此，需要对输入数据源进行一个合理的转换，将超出最大倍数比的情况进行分情况处理，转化在一个合理的区间内。
最大倍数比分成 3 个阶段处理，分别是 10 倍，30 倍，30 倍以上区间。实际上，就是把一个不可预知的随机范围转换成一个可控的合理区间内。

```javascript
  // x=1-2区间，由双曲正切函数调整，输出增长率快到缓慢
  const reviseMethod = i => Math.tanh(i / 20) * 26;
  const computeVote = (vote: number, quota: number) => {
    // 基底100 + 倍数 * 每倍的份额
    return base + (vote / minVote - 1) * quota;
  };

  const stage1 = 10;
  const stage2 = 30;
  // 10倍区间
  const ceilStage1 = 600;
  // 30倍区间
  const ceilStage2 = 1000;
  // 30倍以上区间
  const ceilStage3 = 1300;

  let quota;
  // 最大最小倍数比
  const curMultiple = maxVote / minVote;
  const data = voteList.map(i => {
    let finalVote;

    // 不同阶段处理方案
    if (curMultiple <= stage1 + 1) {
      quota = (ceilStage1 - base) / stage1;
      const reviseValue = reviseMethod(i);
      finalVote = computeVote(reviseValue, quota);
    } else if (curMultiple <= stage2 + 1) {
      quota = (ceilStage2 - base) / stage2;
      finalVote = computeVote(i, quota);
    } else {
      // 需要隐藏部分票数，隐藏部分尖角等
      quota = ceilStage3 / curMultiple;
      finalVote = computeVote(i, quota);
    }

    return finalVote;
  });
  return data;
};
```

除了格子块的排版分区间处理，格子块内部的“表情”、“标签词”、“票数”也可能存在互相挤压、互相遮挡的情况。下图所示的是最早针对标签词罗列的处理方案，实际需要处理场景远比这个多的多。包括的边界条件有：标签词自动横排，自动竖排处理，字体大小自适应，多个字不同处理，两两之间格子间遮挡处理等。罗列可能出现的任何一种边界情况，处理它！

![39f13ae31dbdb9f961d4eefc803cf560.jpg](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10381947956/72f2/faac/7ae3/ced56bc84a90ded4ebafdc26731f514d.jpg?imageView=1&type=webp&thumbnail=800x800)

#### 排版太规整

如下图所示，动画看起来并没有什么问题。但是最高票数相比最低票数已经超过 10 倍，我们认为，动画的排版太“均匀规整”了，以至于可能让人无法一眼有所区别。为了追求更加明显可区分的排版，让格子块之间足够错乱有致，增加一些“凌乱之美”的气质。通过对初始输入数据源分组处理，能够比较好地优化这个问题。

![cuoluanyouzhi.gif](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403444557/3faf/82c4/b4b5/4c1b3171873d30a5ce7ec2e3f0564ed2.gif)

最初定义的 18 个输入数据源是并列在一个层级的。我们设想，有没有可能把数据分组，则当数据映射到二维平面时，格子之间也被划分成多个模块展示，是不是就会更加错乱有致。如下代码所示，我们把初始的票数值全部定为 1 票，定义多个 group 分组层级，实际的表现效果确实更加“凌乱”了。

```javascript
// 初始带组的数据
export const dataGroupTree = {
  name: 'allGroup',
  children: [
    {
      name: 'group1',
      children: [
        {
          idx: 1,
          value: 1,
        },
				...
      ],
    },
    {
      name: 'group2',
      children: [
       	...
      ],
    },
    {
      name: 'group3',
      children: [
        ...
      ],
    },
  ],
};
```

#### 带一点可爱尖角

一开始，我们设计的挤压格子块带有一点尖角，如下图所示，在格子块边缘设计有可爱的尖角。但是我们发现，在有些场景下尖角之间会存在互相遮挡甚至碰到格子表情的情况。由于需要针对性做边界处理，最后因为时间关系被拿掉了。

![arrow.gif](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403457285/dbba/0e83/cb3b/d15257dbfeae84b48e807eae2dd3afde.gif)

#### 其他问题
其实，除了上述罗列一些问题以外，还遇到诸多大大小小的问题。  
​
比如，对挤压动效截屏并转成图片分享出去是很重要的一个点。当我们在对 canvas 画布进行截屏分享时，截屏的动作是基于 html2canvas 库的能力，但截屏出来的图片经常偶现空白，尝试在 canvas 绘制图片时对图片链接添加 crossOrigin="anonymous" 属性发现解决了问题。后来又发现，在微信长按保存图片时，在部分安卓机型上依然存在偶现截图图片空白的问题，最后通过在 canvas 绘制图片时把输入图片链接转成 base64 地址最终解决了该问题。  
总之，想要完成一个可爱而”完美“地挤压效果，可能会遇到各种各样的问题，无他，处理它！

## 小结

最后，用海报一句话结尾：  
它值得琢磨，有点东西，少年感永不过期。

![result](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10403884896/f080/29c7/456c/94733f5fcd97466c1b9cd4d8c6494ab2.jpeg?imageView=1&type=webp&thumbnail=800x800)

有兴趣的同学可以在网易音乐 App 搜索“泡泡”，体验一下。
​

## 参考资料

-   ​[Treemaps for space-constrained visualization of hierarchies](http://www.cs.umd.edu/hcil/treemap-history/index.shtml)
-   [Squarified Treemaps](https://www.win.tue.nl/~vanwijk/stm.pdf)​
-   [d3-hierarchy](https://github.com/d3/d3-hierarchy)
-   [d3-treemap-demo](https://hijiangtao.github.io/d3-treemap-with-react-demo/)

> 本文发布自 [网易云音乐大前端团队](https://link.zhihu.com/?target=https%3A//github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！

