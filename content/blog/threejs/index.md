---
title: Three.js 动效方案
date: "2020-03-17T01:25:17.745Z"
description: "Three.js（下面简称 Three） 作为一个 3D 库，不仅减少了我们学习 OpenGL 和 WebGL 的成本，还大大提升了前端在可视化上给用户带来更多的真实、沉浸式的体验。众所周知，Three 更多的是用 3D 模型 + 投影相机 + 用户交互的方式来构建一个「3D 世界」。"
---


![](https://p1.music.126.net/coS6Hb4AZdJfDJn6zZ6LYQ==/109951164807149208.jpg)

> 本文作者 陈舒仪  

> 图片来源 Pixabay，作者 Arek Socha 

## 背景

Three.js（下面简称 Three） 作为一个 3D 库，不仅减少了我们学习 OpenGL 和 WebGL 的成本，还大大提升了前端在可视化上给用户带来更多的真实、沉浸式的体验。众所周知，Three 更多的是用 3D 模型 + 投影相机 + 用户交互的方式来构建一个「3D 世界」。  

[这张专辑，用眼睛去“听”](https://music.163.com/st/stoneplan-album?nm_style=sbt) 活动中，在视觉在只能提供「2D 切图」的情况下，需要营造「3D 效果」。为了获得最好视觉体验，仅仅通过贴图很难做到，所以借此机会探索了 Three 的动效方案。

运动往往是相对的，运动的本质可能是「物体动」或「相机动」，本文将从**对象动画**和**相机动画**上阐述对 Three 的动效探索。

## Three 基础

### Camera 相机

Three 提供多种相机，其中应用最广的就是投影相机 (PerspectiveCamera) ，通过投影相机可以模拟人眼所看见的效果。  

```js
const camera = THREE.PerspectiveCamera(fov, aspect, near, far);
```

|  参数  | 含义  |默认值|
|  --------  | -  |-|
| fov  | fov 是视景体竖直方向上（非水平！）的张角，人类有接近180度的视角大小。该值可根据具体场景所需要的视角设置。 |45|
| aspect &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | 指定渲染结果的横向尺寸和纵向尺寸的比值。该值通常设置为窗口大小的宽高比。 |window.innerWidth / window.innerHeight
| near  | 表示可以看到多近的物体。这个值通常很小。|0.1
| far  | 表示可以看到多远的物体。这个看情况设置，过大会导致渲染过多；太小可能又会看不到。|  1000  

**ps:**  在 Three 中是没有「长度单位」这个概念的，它的数值都是根据比例计算得出，因此这里提到的 0.1 或 1000 都没有具体的含义，而是一种相对长度。

![相机](https://p1.music.126.net/5U3xg6C6V8ElZZQARnNTtw==/109951164576005872.png)

可以看到，通过配置透视相机的相关参数，最终被渲染到屏幕上的，是在 `near` 到 `far` 之间，根据 `fov` 的值和物体远近 `d` 确定渲染高度，再通过 `aspect` 值来确定渲染宽度的。  

### Scene 场景

有了相机，我们还要有场景，场景是为了让我们设置我们的空间内「有什么」和「放在哪」的。我们可以在场景中放置物体，光源还有相机。

```js
const scene = new THREE.Scene();
```
是的，创建场景就是这么简单。

#### Group

为了以群的维度去区分场景中的物体，我们还可以在场景中添加 Group。有了 Group，可以更方便地操作一类物体。  
比如创建一个 `stoneGroup`，并添加到场景中：

```js
const stoneGroup = new THREE.Group();
stoneGroup.name = 'stoneGroup';

scene.add(stoneGroup);
```

为 Group 命名，允许我们通过 name 来获取到对应的 Group：

```js
const group = scene.getObjectByName(name);
```

### Geometry 几何体

Three 提供了多种类型的几何体，可以分为二维网格和三维网格。二维网格顾名思义只有两个维度，可以通过这种几何体创建简单的二维平面；三维网格允许你定义三维物体；在 Three 中定义一个几何体十分简单，只需要选择需要的几何体并传入相应参数创建即可。  

[查看Three提供的几何体](https://threejs.org/docs/index.html#api/en/geometries/BoxBufferGeometry)  

如果看到 Three 提供的几何体，可以看到有的几何体中它分别提供 `Geometery` 和 `BufferGeometery` 版本，关于这两个的区别，可以看这里  [回答](https://stackoverflow.com/questions/54673268/difference-between-buffer-geometry-and-geometry/54673459)  

大致意思就是使用 Buffer 版本的几何体相较于普通的几何体会将描述物体的数据存放在缓冲区中，减少内存消耗和 CPU 循环。通过它们提供的方法来看，使用 geometry 无疑是对新手友好的。

创建几何体：

```js
// 创建立方体，传入长、宽和高
var cubeGeometry = new THREE.CubeGeometry(40, 40, 40);
// 创建球体，传入半径、宽片段数量和高片段数量
var sphereGeometry = new THREE.SphereGeometry(20, 100, 100);
```

### Material 材质

定义材质可以帮助我们决定一个物体在各种环境情况下的具体表现。同样 Three 也提供了多种材质。下面列举几个常用的材质。

|  名称  | 描述  |
|  --------  | -  |
| MeshBasicMaterial  | 基础材质，用它定义几何体上的简单颜色或线框 |
| MeshPhongMaterial  | 受光照影响，用来创建光亮的物体
| MeshLambertMaterial  | 受光照影响，用来创建不光亮的物体
| MeshDepthMaterial | 根据相机远近来决定如何给网格染色


创建材质：

```js
var basicMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
var lambertMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
var phongMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
var wireMaterial = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x666666 });
```

![material](https://p1.music.126.net/-zoGlUdd3PkSu7HHCJ1x4w==/109951164583628186.png?imageView&thumbnail=300x0)   

更多材质和相关信息，可以查看 [材质](https://threejs.org/docs/#api/en/materials/LineBasicMaterial)  


### Mesh网格对象

需要添加到场景中，还需要依赖 Mesh。Mesh 是用来定义材质和几何体之间是如何粘合的，创建网格对象可以应用一个或多个材质和几何体。


创建几何体相同材质不同的网格对象：

```js
var cube = new THREE.Mesh(cubeGeometry, basicMaterial);
var cubePhong = new THREE.Mesh(cubeGeometry, phongMaterial);
scene.add(cube, cubePhong);
```


创建材质相同几何体不同的网格对象：

```js
var cube = new THREE.Mesh(cubeGeometry, basicMaterial);
var sphere = new THREE.Mesh(sphereGeometry, basicMaterial);
scene.add(cube, sphere);
```

创建拥有多个材质几何体的网格对象：

```js
var phongMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
var cubeMeshPhong = new THREE.Mesh(cubeGeometry, cubePhongMaterial);
var cubeMeshWire = new THREE.Mesh(cubeGeometry, wireMaterial);
// 网格对象新增材质
cubeMeshPhong.add(cubeMeshWire);
scene.add(cubeMeshPhong);
```

### Renderer 渲染器

有了场景和相机，我们还需要渲染器把对应的场景用对应的相机可见渲染出来，因此渲染器需要传入场景和相机参数。

```js
// 抗锯齿、canvas 是否支持 alpha 透明度、preserveDrawingBuffer 是否保存 BUFFER 直到手动清除
const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, preserveDrawingBuffer: true
});
renderer.setSize(this.width, this.height);
renderer.autoClear = true;
// 清除颜色，第二个参数为 0 表示完全透明，适用于需要透出背景的场景
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(window.devicePixelRatio);
```

为了在相机更新后所看见的场景，需要在循环渲染中加上

```js
renderer.render(scene, camera);
```

有了相机场景和渲染器，我们已经可以看到初步的效果了。但3D世界里，静止的物体多无趣啊。于是我们尝试加入动画效果。

## 物体动画

### Animations

Three为动画提供了一系列方法。

|  参数  | 含义  |
|  --------  | -  |
|`AnimationMixer`| 作为特定对象的动画混合器，可以管理该对象的所有动画|
| `AnimationAction`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| 为播放器指定对应的片段存储一系列行为，用来指定动画快慢，循环类型等|
| `AnimationClip` | 表示**可重用的**动画行为片段，用来指定一个动画的动画效果（放大缩小、上下移动等）|
| `KeyframeTrack`| 与时间相关的帧序列，传入时间和值，应用在指定对象的属性上。目前有 `BooleanKeyframeTrack` `VectorKeyframeTrack` 等。

那么如何创建一个动画呢？下面这个例子给大家解释如何让网格对象进行简单的上下移动。

创建特定对象的动画混合器：

```js
// 创建纹理
const texture = new THREE.TextureLoader().load(img.src);
// 使用纹理创建贴图
const material = new THREE.SpriteMaterial({ map: texture, color: 0x666666 });
// 使用贴图创建贴图对象
const stone = new THREE.Sprite(material);
// 为贴图对象创建动画混合器
const mixer = new THREE.AnimationMixer(stone);
```

创建动画行为片段：

```js
const getClip = (pos = [0, 0, 0]) => {
    const [x, y, z] = pos;
    const times = [0, 1]; // 关键帧时间数组，离散的时间点序列
    const values = [x, y, z, x, y + 3, z]; // 与时间点对应的值组成的数组
    // 创建位置关键帧对象：0时刻对应位置0, 0, 0   10时刻对应位置150, 0, 0
    const posTrack = new THREE.VectorKeyframeTrack('stone.position', times, values);
    const duration = 1;
    return new THREE.AnimationClip('stonePosClip', duration, [posTrack]);
};
```


创建动画播放器，确定动画的表现：

```js
const action = mixer.clipAction(getClip([x, y, z]));
action.timeScale = 1; // 动画播放一个周期的时间
action.loop = THREE.LoopPingPong; // 动画循环类型
action.play(); // 播放
```

在循环绘制中更新混合器，保证动画的执行：

```js
animate() {
    // 更新动画
    const delta = this.clock.getDelta();
    mixer.update(delta);
    
    requestAnimationFrame(() => {
        animate();
    });
}
```

![image](https://p1.music.126.net/tMMqjXOZIzTzURMFXGwn9Q==/109951164583403656.gif)

[codepen](https://codepen.io/chenshuyi/pen/jOEwEBW)

### 贴图动画

有了 Animation 我们可以很简单地对物体的一些属性进行操作。但一些贴图相关的动画就很难用 Animation 来实现了，比如：  

![箭头动图](https://p1.music.126.net/yyCRvxB_SXXvtebk1yUAmw==/109951164577471457.gif)

上图这种，无法通过改变物体的位置、大小等属性实现。于是，还有一种方案 —— 贴图动画。  

类似在 CSS3 中对序列图片使用 `transform` 属性改变位置来达到的动画效果，实际上在 Three 中也可以使用贴图位移的方式实现。  

首先，我们要有一个序列图：

![箭头序列图](https://p1.music.126.net/NBwpm3-g3isuPkL98Eqqug==/109951164532405066.png)

作为纹理加载，并且增加到场景中：

```js
const arrowTexture = new THREE.TextureLoader().load(Arrow);
const material = new THREE.SpriteMaterial({ map: arrowTexture, color: 0xffffff });
const arrow = new THREE.Sprite(material);
scene.add(arrow);
```

声明 `TextAnimator` 对象，实现纹理的位移：

```js
function TextureAnimator(texture, tilesHoriz, tilesVert, numTiles, tileDispDuration) {
    // 纹理对象通过引用传入，之后可以直接使用update方法更新纹理位置
    this.tilesHorizontal = tilesHoriz;
    this.tilesVertical = tilesVert;
    // 序列图中的帧数
    this.numberOfTiles = numTiles;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / this.tilesHorizontal, 1 / this.tilesVertical);

    // 每一帧停留时长
    this.tileDisplayDuration = tileDispDuration;

    // 当前帧停留时长
    this.currentDisplayTime = 0;

    // 当前帧
    this.currentTile = 0;

    // 更新函数，通过这个函数对纹理位移进行更新
    this.update = (milliSec) => {
        this.currentDisplayTime += milliSec;
        while (this.currentDisplayTime > this.tileDisplayDuration) {
            this.currentDisplayTime -= this.tileDisplayDuration;
            this.currentTile++;
            if (this.currentTile === this.numberOfTiles) { this.currentTile = 0; }
            const currentColumn = this.currentTile % this.tilesHorizontal;
            texture.offset.x = currentColumn / this.tilesHorizontal;
            const currentRow = Math.floor(this.currentTile / this.tilesHorizontal);
            texture.offset.y = currentRow / this.tilesVertical;
        }
    };
}
```
```js
// 传入一个一行里有 13 帧的序列图，每张序列图停留 75ms
const arrowAni = new TextureAnimator(arrowTexture, 13, 1, 13, 75);
```

在循环绘制中更新，保证动画的执行：

```js
arrowAni.update(delta);
```

作为引用传入后，对贴图的修改会直接体现在使用该贴图的材质上。

[codepen](https://codepen.io/chenshuyi/pen/YzPQPYd)

### 粒子动画

Three 中还提供了酷炫的粒子动画，使用继承自 Object3D 的 `Points` 类实现。有了 Points 类我们可以很方便地把一个几何体渲染成一组粒子，并对它们进行控制。  

#### 创建粒子

创建粒子我们首先需要创建粒子的材质，可以使用 `PointsMaterial` 创建粒子材质。

```js
const texture = new THREE.TextureLoader().load('https://p1.music.126.net/jgzbZtWZhDet2jWzED8BTw==/109951164579600342.png');

material = new THREE.PointsMaterial({
  color: 0xffffff,
  // 映射到材质上的贴图
  map: texture,
  size: 2,
  // 粒子的大小是否和其与摄像机的距离有关，默认值 true
  sizeAttenuation: true,
});

// 开启透明度测试，透明度低于0.5的片段会被丢弃，解决贴图边缘感问题
material.alphaTest = 0.5;
```

有了粒子材质后，我们可以应用同一个材质批量创建一组粒子，只需要传入一个简单的几何体。

```js
var particles = new THREE.Points( geometry, material );
```

如果你传入的是 `BoxGeometry` 你可能会得到这样的一组粒子

![cube粒子](https://p1.music.126.net/WGQkrfq7Re7TLiKd2DJdRw==/109951164583388292.png?imageView&thumbnail=300x0)

还可以根据传入的 `Shape` 得到这样一组粒子

![fish粒子](https://p1.music.126.net/Mcvd_DDjQa1y9TqtpNW6UA==/109951164583395525.png?imageView&thumbnail=300x0)

#### 粒子运动

但有趣的粒子绝不是静止的，而是有活动、有过程的。但如果自己动手实现一个粒子的运动又很复杂，因此希望借助一些**第三方库**实现粒子动画的缓动过程。

##### tween.js

tween.js 是一个小型的 JS 库，我们可以使用它为我们的动画声明变化。使用 tween.js 我们不需要关心运动的中间状态，只需要关注粒子的：

- 起始位置
- 最终位置
- 缓动效果

```js
// srcPosition, targetPosition;
tweens.push(new TWEEN.Tween(srcPosition).easing(TWEEN.Easing.Exponential.In));
// tweens最终位置、缓动时间
tweens[0].to(targetPosition, 5000);
tweens[0].start();、
```

![](https://p1.music.126.net/5GKLCqQUfUpUOgzIUX3MCg==/109951164583412634.gif)


[codepen](https://codepen.io/chenshuyi/pen/bGNRmPY)

其实粒子动画的场景还有很多，我们可以用他们创造雪花飘散、穿梭效果，本质都是粒子的位置变化。


## 相机动画

相机在 3D 空间中充当人的眼睛，因此自然的相机动线可以保证交互的自然流畅。

### Controls

Three 提供了一系列相机控件来控制场景中的相机轨迹，这些控件适用于大部分场景。使用 Controls 开发者可以不再需要去关心用户交互和相机移动的问题。  

活动中也涉及到 `OrbitControls` 的使用，他提供了环绕物体旋转、平移和缩放的方法，但由于对使用二维贴图的情况下，旋转和缩放都容易穿帮，需要被禁止。

```js
// 创建轨迹
const controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
controls.enabled = !0;
controls.target = new THREE.Vector3();
controls.minDistance = 0;
controls.maxDistance = 2000;
controls.minPolarAngle = Math.PI / 2;
controls.maxPolarAngle = Math.PI / 2;
// 禁用缩放
controls.enableZoom = !1;
// 禁用旋转
controls.enableRotate !1;
controls.panSpeed = 2;

// 修改控件的默认触摸选项，设置为单指双指都为平移操作
controls.touches = {
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.PAN,
};

this.scene.add(this.camera);
```

OrbitControl 还允许我们设置阻尼，设置该值表现为数值越接近 1 越难拖动，开启阻尼后需要我们手动 update 控件。 

```js
controls.enableDamping = !0;
controls.dampingFactor = 0.2;
```

查看源码可以看到，阻尼的实现就是依赖滑动时的 offset 乘上一个权重，在通过后续的update不断为 panOffset 乘上一个权重实现滑动难，撒手后再滑动一点距离。

```js
// this method is exposed, but perhaps it would be better if we can make it private...
this.update = function () {

	// ...

	return function update() {

		// ...

		// 平移

		if ( scope.enableDamping === true ) {
		    // 开启阻尼后会在原本的位移上乘上一个权重
		    scope.target.addScaledVector( panOffset, scope.dampingFactor );

		} else {

			scope.target.add( panOffset );

		}

		// ...

		if ( scope.enableDamping === true ) {

			sphericalDelta.theta *= ( 1 - scope.dampingFactor );
			sphericalDelta.phi *= ( 1 - scope.dampingFactor );

            // 如果没有人为操作，随着时间推移，panOffset会越来越小
			panOffset.multiplyScalar( 1 - scope.dampingFactor );

		} else {

			sphericalDelta.set( 0, 0, 0 );

			panOffset.set( 0, 0, 0 );

		}

		// ...

	};

}();
```

官方也提供了 Controls 的 [例子](https://threejs.org/examples/?q=orbit#misc_controls_orbit) 供大家参考。


### 相机动线

如果不使用 Controls，仅仅是相机从一个点移动到另一个点，为了更平滑自然的相机轨迹，推荐使用贝塞尔曲线。  

贝塞尔曲线是一个由起点、终点和控制点决定的一条时间相关的变化曲线。这里以二阶贝塞尔曲线为例，实现相机的曲线移动。（三维的点有点难说明白，这里用二维坐标来解释）

![二阶贝塞尔曲线](https://p1.music.126.net/7omSL-S5oCiOeVYUUB7FLA==/109951164577831486.gif)

上图中小黑点的移动轨迹可以看做相机移动的曲线。

![贝塞尔公式](https://p1.music.126.net/HEPpSfrniHNHMkqGke3-Ww==/109951164577838846.png)

从该公式来看，只需要确定 p0、p1 和 p2 三个点，在单位时间下我们可以获得一条确定的曲线。

但是，换成坐标点要怎么做呢？

```js
// 获得贝塞尔曲线
function getBezier(p1, p2) {
    // 在指定范围内随机生成一个控制点
    const cp = {
        x: p1.x + Math.random() * 100 + 200,
        z: p2.z + Math.random() * 200,
    };

    let t = 0;
    // 贝塞尔曲线公式，根据时间确定点的位置
    return (deltat) => {
        if (t >= 1) return [p2.x, p2.y];
        t += deltat;
        if (t > 1) t = 1;

        const { x: x1, z: z1 } = p1;
        const { x: cx, z: cz } = cp;
        const { x: x2, z: z2 } = p2;
        const x = (1 - t) * (1 - t) * x1 + 2 * t * (1 - t) * cx + t * t * x2;
        const z = (1 - t) * (1 - t) * z1
            + 2 * t * (1 - t) * cz + t * t * z2;

        return [x, z];
    };
}
```

```js
const bezier = getBezier(p1, p2);
```

为了从简，这里只实现了二维坐标的轨迹变化，但三维也是同理。  

因为贝塞尔曲线是时间相关曲线，在每一次循环渲染中要传入时间来更新相机位置。

```js
animation() {
    const [x, z] = bezier(clock.getDelta());
    camera.position.x = x;
    camera.position.z = z;
    
    requestAnimationFrame(() => {
            animate();
    });
}

```


## 小结


没赶上 Three 的热潮，只能趁着活动需求给自己补补课了。在三维空间中，动画能够让空间中的物体更加生动，而相机的移动带给用户更强的空间感。

本文介绍了基于 `Animation` 实现物体的简单运动、 `Texture` 实现贴图动画以及使用 `Points` 粒子化的物体动画方案；基于 `Controls` 和贝塞尔曲线的相机动画方案。  

对 Three 有兴趣的朋友，可以通过 [官方文档](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene) 来学习，里面提供的例子覆盖了大部分场景。

以上是我在活动中涉及到的一些动画方案，难免会出现理解偏差和表达错误，如果有更多的动效方案欢迎一起探讨~


## 参考资料

- [Three.js文档](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene)
- [Three.js开发指南](https://item.jd.com/12113317.html)
- [Threejs现学现卖](https://aotu.io/notes/2017/08/28/getting-started-with-threejs/index.html)
- [一起炫起来 -- 3D粒子动画篇](https://juejin.im/post/5a1e7e7e51882503eb4b0a80)
- [贝塞尔曲线算法之JS获取点](https://segmentfault.com/a/1190000018597975)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！

