---
title: Web 端 APNG 播放实现原理
date: 2020-08-06T01:38:10.120Z
description: 在云音乐的直播开发中会常遇到动画播放的需求，每个需求的应用场景不同，体积较小的动画大都采用 APNG 格式。
---


![](https://p1.music.126.net/QVxQdr9RnqkHU2S87_IcSg==/109951165102779950.jpg)

> 题图来源：https://commons.wikimedia.org

> 本文作者：杨彩芳

## 写在前面

在云音乐的直播开发中会常遇到动画播放的需求，每个需求的应用场景不同，体积较小的动画大都采用 APNG 格式。

如果动画仅单独展示可以使用 `<img>` 直接展示 APNG 动画，但是会存在兼容性 Bug，例如：部分浏览器不支持 APNG 播放，Android 部分机型重复播放失效。

如果需要将 APNG 动画 和 其他 DOM 元素 结合 CSS3 Animation 展示动画，APNG 就需要预加载和受控，预加载能够防止 APNG 解析花费时间，从而出现二者不同步的问题，受控能够有利于用户在 APNG 解析成功或播放结束等时间节点进行一些操作。

这些问题 [apng-canvas](https://github.com/davidmz/apng-canvas) 都可以帮我们解决。apng-canvas 采用 canvas 绘制 APNG 动画，可以兼容更多的浏览器，抹平不同浏览器的差异，且便于控制 APNG 播放。下面将具体介绍 APNG 、apng-canvas 库实现原理以及在 apng-canvas 基础上增加的 WebGL 渲染实现方式。

## APNG 简介

APNG（Animated Portable Network Graphics，Animated PNG）是基于 PNG 格式扩展的一种位图动画格式，增加了对动画图像的支持，同时加入了 24 位真彩色图像和 8 位 Alpha 透明度的支持，动画拥有更好的质量。APNG 对传统 PNG 保留向下兼容，当解码器不支持 APNG 播放时会展示默认图像。

除 APNG 外，常见的动画格式还有 GIF 和 WebP。从浏览器兼容性、尺寸大小和图片质量三方面比较，结果如下所示（其中尺寸大小以一张图为例，其他纯色或多彩图片尺寸大小比较可查看 [GIF vs APNG vs WebP](http://littlesvr.ca/apng/gif_apng_webp3.html) ，大部分情况下 APNG 体积更小）。综合比较 APNG 更优，这也是我们选用 APNG 的原因。


![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3515572012/bc69/f332/118e/d174b90ccb3b2598e83c3a71dcc39a09.png)

## APNG 结构

APNG 是基于 PNG 格式扩展的，我们首先了解下 PNG 的组成结构。

### PNG 结构组成

PNG 主要包括 `PNG Signature`、`IHDR`、`IDAT`、`IEND` 和 一些辅助块。其中，`PNG Signature` 是文件标示，用于校验文件格式是否为 PNG ；`IHDR` 是文件头数据块，包含图像基本信息，例如图像的宽高等信息；`IDAT` 是图像数据块，存储具体的图像数据，一个 PNG 文件可能有一个或多个 `IDAT` 块；`IEND` 是结束数据块，标示图像结束；辅助块位于 `IHDR` 之后 `IEND` 之前，PNG 规范未对其施加排序限制。

`PNG Signature` 块的大小为 8 字节，内容如下：

```js
0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
```

其他每个块的组成结构基本如下所示：

![](https://p1.music.126.net/NYS69k_xp0xllza7w0Wneg==/109951165101574867.png)

4 个字节标识数据的长度，4 个字节标识块类型，length 个字节为数据（如果数据的长度 length 为 0，则无该部分），最后4个字节是CRC校验。

### APNG 结构组成

APNG 在 PNG 的基础上增加了 `acTL`、`fcTL` 和 `fdAT` 3 种块，其组成结构如下图所示：

![](https://p1.music.126.net/zlEQJpbNxdyFe8uYkUJ1pA==/109951164795989374.png)

- `acTL`：动画控制块，包含了图片的帧数和循环次数（ 0 表示无限循环）
- `fcTL`：帧控制块，属于 PNG 规范中的辅助块，包含了当前帧的序列号、图像的宽高及水平垂直偏移量，帧播放时长和绘制方式（dispose_op 和 blend_op）等，每一帧只有一个 `fcTL` 块
- `fdAT`：帧数据块，包含了帧的序列号和图像数据，仅比 `IDAT` 多了帧的序列号，每一帧可以有一个或多个 `fcTL` 块。`fdAT` 的序列号与 `fcTL` 共享，用于检测 APNG 的序列错误，可选择性的纠正

`IDAT` 块是 APNG 向下兼容展示时的默认图片。如果 `IDAT` 之前有 `fcTL`， 那么 `IDAT` 的数据则当做第一帧图片（如上图结构），如果 `IDAT` 之前没有 `fcTL`，则第一帧图片是第一个 `fdAT`，如下图所示：

![](https://p1.music.126.net/aairiTjOEkEJydwoqYMFhQ==/109951165101226499.png)

APNG 动画播放主要是通过 `fcTL` 来控制渲染每一帧的图像，即通过 dispose_op 和 blend_op 控制绘制方式。

- dispose_op 指定了下一帧绘制之前对缓冲区的操作

  - 0：不清空画布，直接把新的图像数据渲染到画布指定的区域

  - 1：在渲染下一帧前将当前帧的区域内的画布清空为默认背景色

  - 2：在渲染下一帧前将画布的当前帧区域内恢复为上一帧绘制后的结果

- blend_op 指定了绘制当前帧之前对缓冲区的操作

  - 0：表示清除当前区域再绘制

  - 1：表示不清除直接绘制当前区域，图像叠加

## apng-canvas 实现原理

了解 APNG 的组成结构之后，我们就可以分析 apng-canvas 的实现原理啦，主要分为两部分：解码和绘制。

### APNG 解码

APNG 解码的流程如下图所示：

![](https://p1.music.126.net/dksxB13ab1PERudhu0_xYA==/109951165102246118.png)

首先将 APNG 以`arraybuffer` 的格式下载资源，通过`视图`操作二进制数据；然后依次校验文件格式是否为 PNG 及 APNG；接着依次拆分 APNG 每一块处理并存储；最后将拆分获得的 PNG 标示块、头块、其他辅助块、一帧的帧图像数据块和结束块重新组成 PNG 图片并通过加载图像资源。在这个过程中需要浏览器支持 `Typed Arrays` 和 `Blob URLs`。

APNG 的文件资源是通过 `XMLHttpRequest` 下载，实现简单，这里不做赘述。

#### 校验 PNG 格式

校验 PNG 格式就是校验 `PNG Signature` 块，将文件资源从第 1 个字节开始依次比对前 8 个字节的内容，关键实现如下：

```js
const bufferBytes = new Uint8Array(buffer); // buffer为下载的arraybuffer资源
const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
for (let i = 0; i < PNG_SIGNATURE_BYTES.length; i++) {
    if (PNG_SIGNATURE_BYTES[i] !== bufferBytes[i]) {
        reject('Not a PNG file (invalid file signature)');
        return;
    }
}
```

#### 校验 APNG 格式

校验 APNG 格式就是判断文件是否存在类型为 `acTL` 的块。因此需要依序读取文件中的每一块，获取块类型等数据。块的读取是根据上文所述的 PNG 块的基本组成结构进行处理，流程实现如下图所示：

![](https://p1.music.126.net/V9lnwZF8MPCdww4UftXkOA==/109951165102246117.png)

off 初始值为 8，即 `PNG Signature` 的字节大小，然后依序读取每一块。首先读取 4 个字节获取数据块长度 length，继续读取 4 个字节获取数据块类型，然后执行回调函数处理本块的数据，根据回调函数返回值 res、块类型和 off 值判断是否需要继续读取下一块（res 值表示是否要继续读取下一块数据，默认为 `undefined` 继续读取）。如果继续则 off 值累加 `4 + 4 + length + 4`，偏移到下一块的开始循环执行，否则直接结束。关键代码如下：

```js
const parseChunks = (bytes, callback) => {
    let off = 8;
    let res, length, type;
    do {
        length = readDWord(bytes, off);
        type = readString(bytes, off + 4, 4);
        res = callback(type, bytes, off, length);
        off += 12 + length;
    } while (res !== false && type !== 'IEND' && off < bytes.length);
};
```

调用 `parseChunks` 从头开始查找，一旦存在 `type === 'acTL'` 的块就返回 `false` 停止读取，关键实现如下：

```js
let isAnimated = false;
parseChunks(bufferBytes, (type) => {
    if (type === 'acTL') {
        isAnimated = true;
        return false;
    }
    return true;
});
if (!isAnimated) {
    reject('Not an animated PNG');
    return;
}
```

#### 按照类型处理每一块

APNG 结构中的核心类型块的详细结构如下图所示：

![](https://p1.music.126.net/Gml04RvhWYa1vKQLblDDNQ==/109951165102689072.png)

![](https://p1.music.126.net/nwYdVKUzFLNeIgGYshUDPQ==/109951165102688144.png)

调用 `parseChunks` 依次读取每一块，根据每种类型块中包含的数据及其对应的偏移和字节大小分别进行处理存储。其中在处理 `fcTL` 和 `fdAT` 块时跳过了帧序列号 (sequence_number)的读取，似乎没有考虑序列号出错的问题。关键实现如下：

```js
let preDataParts = [], // 存储 其他辅助块
    postDataParts = [], // 存储 IEND块
    headerDataBytes = null; // 存储 IHDR块

const anim = anim = new Animation();
let frame = null; // 存储 每一帧

parseChunks(bufferBytes, (type, bytes, off, length) => {
    let delayN,
        delayD;
    switch (type) {
        case 'IHDR':
            headerDataBytes = bytes.subarray(off + 8, off + 8 + length);
            anim.width = readDWord(bytes, off + 8);
            anim.height = readDWord(bytes, off + 12);
            break;
        case 'acTL':
            anim.numPlays = readDWord(bytes, off + 8 + 4); // 循环次数
            break;
        case 'fcTL':
            if (frame) anim.frames.push(frame); // 上一帧数据
            frame = {}; // 新的一帧
            frame.width = readDWord(bytes, off + 8 + 4);
            frame.height = readDWord(bytes, off + 8 + 8);
            frame.left = readDWord(bytes, off + 8 + 12);
            frame.top = readDWord(bytes, off + 8 + 16);
            delayN = readWord(bytes, off + 8 + 20);
            delayD = readWord(bytes, off + 8 + 22);
            if (delayD === 0) delayD = 100;
            frame.delay = 1000 * delayN / delayD;
            anim.playTime += frame.delay; // 累加播放总时长
            frame.disposeOp = readByte(bytes, off + 8 + 24);
            frame.blendOp = readByte(bytes, off + 8 + 25);
            frame.dataParts = [];
            break;
        case 'fdAT':
            if (frame) frame.dataParts.push(bytes.subarray(off + 8 + 4, off + 8 + length));
            break;
        case 'IDAT':
            if (frame) frame.dataParts.push(bytes.subarray(off + 8, off + 8 + length));
            break;
        case 'IEND':
            postDataParts.push(subBuffer(bytes, off, 12 + length));
            break;
        default:
            preDataParts.push(subBuffer(bytes, off, 12 + length));
    }
});
if (frame) anim.frames.push(frame); // 依次存储每一帧帧数据
```

#### 组装 PNG

拆分完数据块之后就可以组装 PNG 了，遍历 `anim.frames` 将 PNG 的通用数据块 PNG_SIGNATURE_BYTES、 headerDataBytes、preDataParts、一帧的帧数据 dataParts 和postDataParts 按序组成一份 PNG 图像资源（bb），通过 `createObjectURL` 创建图片的 URL 存储到frame中，用于后续绘制。

```js
const url = URL.createObjectURL(new Blob(bb, { type: 'image/png' }));
frame.img = document.createElement('img');
frame.img.src = url;
frame.img.onload = function () {
    URL.revokeObjectURL(this.src);
    createdImages++;
    if (createdImages === anim.frames.length) { //全部解码完成
        resolve(anim);
    }
};
```

到这里我们已经完成了解码工作，调用 `APNG.parseUrl` 就可以实现动画资源预加载功能：页面初始化之后首次调用加载资源，渲染时再次调用直接返回解析结果进行绘制操作。

```js
const url2promise = {};
APNG.parseURL = function (url) {
    if (!(url in url2promise)) {
        url2promise[url] = loadUrl(url).then(parseBuffer);
    }
    return url2promise[url];
};
```

### APNG 绘制

APNG 解码完成后就可以根据动画控制块和帧控制块绘制播放啦。具体是使用 requestAnimationFrame在 canvas 画布上依次绘制每一帧图片实现播放。apng-canvas 采用 Canvas 2D 渲染。

```js
const tick = function (now) {
    while (played && nextRenderTime <= now) renderFrame(now);
    if (played) requestAnimationFrame(tick);
};
```

Canvas 2D 绘制主要是使用 Canvas 2D 的 API `drawImage`、`clearRect`、`getImageData`、`putImageData` 实现。

```js
const renderFrame = function (now) {
    // fNum 记录循环播放时的总帧数
    const f = fNum++ % ani.frames.length;
    const frame = ani.frames[f];
    // 动画播放结束
    if (!(ani.numPlays === 0 || fNum / ani.frames.length <= ani.numPlays)) {
        played = false;
        finished = true;
        if (ani.onFinish) ani.onFinish(); // 这行是作者加的便于在动画播放结束后执行一些操作
        return;
    }

    if (f === 0) {
        // 绘制第一帧前将动画整体区域画布清空
        ctx.clearRect(0, 0, ani.width, ani.height);  
        prevF = null; // 上一帧
        if (frame.disposeOp === 2) frame.disposeOp = 1;
    }

    if (prevF && prevF.disposeOp === 1) { // 清空上一帧区域的底图
        ctx.clearRect(prevF.left, prevF.top, prevF.width, prevF.height);
    } else if (prevF && prevF.disposeOp === 2) { // 恢复为上一帧绘制之前的底图
        ctx.putImageData(prevF.iData, prevF.left, prevF.top);
    } // 0 则直接绘制

    const {
        left, top, width, height,
        img, disposeOp, blendOp
    } = frame;
    prevF = frame;
    prevF.iData = null;
    if (disposeOp === 2) { // 存储当前的绘制底图，用于下一帧绘制前恢复该数据
        prevF.iData = ctx.getImageData(left, top, width, height);
    }
    if (blendOp === 0) { // 清空当前帧区域的底图
        ctx.clearRect(left, top, width, height);
    }

    ctx.drawImage(img, left, top); // 绘制当前帧图片

    // 下一帧的绘制时间
    if (nextRenderTime === 0) nextRenderTime = now;
    nextRenderTime += frame.delay; // delay为帧间隔时间
};
```

## WebGL 绘制

渲染方式除 Canvas 2D 外还可以使用 WebGL。WebGL 渲染性能优于 Canvas 2D，但是 WebGL 没有可以直接绘制图像的 API，绘制实现代码较为复杂，本文就不展示绘制图像的具体代码，类似 `drawImage` API 的 WebGL 实现可参考 [WebGL-drawimage](https://WebGLfundamentals.org/WebGL/lessons/zh_cn/WebGL-2d-drawimage.html)，[二维矩阵](https://webglfundamentals.org/webgl/lessons/zh_cn/webgl-2d-matrices.html)等。下面将介绍作者选用的绘制实现方案的关键点。

由于 WebGL 没有 `getImageData`、`putImageData` 等 API 可以获取或复制当前画布的图像数据，所以在 WebGL 初始化时就初始化多个纹理，使用变量 glRenderInfo 记录历史渲染的纹理数据。

```js
// 纹理数量
const textureLens = ani.frames.filter(item => item.disposeOp === 0).length;

// 历史渲染的纹理数据
const glRenderInfo = {
    index: 0,
    frames: {},
};
```

渲染每一帧时根据 `glRenderInfo.frames` 使用多个纹理依次渲染，同时更新 `glRenderInfo` 数据。

```js
const renderFrame = function (now) {
    ...
    let prevClearInfo;
    if (f === 0) {
        glRenderInfo.index = 0;
        glRenderInfo.frames = {};
        prevF = null;
        prevClearInfo = null;
        if (frame.disposeOp === 2) frame.disposeOp = 1;
    }
    if (prevF && prevF.disposeOp === 1) { //  需要清空上一帧区域底图
        const prevPrevClear = glRenderInfo.infos[glRenderInfo.index].prevF;
        prevClearInfo = [
            ...(prevPrevClear || []),
            prevF,
        ];
    }
    if (prevF && prevF.disposeOp === 0) { // 递增纹理下标序号，否则直接替换上一帧图片
        glRenderInfo.index += 1;
    }
    // disposeOp === 2 直接替换上一帧图片
    glRenderInfo.frames[glRenderInfo.index] = { // 更新glRenderInfo
        frame,
        prevF: prevClearInfo, // 用于清除上一帧区域底图
    };
    prevF = frame;
    prevClearInfo = null;
    // 绘制图片，底图清除在 glDrawImage 接口内部实现
    Object.entries(glRenderInfo.frames).forEach(([key, val]) => {
        glDrawImage(gl, val.frame, key, val.prevF);
    });
    ...
}
```

## 小结

本文介绍了 APNG 的结构组成、图片解码、使用 Canvas 2D / WebGL 渲染实现。希望阅读本文后，能够对您有所帮助，欢迎探讨。

## 参考

- [Animated PNG graphics](https://developer.mozilla.org/zh-CN/docs/Mozilla/Tech/APNG)
- [apng-canvas](https://github.com/davidmz/apng-canvas) 
- [APNG 那些事](https://aotu.io/notes/2016/11/07/apng/index.html)
- [二进制数组](https://javascript.ruanyifeng.com/stdlib/arraybuffer.html)


> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
