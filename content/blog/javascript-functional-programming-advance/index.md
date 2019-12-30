---
title: 函数式编程进阶：杰克船长的黑珍珠号
date: "2019-12-30T01:47:34.408Z"
description: "本系列文章适合拥有扎实的 JavaScript 基础和有一定函数式编程经验的人阅读，本文的目的是结合 JavaScript 的语言特性来讲解范畴论的一些概念和逻辑在编程中的实际应用。"
---

![banner](https://p1.music.126.net/dwtcN86z-8-aHbKrGy_9pQ==/109951164578969593.jpg)

> 本文作者：[赵祥涛](https://github.com/sylvenas)

函数式编程（Functional Programming）这一理念不论是在前端领域还是后端领域，都逐渐热门起来，现在不大量使用函数式编程技术的大型应用程序已经很罕见了，比如前端流行的 React（核心思路数据即视图），Vue3.0 的 Composition API ，Redux ，Lodash 等等前端框架和库，无不充斥着函数式的思维，实际上函数式编程绝不是最近几年才被创造的编程范式，而是在计算机科学的开始，[Alonzo Church](https://history.computer.org/pioneers/church.html) 在 20 世纪 30 年代发表的 `lambda` 演算，可以说是函数式编程的前世今生。

本系列文章适合拥有扎实的 JavaScript 基础和有一定函数式编程经验的人阅读，本文的目的是结合 JavaScript 的语言特性来讲解范畴论的一些概念和逻辑在编程中的实际应用。

### 黑珍珠号的诅咒

#### 扬帆起航！

首先我们看一段 `双11大促销` 的代码，即作为对函数组合等概念的回顾，也作为即将开启的新征程的第一步：
``` js
const finalPrice = number => {
    const doublePrice = number * 2
    const discount = doublePrice * .8
    const price = discount - 50
    return price
}

const result = finalPrice(100)
console.log(result) // => 110
```
看看上面这段简单的 `双11购物狂欢节` 的代码，**原价 100 **的商品，经过商家一顿花式大促销（`打折（八折）` + `优惠券（50）`）的操作之后，大家成功拿到**剁手价 110**。~~好划算，快剁手~~

如果你已经阅读了我们云音乐前端团队的另外一篇[函数式编程入门文章](https://juejin.im/post/5d70e25de51d453c11684cc4)，我相信你已经知道如何书写函数式的程序了：即通过管道把数据在一系列纯函数间传递的程序。我们也知道了，这些程序就是声明式的行为规范。现在再次使用函数组合的思路保持数据管道操作，并消除这么多的中间变量，保持一种 `Point-Free` 风格：

``` js
    const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x)

    const double = x => x * 2
    const discount = x => x * 0.8
    const coupon = x => x - 50

    const finalPrice = compose(coupon, discount, double)

    const result = finalPrice(100)
    console.log(result) // => 110
```
嗯！终于有了点函数式的味道！这个时候，我们发现传给函数 `finalPrice` 的参数 `100` 像一个工厂的零配件一样在流水线上先后被函数 `double`、 `discount` 和 `coupon` 所操作。`100` 像水一样在管道中流通。看到这一幕我们是不是有点眼熟，Array 的 `map` ，`filter` ，不就是完全类似的概念吗？所以我们可以用 Array 把我们输入的参数进行包装：
``` js
const finalPrice = number =>
    [number]
        .map(x => x * 2)
        .map(x => x * 0.8)
        .map(x => x - 50)

const result = finalPrice(100)
console.log(result) // => [110]
```

现在我们把 `number` 放进 Array 这个容器内，然后连续调用了三次 map ,来实现数据的管道流动。仔细观察发现 Array 只是我们数据的容器，我们也只是想利用 Array 的 map 方法罢了，其他的方法我们暂时用不到，那么我们何不创建一个 `Box` 容器呢？
``` js
const Box = x => ({
    map: f => Box(f(x)),
    inspect: () => `Box(${x})`
})

const finalPrice = str =>
    Box(str)
        .map(x => x * 2)
        .map(x => x * 0.8)
        .map(x => x - 50)

const result = finalPrice(100)

console.log(result) // => Box(110)
```

> 这里使用函数 Box 而不是 ES6 的 Class 来生产对象的原因是，尽量避免了“糟糕”的 new 和 this 关键字(摘自《 You Don't Know JS 上册》)， new 让人误以为是创建了 Class 的实例，但其实根本不存在所谓的`实例化`，只是简单的`属性委托机制(对象组合的一种)`，而 this 则引入了执行上下文和词法作用域的问题，而我只是想创建一个简单的对象而已！
>
> inspect 方法的目的是为了使用 Node.js 中的 console.log 隐式的调用它，方便我们查看数据的类型；而这一方法在浏览器中不可行，可以用 `console.log(String(x))` 来代替; Node.js V12 API 有变更，可以采用 [`Symbol.for('nodejs.util.inspect.custom')`](http://nodejs.cn/api/en/util.html#util_util_inspect_object_options) 替代 inspect 
>
> 这里使用连续 dot、dot、dot 的链式调用而不是使用 compose 组合的原因是为了更方便的理解，compose 更为函数式。

#### 被封印的黑珍珠号

![杰克船长的黑珍珠号](https://p1.music.126.net/eLyaFFUwmPlcaY9bxWhGkw==/109951164499400541.png)

Box 中这个 `map` 跟数组那个著名的 `map` 一样，除了前者操作的是 `Box(x)` 而后者是 `[x]` 。它们的使用方式也几乎一致，把一个值丢进 Box ，然后不停的 map，map，map...：
``` js
Box(2).map(x => x + 2).map(x => x * 3);
// => Box(12)

Box('hello').map(s => s.toUpperCase());
// => Box('HELLO')
```

这是讲解函数式编程的第一个容器，我们将它称之为 `Box`，而数据就像杰克船长瓶子中的黑珍珠号一样，我们只能通过 `map` 方法去操作其中的值，而 Box 像是一种虚拟的屏障，也可以说在一定程度上保护 Box 中的值不被随意的获取和操作。

为什么要使用这样的思路？因为我们能够在不离开 Box 的情况下操作容器里面的值。Box 里的值传递给 `map` 函数之后，就可以任我们操作；操作结束后，为了防止意外再把它放回它所属的 `Box`。这样做的结果是，我们能连续地调用 `map`，运行任何我们想运行的函数。甚至还可以改变值的类型，就像上面最后一个例子中那样。

> map 是可以使用 lambda 表达式变换容器内的值的有效且安全的途径。

等等，如果我们能一直调用 `map.map.map` ，那我们是不是可以称这种类型为 `Mappable Type` ? 这样理解完全没有问题！

`map` 知道如何在上下文中映射函数值。它首先会打开该容器，然后把值通过函数映射为另外一个值，最后把结果值再次包裹到一个新的同类型的容器中。而这种变换容器内的值的方法(map)称为 [Functor(函子)](https://medium.com/@dtinth/what-is-a-functor-dcf510b098b6)。

![函子图解](https://p1.music.126.net/T8BjeCqe_-mJUQczJoOdbw==/109951164499392356.png)

`Functor(函子)` 是[范畴论](https://www.quantamagazine.org/with-category-theory-mathematics-escapes-from-equality-20191010/)里的概念。范畴论又是什么？？？ 我不懂！！！

不慌！后面我们会再继续简单的讨论一下范畴论与 Functor 的概念和理论，让我们暂时忘记这个奇怪的名字，先跳过这个概念。

还是继续称之为我们都能理解的 Box 吧！

#### 黑珍珠号的救赎

类似于 `Box(2).map(x => x + 2)` 我们已经可以把任何类型的值，包装到 Box 中，然后不断的 map，map，map...。

另一个问题，我们怎么取出来我们的值呢？我想要的结果是 `4` 而不是 `Box(4)`!

如果黑珍珠号不能从瓶子中释放出来又有什么用处呢？接下来让杰克斯派洛船长抢过黑胡子的宝剑，释放出来黑珍珠号！

是时候为我们的这个最为原始的 Box 添加别的方法了。

``` js
const Box = x => ({
    map: f => Box(f(x)),
    fold: f => f(x),
    inspect: () => `Box(${x})`
})

Box(2)
    .map(x => x + 2)
    .fold(x => x)  // => 4
```

嗯，看出来 `fold` 和 `map` 的区别了吗？

**`map` 是把函数执行的结果重新包装到 Box 中后然返回一个新的 Box 类型，而 `fold` 则是直接把函数执行的结果 return 出来，就结束了！**

### Box 的实际应用

#### Try-Catch
在许多情况下都会发生 JavaScript 错误，特别是在与服务器通讯时，或者是在试图访问一个 null 对象的属性时。我们总是要预先做好最坏的打算，而这种大部分都是通过 `try-catch` 来实现的。

举例来说：
``` js
const getUser = id =>
    [{ id: 1, name: 'Loren' }, { id: 2, name: 'Zora' }]
        .filter(x => x.id === id)[0]

const name = getUser(1).name
console.log(name) // => 'Loren'

const name2 = getUser(4).name
console.log(name2) // => 'TypeError: Cannot read property 'name' of undefined'
```
那么现在代码报错了，使用 `try-catch` 可以一定程度上解决这个问题：
``` js
try {
    const result = getUser(4).name
    console.log(result)
} catch (e) {
    console.log('error', e.message) // => 'TypeError: Cannot read property 'name' of undefined'
}
```
一旦发生了错误，JavaScript 会立即终止执行，并创建导致该问题的函数的调用堆栈跟踪，并保存到 Error 对象中，catch 就像是我们代码的避风港湾一样。但是 `try-catch` 能妥善的解决我们的问题吗？`try-catch` 存在以下缺点：

* 违反了[引用透明](https://en.wikipedia.org/wiki/Referential_transparency)原则，因为抛出异常会导致函数调用出现另一个出口，所以不能确保单一的可预测的返回值。
* 会引起[副作用](https://juejin.im/post/5d70e25de51d453c11684cc4#heading-11)，因为异常会在函数调用之外对堆栈引发不可预料的影响。
* 违反[局域性的原则](https://www.commonlounge.com/discussion/e16d75c8232c4161b474f4b62c261c9d#trycatch)，因为用于恢复异常的代码和原始的函数调用渐行渐远，当发生错误的时候，函数会离开局部栈和环境。
* 不能只关心函数的返回值，调用者需要负责声明 catch 块中的异常匹配类型来管理特定的异常;难以与其他函数组合或链接，总不能让管道中的下一个函数处理上一个函数抛出的错误吧。
* 当有多个异常条件的时候会出现[嵌套的异常处理块](https://guide.freecodecamp.org/javascript/error-handling-and-try-catch-throw/)。

> 异常应该由一个地方抛出，而不是随处可见。

上面的描述和代码可以看出，`try-catch` 是完全被动的解决方式，也非常的不“函数式”，若是能轻松的处理错误甚至包容错误，该有多好？下面不妨让我们使用Box理念，来优化这些问题

#### 向左? 向右?

仔细分析 `try-catch` 代码块的逻辑，发现我们的代码出口要么在 try 中，要么在 catch 中(函数总不能有两个返回值吧)。按照我们代码设计的期望，我们是希望代码从 try 分支走完的，catch 是我们的一个兜底方案，那么我们可以类比 try 为 `Right` 指代正常的分支，catch 为 `Left` 指代出现异常的分支，他们两者绝不会同时出现！那么我们扩展一下我们的 `Box` ，分别为 `Left` 和 `Right` ，看代码：

``` js
const Left = x => ({
    map: f => Left(x),
    fold: (f, g) => f(x),
    inspect: () => `Left(${x})`
})

const Right = x => ({
    map: f => Right(f(x)),
    fold: (f, g) => g(x),
    inspect: () => `Right(${x})`
})

const resultLeft = Left(4).map(x => x + 1).map(x => x / 2)
console.log(resultLeft)  // => Left(4)

const resultRight = Right(4).map(x => x + 1).map(x => x / 2)
console.log(resultRight)  // => Right(2.5)
```

`Left` 和 `Right` 的区别在于 Left 会自动跳过 `map` 方法传递的函数，而 Right 则类似于最基本的 Box，会执行函数并把返回值重新包装到 Right 容器里面。`Left` 和 `Right` 完全类似于 Promise 中的 `Reject` 和 `Resolve`，一个 Promise 的结果要么是 Reject 要么是 Resolve，而拥有 Right 和 Left 分支的结构体，我们可以称之为 **Either** ，要么向左，要么向右，很好理解，对吧！上面的代码说明了 Left 和 Right 的基本用法，现在把我们的 `Left` 和 `Right` 应用到 `getUser` 函数上吧！

``` js
const getUser = id => {
    const user = [{ id: 1, name: 'Loren' }, { id: 2, name: 'Zora' }]
        .filter(x => x.id === id)[0]
    return user ? Right(user) : Left(null)
}

const result = getUser(4)
    .map(x => x.name)
    .fold(() => 'not found', x => x)

console.log(result) // => not found
```
不可相信！我们现在竟然能线性的处理错误，并且甚至能够给出一个 `not found` 的提醒了（通过给 fold 提供），但是再仔细思考一下，是不是我们原始的 `getUser` 函数，有可能会返回 `undefined` 或者一个正常的值，是不是可以直接包装一下这个函数的返回值呢？

``` js
const fromNullable = x =>
    x != null ? Right(x) : Left(null)

const getUser = id =>
    fromNullable([{ id: 1, name: 'Loren' }, { id: 2, name: 'Zora' }]
            .filter(x => x.id === id)[0])

const result = getUser(4)
    .map(x => x.name)
    .fold(() => 'not found', c => c.toUpperCase())

console.log(result) // => not found
```
现在我们已经成功处理了可能出现 null 或者 undefined 的情况，那么 try-catch 呢？是否也可以被 Either 包装一下呢？
``` js
const tryCatch = (f) => {
    try {
        return Right(f())
    } catch (e) {
        return Left(e)
    }
}

const jsonFormat = str => JSON.parse(str)

const app = (str) =>
    tryCatch(() => jsonFormat(str))
        .map(x => x.path)
        .fold(() => 'default path', x => x)

const result = app('{"path":"some path..."}')
console.log(result) // => 'some path...'

const result2 = app('the way to death')
console.log(result2) // => 'default path'
```

现在我们的 try-catch 即使报错了，也不会打断我们的函数组合了,并且错误得到了合理的控制，不会随意的 throw 出来一个 Error 对象了。

> 此处建议打开网易云音乐听一首[《向左向右》](https://music.163.com/#/song?id=1365888841)！放松一下，顺带回味一下我们的 Right 与 Left。

### 什么是 Functor? 怎么使用 Functor? 为什么使用 Functor?

#### 什么是 Functor?
上面我们定义了一个简单的 Box，其实也就是拥有 `map` 和 `fold` 方法的类型。让我们把脚步放慢一点，再仔细观察和思考一下我们的 `map`：`Box(a) -> Box(b)` ，本质上就是通过一个函数 `a -> b` 把一个 `Box(a)` 映射为 `Box(b)`。这和中学代数中的函数知识何其类似，不妨再回顾一下代数课本中函数的定义：

**假设 A 和 B 是两个集合，若按照某种对应法则，使得 A 的任一元素在 B 中都有唯一的元素和它对应，则称这种对应为从集合 A 到集合 B 的函数。**

上面的集合 A 和集合 B，拿到我们的程序世界，完全可以类比与 String 、Boolean、Number 和更抽象的 Object，通常我们可以把数据类型视作所有可能值的一个集合（ Set ）。像 Boolean 就可以看作是 `[true,false]` 的集合，Number 是所有实数的集合，所有的集合，以集合为对象，集合之间的映射作为箭头，则构成了一个范畴：

![范畴](https://p1.music.126.net/IQIDMxhCvN2lKYDPfBE6rQ==/109951164499395888.png)

看图：a，b，c 分别表示三个范畴，现在我们做个类比：a 为字符串的集合(String)，b 为实数的集合(Number)，c 为 Boolean 的集合；那么我们完全可以实现映射函数 `g` 为 `str => str.length`，而函数 `f` 为 `number => number >=0 ? true : false`，那么我们就可以通过函数 `g` 完成从字符串范畴到实数范畴的映射，然后通过函数 `f` 从实数范畴映射到 Boolean 范畴。

现在重新回顾一下之前跳过的那个晦涩的名字： Functor （函子）就是范畴到范畴之间映射的那个箭头！而这个箭头一般通过 map 方法配合一个变换函数（i.e. `str => str.length` ）来实现,这样理解起来就很容易了，对吧（~~才怪~~）

如果我们有了函数 g 和函数 f，那么我们一定可以推导出函数 `h = f·g` ，也就是 `const h = compose(f,g)`，而这就是上图下半部分 `a -> c`的变换过程，这不就是中学的数学`结合律`吗? ~~我们可都是学过高数的，谁不会啊~~

等等，a，b，c 上面的那个 id 箭头又是什么鬼？自己映射到自己？不错！
对于任何 `Functor`，通过函数 `const id = x => x` 可以实现 `fx.map(id) == id(fx)`，而这被称为 `Identity`，也就是数学中的`同一律`。

这也是为什么我们一定要引入范畴论，引入 `Functor` 的概念，而不只是简单的把他们称为 `mappale` 或者其他什么东西，因为这样我们就可以在保持名称不变的基础上更加理解伴随着数学原理而来的 Functor 的其他的定理(`Composition` 和 `Identity`)，不要因为这个晦涩的名称而让我们驻步不前。

> 上面的介绍仅仅是方便前端渣渣们(~~和Haskell大神相比~~)，在一定程度上理解范畴。并不是十分的严谨(~~非常不严谨好不~~)，范畴中的对象可以不是集合，箭头也可以不是映射...停停！！打住！再说下去我就可以转行做代数老师了(ahhhh.jpg)。

#### 怎么使用 Functor?
现在再次让我们回到代码的世界，毫无疑问 `Functor` 这个概念太常见了。其实绝大多数的开发人员一直在使用 `Functor` 却没有意识到而已。比如：
* Array 的 `map` 和 `filter`。
* jQuery 的 `css` 和 `style`。
* Promise 的 `then` 和 `catch` 方法(Promise 也是一种 Functor? Yes！)。
* Rxjs Observable 的 `map` 和 `filter` (异步函数的组合？Relax！)。

都是返回同样类型的 `Functor`，因此可以不断的链式调用，其实这些都是 Box 理念的延伸：

``` js
[1, 2, 3].map(x => x + 1).filter(x => x > 2)

$("#mybtn").css("width","100px").css("height","100px").css("background","red");

Promise.resolve(1).then(x => x + 1).then(x => x.toString())

Rx.Observable.fromEvent($input, 'keyup')
    .map(e => e.target.value)
    .filter(text => text.length > 0)
    .debounceTime(100)    
```

#### 为什么使用 Functor?
把值装进一个容器（比如 Box，Right，Left 等），然后只能用 `map` 来操作它，这么做的理有到底是什么呢？如果我们换种方式来思考，答案就很明显了：让容器自己去运用函数能给我们带来什么好处呢？答案是：
**抽象，对于函数运用的抽象。**

纵观整个函数式编程的核心就在于把一个个的小函数组合成更高级的函数。
举个函数组合的例子：如果想给任何 `Functor` 应用一个统一的 map ，该如何处理？答案是 [`Partial Application`](https://juejin.im/post/5d70e25de51d453c11684cc4#heading-15)：

``` js
const partial =
    (fn, ...presetArgs) =>
        (...laterArgs) =>
            fn(...presetArgs, ...laterArgs);

const double = n => n * 2
const map = (fn, F) => F.map(fn)
const mapDouble = partial(map, double)

const res = mapDouble(Box(1)).fold(x => x)
console.log(res)  // => 2
```
关键在于 `mapDouble` 函数返回的结果是一个等待接收第二个参数 F (Box(1)) 的函数; 一旦收到第二个参数，则会直接执行 `F.map(fn)` ，相当于 `Box(1).map(double)` ,该表达式返回的结果为 `Box(2)` ,所以后面可以继续 `.fold`等等链式操作。

### 总结与计划
#### 总结
上面通过双十一购物狂欢节的例子，介绍了函数式编程的几个基本概念（pure function，compose）等，并逐渐引入了功能强大的 `Box` 理念，也就是最基本的 `Functor`。后面通过无时不刻可能出现的 null ，介绍了 `Either` 可以用来做 null 的包容器。再通过 `try-catch` 的例子，了解了比较 pure 的处理错误的方式， Either 当然不仅仅是这两种用法，后面会继续介绍其他高级的用法。最后总结了什么是 `Functor`，怎么使用 `Functor`，以及使用 `Functor` 的优势何在。

#### 计划
`Functor` 是我们介绍的范畴论中的最最最基本的一个概念，不过我们目前解决的都是最简单的问题（更优秀的组合（map），更健壮的代码（fromNullAble），更纯的错误处理（TryCatch）），但是嵌套的 try-catch 呢？异步函数怎么组合呢？后面会继续通过 `双11购物狂欢节的案例` 来介绍范畴论中的其他概念和实际用法示例（实际目的：继续揭露奸商的套路，~~顺便转行做代数老师，摆脱 34岁 淘汰的潜规则; 狗头.jpg~~）。


参考资料与引用文章：   
- [What is a functor?](https://medium.com/@dtinth/what-is-a-functor-dcf510b098b6)   
- [So You Want to be a Functional Programmer](https://medium.com/@cscalfani/so-you-want-to-be-a-functional-programmer-part-1-1f15e387e536)   
- [Two Years of Functional Programming in JavaScript: Lessons Learned](https://hackernoon.com/two-years-of-functional-programming-in-javascript-lessons-learned-1851667c726)   
- [Master the JavaScript Interview: What is Functional Programming?](https://medium.com/javascript-scene/master-the-javascript-interview-what-is-functional-programming-7f218c68b3a0)    
- [《JavaScript函数式编程指南》](https://github.com/MostlyAdequate/mostly-adequate-guide)      
- [《You Don't Know JS》](https://book.douban.com/subject/25883834/)   
- [写给程序员的范畴论](https://bartoszmilewski.com/2014/10/28/category-theory-for-programmers-the-preface/)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
