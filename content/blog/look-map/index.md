---
title: LOOK直播活动地图生成器方案
date: 2021-12-14T03:46:24.217Z
description: 在最近的活动开发中，笔者完成了一款大富翁的游戏。其技术细节暂且忽略，在这里主要想探讨下地图绘制的问题。在整个地图中，有很多的组成路径的方格以及作为房产的方格，如果一个个手动去调整位置，工作量是很大的。因此需要一个方案能够帮助我们快速确定方格在地图中的位置。下面便是笔者所采用的方法。
---

![大富翁](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11314782411/aa23/8c55/030f/b193b7a40121f440cbc0c882a2ccc51a.png)

> 本文作者：李一笑

对于前端而言，与视觉稿打交道是必不可少的，因为我们需要对照着视觉稿来确定元素的位置、大小等信息。如果是比较简单的页面，手动调整每个元素所带来的工作量尚且可以接受；然而当视觉稿中素材数量较大时，手动调整每个元素便不再是个可以接受的策略了。

在最近的活动开发中，笔者就刚好碰到了这个问题。这次活动开发需要完成一款大富翁游戏，而作为一款大富翁游戏，地图自然是必不可少的。在整个地图中，有很多的不同种类的方格，如果一个个手动去调整位置，工作量是很大的。那么有没有一种方案能够帮助我们快速确定方格的位置和种类呢？下面便是笔者所采用的方法。

# 方案简述

## 位点图

首先，我们需要视觉同学提供一张特殊的图片，称之为位点图。

这张图片要满足以下几个要求：

1. 在每个方格左上角的位置，放置一个 1px 的像素点，不同类型的方格用不同颜色表示。
2. 底色为纯色：便于区分背景和方格。
3. 大小和地图背景图大小一致：便于从图中读出的坐标可以直接使用。

![bitmap](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11314785756/3999/eaa5/0eeb/98e463a2330058e0a2c9053d98b55352.png)

上图为一个示例，在每个路径方格左上角的位置都有一个 1px 的像素点。为了看起来明显一点，这里用红色的圆点来表示。在实际情况中，不同的点由于方格种类不同，颜色也是不同的。

![bitmap2](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327600419/9124/3f24/8311/43f1a0ac8935fc02161f6b10e8f5670b.png)

上图中用黑色边框标出了素材图的轮廓。可以看到，红色圆点和每个路径方格是一一对应的关系。

## 读取位点图

在上面的位点图中，所有方格的位置和种类信息都被标注了出来。我们接下来要做的，便是将这些信息读取出来，并生成一份 json 文件来供我们后续使用。

```jsx
const JImp = require('jimp');
const nodepath = require('path');

function parseImg(filename) {
    JImp.read(filename, (err, image) => {
        const { width, height } = image.bitmap;

        const result = [];

        // 图片左上角像素点的颜色, 也就是背景图的颜色
        const mask = image.getPixelColor(0, 0);

        // 筛选出非 mask 位置点
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                const color = image.getPixelColor(x, y);
                if (mask !== color) {
                    result.push({
                        // x y 坐标
                        x,
                        y,
                        // 方格种类
                        type: color.toString(16).slice(0, -2),
                    });
                }
            }
        }

        // 输出
        console.log(JSON.stringify({
            // 路径
            path: result,
        }));
    });
}

parseImg('bitmap.png');
```

在这里我们使用了 `jimp` 用于图像处理，通过它我们能够去扫描这张图片中每个像素点的颜色和位置。

至此我们得到了包含所有方格位置和种类信息的 json 文件：

```json
{
    "path": [
        {
            "type": "",
            "x": 0,
            "y": 0,
        },
        // ...
    ],
}
```

其中，x y 为方格左上角的坐标；type 为方格种类，值为颜色值，代表不同种类的地图方格。

## 通路连通算法

对于我们的项目而言，只确定路径点是不够的，还需要将这些点连接成一个完整的通路。为此，我们需要找到一条由这些点构成的最短连接路径。

代码如下：

```jsx
function takePath(point, points) {
    const candidate = (() => {
        // 按照距离从小到大排序
        const pp = [...points].filter((i) => i !== point);
        const [one, two] = pp.sort((a, b) => measureLen(point, a) - measureLen(point, b));

        if (!one) {
            return [];
        }

        // 如果两个距离 比较小，则穷举两个路线，选择最短连通图路径。
        if (two && measureLen(one, two) < 20000) {
            return [one, two];
        }
        return [one];
    })();

    let min = Infinity;
    let minPath = [];
    for (let i = 0; i < candidate.length; ++i) {
        // 递归找出最小路径
        const subpath = takePath(candidate[i], removeItem(points, candidate[i]));

        const path = [].concat(point, subpath);
        // 测量路径总长度
        const distance = measurePathDistance(path);

        if (distance < min) {
            min = distance;
            minPath = subpath;
        }
    }

    return [].concat(point, minPath);
}
```

