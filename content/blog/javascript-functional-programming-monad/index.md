---
title: 函数式编程进阶：Monad 与 异步函数的组合
date: 2021-01-19T02:31:26.993Z
description: 函数组合是函数式编程的核心，而「异步非阻塞」是 JavaScript 世界的主流；本篇文章将会介绍 Monad 的概念，以及如何优雅的实现异步函数的组合。
---

![russian dolls](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5507082808/23cf/319b/5b26/63ff0fc33c21d14832865389e6a5dcb7.png)

图片来源: [https://unsplash.com/photos/RPLwFFzNvp0](https://unsplash.com/photos/RPLwFFzNvp0)

> 本文作者：[赵祥涛](https://github.com/sylvenas)

前面两篇分别介绍了 [Functor](https://musicfe.dev/javascript-functional-programming-advance/) 和 [Applicative](https://musicfe.dev/javascript-functional-programming-functor/) 的概念和实际应用，并列举了几个具体的例子，说明了 Functor 和 Applicative 的实际用途，比如：使用 `Either` 来处理无处不在的 `null` 和创建可组合的 `try-catch`；使用 Applicative 来做高度灵活高度可拓展的表单校验；相信读者应该已经牢牢掌握了 Functor 的核心：**map-应用一个函数到包裹的值**，Applicative的核心：**ap-应用一个包裹的函数到一个包裹的值**。

别忘了之前遗留的几个问题：

* 如何解决嵌套的 `try-catch`
* 异步函数的组合
* Promise 也是一种 Functor ?

三个问题从易到难一个一个的解决，先从第一个：嵌套的 `try-catch` 开始入手。

> 本篇文章建立在前两篇的基础之上，所以建议先阅读前两篇的文章，再读本篇，不然可能会对某些概念和名词感到困惑
## 嵌套的 Array
Javascript Array 的 `map` 方法，相信开发者们都很熟悉，并且几乎在每天的编程中都会用到，但 Array 原型链上的另一个方法 `Array.prototype.flatMap` 可能很多人没怎么用过，从字面意思上理解就是`扁平化的 map`，实际作用也确实是的，看一个和 `map` 做对比的使用案例：

```js
const arr = [1, 2, 3, 4]

arr.map(x => [x * 2])  // => [[2], [4], [6], [8]]

arr.flatMap(x => [x * 2])  // => [2, 4, 6, 8]
```

`flatMap` 相对于 `map` 的区别是：

- `map` 是把函数执行的结果，放在一起然后装进 Box 中；
- `flatMap` 的结果是把**函数执行的结果分别去掉一层“包装”**，然后放在一起装进 Box 中

所以 `flatMap` 相当于是先 `map` (映射)然后 `flat` (拍平)， 仅仅是多了一个“去包装”的操作！

## 俄罗斯套娃
上面介绍了 Array 的一种先 `map` 在 `flat` 的方法，Array 也是 `Box` 理念的一个具体实现案例，那其他的 Box 呢？比如前面两篇一直在用的 `Either` 又是如何实现的呢？从一个更简单的函数组合的案例出发，需求是：编写一个获取用户地址的街道名称函数：

```js
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x)
const address = user => user.address
const street = address => address.street

const app = compose(street, address)

const user = {
    address: {
        street: '长河'
    }
}

const res = app(user) // => 长河
```

函数组合的理论也非常简单，只要上一个函数的返回值类型可以作为下一个函数的入参就可以放心大胆的进行组合了。

值得警惕的是，`user` 对象上面 `address` 属性值可能为 `null` ，上面的这段代码如果不做任何防范，那么 `TypeError` 的错误是可能发生的。这个问题不用担心，毕竟之前已经准备好了用来处理 `null/undefined` 的 `Either` 函子，可以使用 `fromNullable` 包装一下上面代码：

```js
const address = user => fromNullable(user).map(u => u.address)
const street = address => fromNullable(address).map(a => a.street)

const app = user =>
    address(user)     // Either(address)                                       
        .map(street)  // Either(Either(street))

const res = app(user) // => Rirgt(Right('长河'))
```

审视一下上面的代码，`street` 函数返回的是一个 `Either` ，但是别忘了，`map` 方法( `map: f => Right(f(x))` )会把函数执行的结果重新包装进“盒子”中，也就是：最终得到的结果是：`Rirgt(Right('长河'))`。

这很明显不是我们想要的结果，我们只想要被包裹一层的 `street` ，问题是出现 `map` 方法上(map 会进行二次包装)，那么只要使用 `fold` 方法把 `street` 函数执行的结果从“盒子”里“拆包”解放出来即可。

```js
const app = user =>
        address(user)                              // Either(address)
       .map(s => street(s).fold(x => x, x => x))   // Either(street)
       .fold(() => 'default street', x => x)       // street
       
const res = app(user)  // => '长河'
```

毫无疑问，有几次包装，就需要几次“拆包”操作，这样做逻辑上自然没有问题。但这岂不是和前端常见的[回调地狱](http://callbackhell.com/)问题很类似，这样的代码写下去实在是太难维护和阅读，总不能写一行就要数数有几层包装吧！

这简直是代码版本的俄罗斯套娃：

![russian-dolls](https://d1.music.126.net/dmusic/obj/w5zCg8OAw6HDjzjDgMK_/5473369813/a3d5/d99f/df90/f221f2e6dd3b4a8fc6ee7bc400ba4008.gif?download=russian-dolls.gif)

出现两层包装的原因是：`map` 会把函数计算的结果重新包装进 Box 中，而这一层包装有点赘余，因为之后立即进行了拆箱操作，这非常类似于 `Array flatmap` (先 map 然后 flat )。

**因为函数的执行结果已经是被包装好了的，所以只需要一个方法( flatMap )直接执行函数，不做其他的任何操作**

```js
const Right = x => ({
  flatMap: f => f(x),
});

const Left = x => ({
  flatMap: f => Left(x),
});

const app = user =>
    address(user)                             // Either(address)
        .flatMap(street)                      // Either(street)
        .flod(() => 'default street',x => x)  // street
```

`map` 和 `flatMap` 的不同点：`map` 方法接收一个仅仅变换容器内值的函数，所以需要用 Box 重新包装；但是 `flatMap` 接收**一个返回Box类型的函数**，直接调用即可。

`map` 和 `flatMap` 的相同点却是非常明显的：都是返回一个 Box 的实例，方便后面继续链式的调用。

> `flatMap` 方法和 `flod` 方法逻辑一样？这里得承认他们确实很类似，但是他们的使用场景却完全不同！`flod` 的用途是把一个值从 Box 中解放出来；`flatMap` 的用途是把一个返回 Box 的函数应用到一个 Box 上，这样后面可以继续保持链式的调用。

> 根据[规范](https://github.com/fantasyland/fantasy-land#chain) `flatMap` 方法后面会改写为 `chain`，在别的语言中，可能也称为 `bind`。

既然解决了嵌套的 `Either` 问题，那么嵌套的 `try-catch` ，自然用同样的理论也可以迎刃而解了：

举例来说，如果要从文件系统读取一个配置文件，然后读取内容(请注意 `fs.readFileSync` 和 `JSON.parse` 都是可能发生错误的，所以会用 `try-catch` 包裹)：
```js
const readConfig = (filepath) => {
    try {
        const str = fs.readFileSync(filepath);
        const config = JSON.parse(str);
        return config.version
    } catch (e) {
        return '0.0.0'
    }
}

const result = readConfig('/config.json');
console.log(result) // => '1.0.0'
```
现在使用“盒子”理念 + “chain” 函数重写上面的代码为：
```js
const readConfig = (filepath) =>
    tryCatch(() => fs.readFileSync(filepath))             // Either('')
        .chain(json => tryCatch(() => JSON.parse(json)))  // Either('') 
        .fold(() => '0.0.0', c => c.version)

const result = readConfig('/config.json');
console.log(result) // => '1.0.0'
```
如果一个 Functor 实现了 `chain` 方法，那么我们可以称这个函子为**单子(Monad)**，不错单子的概念就是这么简单；
如果你去 Google 搜索 `Monad` ，有无数篇在讲解 `Monad` 的文章，其中最经(戏)典(虐)的一个解释为：

> “A monad is just a monoid in the category of endofunctors. What’s the problem?”

![monad](https://d1.music.126.net/dmusic/obj/w5zCg8OAw6HDjzjDgMK_/5473423836/7034/6444/5f4c/6221ec38ef408e8a25b7be620202b998.gif?download=tenor.gif)

上面这句话的出处是[brief-incomplete-and-mostly-wrong](http://james-iry.blogspot.com/2009/05/brief-incomplete-and-mostly-wrong.html),完全是为了吐槽 Haskell，理论上没有错，但更多的是调侃(~~该文章极其经典，点明了所有主流开发语言的“特色与优点”，推荐阅读背诵~~)。

而 Monad 的准确定义是：

> All told, a monad in X is just a monoid in the category of endofunctors of X, with product × replaced by composition of endofunctors and unit set by the identity endofunctor. -- [Saunders Mac Lane](https://en.wikipedia.org/wiki/Saunders_Mac_Lane)

所以上面这个定义你看懂了吗？(~~别打我~~)看不懂，真的没有关系，因为那是为专业的数学学生而准备的，我们只要掌握 Monad 在编程中可以理解为 `chainable` 的对象，用来解决嵌套的 Box 问题，抓住这个重点已经足够了。

## 异步
毫无疑问 异步 是 JavaScript 世界的主流，从按钮的 `onclick` 点击回调，到 AJAX 请求的 `onload` 回调，再到 Node.js 里的 `readFile` 回调，这种根基级的手法都万变不离其宗，「异步非阻塞」意味着一种以回调函数为基础的编程范式。

关于异步和事件循环的理论，可以参考网易云音乐团队的另一篇文章：[聊聊 JavaScript 的并发、异步和事件循环](https://musicfe.dev/eventloop/)

### callback 与 异步
从最简单的回调函数开始，首先看一典型的 Node.js 风格的 callback :
```js
const getUrl = url => callback => request(url, callback)
const getSomeJSON = getUrl('http://example.com/somedata.json')
getSomeJSON((err, data)=>{
  if(err){
    //do something with err
  }else {
    //do something with data
  }
})
```

这是一段简单的异步 HTTP 请求，首先采用柯里化的方式传入 `url` ，然后传入 `callback` ，这种风格有什么缺点呢？

- 1.函数的调用者无法直接控制请求，必须要把所有的后续操作放在 `callback` 里面
- 2.函数无法组合，因为 `getSomeJSON` 调用之后没有返回任何结果

还有一个关键点在于，`callback` 接收两个参数，一个错误信息，一个成功的数据，这导致我们不得不在一个函数里面同时处理错误与数据的逻辑。

那么转换一下思路，**与其传递一个接收两个参数(err & data)的函数，不如传递两个函数(handleError & handleData)，每个接收一个参数**。

```js
const getUrl = url =>
    (reject, resolve) =>
        request(url, (err, data)=>{
            err? reject(err) : resolve(data)
        })
```
现在调用 `getUrl` 之后，我们可以继续传递 `handleError` 和 `handleData`
```js
const getSomeJSON = getUrl('http://example.com/somedata.json')
const handleError = err => console.error('Error fetching JSON', err)
const handleData = compose(renderData, JSON.parse)

getSomeJSON(handleError, handleData) // 触发请求
```
现在完全分离了 `handleData` 和 `handleError` 的逻辑，并且 `handleData` 函数已经可以按照我们的期望进行组合了，而`(reject, resolve) => {}` 函数我们称之为fork，意为：两个“分支”。

### Task与异步
现在我们发现了另外一个问题，我们总是需要在 `handleData` 中进行 `JSON.parse` 操作，因为把字符串转换为 JSON 是任何数据处理逻辑的第一步，如果我们能把 `getSomeJSON` 与 `JSON.parse` 函数组合在一起就好了；现在问题明确了：**如何把一个普通的函数和fork函数进行组合？**

这个问题看上去非常棘手，不过可以从简单的问题开始一步步解决，假设现在有字符串 `stringifyJson` ，如何转换为 JSON 呢，借用前面一章中介绍的[LazyBox](https://musicfe.dev/javascript-functional-programming-functor/)的概念：

```js
const stringifyJson= '{"a":1}'

LazyBox(() => stringifyJson).map(JSON.parse) // => LazyBox({ a: 1 })
```

我们可以把一个函数包装进 `LazyBox` 中，然后通过 `map` 不断的进行函数组合，直到最后调用 `fold` 函数，真正的触发函数调用；   

`LazyBox` 用来包裹同步的函数，那么同理对于处理异步逻辑的 `fork` 函数，也可以用一个盒子包装起来，然后 `map` 普通函数 `f` ，不也可以实现函数组合吗？对于异步的逻辑，可以称之为 `Task` (任务：将来才会完成某个目标或者达成某种结果，~~是不是很好理解~~)

```js
const Task = fork => ({
    map: f => Task((reject, resolve) =>          // return another Task, including a new fork.
            fork(reject, x => resolve(f(x)))),   // when called,the new fork will run `f` over the value, before calling `resolve`
    fork,
    inspect: () => 'Task(?)'
})
```
`Task` 的 `map` 方法，接收一个函数 `f` ，返回一个新的 `Task`，关键点在：新的 `fork` 函数会调用上一个 `fork` ，如果是正确的分支则 `resolve` 被函数 `f` 计算过后的结果，如果是失败的分支，则传递 `reject`。

> 如果之前没有深入了解过 Promise 的实现原理，可能这里比较难以理解，但是请停下来，花点时间思考一下。

现在使用 `Task` 改写一下 `readConfig` 函数：
```js
const readConfig = filepath => Task((reject, resolve) =>
    fs.readFile(filepath, (err, data) =>
        err ? reject(err) : resolve(data)
    ))

const app = readConfig('config.json')
    .map(JSON.parse)

app.fork(() => console.log('something went wrong'), json => console.log('json', json))
```
`Task.map` 和 `LazyBox` 的 `map` 完全类似，一直都是在做函数组合的工作，并没有进行实际的函数调用，`LazyBox` 最后通过调用 `fold` 真正实现函数调用，而 `Task` 最后通过调用 `fork` ，实现异步函数的执行。

### Task与异步函数的组合
现在通过 `Task` 实现了一个比较“优雅”的 `readConfig` 函数，如果要继续修改配置文件并保存到本地，又该如何处理呢？先从 `writeConfig` 函数开始吧，完全仿照 `readConfig` 函数的写法：
```js
const app = readConfig(readPath)
    .map(JSON.parse)
    .map(c => ({ version: c.version + 1 }))
    .map(JSON.stringify)

const writeConfig = (filepath, contents) =>
    Task((reject, resolve) => {
        fs.writeFile(filepath, contents, (err, _) =>
            err ? reject(err) : resolve(contents)
        )
    })
```

那么怎么继续把 `writeConfig` 应用到 `app` 上呢，既然 `writeConfig` 函数返回一个 `Task`，那么很明显需要一个类似 `Array.prototype.flatMap` 和 `Either.chain` 函数，帮我们把这个返回 `Task` 的函数应用到 `app` 上：

```js
const Task = fork => ({
    chain: f => Task((reject, resolve) =>                   // return another Task
            fork(reject, x => f(x).fork(reject, resolve)))  // calling `f` with the eventual value
})
```
类似于 `Either` 中的 `chain` 函数，首先会直接调用函数 `f` (返回TaskB)，然后传入`(reject, resolve)`调用 `TaskB` 的 `fork` 函数去处理后续的逻辑。

现在就可以流畅的使用 `chain` 继续组合 `writeConfig` 函数了
```js
const app = readConfig(readPath)
    .map(JSON.parse)
    .map(c => ({ version: c.version + 1 }))
    .map(JSON.stringify)
    .chain(c => writeConfig(writeFilepath, c))

app.fork(() => console.log('something went wrong'), 
    () => console.log('read and write config success'))
```
看到这里，应该可以举一反三的想到，需要链式调用的 HTTP 请求，比如：连续调用两个接口，第二个接口依赖第一个接口的返回值作为参数，那么完全可以用 `chain` 组合两个异步 HTTP 请求：
```js
const httpGet = content => Task((rej, res) => {
    setTimeout(() => res(content), 2000)
})

const getUser = (id) => httpGet('Melo')
const getAge = name => httpGet(name)

getUser('id')
    .chain(name => getAge(name + ' 18'))
    .fork(console.error, console.log) // => 4000ms later， log： "Melo 18"
```

## Monad VS Promise
`Task` 的代码实现，不如之前介绍的 `Box`，`Either`， `LazyBox` 那么直观和好理解，但是请仔细思考和理解一下，你会发现 `Task` 和 `Promise` 是非常非常相似的，甚至我们可以认为 `Task` 就是一个 Lazy-Promise ：**Promise 是在创建的时候立即开始执行，而 Task 是在调用 fork 之后，才会开始执行**。

关于读取配置文件，修改内容，然后重新保存到本地，我想大家都可以轻松的写出来 Promise 版本的实现，作为对比展示一下示例代码：
```js
const readConfig = filepath => new Promise((resolve, reject) =>
    fs.readFile(filepath, (err, data) =>
        err ? reject(err) : resolve(data)
    ))

const writeConfig = (filepath, contents) => new Promise((resolve, reject) => {
    fs.writeFile(filepath, contents, (err, _) =>
        err ? reject(err) : resolve(contents)
    )
})

readConfig(readPath)
    .then(JSON.parse)
    .then(c => ({ version: c.version + 1 }))
    .then(JSON.stringify)
    .then(c => writeConfig(writeFilepath, c))
```

两个版本中 `readConfig` 和 `writeConfig` 的实现非常类似，不再叙述；关键的不同点在于：Task 版本的组合函数使用的是 `map` 和 `chain` 函数，而 Promise 版本一直使用的都是 `then`。所以 Promise 看上去和 Monad 非常类似，那么不禁要问，Promise 是不是 Monad 呢？

那么可以和最简单的 `Box` Monad 做个对比:
```js
const Box = x => ({
    map: f => Box(f(x)),
    chain: f => f(x),
})

const box1 = Box(1)                          // => Box(1)
const promise1 = Promise.resolve(1)          // => Promise(1)
    
box1.map(x => x + 1)                         // => Box(2)
promise1.then(x => x + 1)                    // => Promise(2)

// -----------------

box1.chain(x => Box(x + 1))                 // => Box(2)
promise1.then(x => Promise.resolve(x + 1))  // => Promise(2)
```
可以发现，如果函数返回的是没有被包裹的值，`then` 和 `map` 的行为很类似；如果函数返回的是包裹的值，`then` 和 `chain` 很类似，都会去掉一层包装，从这个角度看 Promise 和Functor/Monad 都很类似，符合他们的数学规则。

下面继续看：
```js
box1.map(x => Box(x + 1))                   // => Box(Box(2))
promise1.then(x => Promise.resolve(x + 1))  // => Promise(2)

box1.chain(x => x + 1)                      // => 2
promise1.then(x => x + 1)                   // => Promise(2)
```
如果把一个返回包裹的值的函数，传递给 `then`，不会像 Functor 那样得到一个被包裹两层的值，而是只有一层；同样的把一个返回普通值的函数传递给 `then`，我们依然得到的是一个Promise，而 `chain` 的结果是去掉一层包裹，得到了值。从这个角度看，Promise 同时打破了 Functor 和 Monad 的数学规则。**所以严格意义来说 Promise 不是一个 Monad**，但是不可否认 Promise 的设计肯定有不少灵感来自 Monad。

> 这一小节的内容较为难理解，主要难在 Task 的实现原理和异步函数的组合，在逻辑上需要很好的数学思维，希望能多思考一下，一定会有更多的收获，毕竟我们用了短短几行代码，就实现了加强版的 Promise-> Lazy Promise -> Task。

> 更多的关于 Promise 和 Monad 的对比可以参考：[Javascript: Promises and Monads](https://www.breaktech.com/post/javascript-promises-and-monads),[difference between promise and task](https://glebbahmutov.com/blog/difference-between-promise-and-task/)

## 应用函子与单子

Monad 更擅长处理的是一种拥有 `Context(上下文)` 的场景，上面的 `getUser` 与 `getAge` 的例子中，`getAge` 函数必须等到 `getUser` 函数中的异步执行完成才能开始调用，这是一种**纵向(串行)**的链路；

而**Applicative更擅长的是处理一种横向(并行)的链路**，比如上一章介绍的表单校验的例子，每个字段的校验之间完全没有什么关联关系。

现在不禁要问 Task 可以实现异步的并行吗？答案是肯定的！假设 `getUser` 和 `getAge` 互不依赖，则完全可以采用 Applicative 的 apply 方法来进行组合。
```js
Task
    .of(name => age => ({ name, age }))
    .ap(getUser)
    .ap(getAge)
    .fork(console.error, console.log) // 2000ms later， log： "{name: 'Melo', age: 18}"
```

> Task.ap 可以参考 Promise.all 的原理，具体实现可以参考[gist.github](https://gist.github.com/Sylvenas/2a06088257344bc1596ed03407194f49)。

## 总结
- `Functor` 是一种实现 `map` 方法的数据类型
- `Applicative` 是一种实现了 `apply` 方法的数据类型
- `Monad` 是一种实现了 `chain` 或 `flatmap` 方法的数据类型

那么`Functor`、`Applicative` 和 `Monad` 三个区别是什么？

![functor-applicative-monad](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5502286847/c6d7/0597/c401/2284b7163900c63a298fbe46ce309e4d.png)

- `Functor`: 应用一个函数到包裹的值，使用 `map`.
- `Applicative`: 应用一个包裹的函数到包裹的值，使用 `ap`
- `Monad`: 应用一个返回包裹值的函数到一个包裹的值，使用 `chain`

参考资料与引用文章：   
- [Array.prototype.flatMap](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap)     
- [Monads and Gonads (YUIConf Evening Keynote)](https://www.youtube.com/watch?v=dkZFtimgAcM)   
- [Marvellously mysterious javascript maybe monad](https://jrsinclair.com/articles/2016/marvellously-mysterious-javascript-maybe-monad/)   
- [Understanding Functor and Monad With a Bag of Peanuts](https://medium.com/beingprofessional/understanding-functor-and-monad-with-a-bag-of-peanuts-8fa702b3f69e) 
- [Functors, Applicatives, And Monads In Pictures](https://adit.io/posts/2013-04-17-functors,_applicatives,_and_monads_in_pictures.html)     
- [A Brief, Incomplete, and Mostly Wrong History of Programming Languages](http://james-iry.blogspot.com/2009/05/brief-incomplete-and-mostly-wrong.html)     
- [The Little Idea of Functional Programming](https://jaysoo.ca/2016/01/13/functional-programming-little-ideas/)    
- [Comparison to Promises](https://github.com/fluture-js/Fluture/wiki/Comparison-to-Promises)    
- [Functional Programming In JavaScript — With Practical Examples](https://medium.com/free-code-camp/functional-programming-in-js-with-practical-examples-part-2-429d2e8ccc9e)     
- [Compose monads](https://twitter.com/_ericelliott/status/905538090634059776)
- [Translation from Haskell to JavaScript of selected portions of the best introduction to monads I’ve ever read](https://blog.jcoglan.com/2011/03/05/translation-from-haskell-to-javascript-of-selected-portions-of-the-best-introduction-to-monads-ive-ever-read/)
- [猫论讲解monad](https://blog.oyanglul.us/grokking-monad/part1)
- [怎样用简单的语言解释 monad？](https://www.zhihu.com/question/24972880)
- 《JavaScript函数式编程》   

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
