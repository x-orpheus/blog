---
title: 从全局播放到单例模式
date: "2020-03-24T02:02:33.108Z"
description: "本文以音频能力中的全局播放为切入点，探讨单例模式在前端业务中的应用。文中代码均为 React 组件内代码。"
---

![header.png](https://kalianey.com/wp-content/uploads/2016/03/singleton_pattern.jpg)

> 图片来源：https://kalianey.com/

> 本文作者：郑正和（https://github.com/proempire）

本文以音频能力中的全局播放为切入点，探讨单例模式在前端业务中的应用。文中代码均为 React 组件内代码。

## 全局播放

在文章一开始，我们先解释一下<b>全局播放</b>的含义：

1. 媒体在应用中时时都在播放（跨路由、跨 tab、后台播放）
2. 用户对媒体有全局控制能力

对大多数具备音频能力的应用而言，为了保证音频体验上的流畅，全局播放基本是一项必备的能力，很难想象使用一个不具备全局播放能力的应用是种什么样的体验。设想一下，你在听一首歌的同时不能去浏览其他内容？显然这是不可接受的。在当前这个时代，即便是视频，部分应用也已经支持了全局播放（Youtube）。

那么对于前端而言，全局播放又是一个什么样的存在呢？虽然前端领域的音视频能力起步时间较晚，但是当前大量的 Hybrid APP、小程序，或是稍微复杂一些的活动页，都对全局播放提出了较高的要求，列表增删，播放模式切换、切歌等等能力都常常被包含在内。

我们知道，前端里的 Audio 对象已经支持了一部分音频能力，如自动播放、循环、静音等能力，但这里有个问题：前端应用在进行全局播放时，无论当前处于单页应用（只能是单页应用，多页应用暂时不可能做出全局播放）的哪个子页面，都必须<b>能且仅能操作同一个</b>音频对象，否则就不是全局播放了。

因此，我们有必要对 Audio 做一层封装，以提供全局播放相关能力，以下代码对<b>能且仅能操作同一个</b>这一逻辑进行了封装：

```js
function singletonAudio = (function () {
    class Audio {
        constructor(options) {
            if (!options.src) throw new Error('播放地址不允许为空');

            this.audioNode = document.createElement('audio');
            this.audioNode.src = options.src;
            this.audioNode.preload = !!options.preload;
            this.audioNode.autoplay = !!options.autoplay;
            this.audioNode.loop = !!options.loop;
            this.audioNode.muted = !!options.muted;

            // ...
        }

        play(playOptions) {
            // ...
        }

        // 其他对单个音频的控制逻辑...
    }

    let audio;

    const _static = {
        getInstance(options) {
            // 若 audio 实例还未被创建，则创建并返回
            if (audio === undefined) {
                audio = new Audio(options);
            }

            return audio;
        }
    };

    return _static;
})();
```

`Audio` 类的具体控制逻辑已被省去，因为这不是我们的重点。这里我们采用了一个 IIFE（立即执行函数）来构造闭包，仅返回了一个 `_static` 对象，该对象提供了 `getInstance` 方法，封装了<b>创建</b>和<b>获取</b>的步骤，由此，使用者无论何时、在应用何处调用该方法，都会获取到唯一一个音频实例，对其进行操作，就可以完成全局播放的逻辑。

## 单例模式（Singleton Pattern）

在上面的全局播放例子中，我们可以注意到音频实例并没有直接暴露给使用者，而是通过一个公有方法 `getInstance` 让使用者创建、获取音频实例。这么做的目的是禁止使用者主动实例化 `Audio`，在公共组件的层面上保证全局只存在一个 `audio` 实例。

现在我们可以来看看单例模式的定义了：

> 类仅允许有一个实例，且该实例在用户侧有一个访问点。

在我们全局播放的例子中，始终只操作一个 `audio` 实例，且该实例全局可用。

单例模式的一个常见应用场景（applicability）如下：

> 实例必须能通过子类的形式进行扩展，且用户侧能在不修改代码的前提下使用该扩展实例。

光看概念毕竟有点抽象，我们还是以实际的场景来说明一下。

仍以上文的 `Audio` 类为例，假设单例现在需要提供一个永远保持循环播放的子类 `LoopAudio`，代码修改如下：

```js
function singletonAudio = (function () {
    class Audio {
        // 同上文...
    }

    class LoopAudio extends Audio {
        constructor(options) {
            super(options);
            this.audioNode.loop = true;
        }

        // 其他对单个音频的控制逻辑，不开放 loop 属性的控制方法...
    }

    let audio;

    const _static = {
        getInstance(options) {
            // 若 audio 实例还未被创建，则创建并返回
            if (audio === undefined) {
                if (isLoop()) {
                    audio = new LoopAudio(options);
                } else {
                    audio = new Audio(options);
                }
            }

            return audio;
        }
    };

    return _static;
})();
```

`LoopAudio` 类继承自 `Audio` 类，强制定义了 `loop` 属性，且封闭了 `loop` 属性的修改途径（若 `Audio` 类已经提供，在 `LoopAudio` 的同名方法中取消这一行为）。同时在返回的 `_static` 对象中，我们通过 `isloop` 方法判断要返回给用户侧哪种实例，注意这里的判断只有第一次会进行，一旦实例创建，就不能再更改了。

你可能要问，为什么搞这么麻烦？我在 `_static` 里重新定义一个方法 `getLoopInstance` 直接创建/获取 `LoopAudio` 类不行吗？如果你这么想，请回头再仔细看看单例模式应用场景的第 2 点后半句，<b>用户侧不修改代码</b>，即用户侧对 `audio` 实例扩展为 `loopAudio` 实例是无感知的。如果你非要说：我在业务组件里有些时候需要用 `audio` 实例，有些时候需要用 `loopAudio` 实例，那么，你完全可以在业务代码里自己对 `audio` 实例的 `loop` 属性进行控制，而这里就不需要处理这个逻辑了。这种场景和单例模式并不冲突，仅仅是将 `loop` 属性的控制权转移到了用户侧。

这里我们举的 `LoopAudio` 是单例模式中扩充子类的一个例子，实际应用中扩充的子类可能依赖于一些特定的环境，如根据浏览器对 `Audio` 类的支持程度决定使用原生 `Audio` 还是伪造的 `DumbAudio`，抑或是根据设备性能决定使用高采样率的 `HighQualityAudio` 还是低采样率的 `LowQualityAudio`。

## 单例模式的完善

### 用户侧的例子——音轨

前面提到，全局播放是指同一时间内，应用的所有组件都能操作唯一一个音频对象，这主要是针对歌曲、视频成品等内容而言。事实上，对于制作中的歌曲，同时存在多个<b>音轨</b>是非常常见的情况，如果你用 Pr、Au 等 Adobe 全家桶系列做过音频剪辑，这个概念你应该很熟悉。

为了实现<b>音轨</b>这个功能，我们定义了 `Tracks` 类：

```js
class Tracks {
    constrcutor() {
        this.tracks = {};
    }

    set(key, options) {
        this.tracks[key] = singletonAudio.getInstance(key, options);
    }

    get(key) {
        return this.tracks[key];
    }

    // 所有音轨音量调节
    volumeUp(options) {
        // 这里的 options 直接原样传入了，实际情况下可能会对 options 作额外的处理
        // 例如，我们想调节所有音轨的整体音量，options 传入 overallVolume
        // 综合考虑所有 audio 的音量，给每个 audio 的 volumeUp 方法传入合适的参数
        Object.keys(this.tracks).forEach((key) => {
            const audio = this.tracks[key];
            audio.volumeUp(options);
        });    
    }
}
```

在这里，我们支持通过实例方法 `set` 动态新增音轨，但新增的每条音轨，我们都从 `singletonAudio.getInstance` 中获取，这样我们可以保证应用在使用 `tracks` 实例的 `set` 方法时，在传入一样的 `key` 的前提下，该 `key` 若还没有设置 `audio` 实例，则设置，如果设置过了，就直接返回（这是 `singletonAudio.getInstance` 本身的特性）。\[1\]

同时，我们将 `singletonAudio` 修改如下：

```js
function singletonAudio = (function () {
    class Audio {
        // 同上文...
    }

    let audios = {};

    const _static = {
        getInstance(key, options) {
            // 若 audio 实例还未被创建，则创建并返回
            if (audios[key] === undefined) {
                audios[key] = new Audio(options);
            }

            return audio[key];
        }
    };

    return _static;
})();
```

对于这里对 `singletonAudio` 的修改，我们做一些补充说明：

在文章的第二部分，我们说单例模式下全局播放只有一个 `audio` 实例，但在这里的场景下，全局不止一个 `audio` 实例。事实上，单例模式的定义里从来就没有严格限制其只能提供一个实例。这不矛盾么？

注意看上面这句话的表述中的<b>提供</b>二字，单例模式的确会返回具有单例性质的<b>结构</b>，但单例这一性质体现在这些<b>结构</b>上，单例模式本身完全可以返回多个具有单例性质的对象（这是<b>结构</b>的一种）。

> This is because it is neither the object or "class" that's returned by a Singleton, it's a structure —— Addy Osmani

好的，解决了为什么这里会出现多个 `audio` 实例后，我们看看之前的表述\[1\]，其中提到 <b>传入一样的 `key`</b>，为什么 `key` 要一样呢？有了对于出现多个 `audio` 实例原因的补充，这里解释起来就方便很多了，`key` 标识 `singletonAudio` 返回结构中不同的单例，当 `key` 一样时，我们操作的就是同一个单例。

### 隐患

至此，我们完成了一个 `Tracks` 类，它可以管理多个 `audio` 实例，每个 `audio` 实例本身都具备单例的性质，但是这就没有问题了吗？

注意在前面的 `tracks` 实例的 `set` 方法中，我们默认使用了单例模式 `singletonAudio`，即调用 `singletonAudio.getInstance` 给 `this.tracks[key]` 赋值，这么做事实上已经有了一个预设，即 `this.tracks[key]`——也就是某条音轨——必定是由 `singletonAudio` 创建出来的，这样一来，`Tracks` 类就直接与 `singletonAudio` 绑定了，如果后续 `singletonAudio` 作了一些修改，`Tracks` 类只能一起改。举个例子：

`Tracks` 类提供了 `set` 方法：

```js
set(key, options) {
    this.tracks[key] = singletonAudio.getInstance(key, options);
}
```

这里我们通过 `key` 标识不同的音轨，用 `options` 初始化每条音轨，但是，如果后面我们的 `singletonAudio` 发生更改，只提供 `getCollection(key)` 方法，这里的 `key` 用来实例化 `Audio` 的不同子类，该方法返回的对象 `collection` 再提供原有的 `getInstance` 方法以获取该子类下的不同单例。这样一来，原来的 `set` 方法将会失效。`singletonAudio` 改动带动了非业务下游组件（这里是 `Tracks`）改动。而类似的情况有很多，例如全局播放条组件、前端音视频播放器、本地音视频采集等等。

由于 `singletonAudio` 抽象层级较高（其封装的是音频能力，所有涉及音频能力的非业务下游组件都可能使用到它），后续容易产生大量依赖它的如 `Tracks` 这样的非业务下游组件，由于这些组件本身不承载业务逻辑，我们也很难事先设计好架构同步 `Tracks` 类与其他依赖于 `singletonAudio` 的修改，<b>此时维护这些下游组件只能一个个修改</b>。

无论如何，这种上游组件修改带动整个用户侧一起作修改的做法，都是极为不可取的，它会浪费许多不必要的时间来对一次更新作兼容，成本过高。

> 你可能要问，组件特性更新向下兼容，大版本不向下兼容不就可以了么？是，但这是在用 npm 管理公共组件的前提下，如果仅仅是单个应用内部的公共组件，还要引入组件版本的概念，未免不太合适。如果为了这个把应用仓库改造成 monorepo，又有些小题大做了。

### 应用侧才是出路？

上述问题之所以存在，就是因为 `Tracks` 类的写法耦合了 `singletonAudio.getInstance`，即上面说的做了 `this.tracks[key]` 必定由 `singletonAudio` 创建出来的预设。这是一种很常见的反设计模式：**I know where you live**，如果一个组件对另一个组件的了解过多，以至于在组件中有大量基于另一个组件的逻辑，那么上游组件一旦变动，下游组件除了修改外没有办法。组件之间，除了必要的通信信息，其他信息应该遵循知道得越少越好的原则。

为了避免上面这种“一次更新，全局修改”的情况发生，考虑到应用侧本身就管理着业务逻辑，我们不妨把 `this.tracks[key]` 是否具有单例性质的控制权交给应用侧，`Tracks` 类改写如下： 

```js
class Tracks {
    constrcutor() {
        this.tracks = {};
    }

    set(key, options) {
        this.tracks[key] = options.audio;
    }

    get(key) {
        return this.tracks[key];
    }

    // 所有音轨音量调节
    volumeUp(options) {
        // 同上... 
    }
}
```

这里的修改其实很简单，变动的只有 `set` 方法，注意到我们将 `options.audio` 赋值给了 `this.tracks[key]`，也就是说，某个音轨是否采用上面具有单例性质的 `audio` 是由实际的业务逻辑决定的，相对于非业务下游组件，业务组件本身的业务上下文使其更容易管理多种、多个像 `Tracks` 这样的组件。

在业务侧，我们可以通过 `singletonAudio.getInstance` 实例化一个 `audio` 单例，然后将这个 `audio` 存储于顶层 state 中（使用任一状态管理库），这样在所有用到 `Tracks` 等类的地方，我们拿到这个全局 `audio` 作为依赖注入到 `Tracks` 类中，此时我们就把 `Tracks`、全局播放条组件这些类的修改收敛到了一个地方。如果发生了上面<b>隐患</b>一节例子中的修改，我们只需要在应用侧处理 `getCollection` 和 `getInstance` 逻辑，对于 `Tracks` 这些类，它们还是接收一个 `audio` 实例，代码是无须变动的。

## 小结

本文从音频播放能力中常见的全局播放说起，进而引申出了单例模式的讨论，最后通过一个单例模式的应用，讨论了该模式在实际应用中可能存在的缺陷，并提出了解决方法。

### 参考资料

* 《JavaScript设计模式》Addy Osmani著


> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
