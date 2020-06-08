---
title: 互动直播中的前端技术 -- 即时通讯
date: "2020-06-08T02:24:54.679Z"
description: "在疫情期间，上班族开启了远程办公，体验了各种远程办公软件。老师做起了主播，学生们感受到了被钉钉支配的恐惧，歌手们开启了在线演唱会，许多综艺节目也变成了在线直播。在这全民互动直播的时期，我们来聊聊互动直播中的即时通讯技术在前端中的使用。"
---

![](https://p1.music.126.net/_NuFgEUzjQDbVjRzEtDrdA==/109951164825566883.jpg)
> 本文作者：吴杰

## 前言

在疫情期间，上班族开启了远程办公，体验了各种远程办公软件。老师做起了主播，学生们感受到了被钉钉支配的恐惧，歌手们开启了在线演唱会，许多综艺节目也变成了在线直播。在这全民互动直播的时期，我们来聊聊互动直播中的即时通讯技术在前端中的使用。

## 即时通讯技术
即时通讯（Instant Messaging，简称IM）是一个实时通信系统，允许两人或多人使用网络实时的传递文字消息、文件、语音与视频交流。如何来实现呢，通常我们会使用服务器推送技术来实现。常见的有以下几种实现方式。

### 轮询(polling)
这是一种我们几乎都用到过的的技术实现方案。客户端和服务器之间会一直进行连接，每隔一段时间就询问一次。前端通常采取setInterval或者setTimeout去不断的请求服务器数据。

> 优点：实现简单，适合处理的异步查询业务。

> 缺点：轮询时间通常是死的，太长就不是很实时，太短增加服务器端的负担。不断的去请求没有意义的更新的数据也是一种浪费服务器资源的做法。

### 长轮询(long-polling)
客户端发送一个请求到服务端，如果服务端没有新的数据，就保持住这个连接直到有数据。一旦服务端有了数据（消息）给客户端，它就使用这个连接发送数据给客户端。接着连接关闭。

> 优点：对比轮询做了优化，有较好的时效性。

> 缺点：占较多的内存资源与请求数。

### iframe流
iframe流就是在浏览器中动态载入一个iframe, 让它的地址指向请求的服务器的指定地址（就是向服务器发送了一个http请求），然后在浏览器端创建一个处理数据的函数，在服务端通过iframe与浏览器的长连接定时输出数据给客户端，iframe页面接收到这个数据就会将它解析成代码并传数据给父页面从而达到即时通讯的目的。
> 优点：对比轮询做了优化，有较好的时效性。

> 缺点：兼容性与用户体验不好。服务器维护一个长连接会增加开销。一些浏览器的的地址栏图标会一直转菊花。


### Server-sent Events(sse)
sse与长轮询机制类似，区别是每个连接不只发送一个消息。客户端发送一个请求，服务端保持这个连接直到有新消息发送回客户端，仍然保持着连接，这样连接就可以消息的再次发送，由服务器单向发送给客户端。

> 优点：HTML5 标准；实现较为简单；一个连接可以发送多个数据。

> 缺点：兼容性不好（IE，Edge不支持）；服务器只能单向推送数据到客户端。


### WebSocket

HTML5 WebSocket规范定义了一种API，使Web页面能够使用WebSocket协议与远程主机进行双向通信。与轮询和长轮询相比，巨大减少了不必要的网络流量和等待时间。

WebSocket属于应用层协议。它基于TCP传输协议，并复用HTTP的握手通道。但不是基于HTTP协议的，只是在建立连接之前要借助一下HTTP，然后在第一次握手是升级协议为ws或者wss。

![](https://p1.music.126.net/_M-NYmSrF7G7WvwWaOuw7Q==/109951165030525799.png?imageView&thumbnail=600x0)


> 优点：开销小，双向通讯，支持二进制传输。

> 缺点：开发成本高，需要额外做重连保活。

在互动直播场景下，由于本身的实时性要求高，服务端与客户端需要频繁双向通信，因此与它十分契合。

## 搭建自己的IM系统

上面简单的概述了下即时通讯的实现技术，接下来我们就聊聊如何实现自己的IM系统。

从零开始搭建IM系统还是一件比较复杂与繁琐的事情。自己搭建推荐基于[socket.io](https://github.com/socketio/socket.io-client/)来实现。socket.io对即时通讯的封装已经很不错了，是一个比较成熟的库，对不同浏览器做了兼容，提供了各端的方案包括服务端，我们不用关心底层是用那种技术实现进行数据的通信，当然在现代浏览器种基本上是基于WebSocket来实现的。市面上也有不少IM云服务平台，比如[云信](https://netease.im/)，借助第三方的服务也可以快速集成。下面就介绍下前端怎么基于socket.io集成开发。

### 基础的搭建

服务端集成socket.io(有java版本的)，服务端即成可以参考下[这里](https://github.com/socketio/engine.io-server-java)，客户端使用socket.io-client集成。
参考socket.io官方api，订阅生命周期与事件，通过订阅的方式或来实现基础功能。在回调函数执行解析包装等逻辑，最终抛给上层业务使用。

```js
import io from 'socket.io-client';
import EventEmitter from 'EventEmitter';
class Ws extends EventEmitter {
    constructor (options) {
        super();
        //...
        this.init();
    }
    init () {
        const socket  = this.link = io('wss://x.x.x.x');
        socket.on('connect', this.onConnect.bind(this));
        socket.on('message', this.onMessage.bind(this));
        socket.on('disconnect', this.onDisconnect.bind.(this);
        socket.on('someEvent', this.onSomeEvent.bind(this));
    }
    onMessage(msg) {
        const data = this.parseData(msg);
        // ...
        this.$emit('message', data);
    }
}

```

### 消息收发

与服务器或者其他客户端进行消息通讯时通常会基于业务约定协议来封装解析消息。由于都是异步行为，需要有唯一标识来处理消息回调。这里用自增seq来标记。

#### 发送消息
```js
class Ws extends EventEmitter {
    seq = 0;
    cmdTasksMap = {};
    // ...
    sendCmd(cmd, params) {
        return new Promise((resolve, reject) => {
            this.cmdTasksMap[this.seq] = {
                resolve,
                reject
            };
            const data = genPacket(cmd, params, this.seq++);
            this.link.send({ data });
        });
    }
}

```
#### 接受消息 

```js
class Ws extends EventEmitter {
    // ...
    onMessage(packet) {
        const data = parsePacket(packet);
        if (data.seq) {
            const cmdTask = this.cmdTasksMap[data.seq];
            if (cmdTask) {
                if (data.body.code === 200) {
                    cmdTask.resolve(data.body);
                } else {
                    cmdTask.reject(data.body);
                }
                delete this.cmdTasksMap[data.seq];
            }
        }
    }
}

```

## 生产环境中优化

上文只介绍了基础功能的简单封装，在生产环境中使用，还需要对考虑很多因素，尤其是在互动直播场景中，礼物展示，麦序（进行语音通话互动的顺序），聊天，群聊等都强依赖长链接的稳定性，下面就介绍一些兜底与优化措施。

### 连接保持

为了稳定建立长链接与保持长链接。采用了以下几个手段：

- 超时处理
- 心跳包
- 重连退避机制

#### 超时处理

在实际使用中，并不一定每次发送消息都服务端都有响应，可能在客户端已经出现异常了，我们与服务端的通讯方式都是一问一答。基于这一点，我们可以增加超时逻辑来判断是否是发送成功。然后基于回调上层进行有友好提示，进入异常处理。接下来就进一步改造发送逻辑。

```js
class Ws extends EventEmitter {
    // ...
    sendCmd(cmd, params) {
        return new Promise((resolve, reject) => {
            this.cmdTasksMap[this.seq] = {
                resolve,
                reject
            };
            // 加个定时器
            this.timeMap[this.seq] = setTimeout(() => {
                const err = new newTimeoutError(this.seq);
                reject({ ...err });
            }, CMDTIMEOUT);

            const data = genPacket(cmd, params, this.seq++);
            this.link.send({ data });
        });
    }
    onMessage(packet) {
        const data = parsePacket(packet);
        if (data.seq) {
            const cmdTask = this.cmdTasksMap[data.seq];
            if (cmdTask) {
                clearTimeout(this.timeMap[this.seq]);
                delete this.timeMap[this.seq];
                if (data.body.code === 200) {
                    cmdTask.resolve(data.body);
                } else {
                    cmdTask.reject(data.body);
                }
                delete this.cmdTasksMap[data.seq];
            }
        }
    }
}

```
#### 心跳包

> 心跳包: 心跳包就是在客户端和服务器间定时通知对方自己状态的一个自己定义的命令字，按照一定的时间间隔发送，类似于心跳，所以叫做心跳包。

心跳包是检查长链接存活的关键手段，在web端我们通过心跳包是否超时来判断。TCP中已有[keepalive选项](https://en.wikipedia.org/wiki/Keepalive)，为什么要在应用层加入心跳包机制？

 - tcp keepalive检查连接是否存活
 - 应用keepalive检测应用是否正常可响应
 
举个栗子: 服务端死锁，无法处理任何业务请求。但是操作系统仍然可以响应网络层keepalive包。所以我们通常使用空内容的心跳包并设定合适的发送频率与超时时间来作为连接的保持的判断。

 如果服务端只认心跳包作为连接存在判断，那就在连接建立后定时发心跳就行。如果以收到包为判断存活，那就在每次收到消息重置并起个定时器发送心跳包。
 
``` js
class Ws extends EventEmitter {
    // ...
	 onMessage(packet) {
        const data = parsePacket(packet);
        if (data.seq) {
            const cmdTask = this.cmdTasksMap[data.seq];
            if (cmdTask) {
                clearTimeout(this.timeMap[this.seq]);
                if (data.body.code === 200) {
                    cmdTask.resolve(data.body);
                } else {
                    cmdTask.reject(data.body);
                }
                delete this.cmdTasksMap[data.seq];
            }
        }
        this.startHeartBeat();
    }
    startHeartBeat() {
        if (this.heartBeatTimer) {
            clearTimeout(this.heartBeatTimer);
            this.heartBeatTimer = null;
        }
        this.heartBeatTimer = setTimeout(() => {
            // 在sendCmd中指定heartbeat类型seq为0，让业务包连续编号
            this.sendCmd('heartbeat').then(() => {
                // 发送成功了就不管
            }).catch((e) => {
                this.heartBeatError(e);
            });
        }, HEARTBEATINTERVAL);
    }
}

```
#### 重连退避机制

连不上了，重连，还连不上，重连，又连不上，重连。重连是一个保活的手段，但总不能一直重连吧，因此我们要用合理策去重连。

通常服务端会提供lbs（Location Based Services，LBS）接口，来提供最优节点，我们端上要做便是缓存这些地址并设定端上的重连退避机制。按级别次数通常会做以下处理。

- 重连（超时<X次）
- 换连接地址重连 (超时>=X次)
- 重新获取连接地址(X<MAX)
- 上层处理（超过MAX）

在重连X次后选择换地址，在一个地址失败后，选择重新去拿地址再去循环尝试。具体的尝试次数根据实际业务来定。当然在一次又一次失败中做好异常上报，以便于分析解决问题。


### 接受消息优化

在高并发的场景下尤其是聊天室场景，我们要做一定的消息合并与缓冲，来避免过多的UI绘制与应用阻塞。
因此要约定好解析协议，服务端与客户端都做消息合并，并设置消息缓冲。示例如下：

``` js
Fn.startMsgFlushTimer = function () {
    this.msgFlushTimer = setTimeout(() => {
    const msgs = this.msgBuffer.splice(0, BUFFERSIZE);
    // 回调消息通知
    this.onmsgs(msgs);
    if (!this.msgBuffer.length) {
      this.msgFlushTimer = null;
    } else {
      this.startMsgFlushTimer();
    }
  }, MSGBUFFERINTERVAL);
};

```

### 流量优化

#### 持久化存储
在单聊场景中每次都同步全量的会话，历史消息等这是一个很大的代价。此外关闭web也是一种比较容易的操作(基本上就需要重新同步一次)。如果我们用增量的方式去同步就可以减少很多流量。实现增量同步自然想到了web存储。

常用web存储cookie，localStorage，sessionStorage不太能满足我们持久化的场景，然而html5的indexedDB正常好满足我们的需求。IndexedDB 内部采用对象仓库（object store）存放数据。所有类型的数据都可以直接存入，包括JavaScript对象。indexedDB的api直接用可能会比较难受，可以使用[Dexie.js](https://github.com/dfahlander/Dexie.js)，[db.js](https://github.com/aaronpowell/db.js)这些二次封装的库来实现业务的数据层。

在满足持久化存储后, 我们便可以用时间戳，来进行增量同步，在收到消息通知时，存储到web数据库。上层操作获取数据，优先从数据库获取数据，避免总是高频率、高数据量的与服务器通讯。当然敏感性信息不要存在数据库或者增加点破解难度，毕竟所有web本地存储都是能看到的。此外注意下存储大小还是有限制的，[每种浏览器可能不一样](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria)，但是远大于其他Web本地存储了，只要该放云端的数据放云端(比如云消息)，不会有太大问题。

在编码实现上，由于处理消息通知都是异步操作，要维护一个队列保证**入库时序**。此外要做好**降级方案**。



#### 减少连接数

在Web桌面端的互动直播场景，同一种页面开启了多个tab访问应该是很常见的。业务上也会有多端互踢操作，但是对Web场景如果只能一个页面能进行互动那肯定是不行的，一不小心就不知道切到哪个tab上去了。所以通常会设置一个多端在线的最大数，超过了就踢。因而一个浏览器建立7，8个长链接是一件很寻常的事情，对于服务端资源也是一种极大的浪费。

Web Worker可以为Web内容在后台线程中运行脚本提供了一种简单的方法，线程可以执行任务而不干扰用户界面。并且可以将消息发送到创建它的JavaScript代码, 通过将消息发布到该代码指定的事件处理程序（反之亦然）。虽然Web Worker中不能使用DOM API，但是XHR，WebSocket这些通讯API并没有限制（而且可以操作本地存储）。因此我们可以通过SharedWorker API创建一个执行指定脚本来共享web worker来实现多个tab之前的通讯复用，来达到减少连接数的目的。在兼容性要求不那么高的场景可以尝试一下。

## 小结

本文介绍了互动直播中的即时通讯技术的在前端中应用，并分享了自己在工作开发中的一些经验，希望对您有所帮助，欢迎探讨。

## 参考资料

* [WebSocket](https://en.wikipedia.org/wiki/WebSocket)
* [IndexedDB](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API)
* [Web Worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API)
* [WebSocket 教程](http://www.ruanyifeng.com/blog/2017/05/websocket.html)
* [TCP中已有SO_KEEPALIVE选项，为什么还要在应用层加入心跳包机制??](https://www.zhihu.com/question/40602902)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
