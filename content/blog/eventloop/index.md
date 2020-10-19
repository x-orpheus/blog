---
title: 聊聊 JavaScript 的并发、异步和事件循环
date: 2020-10-19T02:08:35.036Z
description: JavaScript 作为天生的单线程语言，社区经常聊 JavaScript 就聊异步、聊 Event Loop，看起来它们好像难舍难分，实际上可能只有五毛钱的关系。本文把这些串起来讲讲，希望能给读者带来一些收获，如果能消除一些误解那就最好了。
---

![](https://cdn.int64ago.org/fdd4e4d2-f18b-47a7-be31-bd7c09e6159a.png)

> 本文作者：[Cody Chan](https://github.com/int64ago)，题图来自 [Jake Archibald](https://jakearchibald.com/)

JavaScript 作为天生的单线程语言，社区经常聊 JavaScript 就聊异步、聊 Event Loop，看起来它们好像难舍难分，实际上可能只有五毛钱的关系。本文把这些串起来讲讲，希望能给读者带来一些收获，如果能消除一些误解那就最好了。

> 需要强调的是，这类纯技术学习除了 **SPEC** 和**源码**其它都不是严谨的途径，这篇文章也不例外。

## 开端

网上经常充斥着所谓「前端八股文」，其中可能就有类似这样的题：

```javascript
console.log(1);

setTimeout(() => console.log(2), 0);

new Promise(resolve => {
  console.log(3);
  resolve();
}).then(() => console.log(4));

console.log(5);
```

这篇文章并不是为了解决上面的题，上面的题只要对 Event Loop 有过基本了解就可以作答。

写这个文章的冲动来自于很久之前的一个疑惑：NodeJS 里既然有了 `fs.readFile()` 为什么还提供 `fs.readFileSync()`？

## Engine 和 Runtime

严格来说，JavaScript 跟其它语言一样，是很单纯的，只是一份 [SPEC](https://www.ecma-international.org/publications/standards/Ecma-262.htm)。我们现在看到的它的面貌很多是 Engine 和 Runtime 赋予的。

这里的 Engine 是指 [JavaScript 引擎](https://en.wikipedia.org/wiki/List_of_ECMAScript_engines)，比如常见的 [V8](https://chromium.googlesource.com/v8/v8.git) 和 [SpiderMonkey](https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey) 等，它们主要工作就是翻译代码并执行（当然附带内存分配回收等）。下图是 V8 主要工作原理：

![](https://cdn.int64ago.org/e282a0a9-b4c4-46ad-b83b-47abd2f674c8.png)

> 可以通过 [这个](https://docs.google.com/presentation/d/1chhN90uB8yPaIhx_h2M3lPyxPgdPmkADqSNAoXYQiVE) 了解更多。

而 Runtime 是指各种浏览器及 NodeJS，它们提供了各种接口模块，整合 Engine 并按事件驱动地方式调度等。

比如下面的代码：

```javascript
setTimeout(callback, ms);
```

Engine 只是很纯粹地翻译执行，跟对待任何普通函数一样：

```javascript
myFun(arg1, arg2);
```

Runtime 实现了 `setTimeout` 并把它放到了 `window` 或 `global` 上，至于里面的 `callback` 何时可以被执行的逻辑也是 Runtime 实现的，其实就是 Event Loop 机制。

> 部分参考自 [这里](https://medium.com/@sanderdebr/a-brief-explanation-of-the-javascript-engine-and-runtime-a0c27cb1a397)，这些称呼在不同语境下也不太一样，知道怎么回事即可。

## 并发

并发和多线程经常会同时出现，看起来 JavaScript 这种单线程语言在并发天然弱势，实则不然。

除了并发，还有个叫并行的概念，并行就是一般意义上多个任务同时进行，而并发是指多个任务**看起来像**是同时进行的。我们一般很少需要关心是否并行。

**高效处理并发的本质是充分利用 CPU。**

### 充分利用单核 CPU

对于 I/O 密集型应用，CPU 其实很闲的，可能大多时候就是无聊地等待。I/O 操作之间如果没有依赖，完全可以并发地发起指令，再并发地响应结果，中间等待的时间就可以省掉。

因为 CPU 处理的事足够简单，多线程干这个事表现就可能很糟糕，花 100ms 切上下文，结果 CPU 只用了 10ms 就又切走了。所以 JavaScript 选择了事件驱动的方式，也让它更擅长 I/O 密集型场景。

![](https://cdn.int64ago.org/a116fb75-04fa-4667-94b3-f59d092daba6.png)

### 充分利用多核 CPU

充分利用单核 CPU 是有上限的，充其量也仅仅是把 CPU 不必要的空闲时间（进程挂起）减为零。面对 CPU 密集型应用，就需要充分利用多核 CPU。

![](https://cdn.int64ago.org/40044f13-5008-4cd8-976c-a6807c4fff59.png)

用户态进程是无法直接调度 CPU 的，所以如果要充分利用多 CPU，只需要在用户态开多个进程（线程），操作系统会自动帮调度。

拿 Chrome 为例，看浏览器的 Task Manager，会发现每个 Tab 以及每个扩展都是 [独立的进程](https://developers.google.com/web/updates/2018/09/inside-browser-part1#the_benefit_of_multi-process_architecture_in_chrome)，当然我们还可以借助 [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) 手动开多个线程。

NodeJS 的话方式就多了：

 - [Child process](https://nodejs.org/api/child_process.html)：比较常用，可以 fork 一个子进程，也可以 spawn 执行系统命令；
 - [Worker threads](https://nodejs.org/api/worker_threads.html)：这个更轻，如名字，可以认为更**像**线程，还可以通过 [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) 等共享内存（数据）；
 - [Cluster](https://nodejs.org/api/cluster.html)：跟上面方案比起来 Cluster 更像是具体场景的解决方案，在作为 Web Server 提供服务时，如果 fork 多个进程，这就涉及到通信以及 bind 端口被占用等问题，而这些 Cluster 都帮你解决了，著名的 [PM2](https://github.com/Unitech/pm2) 以及 [EggJS](https://eggjs.org/en/index.html) 多进程模型都是基于此。

### 用户态并发

当然充分利用 CPU 也不是万事大吉，还要合理安排我们的任务！

对于那些任务有相互依赖的情况，比如 B 依赖 A 的结果，我们一般是做完 A 再做 B，那如果是 B 部分依赖 A 呢？实际场景，A 是生产者且一直生产，B 是消费者且一直消费，这种单线程如何优雅实现呢？

答案是协程，在 JavaScript 里即 [Generator 函数](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator)。实现上述过程的代码：

```javascript
function* consumer() {
    while(true) { console.log('consumer'); yield p; }
}

function* provider() {
    while(true) { console.log('provider'); yield c; }
}

var c = consumer(), p = provider();
var current = p, i = 0;

do { current = current.next().value; } while(i++ < 10);
```

所以 Generator（协程）作用只有一个，在用户态可以细粒度地控制任务的切换。至于使用 [co](https://github.com/tj/co) 包裹后达到同步的效果那是另一件事了，仅仅是因为 co 利用这个控制能力在异步 callback 回来时可以手动恢复到之前执行的位置继续执行。再深究的话你会发现即使 co 包裹后的 Generator 函数执行也是立即返回的，也就是 Generator 函数并不能真的让异步变同步，顶多是把逻辑上有顺序的代码在局部做到**看起来**同步。

JavaScript 因为自身限制，借助 Runtime 各种奇技淫巧还是比较完美地解决了并发问题，但是回头看，还是不如那些天然支持多线程的语言来的优雅。多线程处理并发更像 React 借助 [Virtual DOM](https://reactjs.org/docs/faq-internals.html) 处理 UI 渲染，关注的问题是收敛的，而 JavaScript 这一套方案下来，会有种不断打补丁的感觉。

## 异步 I/O

我们说同步和异步时，大多时候说的是 I/O 操作，而 I/O 操作一般是慢的，因为 I/O 操作会跟外部设备打交道，比如文件读写操作硬盘、网络请求操作网卡等。

所谓同步就是进程进行 I/O 操作时**从用户态看**是被阻塞了的，要么是一直挂起等待内核（I/O 底层由内核驱动）准备数据，要么一直主动检查数据是否准备好。这里为了便于理解，可以认为一直在检查。

![](https://cdn.int64ago.org/97133b87-f4d3-42cb-90be-504f73b0b118.png)

从社会分工经验看，这类无聊重复的轮询工作不应该分散在各个日常工作中（主线程），应该由其它工种（独立线程）批量做。注意，即使轮询工作交出去了，这部分工作也并没有凭空消失，哪有什么岁月静好，不过是有人替你负重前行罢了。

当然，这些操作系统早就提供好整套解决方案了，因为不同操作系统会不一样，为了跨平台，就出现了一些独立的库屏蔽这些差异，比如 NodeJS 重要组成部分的 [libuv](https://github.com/libuv/libuv)。

> 实际实践中并不是这么简单的，有时会结合 [线程池](https://en.wikipedia.org/wiki/Thread_pool)，而且除了同步和异步，还有 [其它维度](https://notes.shichao.io/unp/ch6/#io-models)。

## Event Loop

上面提到的帮你负重前行的就是 Event Loop（及相关配套）。

这个展开说的话会需要非常长的篇幅，这里只是简单介绍。强烈建议看两个视频：

 - [In The Loop](https://www.youtube.com/watch?v=cCOL7MC4Pl0) （[国内地址](https://www.bilibili.com/video/BV1a4411F7t7)）
 - [What the heck is the event loop anyway?](https://www.youtube.com/watch?v=8aGhZQkoFbQ) （[国内地址](https://www.bilibili.com/video/BV1nx411L7aA)、[可视化 DEMO](http://latentflip.com/loupe)）

如果没时间看可以参照下图：

![](https://cdn.int64ago.org/26686f62-8327-4b1b-8ff5-c5a20e4506ec.png)

1. JavaScript 单线程，Engine 维护了一个栈用于执行进栈的任务；
2. 执行任务的过程可能会调用一些 Runtime 提供的异步接口；
3. Runtime 等待异步任务（如定时器、Promise、文件 I/O、网络请求等）完成后会把 callback 扔到 Task Queue（如定时器）或 Microtask Queue（如 Promise）；
4. JavaScript 主线程栈空了后 Microtask Queue 的任务会依次扔到栈里执行，直到清空，之后会取出一个 Task Queue 里可以执行的任务扔到栈里执行；
5. 周而复始。

> 因为不同 Runtime 机制不太一样，上面仅仅是个大概。

## 问题回顾

看下一开始的问题：NodeJS 里既然有了 `fs.readFile()`（异步）为什么还提供 `fs.readFileSync()`（同步）？

看起来很明显，同步的方式在等待结果返回前会挂起当前线程，也就是期间无法继续执行栈里的指令，也无法响应其它异步任务回调回来的结果。所以通常不推荐同步的方式，但是以下情况还是可以考虑甚至推荐使用同步方式的：

 - 响应时间很短且可控；
 - 无并发诉求，比如 CLI 工具；
 - 通过其它方式开起来多个进程；
 - 对结果准确性要求很高（可能有人好奇为什么异步的结果准确性不高，考虑一个极端情况，在 I/O 完成响应，已经在 Task Queue 等待被处理期间文件被删除了，我们期望的是报错，但结果会被当做成功）。

## 总结

本文从一个问题出发，顺便带着回顾了 JavaScript 的并发、异步和事件循环，总结如下：

 - JavaScript 语言层面是单线程的，它和 Engine 以及 Runtime 共同构成了我们现在看到的样子；
 - JavaScript 使用异步来解决 I/O 的并发场景；
 - Runtime 通过 Web Worker、Child process 等方式可以创建多线程（进程）来充分利用多核 CPU；
 - Event Loop 是实现异步 I/O 的一种方案（不唯一）。

最后，抛个问题，如果 JavaScript 提供了语言层面的创建多线程的方式，又会是怎样一番景象呢？

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