到这里，我们已经完成了所有的准备工作，可以开始绘制地图了。在绘制地图时，我们只需要先读取 json 文件，再根据 json 文件内的坐标信息和种类信息来放置对应素材即可。

# 方案优化

上述方案能够解决我们的问题，但仍有一些不太方便的地方：

1. 只有 1px 的像素点太小了，肉眼无法辨别。不管是视觉同学还是开发同学，如果点错了位置就很难排查。
2. 位点图中包含的信息还是太少了，颜色仅仅对应种类，我们希望能够包含更多的信息，比如点之间的排列顺序、方格的大小等。

## 像素点合并

对于第一个问题，我们可以让视觉同学在画图的时候，将 1px 的像素点扩大成一个肉眼足够辨识的区域。**需要注意两个区域之间不要有重叠。**

![bitmap3](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327612311/76f0/bcba/1acf/0abfc03451a7aac37d687b28a584a881.jpg)

这时候就要求我们对代码做一些调整。在之前的代码中，当我们扫描到某个颜色与背景色不同的点时，会直接记录其坐标和颜色信息；现在当我们扫描到某个颜色与背景色不同的点时，还需要进行一次区域合并，将所有相邻且相同颜色的点都纳入进来。

区域合并的思路借鉴了下图像处理的区域生长算法。区域生长算法的思路是以一个像素点为起点，将该点周围符合条件的点纳入进来，之后再以新纳入的点为起点，向新起点相邻的点扩张，直到所有符合条件条件的点都被纳入进来。这样就完成了一次区域合并。不断重复该过程，直到整个图像中所有的点都被扫描完毕。

我们的思路和区域生长算法非常类似：

1. 依次扫描图像中的像素点，当扫描到颜色与背景色不同的点时，记录下该点的坐标和颜色。
    
    ![步骤1.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327616110/5c78/8d22/7490/b6e53e04dbff485113cce09efe067eb1.png)
    
2. 之后扫描与该点相邻的 8 个点，将这些点打上”已扫描“的标记。筛选出其中颜色与背景色不同且尚未被扫描过的点，放入待扫描的队列中。
    
    ![步骤2.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327615330/5bd7/c9e7/a7e0/cce4aa97d07c881639cc1b1ea10c067f.png)
    
3. 从待扫描队列中取出下一个需要扫描的点，重复步骤 1 和步骤 2。
4. 直到待扫描的队列为空时，我们就扫描完了一整个有颜色的区域。区域合并完毕。
    
    ![步骤3.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327616119/a661/cb39/5b41/2137e14930e567914edb554d5db93af0.png)
    

```jsx
const JImp = require('jimp');

let image = null;
let maskColor = null;

// 判断两个颜色是否为相同颜色 -> 为了处理图像颜色有误差的情况, 不采用相等来判断
const isDifferentColor = (color1, color2) => Math.abs(color1 - color2) > 0xf000ff;

// 判断是(x,y)是否超出边界
const isWithinImage = ({ x, y }) => x >= 0 && x < image.width && y >= 0 && y < image.height;

// 选择数量最多的颜色
const selectMostColor = (dotColors) => { /* ... */ };

// 选取左上角的坐标
const selectTopLeftDot = (reginDots) => { /* ... */ };

// 区域合并
const reginMerge = ({ x, y }) => {
    const color = image.getPixelColor(x, y);
    // 扫描过的点
    const reginDots = [{ x, y, color }];
    // 所有扫描过的点的颜色 -> 扫描完成后, 选择最多的色值作为这一区域的颜色
    const dotColors = {};
    dotColors[color] = 1;

    for (let i = 0; i < reginDots.length; i++) {
        const { x, y, color } = reginDots[i];

        // 朝临近的八个个方向生长
        const seeds = (() => {
            const candinates = [/* 左、右、上、下、左上、左下、右上、右下 */];

            return candinates
                // 去除超出边界的点
                .filter(isWithinImage)
                // 获取每个点的颜色
                .map(({ x, y }) => ({ x, y, color: image.getPixelColor(x, y) }))
                // 去除和背景色颜色相近的点
                .filter((item) => isDifferentColor(item.color, maskColor));
        })();

        for (const seed of seeds) {
            const { x: seedX, y: seedY, color: seedColor } = seed;

            // 将这些点添加到 reginDots, 作为下次扫描的边界
            reginDots.push(seed);

            // 将该点设置为背景色, 避免重复扫描
            image.setPixelColor(maskColor, seedX, seedY);

            // 该点颜色为没有扫描到的新颜色, 将颜色增加到 dotColors 中
            if (dotColors[seedColor]) {
                dotColors[seedColor] += 1;
            } else {
                // 颜色为旧颜色, 增加颜色的 count 值
                dotColors[seedColor] = 1;
            }
        }
    }

    // 扫描完成后, 选择数量最多的色值作为区域的颜色
    const targetColor = selectMostColor(dotColors);

    // 选择最左上角的坐标作为当前区域的坐标
    const topLeftDot = selectTopLeftDot(reginDots);

    return {
        ...topLeftDot,
        color: targetColor,
    };
};

const parseBitmap = (filename) => {
    JImp.read(filename, (err, img) => {
        const result = [];
        const { width, height } = image.bitmap;
        // 背景颜色
        maskColor = image.getPixelColor(0, 0);
        image = img;

        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                const color = image.getPixelColor(x, y);

                // 颜色不相近
                if (isDifferentColor(color, maskColor)) {
                    // 开启种子生长程序, 依次扫描所有临近的色块
                    result.push(reginMerge({ x, y }));
                }
            }
        }
    });
};
```

