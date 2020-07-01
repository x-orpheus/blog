---
title: 实现一个简单的基于 WebAssembly 的图片处理应用
date: "2020-07-01T02:00:59.587Z"
description: "本文希望通过 Rust 敲一敲 WebAssembly 的大门。作为一篇入门文章，期望能够帮你了解 WebAssembly 以及构建一个简单的 WebAssembly 应用。在不考虑IE的情况，目前大部分主流的浏览器已经支持 WebAssembly，尤其在移动端，主流的UC、X5内核、Safari等都已支持。读完本文，希望能够帮助你将 WebAssembly 应用在生产环境中。"
---

![](https://p1.music.126.net/f-uNIGN1PhWAbafLyTh1uA==/109951164975440423.png)
> 图片来源：https://rustwasm.github.io/

> 本文作者：[刘家隆](https://www.onehacker.top/)

# 写在前边
本文希望通过 Rust 敲一敲 WebAssembly 的大门。作为一篇入门文章，期望能够帮你了解 WebAssembly 以及构建一个简单的 WebAssembly 应用。在不考虑IE的情况，目前大部分主流的浏览器已经支持 WebAssembly，尤其在移动端，主流的UC、X5内核、Safari等都已支持。读完本文，希望能够帮助你将 WebAssembly 应用在生产环境中。

# WebAssembly（wasm） 简介

> 如果你真的了解了 WebAssembly， 可以跳过这一节。

> 可以先看两个 wasm 比较经典的 demo：
> 
> http://webassembly.org.cn/demo/Tanks/
> 
> http://wasm.continuation-labs.com/d3demo/

快速总结一下： WebAssembly（wasm） 是一个可移植、体积小、加载快并且兼容 Web 的全新格式，由 w3c 制定出的新的规范。目的是在一些场景下能够代替 JS 取得更接近原生的运算体验，比如游戏、图片/视频编辑、AR/VR。说人话，就是可以体积更小、运行更快。

wasm 有两种表示格式，文本格式和二进制格式。二进制格式可以在浏览器的 js 虚拟机中沙箱化运行，也可以运行在其他非浏览器环境中，比如常见的 node 环境中等；运行在 Web 上是 wasm 一开始设计的初衷，所以实现在浏览器上的运行方法非常简单。

通过一个简单的例子实现快速编译 wasm 文本，运行一个 wasm 二进制文件：

wasm 文本格式代码：

```js
(module
    (import "js" "import1" (func $i1)) // 从 js 环境中导入方法1
    (import "js" "import2" (func $i2)) // 从 js 环境中导入方法2
    (func $main (call $i1)) // 调用方法1
    (start $main)
    (func (export "f") (call $i2)) // 将自己内部的方法 f 导出，提供给 js，当 js 调用，则会执行方法2
)
```

上述内容看个大概即可，参阅代码中注释大致了解主要功能语法即可。主要功能就是从 js 环境中导入两个方法 ```import1``` 和 ```import2```； 同时自身定义一个方法 ```f``` 并导出提供给外部调用，方法体中执行了 ```import2```。

文本格式本身无法在浏览器中被执行，必须编译为二进制格式。可以通过 [wabt](https://github.com/WebAssembly/wabt) 将文本格式编译为二进制，注意文本格式本身不支持注释的写法，编译的时候需要将其去除。这里使用 [wat2wasm 在线工具](https://webassembly.github.io/wabt/demo/wat2wasm/)快速编译，将编译结果下载就是运行需要的 wasm 二进制文件。

有了二进制文件，剩下的就是在浏览器中进行调用执行。

```js
// 定义 importObj 对象赋给 wasm 调用
var importObj = {js: { 
    import1: () => console.log("hello,"), // 对应 wasm 的方法1
    import2: () => console.log("world!") // 对应 wams 的方法2
}};
// demo.wasm 文件就是刚刚下载的二进制文件
fetch('demo.wasm').then(response =>
    response.arrayBuffer() // wasm 的内存 buffer
).then(buffer =>
       /**
       * 实例化，返回一个实例 WASM.module 和一个 WASM.instance，
       * module 是一个无状态的 带有 Ast.module 占位的对象；
       * 其中instance就是将 module 和 ES 相关标准融合，可以最终在 JS 环境中调用导出的方法
       */
    WebAssembly.instantiate(buffer, importObj) 
).then(({module, instance}) =>
    instance.exports.f() // 执行 wasm 中的方法 f
);
```

大概简述一下功能执行流程：
* 在 js 中定义一个 ```importObj``` 对象，传递给 wasm 环境，提供方法 ```import1``` ```import2``` 被 wasm 引用；
* 通过 fetch 获取二进制文件流并获取到内存 buffer；
* 通过浏览器全局对象 WebAssembly 从内存 buffer 中进行实例化，即 ```WebAssembly.instantiate(buffer, importObj)```，此时会执行 wasm 的 ```main``` 方法，从而会调用 ```import1``` ，控制台输出 hello；
* 实例化之后返回 wasm 实例，通过此实例可以调用 wasm 内的方法，从而实现了双向连接，执行 ```instance.exports.f()``` 会调用 wasm 中的方法 ```f```，```f``` 会再调用 js 环境中的 ```import2```，控制台输出 world。

细品这段实现，是不是就可以达到 wasm 内调用 js，从而间接实现在 wasm 环境中执行浏览器相关操作呢？这个下文再展开。

通过直接编写文本格式实现 wasm 显然不是我们想要的，那么有没有“说人话的”实现方式呢，目前支持比较好的主要包括 C、 C++、Rust、 Lua 等。

# 颇有特点的Rust

> 如果你了解 Rust，这一节也可以跳过了。

> A language empowering everyone to build reliable and efficient software. ——from [rust-lang](https://www.rust-lang.org/)

Rust 被评为 2019 最受欢迎的语言。

![](https://p1.music.126.net/TR4H-hbXEmGjA953aj1IXQ==/109951164975622911.png?imageView&thumbnail=450x0)
> 截图自 https://insights.stackoverflow.com/survey/2019#technology-_-most-loved-dreaded-and-wanted-languages

Rust 正式诞生于 15 年，距今仅仅不到五年的时间，但是目前已覆盖各大公司，国外有 Amazon、Google、Facebook、Dropbox 等巨头，国内有阿里巴巴、今日头条、知乎、Bilibili 等公司。那是什么让如此年轻的语言成长这么快？
* Rust 关注安全、并发与性能，为了达成这一目标，Rust 语言遵循内存安全、零成本抽象和实用性三大设计哲学
* 借助 LLVM 实现跨平台运行。
* Rust 没有运行时 gc，并且大部分情况不用担心内存泄漏的问题。
* ...
  
你内心 OS 学不动了？别急，先简单领略一下 Rust 的魅力，或许你会被他迷住。

下边看似很简单的问题，你能否答对？一共三行代码，语法本身没有问题，猜打印的结果是啥？

```Rust
fn main() {
    let s1 = String::from("hello word"); // 定义一个字符串对象
    let s2 = s1; // 赋值
    println!("{}", s1); // log输出 
}
```

<details>
<summary>思考一会 点击查看答案</summary>
报错！变量 s1 不存在了。
</details>

这其实是 Rust 中一个比较重要的特性——所有权。当将 ```s1``` 赋值给 ```s2``` 之后，```s1``` 的所有权便不存在了，可以理解为 ```s1``` 已经被销毁。通过这种特性，实现内存的管理被前置，代码编写过程中实现内存的控制，同时，借助静态检查，可以保证大部分编译正确的程序可以正常运行，提高内存安全之外，也提高了程序的健壮性，提高开发人员的掌控能力。

所有权只是 Rust 的众多特性之一，围绕自身的三大哲学（安全、并发与性能）其有很多优秀的思想，也预示着其上手成本还是比较高的，感兴趣的可以深入了解一下。之前 Rust 成立过 CLI、网络、WASM、嵌入式四大工作组，预示着 Rust 希望发力的四大方向。截止目前已经在很多领域有比较完善的实现，例如在服务端方向有 actix-web、web 前端方向有 yew、wasm 方面有 wasm-pack 等。总之，Rust 是一门可以拓宽能力边界的非常有意思的语言，尽管入门陡峭，也建议去了解一下，或许你会深深的爱上它。
> 除 wasm 外的其他方向（cli、server等），笔者还是喜欢 go，因为简单，^_^逃...

行了，扯了这么多，Rust 为何适合 wasm：
* 没有运行时 GC，不需要 JIT，可以保证性能
* 没有垃圾回收代码，通过代码优化可以保证 wasm 的体积更小
* 支持力度高（官方介入），目前而言相比其他语言生态完善，保证开发的低成本

# Rust -> wasm

## Rust编译目标

rustc 本身是一个跨平台的编译器，其编译的目标有很多，具体可以通过 ```rustup target list``` 查看，和编译 wasm 相关的主要有三个：
* wasm32-wasi：主要是用来实现跨平台，通过 wasm 运行时实行跨平台模块通用，无特殊 web 属性
* wasm32-unknown-emscripten：首先需要了解 [emscripten](https://emscripten.org/index.html)，借助 LLVM 轻松支持 rust 编译。目标产物通过 emscripten 提供标准库支持，保证目标产物可以完整运行，从而实现一个独立跨平台应用。
* wasm32-unknown-unknown：主角出场，实现 rust 到 wasm 的纯粹编译，不需要借助庞大的 C 库，因而产物体积更加小。通过内存分配器（wee_alloc）实现堆分配，从而可以使用我们想要的多种数据结构，例如 Map，List 等。利用 wasm-bindgen、web-sys/js-sys 实现与 js、ECMAScript、Web API 的交互。该目标链目前也是处于官方维护中。

> 或许有人对 wasm32-unknown-unknown 的命名感觉有些奇怪，这里大概解释一下：wasm32 代表地址宽度为 32 位，后续可能也会有 wasm64 诞生，第一个 unknow 代表可以从任何平台进行编译，第二个 unknown 表示可以适配任何平台。

## wasm-pack

以上各个工具链看着复杂，官方开发支持的 [wasm-pack](https://rustwasm.github.io/wasm-pack/) 工具可以屏蔽这一切细节，基于 wasm32-unknown-unknown 工具链可快速实现 Rust -> wasm -> npm 包的编译打包，从而实现在 web 上的快速调用，窥探 wasm-npm 包这头“大象”只需要如下几步：
1. 使用 [rustup](https://rustup.rs/) 安装rust
2. 安装 wasm-pack
3. wasm-pack new hello-wasm.
4. cd hello-wasm
5. 运行 wasm-pack build.
6. pkg 目录下产物就是可以被正常调用的 node_module 了

## 一个真实例子看一下 wasm 运行优势

路指好了，准备出发！接下来可以愉快的利用 rust 编写 wasm 了，是不是手痒了；下边通过实现一个 MD5 加密方法来对比一下 wasm 和 js 的运行速度。

#### 首先修改 Cargo.toml，添加依赖包

``` yaml
[dependencies]
wasm-bindgen = "0.2"
md5 = "0.7.0"
```

[Cargo](https://crates.io/) 是 Rust 的包管理器，用于 Rust 包的发布、下载、编译等，可以按需索取你需要的包。其中 md5 就是一会要进行 md5 加密的算法包，wasm-bindgen 是帮助 wasm 和 js 进行交互的工具包，抹平实现细节，方便两个内存空间进行通讯。

#### 编写实现（src/lib.rs）

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn digest(str: &str) -> String {
    let digest = md5::compute(str);
    let res = format!("{:x}", digest);
    return res;
}
```

借助 wasm_bindgen 可以快速将方法导出给 js 进行调用，从而不需要关心内存通信的细节。最终通过 wasm-pack build 构建出包（在目录 pkg 下），可以直接在 web 进行引用了，产物主要包含以下几部分

```js
├── package.json
├── README.md
├── *.ts
├── index_bg.wasm：生成 wasm 文件，被index.js进行调用
├── index.js：这个就是最终被 ECMAScript 项目引用的模块文件，里边包含我们定义的方法以及一些自动生成的胶水函数，利用 TextEncoder 实现内存之间的数据通信。
```

#### js 调用

```js
import * as wasm from "./pkg";
wasm.digest('xxx');
```
构建出的 wasm pkg 包引入 web 项目中，使用 webpack@4 进行打包编译，甚至不需要任何其他的插件便可支持。

#### 速度对比

针对一个大约 22 万字符长度的字符串进行 md5 加密，粗略的速度对比：

|   | 加密1次时间（ms） | 加密100次时间（ms） |  算法依赖包 |
| --- | --- | --- | --- |
| js版本md5   | ~57  | ~1300 | https://www.npmjs.com/package/md5 |
| wasm版本md5 | ~5  | ~150 | https://crates.io/crates/md5 |

从数据层面来看，wasm 的性能优势显而易见。但同时也发现在 100 次的时候，性能数据差值虽然扩大，但是比值却相比一次加密缩小。原因是在多次加密的时候，js 和 wasm 的通信成本的占比逐渐增高，导致加密时间没有按比例增长，也说明 wasm 实际加密运算的时间比结果更小。这其实也表明了了 wasm 在 web 上的应用场景：重计算、轻交互，例如音视频/图像处理、游戏、加密。但在将来，这也会得到相应的改善，借助 [interface-type](https://github.com/WebAssembly/interface-types/blob/master/proposals/interface-types/Explainer.md) 可实现更高效的值传递，未来的前端框架或许会真正迎来一场变革。

# 利用 wasm 实现一个完整 Web 应用

![](https://p1.music.126.net/_jDkFb2zvVKqMbeV0obzaQ==/109951165015160688.png?imageView&thumbnail=400x0)

借助 ```wasm-bindgen```,```js-sys```和```web-sys``` crates，我们甚至可以极小的依赖 js，完成一个完整的 web 应用。以下是一个本地彩色 png 图片转换为黑白图片的 web-wasm 应用。

效果图：

![](https://p1.music.126.net/Yv_KHndz79jZt3IMECRf-w==/109951164976120814.png?imageView&thumbnail=300x0)
> 在线体验：[点我](https://yunfengsa.github.io/demos/wasm-web/index.html)

大致功能是通过 js 读取文件，利用 wasm 进行图片黑白处理，通过 wasm 直接创建 dom 并进行图片渲染。

![](https://p1.music.126.net/CKQpOay8y7J3BRrh_C7oGg==/109951165015194247.png?imageView&thumbnail=400x0)

#### 1. 利用 js 实现一个简单的文件读取：

```html
// html
<div>
	<input type="file" id="files" style="display: none" onchange="fileImport();">
	<input type="button" id="fileImport" value="选择一张彩色的png图片">
</div>
```

```js
// js
$("#fileImport").click(function () {
    $("#files").click();
})
window.fileImport = function() {
    //获取读取我文件的 File 对象
    var selectedFile = document.getElementById('files').files[0];
    var reader = new FileReader(); // 这是核心, 读取操作就是由它完成.
    reader.readAsArrayBuffer(selectedFile); // 读取文件的内容,也可以读取文件的URL
    reader.onload = function () {
        var uint8Array = new Uint8Array(this.result);
        wasm.grayscale(uint8Array);
    }
}
```

这里获取到的文件是一个 js 对象，最终拿到的文件信息需要借助内存传递给 wasm , 而文件对象无法直接传递给 wasm 空间。我们可以通过 FileReader 将图片文件转换为一个 8 位无符号的数组来实现数据的传递。到此，js 空间内的使命完成了，最后只需要调用 ```wasm.grayscale``` 方法，将数据传递给 wasm 即可。

#### 2. wasm 获取数据并重组

```rust
fn load_image_from_array(_array: &[u8]) -> DynamicImage {
    let img = match image::load_from_memory_with_format(_array, ImageFormat::Png) {
        Ok(img) => img,
        Err(error) => {
            panic!("{:?}", error)
        }
    };
    return img;
}

#[wasm_bindgen]
pub fn grayscale(_array: &[u8]) -> Result<(), JsValue> {
    let mut img = load_image_from_array(_array);
    img = img.grayscale();
    let base64_str = get_image_as_base64(img);
    return append_img(base64_str);
}
```

wasm 空间拿到传递过来的数组，需要重组为图片文件对象，利用现成的轮子 image crate 可以快速实现从一个无符号数组转换为一个图片对象（```load_image_from_array```），并进行图像的黑白处理（```img.grayscale()```）。处理过后的对象需要最终再返回浏览器 ```<img />``` 标签可识别的内容信息，提供给前端进行预览，这里选择 base64 字符串。

#### 3. wasm 内生成 base64 图片格式

```rust
fn get_image_as_base64(_img: DynamicImage) -> String {
    // 创建一个内存空间
    let mut c = Cursor::new(Vec::new());
    match _img.write_to(&mut c, ImageFormat::Png) {
        Ok(c) => c,
        Err(error) => {
            panic!(
                "There was a problem writing the resulting buffer: {:?}",
                error
            )
        }
    };
    c.seek(SeekFrom::Start(0)).unwrap();
    let mut out = Vec::new();
    // 从内存读取数据
    c.read_to_end(&mut out).unwrap();
    // 解码
    let stt = encode(&mut out);
    let together = format!("{}{}", "data:image/png;base64,", stt);
    return together;
}
```

在 wasm 空间内将 DynamicImage 对象再转换为一个基础值，从而再次实现值得传递；借助 Rust Cursor，对 DynamicImage 对象信息进行读写，Rust Cursor 有点类似前端的  Reader/Writer，通过一个缓存区实现信息读写，从而拿到内存空间内的图片存储信息，获得的信息经过 base64 解码即可拿到原始字符串信息，拿到的字符串拼接格式信息 ```data:image/png;base64``` 组成完整的图片资源字符创，便可以直接返回给前端进行预览渲染了。

以上已经完成了图片处理的所有流程了，获取到的 base64 可以直接交还给 js 进行创建 dom 预览了。但是！我有没有可能不使用 js 进行操作，在 wasm 内直接完成这步操作呢？

#### 4. wasm 内创建 dom 并渲染图片

wasm 本身并不能直接操作 dom，必须经过 js 完成 dom 的操作。但是依然可以实现在 wasm 内载入 js 模块间接操作 dom。[web_sys](https://crates.io/crates/web-sys) 便实现了这步操作，并基本完成所有的接口实现，借助 web_sys 甚至可以很方便的实现一个纯 wasm 的前端框架，比如 yew。

![](https://p1.music.126.net/aX0h3uTiJP-FkxLDIz4zjg==/109951165097855840.png)
> 图片引自：https://hacks.mozilla.org/2017/02/where-is-webassembly-now-and-whats-next/

```rust
pub fn append_img(image_src: String) -> Result<(), JsValue> {
    let window = web_sys::window().expect("no global `window` exists");
    let document = window.document().expect("should have a document on window");
    let body = document.body().expect("document should have a body");
    let val = document.create_element("img")?;
    val.set_attribute("src", &image_src)?;
    val.set_attribute("style", "height: 200px")?;
    body.append_child(&val)?;
    Ok(())
}
```

操作的流程和直接使用 js 操作 dom 基本一致，其实也都是间接调用了 js 端方法。在实际应用中，还是要尽量避免多次的通信带来额外的性能损耗。

> 一个简单的图片黑白处理应用完成了，完整的代码：[点我](https://github.com/yunfengsa/rust-wasm)。其他的功能可以按照类似的方式进行拓展，比如压缩、裁剪等。

# 写在最后

本文简述了从 Rust 到 wasm，再到 web based wasm 的流程。希望读完本文，能够帮你在实际业务开发中开拓解决问题的思路，探索出更多更实用的场景。由于作者水平有限，欢迎批评指正。

#### 资料参考

https://rustwasm.github.io/

https://rustwasm.github.io/wasm-pack/

https://github.com/WebAssembly/interface-types/blob/master/proposals/interface-types/Explainer.md

https://yew.rs/docs/v/zh_cn/

https://hacks.mozilla.org/2017/02/where-is-webassembly-now-and-whats-next/

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，可自由转载，转载请在标题标明转载并在显著位置保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
