---
title: Libuv 之 - 只看这篇是不够的
date: 2021-03-31T06:47:54.851Z
description: 对 Node.js 的学习，无论如何都绕不开 Libuv。本文选择沿着 Libuv 的 Linux 实现的脉络对其内部一探究竟
---

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/8001932229/2e2c/df94/7e2c/2ccf735e8c9eb14ef68d9f79eaea6c94.png)

> 图片来源：[libuv](https://github.com/libuv/libuv)

> 本文作者：[肖思元](https://github.com/hsiaosiyuan0)

对 Node.js 的学习，无论如何都绕不开 Libuv。本文选择沿着 Libuv 的 Linux 实现的脉络对其内部一探究竟

## 为什么是 Linux

> As an asynchronous event-driven JavaScript runtime, Node.js is designed to build **scalable network applications**
>
> [About Node.js](https://nodejs.org/en/about/#about-node-js)

Node.js 作为前端同学探索服务端业务的利器，自身是立志可以构建一个具有伸缩性的网络应用程序。目前的服务端环境主要还是 Linux，对于另一个主要的服务端环境 Unix，则在 API 上和 Linux 具有很高相似性，所以选择 Linux 作为起始点，说不定可以有双倍收获和双倍快乐

## Libuv 与 Linux

下面是 libuv 官网的架构图：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7941003946/3336/e900/8dc0/e79e4fa61877a6cb5eebb9bba7fb96cb.png)

单以 Linux 平台来看，libuv 主要工作可以简单划为两部分：

- 围绕 epoll，处理那些被 epoll 支持的 IO 操作
- 线程池（Thread pool），处理那些不被 epoll 支持的 IO 操作

## epoll 简介

为了追本溯源，我们将从 epoll 开始

简单来说，epoll 是由 Linux 内核提供的一个系统调用（system call），我们的应用程序可以通过它：

- 告诉系统帮助我们同时监控多个文件描述符
- 当这其中的一个或者多个文件描述符的 I/O 可操作状态改变时，我们的应用程序会接收到来自系统的事件提示（event notification）

### 事件循环

我们通过一小段伪代码来演示使用 epoll 时的核心步骤：

```cpp
// 创建 epoll 实例
int epfd = epoll_create(MAX_EVENTS);
// 向 epoll 实例中添加需要监听的文件描述符，这里是 `listen_sock`
epoll_ctl_add(epfd, listen_sock, EPOLLIN | EPOLLOUT | EPOLLET);

while(1) {
  // 等待来自 epoll 的通知，通知会在其中的文件描述符状态改变时
  // 由系统通知应用。通知的形式如下：
  //
  // epoll_wait 调用不会立即返回，系统会在其中的文件描述符状态发生
  // 变化时返回
  //
  // epoll_wait 调用返回后：
  // nfds 表示发生变化的文件描述符数量
  // events 会保存当前的事件，它的数量就是 nfds
  int nfds = epoll_wait(epfd, events, MAX_EVENTS, -1);

  // 遍历 events，对事件作出符合应用预期的响应
  for (int i = 0; i < nfds; i++) {
    // consume events[i]
  }
}
```

> 完整例子见 [epoll-echo-server](https://github.com/going-merry0/epoll-echo-server)

上面的代码中已经包含了注释，可以大致概括为下图：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7938926095/59a4/fb8a/04fb/12af868c3b037ed48b518a77a2b9e400.png)

所以处于 libuv 底层的 epoll 也是有「事件循环」的概念，可见事件循环并不是 libuv 独创

提到 epoll，不得不提它的两种触发模式：水平触发（Level-triggered）、边缘触发（Edge-triggered）。不得不提是因为它们关系到 epoll 的事件触发机制，加上名字取得又有些晦涩

### 水平触发

这两个术语都源自电子学领域，我们从它们的原始含义开始理解

首先是水平触发：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7955762915/1ccf/7d9a/886a/d760581088a5655e32bb5655d48908e8.png)

> [Electrical Concepts](https://electricalbaba.com/edge-triggering-and-level-triggering/)

上图是表示电压变化的时序图，VH 表示电压的峰值，VL 表示电话的谷值。水平触发的含义是，随着时间的变化，只要电压处于峰值，系统就会激活对应的电路（触发）

### 边缘触发

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7955741499/0878/105e/b498/b035300c409e916d5f1d4bbe71154b6f.png)

> [Electrical Concepts](https://electricalbaba.com/edge-triggering-and-level-triggering/)

上图依然是表示电压变化的时序图，不过激活电路（触发）的条件是电压的**改变**，即电压由 VH -> VL、VL -> VH 的状态变化，在图中通过**边**来表示这个变化，即 Rising edge 和 Falling edge，所以称为 Edge-triggered 即边缘触发

我们可以大致理解它们的形式与差别，继续结合下面的 epoll 中的表现进行理解

### 在 epoll 中

回到 epoll 中，水平触发和边缘触发作为原始含义的衍生，当然还是具有类似电子学领域中的含义

我们通过一个例子来理解，比如我们有一个 fd（File descriptor） 表示刚建立的客户端连接，随后客户端给我们发送了 5 bytes 的内容，

如果是水平触发：

- 我们的应用会被系统唤醒，因为 fd 此时状态变为了可读
- 我们从系统的缓冲区中读取 1 byte 的内容，并做了一些业务操作
- 进入到新的一次事件循环，等待系统下一次唤醒
- 系统继续唤醒我们的应用，因为缓冲区还有未读取的 4 bytes 内容

如果是边缘触发：

- 我们的应用会被系统唤醒，因为 fd 此时状态变为了可读
- 我们从系统的缓冲区中读取 1 byte 的内容，并做了一些业务操作
- 进入到新的一次事件循环，等待系统下一次唤醒
- 此时系统并不会唤醒我们的应用，直到下一次客户端发送了一些内容，比如发送了 2 bytes（因为直到下一次客户端发送了请求之前，fd 的状态并没有改变，所以在边缘触发下系统不会唤醒应用）
- 系统唤醒我们的应用，此时缓冲区有 6 bytes = (4 + 2) bytes

我们很难将水平触发、边缘触发的字面意思与上面的行为联系起来，好在我们已经预先了解过它们在电子学领域的含义

水平触发，因为已经是可读状态，所以它会一直触发，直到我们读完缓冲区，且系统缓冲区没有新的客户端发送的内容；边缘触发对应的是**状态的变化**，每次有新的客户端发送内容，都会设置可读状态，因此只会在这个时机触发

水平触发是 epoll 默认的触发模式，并且 libuv 中使用的也是水平触发。在了解了水平触发和边缘触发的区别后，我们其实就可以猜测 libuv 使用水平触发而不是边缘触发背后的考量：

如果是边缘触发，在 epoll 的客观能力上，我们不被要求一次读取完缓冲区的内容（可以等到下一次客户端发送内容时继续读取）。但是实际业务中，客户端此时很可能在等待我们的响应（可以结合 HTTP 协议理解），而我们还在等待客户端的下一次写入，因此会陷入死锁的逻辑。由此一来，一次读取完缓冲区的内容几乎就成了边缘触发模式下的必选方式，这就不可避免的造成其他回调的等待时间变长，让 CPU 时间分配在各个回调之间显得不够均匀

### 局限性

epoll 并不能够作用在所有的 IO 操作上，比如文件的读写操作，就无法享受到 epoll 的便利性

所以 libuv 的工作可以大致概括为：

- 将各种操作系统上的类似 epoll 的系统调用（比如 Unix 上的 kqueue 和 Windows 上的 IOCP）抽象出统一的 API（内部 API）
- 对于可以利用系统调用的 IO 操作，优先使用统一后的 API
- 对于不支持或者支持度不够的 IO 操作，使用线程池（Thread pool）的方式模拟出异步 API
- 最后，将上面的细节封装在内部，对外提供统一的 API

## 回到 libuv

回到 libuv，我们将以 event-loop 为主要脉络，结合上文提到的 epoll，以及下面将会介绍到的线程池，继续 libuv 在 Linux 上的实现细节一探究竟

### event-loop

我们将结合源码来回顾一下 event-loop 基本概念

下面这幅图也取自 libuv 官网，它描述了 event-loop 内部的工作：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7941149650/166f/78e5/94d7/cf0de3817e3d4db037e4b05b5c291074.png)

> 引用自 [libuv - Design overview](http://docs.libuv.org/en/v1.x/design.html)

单看流程图可能太抽象，下面是对应的 libuv 内部的实现 [完整内容](https://github.com/libuv/libuv/blob/v1.x/src/unix/core.c#L365)：

```cpp
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  int timeout;
  int r;
  int ran_pending;

  r = uv__loop_alive(loop);
  if (!r) uv__update_time(loop);

  // 是循环，没错了
  while (r != 0 && loop->stop_flag == 0) {
    uv__update_time(loop);
    // 处理 timer 队列
    uv__run_timers(loop);
    // 处理 pending 队列
    ran_pending = uv__run_pending(loop);
    // 处理 idle 队列
    uv__run_idle(loop);
    // 处理 prepare 队列
    uv__run_prepare(loop);

    // 执行 io_poll
    uv__io_poll(loop, timeout);
    uv__metrics_update_idle_time(loop);

    // 执行 check 队列
    uv__run_check(loop);
    // 执行 closing 队列
    uv__run_closing_handles(loop);

    r = uv__loop_alive(loop);
    if (mode == UV_RUN_ONCE || mode == UV_RUN_NOWAIT) break;
  }

  return r;
}
```

之所以各种形式的回调（比如 `setTimeout`）在优先级上会有差别，就在于它们使用的是不同的队列，而不同的队列在每次事件循环的迭代中的执行顺序不同

### Handle 和 Request

按照官网的描述，它们是对 event-loop 中执行的操作的抽象，前者表示需要长期存在的操作，后者表示短暂的操作。单看文字描述可能不太好理解，我们看一下它们的使用方式有何不同

对于 Handle 表示的长期存在的操作来说，它们的 API 具有类似下面的形式：

```cpp
// IO 操作
int uv_poll_init_socket(uv_loop_t* loop, uv_poll_t* handle, uv_os_sock_t socket);
int uv_poll_start(uv_poll_t* handle, int events, uv_poll_cb cb);
int uv_poll_stop(uv_poll_t* poll);

// timer
int uv_timer_init(uv_loop_t* loop, uv_timer_t* handle);
int uv_timer_start(uv_timer_t* handle, uv_timer_cb cb, uint64_t timeout, uint64_t repeat);
int uv_timer_stop(uv_timer_t* handle);
```

大致都有这三个步骤（并不是全部）：`初始化 -> 开始 -> 停止`。很好理解吧，因为是长期存在的操作，它开始了就会持续被处理，所以需要安排一个「停止」的 API

而对于 Request 表示的短暂操作来说，比如域名解析操作：

```cpp
int uv_getaddrinfo(uv_loop_t* loop, uv_getaddrinfo_t* req, uv_getaddrinfo_cb getaddrinfo_cb, /* ... */);
```

域名解析操作的交互形式是，我们提交需要解析的地址，方法会返回解析的结果（这样的感觉似乎有点 HTTP 1.0 请求的样子），所以按「请求 - Request」来命名这样的操作的原因就变得有画面感了

不过 Handle 和 Request 两者不是互斥的概念，Handle 内部实现可能也用到了 Request。因为一些宏观来看的长期操作，在每个时间切片内是可以看成是 Request 的，比如我们处理一个请求，可以看成是一个 Handle，而在当次的请求中，我们很可能会做一些读取和写入的操作，这些操作就可以看成是 Request

### timer

我们通过 timer 开放出来的 API 为线索，来分析它的内部实现：

```cpp
int uv_timer_init(uv_loop_t* loop, uv_timer_t* handle);
int uv_timer_start(uv_timer_t* handle, uv_timer_cb cb, uint64_t timeout, uint64_t repeat);
int uv_timer_stop(uv_timer_t* handle);
```

`uv_timer_init` 没有什么特殊的地方，只是初始化一下 `handle` 的状态，并将其添加到 `loop->handle_queue` 中

`uv_timer_start` 内部做了这些工作：

```cpp
int uv_timer_start(uv_timer_t* handle,
                   uv_timer_cb cb,
                   uint64_t timeout,
                   uint64_t repeat) {
  uint64_t clamped_timeout;

  // loop->time 表示 loop 当前的时间。loop 每次迭代开始时，会用当次时间更新该值
  // clamped_timeout 就是该 timer 未来超时的时间点，这里直接计算好，这样未来就不需要
  // 计算了，直接从 timers 中取符合条件的即可
  if (clamped_timeout < timeout)
    clamped_timeout = (uint64_t) -1;

  handle->timer_cb = cb;
  handle->timeout = clamped_timeout;
  handle->repeat = repeat;

  // 除了预先计算好的 clamped_timeout 以外，未来当 clamped_timeout 相同时，使用这里的
  // 自增 start_id 作为比较条件来觉得 handle 的执行先后顺序
  handle->start_id = handle->loop->timer_counter++;

  // 将 handle 插入到 timer_heap 中，这里的 heap 是 binary min heap，所以根节点就是
  // clamped_timeout 值（或者 start_id）最小的 handle
  heap_insert(timer_heap(handle->loop),
              (struct heap_node*) &handle->heap_node,
              timer_less_than);
  // 设置 handle 的开始状态
  uv__handle_start(handle);

  return 0;
}
```

`uv_timer_stop` 内部做了这些工作：

```cpp
int uv_timer_stop(uv_timer_t* handle) {
  if (!uv__is_active(handle))
    return 0;

  // 将 handle 移出 timer_heap，和 heap_insert 操作一样，除了移出之外
  // 还会维护 timer_heap 以保障其始终是 binary min heap
  heap_remove(timer_heap(handle->loop),
              (struct heap_node*) &handle->heap_node,
              timer_less_than);
  // 设置 handle 的状态为停止
  uv__handle_stop(handle);

  return 0;
}
```

到目前为止，我们已经知道所谓的 `start` 和 `stop` 其实可以粗略地概括为，往属性 `loop->timer_heap` 中插入或者移出 handle，并且这个属性使用一个名为 binary min heap 的数据结构

然后我们再回顾上文的 `uv_run`：

```cpp
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  // ...
  while (r != 0 && loop->stop_flag == 0) {
    // ...
    uv__update_time(loop);
    uv__run_timers(loop);
    // ...
  }
  // ...
}
```

`uv__update_time` 我们已经见过了，作用就是在循环开头阶段、使用当前时间设置属性 `loop->time`

我们只需要最后看一下 `uv__run_timers` 的内容，就可以串联整个流程：

```cpp
void uv__run_timers(uv_loop_t* loop) {
  struct heap_node* heap_node;
  uv_timer_t* handle;

  for (;;) {
    // 取根节点，该值保证始终是所有待执行的 handle
    // 中，最先超时的那一个
    heap_node = heap_min(timer_heap(loop));
    if (heap_node == NULL)
      break;

    handle = container_of(heap_node, uv_timer_t, heap_node);
    if (handle->timeout > loop->time)
      break;

    // 停止、移出 handle、顺便维护 timer_heap
    uv_timer_stop(handle);
    // 如果是需要 repeat 的 handle，则重新加入到 timer_heap 中
    // 会在下一次事件循环中、由本方法继续执行
    uv_timer_again(handle);
    // 执行超时 handle 其对应的回调
    handle->timer_cb(handle);
  }
}
```

以上，就是 timer 在 Libuv 中的大致实现方式

#### min heap

后面我们会看到，除了 timer 之外的 handle 都存放在名为 queue 的数据结构中，而存放 timer handle 的数据结构则为 min heap。那么我们就来看看这样的差别选择有何深意

所谓 min heap 其实是（如需更全面的介绍，可以参考 [Binary Tree](https://www.geeksforgeeks.org/binary-tree-set-3-types-of-binary-tree/)）：

- complete binary tree
- 根节点为真个 tree 中最小的节点

先看 binary tree（二元树的定义是）：

- 所有节点都只有最多两个子节点

进一步看 complete binary tree 的定义则是：

- 除了最后一层以外，其余层中的每个节点**都有两个**子节点
- 最后一层的摆布逻辑是，从左往右依次摆放（尽量填满左边）

下面是几个例子：

```
complete binary tree 的例子：

               18
            /      \
         15         30
        /  \        /  \
      40    50    100   40
     /  \   /
    8   7  9

下面不是 complete binary tree，因为最后一层没有优先放满左边

               18
             /    \
          40       30
                   /  \
                 100   40

min heap 的例子，根节点是最小值、父节点始终小于其子节点：

               18
             /    \
           40       30
         /  \
      100   40
```

在 libuv 中对 timer handle 所需的操作是：

- 添加和移除 timer handle
- 快速拿到 `clamped_timeout` 最小的 timer handle

而 min heap 兼顾了上面的需求：

- 相对数组而言，具有更高的插入和移除的效率
- 相对链表而言，具有更高的效率来维护极值（这里是最小值）

heap 的实现在文件是 [heap-inl.h](https://github.com/going-merry0/libuv/blob/feature/learn/src/heap-inl.h)，我加入了一些注释，有兴趣的同学可以继续一探究竟

### pending

上面，我们已经了解了每次事件循环迭代中、处于第一顺位的 timer 的处理，接下来我们来看处在第二顺位的 pending 队列的处理：

```cpp
static int uv__run_pending(uv_loop_t* loop) {
  QUEUE* q;
  QUEUE pq;
  uv__io_t* w;

  if (QUEUE_EMPTY(&loop->pending_queue))
    return 0;

  QUEUE_MOVE(&loop->pending_queue, &pq);

  // 不断从队列中弹出元素进行操作
  while (!QUEUE_EMPTY(&pq)) {
    q = QUEUE_HEAD(&pq);
    QUEUE_REMOVE(q);
    QUEUE_INIT(q);
    w = QUEUE_DATA(q, uv__io_t, pending_queue);
    w->cb(loop, w, POLLOUT);
  }

  return 1;
}
```

从源码来看，仅仅是从队列 `loop->pending_queue` 中不断弹出元素然后执行，并且弹出的元素是 `uv__io_t` 结构体的属性，从名字来看大致应该是 IO 相关的操作

另外，对 `loop->pending_queue` 进行插入操作的只有函数 [uv__io_feed](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/core.c#L951)，该函数的被调用点基本是执行一些 IO 相关的收尾工作

#### queue

和上文出现的 min heap 一样，queue 也是主要用到的数据结构，所以我们在第一次见到它的时候、顺便介绍一下

min heap 的实现相对更深一些，所以提供了基于源码的注释 [heap-inl.h](https://github.com/going-merry0/libuv/blob/feature/learn/src/heap-inl.h) 让感兴趣的读者深入了解一下，而 queue 则相对就简单一些，加上源码中随处会出现操作 queue 的宏，了解这些宏到底做了什么、会让阅读源码时更加安心

接下来我们就一起看看 queue 和一些常用的操作它的宏，首先是起始状态：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7986238068/35fb/5bea/944c/0027a6af84e5f63a49184f26ee255f17.png)

queue 在 libuv 中被设计成一个环形结构，所以起始状态就是 `next` 和 `prev` 都指向自身

接下来我们来看一下往 queue 插入一个新的元素是怎样的形式：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7986351845/495d/3526/5a0e/6d163b1b53f673961b10ec91b21fa7a5.png)

上图分两部分，上半部分是已有的 queue、h 表示其当前的 head，q 是待插入的元素。下半部分是插入后的结果，图中的红色表示 `prev` 的通路，紫色表示 `next` 的通路，顺着通路我们可以发现它们始终是一个环形结构

上图演示的 `QUEUE_INSERT_TAIL` 顾名思义是插入到队尾，而因为是环形结构，我们需要修改头、尾、待插入元素三者的引用关系

再看一下移除某个元素的形式：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7986479363/54d8/127a/5b85/284084afa095df87776e847a2a474121.png)

移除某个元素就比较简单了，就是将该元素的 `prev` 和 `next` 连接起来即可，这样连接后，就跳过了该元素，使得该元素呈现出被移除的状态（无法在通路中访问到）

继续看下连接两个队列的操作：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7986591045/4cd2/3fb6/7361/6bc02c35d355d1d2924bd79e0467e04a.png)

看上去貌似很复杂，其实就是把两个环先解开，然后首尾相连成为一个新的环即可。这里通过意识流的作图方式，使用 `1` 和 `2` 标注了代码和连接动作的对应关系

最后看一下将队列一分为二的操作：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/7997332883/d325/4341/d5d5/ebe1a11cb909a1c8cc2221920cbe91cb.png)

上图同样通过意识流的作图方式，使用 `1` 和 `2` 标注了代码和连接动作的对应关系；将原本以 `h` 开头的 queue，在 `q` 处剪开，`h` 和 `q` 之前的元素相连接成为一个新的 queue；`n` 作为另一个 queue 的开头，连接 `q` 和断开前的队列的末尾，构成另一个 queue

上面演示了一些具有有代表性的 queue 操作，感兴趣的同学可以继续查看 [queue.h](https://github.com/going-merry0/libuv/blob/feature/learn/src/queue.h) 来一探究竟

### idle，check，prepare

大家或许会奇怪，为什么没有按照它们在事件循环中的顺序进行介绍，而且还把它们三个放在了一起

如果大家在源码中搜索 `uv__run_idle` 或者 `uv__run_check` 会更加奇怪，因为我们只能找到它们的声明，甚至找不到它们的定义

其实它们都是在 [loop-watcher.c](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/loop-watcher.c) 中通过宏生成的，因为它们的操作都是一样的 - 从各自的队列中取出 handle 然后执行即可

需要说明的是，大家不要被 idle 的名字迷惑了，它并不是事件循环闲置的时候才会执行的队列，而是在每次时间循环迭代中，都会执行的，完全没有 idle 之意

不过要说完全没有 idle 之意似乎也不是特别合适，比如 idle 和 prepare 队列在内部实现上，无非是先后执行的队列而已：

```cpp
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  // ...
  while (r != 0 && loop->stop_flag == 0) {
    // ...
    uv__run_idle(loop);
    uv__run_prepare(loop);
    uv__io_poll(loop, timeout);
    // ...
  }
  // ...
}
```

那么现在有一个 handle，我们希望它在 `uv__io_poll` 之前执行，是添加到 idle 还是 prepare 队列中呢？

我觉得 prepare 是取「为了下面的 `uv__io_poll` 做准备」之意，所以如果是为了 io_poll 做准备的 handle，那么可以添加到 prepare 队列中，其余则可以添加到 idle 之中。同样的设定我觉得也适用于 check，它运行在 io_poll 之后，可以让用户做一些检验 IO 执行结果的工作，让任务队列更加语义化

### io poll

对于 io_poll 我们还是从事件循环开始分析

#### 从事件循环开始

下面是上文已经介绍过的事件循环的片段：

```cpp
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  // ...
  while (r != 0 && loop->stop_flag == 0) {
    // ...
    timeout = 0;
    if ((mode == UV_RUN_ONCE && !ran_pending) || mode == UV_RUN_DEFAULT)
      timeout = uv_backend_timeout(loop);

    uv__io_poll(loop, timeout);
    // ...
  }
  // ...
}
```

上面的代码计算了一个 `timeout` 用于调用 `uv__io_poll(loop, timeout)`

#### 的确是 epoll

`uv__io_poll` 定义在 [linux-core.c](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/linux-core.c#L191) 中，虽然这是一个包含注释在内接近 300 行的函数，但想必大家也发现了，其中的核心逻辑就是开头演示的 epoll 的用法：

```cpp
void uv__io_poll(uv_loop_t* loop, int timeout) {
  while (!QUEUE_EMPTY(&loop->watcher_queue)) {
    // ...
    // `loop->backend_fd` 是使用 `epoll_create` 创建的 epoll 实例
    epoll_ctl(loop->backend_fd, op, w->fd, &e)
    // ...
  }

  // ...
  for (;;) {
  // ...
    if (/* ... */) {
      // ...
    } else {
      // ...
      // `epoll_wait` 和 `epoll_pwait` 只有细微的差别，所以这里只考虑前者
      nfds = epoll_wait(loop->backend_fd,
                        events,
                        ARRAY_SIZE(events),
                        timeout);
      // ...
    }
  }
  // ...

  for (i = 0; i < nfds; i++) {
    // ...
    w = loop->watchers[fd];
    // ...
    w->cb(loop, w, pe->events);
  }
}
```

#### timeout

`epoll_wait` 的 `timeout` 参数的含义是：

- 如果是 `-1` 表示一直等到有事件产生
- 如果是 `0` 则立即返回，包含调用时产生的事件
- 如果是其余整数，则以 `milliseconds` 为单位，规约到未来某个系统时间片内

结合上面这些，我们看下 `uv_backend_timeout` 是如何计算 `timeout` 的：

```cpp
int uv_backend_timeout(const uv_loop_t* loop) {
  // 时间循环被外部停止了，所以让 `uv__io_poll` 理解返回
  // 以便尽快结束事件循环
  if (loop->stop_flag != 0)
    return 0;

  // 没有待处理的 handle 和 request，则也不需要等待了，同样让 `uv__io_poll`
  // 尽快返回
  if (!uv__has_active_handles(loop) && !uv__has_active_reqs(loop))
    return 0;

  // idle 队列不为空，也要求 `uv__io_poll` 尽快返回，这样尽快进入下一个时间循环
  // 否则会导致 idle 产生过高的延迟
  if (!QUEUE_EMPTY(&loop->idle_handles))
    return 0;

  // 和上一步目的一样，不过这里是换成了 pending 队列
  if (!QUEUE_EMPTY(&loop->pending_queue))
    return 0;

  // 和上一步目的一样，不过这里换成，待关闭的 handles，都是为了避免目标队列产生
  // 过高的延迟
  if (loop->closing_handles)
    return 0;

  return uv__next_timeout(loop);
}

int uv__next_timeout(const uv_loop_t* loop) {
  const struct heap_node* heap_node;
  const uv_timer_t* handle;
  uint64_t diff;

  heap_node = heap_min(timer_heap(loop));
  // 如果没有 timer 待处理，则可以放心的 block 住，等待事件到达
  if (heap_node == NULL)
    return -1; /* block indefinitely */

  handle = container_of(heap_node, uv_timer_t, heap_node);
  // 有 timer，且 timer 已经到了要被执行的时间内，则需让 `uv__io_poll`
  // 尽快返回，以在下一个事件循环迭代内处理超时的 timer
  if (handle->timeout <= loop->time)
    return 0;

  // 没有 timer 超时，用最小超时间减去、当前的循环时间的差值，作为超时时间
  // 因为在为了这个差值时间内是没有 timer 超时的，所以可以放心 block 以等待
  // epoll 事件
  diff = handle->timeout - loop->time;
  if (diff > INT_MAX)
    diff = INT_MAX;

  return (int) diff;
}
```

上面的 `uv__next_timeout` 实现主要分为三部分：

- 只有在没有 timer 待处理的时候，才会是 `-1`，结合本节开头对 `epoll_wait` 的 `timeout` 参数的解释，`-1` 会让后续的 `uv__io_poll` 进入 block 状态、完全等待事件的到达
- 当有 timer，且有超时的 timer `handle->timeout <= loop->time`，则返回 `0`，这样 `uv__io_poll` 不会 block 住事件循环，目的是为了快速进入下一次事件循环、以执行超时的 timer
- 当有 timer，不过都没有超时，则计算最小超时时间 `diff` 来作为 `uv__io_poll` 的阻塞时间

不知道大家发现没有，timeout 的计算，其核心指导思想就是要尽可能的让 CPU 时间能够在事件循环的多次迭代的、多个不同任务队列的执行、中尽可能的分配均匀，避免某个类型的任务产生很高的延迟

#### 小栗子

了解了 io_poll 队列是如何执行之后，我们通过一个 echo server 的小栗子，来对 io_poll 有个整体的认识：

```cpp
uv_loop_t *loop;

void echo_write(uv_write_t *req, int status) {
  // ...
  // 一些无所谓有，但有所谓无的收尾工作
}

void echo_read(uv_stream_t *client, ssize_t nread, uv_buf_t buf) {
  // ...
  // 创建一个写入请求（上文已经介绍过 Request 和 Handle 的区别），
  // 将读取的客户端内容写回给客户端，写入完成后进入回调 `echo_write`
  uv_write_t *write_req = (uv_write_t*)malloc(sizeof(uv_write_t));
  uv_write(write_req, client, &buf, 1, echo_write);
}

void on_new_connection(uv_stream_t *server, int status) {
  // ...
  // 创建 client 实例并关联到事件循环
  uv_tcp_t *client = (uv_tcp_t*) malloc(sizeof(uv_tcp_t));
  uv_tcp_init(loop, client);
  // 与建立客户端连接，并读取客户端输入，读取完成后进入 `echo_read` 回调
  if (uv_accept(server, (uv_stream_t*) client) == 0) {
    uv_read_start((uv_stream_t*) client, alloc_buffer, echo_read);
  }
  // ...
}

int main() {
  // 创建事件循环
  loop = uv_default_loop();

  // 创建 server 实例并关联事件循环
  uv_tcp_t server;
  uv_tcp_init(loop, &server);
  // ...
  // 绑定 server 到某个端口，并接受请求
  uv_tcp_bind(&server, uv_ip4_addr("0.0.0.0", 7000));
  // 新的客户端请求到达后，会进去到 `on_new_connection` 回调
  uv_listen((uv_stream_t*) &server, 128, on_new_connection);
  // ...

  // 启动事件循环
  return uv_run(loop, UV_RUN_DEFAULT);
}
```

### Thead pool

到目前为止，我们已经确认过 io_poll 内部实现确实是使用的 epoll。在本文的开头，我们也提到 epoll 目前并不能处理所有的 IO 操作，对于那些 epoll 不支持的 IO 操作，libuv 统一使用其内部的线程池来模拟出异步 IO。接下来我们看看线程池的大致工作形式

#### 创建

因为我们已经知道读写文件的操作是无法使用 epoll 的，那么就顺着这个线索，通过 [uv_fs_read](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/fs.c#L1891) 的内部实现，找到 [uv__work_submit](https://github.com/going-merry0/libuv/blob/feature/learn/src/threadpool.c#L256) 方法，发现是在其中初始化的线程池：

```cpp
void uv__work_submit(uv_loop_t* loop,
                     struct uv__work* w,
                     enum uv__work_kind kind,
                     void (*work)(struct uv__work* w),
                     void (*done)(struct uv__work* w, int status)) {
  uv_once(&once, init_once);
  // ...
  post(&w->wq, kind);
}
```

所以线程池的创建、是一个延迟创建的单例。`init_once` 内部会调用 [init_threads](https://github.com/going-merry0/libuv/blob/feature/learn/src/threadpool.c#L188) 来完成线程池初始化工作：

```cpp
static uv_thread_t default_threads[4];

static void init_threads(void) {
  // ...
  nthreads = ARRAY_SIZE(default_threads);
  val = getenv("UV_THREADPOOL_SIZE");
  // ...
  for (i = 0; i < nthreads; i++)
    if (uv_thread_create(threads + i, worker, &sem))
      abort();
  // ...
}
```

通过上面的实现，我们知道默认的线程池中线程的数量是 `4`，并且可以通过 `UV_THREADPOOL_SIZE` 环境变量重新指定该数值

除了对线程池进行单例延迟创建，`uv__work_submit` 当然还是会提交任务的，这部分工作是由 `post(&w->wq, kind)` 完成的，我们来看下 [post](https://github.com/going-merry0/libuv/blob/feature/learn/src/threadpool.c#L142:13) 方法的实现细节：

```cpp
static void post(QUEUE* q, enum uv__work_kind kind) {
  uv_mutex_lock(&mutex);
  // ...
  // 将任务插入到 `wq` 这个线程共享的队列中
  QUEUE_INSERT_TAIL(&wq, q);
  // 如果有空闲线程，则通知它们开始工作
  if (idle_threads > 0)
    uv_cond_signal(&cond);
  uv_mutex_unlock(&mutex);
}
```

可以发现对于提交任务，其实就是将任务插入到线程共享队列 `wq`，并且有空闲线程时才会通知它们工作。那么，如果此时没有空闲线程的话，是不是任务就被忽略了呢？答案是否，因为工作线程会在完成当前工作后，主动检查 `wq` 队列是否还有待完成的工作，有的话会继续完成，没有的话，则进入睡眠，等待下次被唤醒（后面会继续介绍这部分细节）

#### 任务如何调度

上面在创建线程的时候 `uv_thread_create(threads + i, worker, &sem)` 中的 `worker` 就是线程执行的内容，我们来看下 [worker](https://github.com/going-merry0/libuv/blob/feature/learn/src/threadpool.c#L57) 的大致内容：

```cpp
// 线程池的 wq，提交的任务都先链到其中
static QUEUE wq;

static void worker(void* arg) {
  // ...
  // `idle_threads` 和 `run_slow_work_message` 这些是线程共享的，所以要加个锁
  uv_mutex_lock(&mutex);
  for (;;) {
    // 这里的条件判断，可以大致看成是「没有任务」为 true
    while (QUEUE_EMPTY(&wq) ||
           (QUEUE_HEAD(&wq) == &run_slow_work_message &&
            QUEUE_NEXT(&run_slow_work_message) == &wq &&
            slow_io_work_running >= slow_work_thread_threshold())) {
      // 轮转到当前进程时因为没有任务，则无事可做
      // 空闲线程数 +1
      idle_threads += 1;
      
      // `uv_cond_wait` 内部是使用 `pthread_cond_wait` 调用后会：
      // - 让线程进入等待状态，等待条件变量 `cond` 发生变更
      // - 对 `mutex` 解锁
      //
      // 此后，其他线程中均可使用 `uv_cond_signal` 内部是 `pthread_cond_signal` 
      // 来广播一个条件变量 `cond` 变更的事件，操作系统内部会随机唤醒一个等待 `cond` 
      // 变更的线程，并在被唤醒线程的 uv_cond_wait 调用返回之前，对之前传入的 `mutex` 
      // 参数上锁
      //
      // 因此循环跳出（有任务）后，`mutex` 一定是上锁的
      uv_cond_wait(&cond, &mutex);
      idle_threads -= 1;
    }
    // ...
    // 因为上锁了，所以放心进行队列的弹出操作
    q = QUEUE_HEAD(&wq);
    QUEUE_REMOVE(q);
    // ...
    // 因为已经完成了弹出，可以解锁，让其他线程可以继续操作队列
    uv_mutex_unlock(&mutex);

    // 利用 c 结构体的小特性，做字段偏移，拿到 `q` 所属的 `uv__work` 实例
    w = QUEUE_DATA(q, struct uv__work, wq);
    w->work(w);

    // 下面要操作 `w->loop->wq` 所以要上锁
    uv_mutex_lock(&w->loop->wq_mutex);
    w->work = NULL; 

    // 需要看仔细，和开头部分线程池中的 wq 区别开
    QUEUE_INSERT_TAIL(&w->loop->wq, &w->wq);

    // 唤醒主线程的事件循环
    uv_async_send(&w->loop->wq_async);
    uv_mutex_unlock(&w->loop->wq_mutex);

    // 这一步上锁是必须的，因为下次迭代的开头又需要
    // 操作共享内存，不过不必担心死锁，因为它和下一次迭代
    // 中的 `uv_cond_wait` 解锁操作是对应的
    uv_mutex_lock(&mutex);
    // ...
  }
}
```

上面我们保留了相对重要的内容，并加以注释。可以大致地概括为：

- 对于线程池中的线程，会通过 `uv_cond_wait` 来等待被唤醒
- 线程被唤醒后就从 `wq` 中主动找一个任务做，完成任务就唤醒主线程，因为回调需要在主线程被执行
- 随后就进入下一次迭代，如果有任务，就继续完成，直至没有任务时，通过 `uv_cond_wait` 再次进入睡眠状态
- 唤醒是通过在另外的线程中使用 `uv_cond_signal` 来通知操作系统做调度
- 线程池是一个可伸缩的设计，当一个任务都没有时，线程会都进入睡眠状态，当任务逐渐增多时，会由活动的线程尝试唤醒睡眠中的线程

#### 唤醒主线程

当线程池完成任务后，需要通知主线程执行对应的回调。通知的方式很有意思，我们先来看下事件循环初始化操作 [uv_loop_init](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/loop.c#L30)：

```cpp
int uv_loop_init(uv_loop_t* loop) {
  // ...
  // 初始化 min heap 和各种队列，用于存放各式的 handles
  heap_init((struct heap*) &loop->timer_heap);
  QUEUE_INIT(&loop->wq);
  QUEUE_INIT(&loop->idle_handles);
  QUEUE_INIT(&loop->async_handles);
  QUEUE_INIT(&loop->check_handles);
  QUEUE_INIT(&loop->prepare_handles);
  QUEUE_INIT(&loop->handle_queue);

  // ...
  // 调用 `epoll_create` 创建 epoll 实例
  err = uv__platform_loop_init(loop);
  if (err)
    goto fail_platform_init;

  // ...
  // 用于线程池通知的初始化
  err = uv_async_init(loop, &loop->wq_async, uv__work_done);
  // ...
}
```

上面的代码中 [uv_async_init](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/async.c#L45) 是用于初始化线程池通知相关的工作，下面是它的函数签名：

```cpp
int uv_async_init(uv_loop_t* loop, uv_async_t* handle, uv_async_cb async_cb);
```

所以第三个实参 [uv__work_done](https://github.com/going-merry0/libuv/blob/feature/learn/src/threadpool.c#L295) 其实是一个回调函数，我们可以看下它的内容：

```cpp
void uv__work_done(uv_async_t* handle) {
  struct uv__work* w;
  uv_loop_t* loop;
  QUEUE* q;
  QUEUE wq;
  int err;

  loop = container_of(handle, uv_loop_t, wq_async);
  uv_mutex_lock(&loop->wq_mutex);
  // 将目前的 `loop->wq` 全部移动到局部变量 `wq` 中，
  //
  // `loop->wq` 中的内容是在上文 worker 中任务完成后使用
  // `QUEUE_INSERT_TAIL(&w->loop->wq, &w->wq)` 添加的
  //
  // 这样尽快释放锁，让其他任务可尽快接入
  QUEUE_MOVE(&loop->wq, &wq);
  uv_mutex_unlock(&loop->wq_mutex);

  // 遍历 `wq` 执行其中每个任务的完成回调
  while (!QUEUE_EMPTY(&wq)) {
    q = QUEUE_HEAD(&wq);
    QUEUE_REMOVE(q);

    w = container_of(q, struct uv__work, wq);
    err = (w->work == uv__cancelled) ? UV_ECANCELED : 0;
    w->done(w, err);
  }
}
```

知道了 `uv__work_done` 就是负责执行任务完成回调的工作后，继续看一下 `uv_async_init` 的内容，看看其内部是如何使用 `uv__work_done` 的：

```cpp
int uv_async_init(uv_loop_t* loop, uv_async_t* handle, uv_async_cb async_cb) {
  // ...
  // 待调查
  err = uv__async_start(loop);
  // ...

  // 创建了一个 async handle
  uv__handle_init(loop, (uv_handle_t*)handle, UV_ASYNC);
  // 在目前的脉络中 `async_cb` 就是 `uv__work_done` 了
  handle->async_cb = async_cb;
  handle->pending = 0;

  // 把 async handle 加入到队列 `loop->async_handles` 中
  QUEUE_INSERT_TAIL(&loop->async_handles, &handle->queue);
  // ...
}
```

我们继续看一下之前待调查的 [uv__async_start](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/async.c#L202) 的内容：

```cpp
static int uv__async_start(uv_loop_t* loop) {
  // ...
  // `eventfd` 可以创建一个 epoll 内部维护的 fd，该 fd 可以和其他真实的 fd（比如 socket fd）一样
  // 添加到 epoll 实例中，可以监听它的可读事件，也可以对其进行写入操作，因此就用户代码就可以借助这个
  // 看似虚拟的 fd 来实现的事件订阅了
  err = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  if (err < 0)
    return UV__ERR(errno);

  pipefd[0] = err;
  pipefd[1] = -1;
  // ...

  uv__io_init(&loop->async_io_watcher, uv__async_io, pipefd[0]);
  uv__io_start(loop, &loop->async_io_watcher, POLLIN);
  loop->async_wfd = pipefd[1];

  return 0;
}
```

我们知道 epoll 是支持 socket fd 的，对于支持的 fd，epoll 的事件调度将非常的高效。而对于不支持的 IO 操作，libuv 则使用 `eventfd` 创建一个虚拟的 fd，继续利用 fd 的事件调度功能

我们继续看下上面出现的 [uv__io_start](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/core.c#L882) 的细节，来确认一下事件订阅的步骤：

```cpp
void uv__io_start(uv_loop_t* loop, uv__io_t* w, unsigned int events) {
  // ...

  // 大家可以翻到上面 `uv__io_poll` 的部分，会发现其中有遍历 `loop->watcher_queue`
  // 将其中的 fd 都加入到 epoll 实例中，以订阅它们的事件的动作
  if (QUEUE_EMPTY(&w->watcher_queue))
    QUEUE_INSERT_TAIL(&loop->watcher_queue, &w->watcher_queue);

  // 将 fd 和对应的任务关联的操作，同样可以翻看上面的 `uv__io_poll`，当接收到事件
  // 通知后，会有从 `loop->watchers` 中根据 fd 取出任务并执行其完成回调的动作
  // 另外，根据 fd 确保 watcher 不会被重复添加
  if (loop->watchers[w->fd] == NULL) {
    loop->watchers[w->fd] = w;
    loop->nfds++;
  }
}
```

确认了事件订阅步骤以后，我们来看下事件回调的内容。上面的形参 `w` 在我们目前的脉络中，对应的实参是 `loop->async_io_watcher`，而它是通过 `uv__io_init(&loop->async_io_watcher, uv__async_io, pipefd[0])` 初始化的，我们看一下 `uv__io_init` 的函数签名：

```cpp
void uv__io_init(uv__io_t* w, uv__io_cb cb, int fd);
```

所以 [uv__async_io](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/async.c#L122) 是接收到虚拟 fd 事件的回调函数，继续看下它的内容：

```cpp
static void uv__async_io(uv_loop_t* loop, uv__io_t* w, unsigned int events) {
  // ...
  // 确保 `w` 必定是 `loop->async_io_watcher`
  assert(w == &loop->async_io_watcher);

  for (;;) {
    // 从中读一些内容，`w->fd` 就是上面使用 `eventfd` 创建的虚拟 fd
    // 不出意外的话，通知那端的方式、一定是往这个 fd 里面写入一些内容，我们可以后面继续确认
    // 从中读取一些内容的目的是避免缓冲区被通知所用的不含实际意义的字节占满
    r = read(w->fd, buf, sizeof(buf));
    // ...
  }

  // 执行 `loop->async_handles` 队列，任务实际的回调
  QUEUE_MOVE(&loop->async_handles, &queue);
  while (!QUEUE_EMPTY(&queue)) {
    q = QUEUE_HEAD(&queue);
    h = QUEUE_DATA(q, uv_async_t, queue);

    QUEUE_REMOVE(q);
    QUEUE_INSERT_TAIL(&loop->async_handles, q);

    // ...
    h->async_cb(h);
  }
}
```

我们已经知道了事件的订阅，以及事件响应的方式

接着继续确认一下事件通知是如何在线程池中触发的。[uv_async_send](http://docs.libuv.org/en/v1.x/async.html?highlight=uv_async_send#c.uv_async_send) 是唤醒主线程的开放 API，它其实是调用的内部 API [uv__async_send](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/async.c#L168)：

```cpp
static void uv__async_send(uv_loop_t* loop) {
  const void* buf;
  ssize_t len;
  int fd;
 
  // ...
  fd = loop->async_io_watcher.fd; 

  do
    // 果然事件通知这一端就是往 `eventfd` 创建的虚拟 fd 写入数据
    // 剩下的就是交给 epoll 高效的事件调度机制唤醒事件订阅方就可以了
    r = write(fd, buf, len);
  while (r == -1 && errno == EINTR);

  // ...
}
```

我们最后通过一副意识流的图，对上面的线程池的流程进行小结：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/8159712870/9e01/5f45/fa15/0fde2cccd1f6b2222b71b2863bec1b84.png)

上图中我们的任务是在 `uv__run_idle(loop);` 执行的回调中通过 `uv__work_submit` 完成的，但是实际上，对于使用事件循环的应用而言，整个应用的时间片都划分在了各个不同的队列回调中，所以实际上、从其余的队列中提交任务也是可能的

### closing

我们开头已经介绍过，只有 Handle 才配备了关闭的 API，因为 Request 是一个短暂任务。Handle 的关闭需要使用 [uv_close](https://github.com/going-merry0/libuv/blob/feature/learn/src/unix/core.c#L108)：

```cpp
void uv_close(uv_handle_t* handle, uv_close_cb close_cb) {
  assert(!uv__is_closing(handle));

  handle->flags |= UV_HANDLE_CLOSING;
  handle->close_cb = close_cb;

  switch (handle->type) {
  // 根据不同的 handle 类型，执行各自的资源回收工作
  case UV_NAMED_PIPE:
    uv__pipe_close((uv_pipe_t*)handle);
    break;

  case UV_TTY:
    uv__stream_close((uv_stream_t*)handle);
    break;

  case UV_TCP:
    uv__tcp_close((uv_tcp_t*)handle);
    break;
  // ...

  default:
    assert(0);
  }
  
  // 添加到 `loop->closing_handles`
  uv__make_close_pending(handle);
}

void uv__make_close_pending(uv_handle_t* handle) {
  assert(handle->flags & UV_HANDLE_CLOSING);
  assert(!(handle->flags & UV_HANDLE_CLOSED));
  handle->next_closing = handle->loop->closing_handles;
  handle->loop->closing_handles = handle;
}
```

调用 `uv_close` 关闭 Handle 后，libuv 会先释放 Handle 占用的资源（比如关闭 fd），随后通过调用 `uv__make_close_pending` 把 handle 连接到 `closing_handles` 队列中，该队列会在事件循环中被 `uv__run_closing_handles(loop)` 调用所执行

使用了事件循环后，业务代码的执行时机都在回调中，由于 `closing_handles` 是最后一个被执行的队列，所以在其余队列的回调中、那些执行 `uv_close` 时传递的回调，都会在当次迭代中被执行

## 小结

本文沿着 Libuv 的 Linux 实现的脉络对其内部实现进行了简单的探索、尝试解开 libuv 的神秘面纱。很显然，只看这篇是不够的，但愿有幸可以作为想深入了解 libuv 的起始读物。后续我们会结合 Node.js 来探究它们内部是如何衔接的

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe (at) corp.netease.com！