## 颜色包含额外信息

在之前的方案中，我们都是使用颜色值来表示种类，但实际上颜色值所能包含的信息还有很多。

一个颜色值可以用 rgba 来表示，因此我们可以让 r、g、b、a 分别代表不同的信息，如 r 代表种类、g 代表宽度、b 代表高度、a 代表顺序。虽然 rgba 每个的数量都有限（r、g、b 的范围为 0-255，a 的范围为 0-99），但基本足够我们使用了。

![rgba.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327624948/83ec/0ede/6c09/fef26a061fdf34f48287b74f8c5e658b.png)

当然，你甚至可以再进一步，让每个数字都表示一种信息，不过这样每种信息的范围就比较小，只有 0-9。

# 总结

对于素材量较少的场景，前端可以直接从视觉稿中确认素材信息；当素材量很多时，直接从视觉稿中确认素材信息的工作量就变得非常大，因此我们使用了位点图来辅助我们获取素材信息。

![无标题-2021-09-28-1450.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11953061566/fef9/e3f0/7ec7/a35430850a7548e8ced1ae7a83fba0bb.png)

地图就是这样一种典型的场景，在上面的例子中，我们已经通过从位点图中读出的信息成功绘制了地图。我们的步骤如下：

1. 视觉同学提供位点图，作为承载信息的载体，它需要满足以下三个要求：
    1. 大小和地图背景图大小一致：便于我们从图中读出的坐标可以直接使用。
    2. 底色为纯色：便于区分背景和方格。
    3. 在每个方格左上角的位置，放置一个方格，不同颜色的方格表示不同类型。
2. 通过 `jimp` 扫描图片上每个像素点的颜色，从而生成一份包含各个方格位置和种类的 json。
3. 绘制地图时，先读取 json 文件，再根据 json 文件内的坐标信息和种类信息来放置素材。

![gif.gif](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11327629851/2606/cbd9/b90a/2dddd96f14fd810f1aea197ad0318386.gif)

上述方案并非完美无缺的，在这里我们主要对于位点图进行了改进，改进方案分为两方面：

1. 由于 1px 的像素点对肉眼来说过小，视觉同学画图以及我们调试的时候，都十分不方便。因此我们将像素点扩大为一个区域，在扫描时，对相邻的相同颜色的像素点进行合并。
2. 让颜色的 rgba 分别对应一种信息，扩充位点图中的颜色值能够给我们提供的信息。

我们在这里只着重讲解了获取地图信息的部分，至于如何绘制地图则不在本篇的叙述范围之内。在我的项目中使用了 pixi.js 作为引擎来渲染，完整项目可以参考[这里](https://codesandbox.io/s/empty-cherry-lqdzn?file=/scripts/bitmap.js)，在此不做赘述。

# FAQ

- 在位点图上，直接使用颜色块的大小作为路径方格的宽高可以不？
    
    当然可以。但这种情况是有局限性的，当我们的素材很多且彼此重叠的时候，如果依然用方块大小作为宽高，那么在位点图上的方块就会彼此重叠，影响我们读取位置信息。
    
- 如何处理有损图的情况？
    
    有损图中，图形边缘处的颜色和中心的颜色会略微有所差异。因此需要增加一个判断函数，只有扫描到的点的颜色与背景色的差值大于某个数字后，才认为是不同颜色的点，并开始区域合并。同时要注意在位点图中方块的颜色尽量选取与背景色色值相差较大的颜色。
    
    这个判断函数，就是我们上面代码中的 isDifferentColor 函数。
    
    ```jsx
    const isDifferentColor = (color1, color2) => Math.abs(color1 - color2) > 0xf000ff;
    ```
    
- 判断两个颜色不相等的 `0xf000ff` 是怎么来的？
    
    随便定的。这个和图片里包含颜色有关系，如果你的背景色和图片上点的颜色非常相近的话，这个值就需要小一点；如果背景色和图上点的颜色相差比较大，这个值就可以大一点。
    

# 参考资料

- [https://zhuanlan.zhihu.com/p/89488964](https://zhuanlan.zhihu.com/p/89488964)
- [https://codeantenna.com/a/B5fEty3uiP](https://codeantenna.com/a/B5fEty3uiP)
