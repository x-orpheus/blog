---
title: 简明 JavaScript 函数式编程——入门篇
date: "2019-09-06T01:44:14.247Z"
description: "早在 1950 年代，随着 Lisp 语言的创建，函数式编程（ Functional Programming，简称 FP）就已经开始出现在大家视野。"
---

![](https://p1.music.126.net/G3dZoJnrN8X6km4fFs8BOg==/109951164345065483.png)

# 写在开头

本文较长，总共分为三大部分：(对于函数式编程以及其优点有一定理解的童鞋，可以直接从  [第二部分](#流水线的构建) 开始阅读)

第一部分：首先会通过实际代码介绍一下什么是函数式编程以及使用它的意义。

第二部分：我会着重介绍一下函数式编程中最重要的两个方法：柯里化和函数组合，以及他们的使用方法和实践经验。

第三部分：实战篇，主要是通过一个实战让大家对这种编程范式有一个更深刻的理解。

最后会总结一下函数式编程的优点和局限，并给出一些建议。

# 什么是函数式编程

早在 1950 年代，随着 Lisp 语言的创建，函数式编程（ Functional Programming，简称 FP）就已经开始出现在大家视野。

而直到近些年，函数式以其优雅，简单的特点开始重新风靡整个编程界，主流语言在设计的时候无一例外都会更多的参考函数式特性（ Lambda 表达式，原生支持 map ，reduce ……），Java8 开始支持函数式编程。

而在前端领域，我们同样能看到很多函数式编程的影子：ES6 中加入了箭头函数，Redux 引入 Elm 思路降低 Flux 的复杂性，React16.6 开始推出 React.memo()，使得 pure functional components 成为可能，16.8 开始主推 Hook，建议使用 pure function 进行组件编写……

这些无一例外的说明，函数式编程这种古老的编程范式并没有随着岁月而褪去其光彩，反而愈加生机勃勃。

另外还有一些例子能证明函数式编程也适应于大型软件的编写：

> WhatsApp：通过 Erlang，WhatsApp 可以支持 9 亿用户，而其团队中只有 **50 名工程师**。
>
> Discord：使用 **Elixir**，类似方式的 [Discord ](https://blog.discordapp.com/how-discord-handles-push-request-bursts-of-over-a-million-per-minute-with-elixirs-genstage-8f899f0221b4) **每分钟**处理超过一**百万个请求**。

于我个人而言，函数式编程就像第三次工业革命，前两次分别为命令式编程（Imperative programming）和面向对象编程（Object Oriented Programming）。

## 初窥

概念说的再多也不够例子直观

> Talk is cheap, show me the code

假设我们有这么个需求，我们登记了一系列人名存在数组中，现在需要对这个结构进行一些修改，需要把字符串数组变成一个对象数组，方便后续的扩展，并且需要把人名做一些转换：

```javascript
['john-reese', 'harold-finch', 'sameen-shaw'] 
// 转换成 
[{name: 'John Reese'}, {name: 'Harold Finch'}, {name: 'Sameen Shaw'}]
```

### 命令式编程

用传统的编程思路，我们一上来就可以撸代码，临时变量，循环走起来：

```javascript
const arr = ['john-reese', 'harold-finch', 'sameen-shaw'];
const newArr = [];
for (let i = 0, len = arr.length; i < len ; i++) {
  let name = arr[i];
  let names = name.split('-');
  let newName = [];
  for (let j = 0, naemLen = names.length; j < naemLen; j++) {
    let nameItem = names[j][0].toUpperCase() + names[j].slice(1);
    newName.push(nameItem);
  }
  newArr.push({ name : newName.join(' ') });
}
return newArr;
```

完成，这几乎是所有人下意识的编程思路，完全的面向过程。你会想我需要依次完成：

- 定义一个临时变量 newArr。
- 我需要做一个循环。
- 循环需要做 arr.length 次。
- 每次把名字的首位取出来大写，然后拼接剩下的部分。
- ……
- 最后返回结果。

这样当然能完成任务，最后的结果就是**一堆中间临时变量**，光想变量名就让人感到崩溃。同时过程中掺杂了大量逻辑，通常一个函数需要**从头读到尾才知道它具体做了什么**，而且一旦出问题很难定位。

### 函数式

一直以来，我也没觉得这样编程有什么问题，直到我遇到了函数式编程。我们来看一看一个 FPer 会如何思考这个问题：

1. 我只需要一个函数能实现从 `String 数组` 到 `Object 数组` 的转换：

![](https://p1.music.126.net/hy4dvlmQSTE6xuXdmeom9g==/109951164344650663.png)

```
convertNames :: [String] -> [Object]
```

2. 这里面涉及到一个 `String -> Object` 的转换，那我需要有这么个函数实现这种转换：

![](https://p1.music.126.net/VMFK_f-UGwLpZBs3jSckKQ==/109951164344727436.png)

```
convert2Obj :: String -> Object
```

3. 至于这种转换，可以轻松想到需要两个函数完成：

   - `capitalizeName`：把名称转换成指定形式
   - `genObj`：把任意类型转换成对象

   ![](https://p1.music.126.net/AF4Klv5IRbgdc_1sbmwMlA==/109951164344657013.png)

4. 如果再细想一下，`capitalizeName` 其实也是几个方法的组合（`split`, `join`, `capitalize`），剩下的几个函数都是非常容易实现的。

   ![](https://p1.music.126.net/Ud6uNeIpiHpUsac5lZMKoQ==/109951164344649758.png)

好了，我们的任务完成了，可以 [运行代码](https://codepen.io/voidsky/pen/NQOYjj)

```javascript
const capitalize = x => x[0].toUpperCase() + x.slice(1).toLowerCase();

const genObj = curry((key, x) => {
  let obj = {};
  obj[key] = x;
  return obj;
}) 

const capitalizeName = compose(join(' '), map(capitalize), split('-'));
const convert2Obj = compose(genObj('name'), capitalizeName)
const convertName = map(convert2Obj);

convertName(['john-reese', 'harold-finch', 'sameen-shaw'])
```

你可以先忽略其中的 `curry` 和 `compose` 函数（[后面](#流水线的构建) 会介绍)。只是看这个编程思路，可以清晰看出，函数式编程的思维过程是完全不同的，它的着眼点是**函数**，而不是**过程**，它强调的是如何通过函数的组合变换去解决问题，而不是我通过写什么样的语句去解决问题，当你的代码越来越多的时候，这种函数的拆分和组合就会产生出强大的力量。

## 为什么叫函数式编程

之前我们已经初窥了函数式编程，知道了它的魅力，现在我们继续深入了解一下函数式编程吧。

其实函数我们从小就学，什么一次函数，二次函数……根据学术上函数的定义，函数即是一种描述集合和集合之间的**转换关系**，输入通过函数都会返回**有且只有一个**输出值。

![](https://p1.music.126.net/cgCmOtNhHsZ_OPBzfi_QEA==/109951164344654118.png)

所以，**函数**实际上是一个**关系**，或者说是一种映射，而这种映射关系是可以组合的，一旦我们知道一个函数的输出类型可以匹配另一个函数的输入，那他们就可以进行组合。还记得之前写的 `convert2Obj`这个函数：

```javascript
const convert2Obj = compose(genObj('name'), capitalizeName)
```

它实际上就完成了映射关系的组合，把一个数据从 `String` 转换成了 `String` 然后再转换成 `Object`。数学好的童鞋就知道，这就是数学上的复合运算：`g°f = g(f(x))`

在我们的编程世界中，我们需要处理的其实也只有“数据”和“关系”，而关系就是函数。我们所谓的**编程工作**也不过就是在找一种**映射关系**，一旦关系找到了，问题就解决了，剩下的事情，就是让数据流过这种关系，然后转换成另一个数据罢了。

我特别喜欢用**流水线**去形容这种工作，把输入当做原料，把输出当做产品，**数据可以不断的从一个函数的输出可以流入另一个函数输入**，最后再输出结果，这不就是一套流水线嘛？

![](https://p1.music.126.net/lkSRxPaXWqOikXXEU70cBQ==/109951164345031080.png)

所以，现在你明确了函数式编程是什么了吧？它其实就是强调在编程过程中把更多的关注点放在如何去**构建关系**。通过构建一条高效的建流水线，一次解决所有问题。而不是把精力分散在不同的加工厂中来回奔波传递数据。

![](https://p1.music.126.net/RjzJYIUnzB0lU8wRNIEeRg==/109951164344652152.png)

## 函数式编程的特点

### 函数是“一等公民”  (First-Class Functions)

这是函数式编程得以实现的**前提**，因为我们基本的操作都是在操作函数。这个特性意味着函数与其他数据类型一样，处于平等地位，可以赋值给其他变量，也可以作为参数，传入另一个函数，或者作为别的函数的返回值，例如前面的 

```
const convert2Obj = compose(genObj('name'), capitalizeName)
```

### 声明式编程  (Declarative Programming)

通过上面的例子可以看出来，函数式编程大多时候都是在声明我需要做什么，而非怎么去做。这种编程风格称为 [声明式编程](https://zh.wikipedia.org/zh-cn/宣告式編程？oldformat=true) 。这样有个好处是代码的可读性特别高，因为声明式代码大多都是接近自然语言的，同时，它解放了大量的人力，因为它不关心具体的实现，因此它可以把优化能力交给具体的实现，这也方便我们进行分工协作。

SQL 语句就是声明式的，你无需关心 Select 语句是如何实现的，不同的数据库会去实现它自己的方法并且优化。React 也是声明式的，你只要描述你的 UI，接下来状态变化后 UI 如何更新，是 React 在运行时帮你处理的，而不是靠你自己去渲染和优化 diff 算法。

### 惰性执行（Lazy Evaluation）

所谓惰性执行指的是函数只在需要的时候执行，即不产生无意义的中间变量。像刚才的例子，函数式编程跟命令式编程最大的区别就在于几乎没有中间变量，它从头到尾都在写函数，只有在最后的时候才通过调用 `convertName` 产生实际的结果。

### 无状态和数据不可变  (Statelessness and Immutable data)

这是函数式编程的核心概念：

- **数据不可变：** 它要求你所有的数据都是不可变的，这意味着如果你想修改一个对象，那你应该创建一个新的对象用来修改，而不是修改已有的对象。
- **无状态：** 主要是强调对于一个函数，不管你何时运行，它都应该像第一次运行一样，给定相同的输入，给出相同的输出，完全不依赖外部状态的变化。

为了实现这个目标，函数式编程提出函数应该具备的特性：没有副作用和纯函数。

![](https://p1.music.126.net/3tYSzDof9TnHivM5rtHyfg==/109951164344708375.png)

### 没有副作用（No Side Effects）

副作用这个词我们可算听的不少，它的含义是：在完成函数主要功能之外完成的其他副要功能。在我们函数中最主要的功能当然是根据输入**返回结果**，而在函数中我们最常见的副作用就是**随意操纵外部变量**。由于 JS 中对象传递的是引用地址，哪怕我们用 `const` 关键词声明对象，它依旧是可以变的。而正是这个“漏洞”让我们有机会随意修改对象。

例如： `map` 函数的本来功能是将输入的数组根据一个函数转换，生成一个新的数组：

```
map :: [a] -> [b]
```

而在 JS 中，我们经常可以看到下面这种对 `map` 的 “错误” 用法，把 `map` 当作一个循环语句，然后去直接修改数组中的值。
```javascript
const list = [...];
// 修改 list 中的 type 和 age
list.map(item => {
  item.type = 1;
  item.age++;
})
```

这样函数最主要的输出功能没有了，变成了直接修改了外部变量，这就是它的副作用。而没有副作用的写法应该是：

```javascript
const list = [...];
// 修改 list 中的 type 和 age
const newList = list.map(item => ({...item, type: 1, age:item.age + 1}));
```

保证函数没有副作用，一来能保证数据的不可变性，二来能避免很多因为共享状态带来的问题。当你一个人维护代码时候可能还不明显，但随着项目的迭代，项目参与人数增加，大家对同一变量的依赖和引用越来越多，这种问题会越来越严重。最终可能连维护者自己都不清楚变量到底是在哪里被改变而产生 Bug。

> 传递引用一时爽，代码重构火葬场

### 纯函数 (pure functions)

纯函数算是在 “没有副作用” 的要求上再进一步了。相信你已经在很多地方接触过这个词，在 [Redux 的三大原则中](https://redux.js.org/introduction/three-principles)，我们看到，它要求所有的修改必须使用纯函数。

> Changes are made with pure functions

其实纯函数的概念很简单就是两点：

- **不依赖外部状态（无状态）：** 函数的的运行结果不依赖全局变量，this 指针，IO 操作等。

- **没有副作用（数据不变）：** 不修改全局变量，不修改入参。

所以纯函数才是真正意义上的 “函数”， 它意味着**相同的输入，永远会得到相同的输出**。

以下几个函数都是不纯的，因为他们都依赖外部变量，试想一下，如果有人调用了 `changeName` 对 `curUser` 进行了修改，然后你在另外的地方调用了 `saySth` ，这样就会产生你预料之外的结果。

```javascript
const curUser = {
  name: 'Peter'
}

const saySth = str => curUser.name + ': ' + str;   // 引用了全局变量
const changeName = (obj, name) => obj.name = name;  // 修改了输入参数
changeName(curUser, 'Jay');  // { name: 'Jay' }
saySth('hello!'); // Jay: hello!
```

如果改成纯函数的写法会是怎么样呢？

```javascript
const curUser = {
  name: 'Peter'
}

const saySth = (user, str) => user.name + ': ' + str;   // 不依赖外部变量
const changeName = (user, name) => ({...user, name });  // 未修改外部变量

const newUser = changeName(curUser, 'Jay');  // { name: 'Jay' }
saySth(curUser, 'hello!'); // Peter: hello!
```

这样就没有之前说的那些问题了。

我们这么强调使用纯函数，纯函数的意义是什么？

- **便于测试和优化**：这个意义在实际项目开发中意义非常大，由于纯函数对于相同的输入永远会返回相同的结果，因此我们可以轻松断言函数的执行结果，同时也可以保证函数的优化不会影响其他代码的执行。这十分符合**测试驱动开发 TDD（Test-Driven Development )** 的思想，这样产生的代码往往健壮性更强。

- **可缓存性**：因为相同的输入总是可以返回相同的输出，因此，我们可以提前缓存函数的执行结果，有很多库有所谓的 `memoize` 函数，下面以一个简化版的 `memoize` 为例，这个函数就能缓存函数的结果，对于像 `fibonacci` 这种计算，就可以起到很好的缓存效果。

```javascript
  function memoize(fn) {
    const cache = {};
    return function() {
      const key = JSON.stringify(arguments);
      var value = cache[key];
      if(!value) {
        value = [fn.apply(null, arguments)];  // 放在一个数组中，方便应对 undefined，null 等异常情况
        cache[key] = value; 
      }
      return value[0];
    }
  }

  const fibonacci = memoize(n => n < 2 ? n: fibonacci(n - 1) + fibonacci(n - 2));
  console.log(fibonacci(4))  // 执行后缓存了 fibonacci(2), fibonacci(3),  fibonacci(4)
  console.log(fibonacci(10)) // fibonacci(2), fibonacci(3),  fibonacci(4) 的结果直接从缓存中取出，同时缓存其他的
```

- **自文档化**：由于纯函数没有副作用，所以其依赖很明确，因此更易于观察和理解（配合后面介绍的 [类型签名](#hindly-milner 类型签名）更佳)。

- **更少的 Bug**：使用纯函数意味着你的函数中**不存在指向不明的 this，不存在对全局变量的引用，不存在对参数的修改**，这些共享状态往往是绝大多数 bug 的源头。

好了，说了这么多，接下来就让我们看看在 JS 中如何使用函数式编程吧。

# 流水线的构建

如果说函数式编程中有两种操作是必不可少的那无疑就是**柯里化（Currying）**和**函数组合（Compose）**，柯里化其实就是流水线上的**加工站**，函数组合就是我们的**流水线**，它由多个加工站组成。

接下来，就让我们看看如何在 JS 中利用函数式编程的思想去组装一套高效的流水线。
## 加工站——柯里化

柯里化的意思是将一个多元函数，转换成一个依次调用的**单元函数**。

```javascript
f(a,b,c) → f(a)(b)(c)
```
我们尝试写一个 `curry` 版本的 `add` 函数
```javascript
var add = function(x) {
  return function(y) {
    return x + y;
  }; 
};
const increment = add(1);

increment(10); // 11
```

为什么这个单元函数很重要？还记得我们之前说过的，函数的返回值，**有且只有一个嘛？** 如果我们想顺利的组装流水线，那我就必须保证我每个加工站的输出刚好能流向下个工作站的输入。**因此，在流水线上的加工站必须都是单元函数。**

现在很好理解为什么柯里化配合函数组合有奇效了，因为柯里化处理的结果刚好就是**单输入**的。

### 部分函数应用 vs 柯里化

经常有人搞不清柯里化和**部分函数应用** ( Partial Function Application )，经常把他们混为一谈，其实这是不对的，在维基百科里有明确的定义，部分函数应用强调的是固定一定的参数，返回一个**更小元的函数**。通过以下表达式展示出来就明显了：

```javascript
// 柯里化
f(a,b,c) → f(a)(b)(c)
// 部分函数调用
f(a,b,c) → f(a)(b,c) / f(a,b)(c)
```

**柯里化**强调的是**生成单元函数**，**部分函数应用**的强调的**固定任意元参数**，而我们平时生活中常用的其实是**部分函数应用**，这样的好处是可以固定参数，降低函数通用性，提高函数的适合用性。

```javascript
// 假设一个通用的请求 API
const request = (type, url, options) => ...
// GET 请求
request('GET', 'http://....')
// POST 请求
request('POST', 'http://....')

// 但是通过部分调用后，我们可以抽出特定 type 的 request
const get = request('GET');
get('http://', {..})
```

### 高级柯里化

通常我们不会自己去写 `curry` 函数，现成的库大多都提供了 `curry` 函数的实现，但是使用过的人肯定有会有疑问，我们使用的 Lodash，Ramda 这些库中实现的 `curry` 函数的行为好像和柯里化不太一样呢，他们实现的好像是部分函数应用呢？

```javascript
const add = R.curry((x, y, z) =>  x + y + z);
const add7 = add(7);
add7(1,2) // 10
const add1_2 = add(1,2);
add1_2(7) // 10 
```

其实，这些库中的 `curry` 函数都做了很多优化，导致这些库中实现的柯里化其实不是纯粹的柯里化，我们可以把他们理解为“高级柯里化”。这些版本实现可以根据你输入的参数个数，**返回一个柯里化函数/结果值**。即，**如果你给的参数个数满足了函数条件，则返回值**。这样可以解决一个问题，就是如果一个函数是多输入，就可以避免使用 `(a)(b)(c)` 这种形式传参了。

所以上面的 `add7(1, 2)` 能直接输出结果不是因为 `add(7)` 返回了一个接受 2 个参数的函数，而是你刚好传了 2 个参数，满足了所有参数，因此给你计算了结果，下面的代码就很明显了：

```javascript
const add = R.curry((x, y, z) =>  x + y + z);
const add7 = add(7);
add(7)(1) // function
```

如果 `add7` 是一个接受 2 个参数的函数，那么 `add7(1)` 就不应该返回一个 function 而是一个值了。

因此，记住这句话：**我们可以用高级柯里化去实现部分函数应用，但是柯里化不等于部分函数应用**。

### 柯里化的应用

通常，我们在实践中使用柯里化都是为了把某个函数变得单值化，这样可以增加函数的多样性，使得其适用性更强：

```javascript
const replace = curry((a, b, str) => str.replace(a, b));
const replaceSpaceWith = replace(/\s*/);
const replaceSpaceWithComma = replaceSpaceWith(',');
const replaceSpaceWithDash = replaceSpaceWith('-');
```
通过上面这种方式，我们从一个 `replace` 函数中产生很多新函数，可以在各种场合进行使用。

更重要的是，单值函数是我们即将讲到的**函数组合的基础**。

## 流水线——函数组合

上面我们借助 `curry`，已经可以很轻松的构造一个加工站了，现在就是我们组合成流水线的时候了。

### 函数组合概念

函数组合的目的是将多个函数组合成一个函数。下面来看一个简化版的实现：

```javascript
const compose = (f, g) => x => f(g(x))

const f = x => x + 1;
const g = x => x * 2;
const fg = compose(f, g);
fg(1) //3
```

我们可以看到 `compose` 就实现了一个简单的功能：形成了一个全新的函数，而这个函数就是一条从 `g -> f` 的流水线。同时我们可以很轻易的发现 `compose` 其实是满足结合律的

```javascript
compose(f, compose(g, t)) = compose(compose(f, g), t)  = f(g(t(x)))
```

只要其顺序一致，最后的结果是一致的，因此，我们可以写个更高级的 `compose`，支持多个函数组合：

```javascript
compose(f, g, t) => x => f(g(t(x))
```

简单实现如下：

```javascript
const compose = (...fns) => (...args) => fns.reduceRight((val, fn) => fn.apply(null, [].concat(val)), args);

const f = x => x + 1;
const g = x => x * 2;
const t = (x, y) => x + y;

let fgt = compose(f, g, t);
fgt(1, 2); // 3 -> 6 -> 7
```

### 函数组合应用

考虑一个小功能：将数组最后一个元素大写，假设 `log`, `head`，`reverse`，`toUpperCase` 函数存在（我们通过 `curry` 可以很容易写出来）

命令式的写法：

```javascript
log(toUpperCase(head(reverse(arr))))
```

面向对象的写法：

```javascript
arr.reverse()
  .head()
  .toUpperCase()
  .log()
```

链式调用看起来顺眼多了，然而问题在于，原型链上可供我们链式调用的函数是有限的，而需求是无限的 ，这限制了我们的逻辑表现力。

再看看，现在通过组合，我们如何实现之前的功能：

```javascript
const upperLastItem = compose(log, toUpperCase, head, reverse);
```

通过参数我们可以很清晰的看出发生了 uppderLastItem 做了什么，它完成了一套流水线，所有经过这条流水线的参数都会经历：`reverse` -> `head` -> `toUpperCase` -> `log` 这些函数的加工，最后生成结果。

![](https://p1.music.126.net/u0YAE5OdYhaHbe3KSrCz5g==/109951164344643955.png)

最完美的是，这些函数都是非常简单的纯函数，你可以随意组合，随意拿去用，不用有任何的顾忌。

其实有些经验丰富的程序猿已经看出来一些蹊跷，这不就是所谓管道 ( `pipe` ) 的概念嘛？在 Linux 命令中常会用到，类似`ps` `grep`的组合

```
ps -ef | grep nginx
```

只是管道的执行方向和 compose (从右往左的组合 ) 好像刚好相反，因此很多函数库（Lodash，Ramda）中也提供了另一种组合方式：`pipe`（从左往右的组合）

```javascript
const upperLastItem = R.pipe(reverse, head, toUppderCase, log);
```

其实函数式编程的理念和 Linux 的设计哲学很像：

> 有众多单一目的的小程序，一个程序只实现一个功能，多个程序组合完成复杂任务。

### 函数组合的好处

函数组合的好处显而易见，它让代码变得简单而富有可读性，同时通过不同的组合方式，我们可以轻易组合出其他常用函数，让我们的代码更具表现力

```javascript
// 组合方式 1
const last = compose(head, reverse);
const shout = compose(log, toUpperCase);
const shoutLast = compose(shout, last);
// 组合方式 2
const lastUppder = compose(toUpperCase, head, reverse);
const logLastUpper = compose(log, lastUppder);
```

这个过程，就像搭乐高积木一样。

![lego](https://p1.music.126.net/vAoHawHk1mfmDDRoTgPR8w==/109951164344643956.png)

由此可见，大型的程序，都可以通过这样一步步的拆分组合实现，而剩下要做的，就是去构造足够多的积木块（函数）。

## 实践经验

在使用柯里化和函数组合的时候，有一些经验可以借鉴一下：

### 柯里化中把要操作的数据放到最后

因为我们的输出通常是需要操作的数据，这样当我们固定了之前的参数（我们可以称为**配置**）后，可以变成一个单元函数，直接被**函数组合**使用，这也是其他的函数式语言遵循的规范：

```javascript
const split = curry((x, str) => str.split(x));
const join = curry((x, arr) => arr.join(x));
const replaceSpaceWithComma = compose(join(','), split(' '));
const replaceCommaWithDash = compose(join('-'), split(','));
```

但是如果有些函数没遵循这个约定，我们的函数该如何组合？当然也不是没办法，很多库都提供了占位符的概念，例如 Ramda 提供了一个占位符号（`R.__`）。假设我们的 `split` 把 `str` 放在首位

```javascript
const split = curry((str, x) => str.split(x));
const replaceSpaceWithComma = compose(join(','), split(R.__, ' '));
```

### 函数组合中函数要求单输入

函数组合有个使用要点，就是中间的函数一定是**单输入**的，这个很好理解，之前也说过了，因为函数的输出都是单个的（数组也只是一个元素）。

### 函数组合的 Debug

当遇到函数出错的时候怎么办？我们想知道在哪个环节出错了，这时候，我们可以借助一个辅助函数 `trace`，它会临时输出当前阶段的结果。

```javascript
const trace = curry((tip, x) => { console.log(tip, x); return x; });
const lastUppder = compose(toUpperCase, head, trace('after reverse'), reverse);
```

### 多参考 Ramda

现有的函数式编程工具库很多，Lodash/fp 也提供了，但是不是很推荐使用 Lodash/fp 的函数库，因为它的很多函数把需要处理的参数放在了首位（ 例如 `map` ）这不符合我们之前说的最佳实践。

这里推荐使用 [Ramda](http://Ramda.cn/docs/)，它应该是目前最符合函数式编程的工具库，它里面的所有函数都是 `curry` 的，而且需要操作的参数都是放在最后的。上述的 `split`，`join`，`replace` 这些基本的都在 Ramda 中可以直接使用，它一共提供了 200 多个超实用的函数，合理使用可以大大提高你的编程效率（目前我的个人经验来说，我需要的功能它 90%都提供了）。

# 实战一下

现在你已经基本学会了所有的基础概念，那让我们来实战一下吧！

假设我现在有一套数据：

```
const data = [
  {
    name: 'Peter',
    sex: 'M',
    age: 18,
    grade: 99
  },
  ……
]
```

实现以下几个常用功能：

1. 获取所有年龄小于 18 岁的对象，并返回他们的名称和年龄。
2. 查找所有男性用户。
3. 更新一个指定名称用户的成绩（不影响原数组）。
4. 取出成绩最高的 10 名，并返回他们的名称和分数。

我这边提供以下 Ramda 库中的参考函数：

```javascript
// 对象操作（最后一个参数是对象），均会返回新的对象拷贝
R.prop('name')    // 获取对象 name 字段的值
R.propEq('name', '123')   // 判断对象 name 字段是否等于‘123’
R.assoc('name', '123')   // 更新对象的'name'的值为'123'
R.pick(['a', 'd']); //=> {a: 1, d: 4}  // 获取对象某些属性，如果对应属性不存在则不返回
R.pickAll(['a', 'd']); //=> {a: 1, d: 4}  // 获取对象某些属性，如果对应属性不存在则返回`key : undefined`

// 数组操作
R.map(func)  // 传统的 map 操作
R.filter(func)  // 传统的 filter 操作
R.reject(func)  // filter 的补集
R.take(n)    // 取出数组前 n 个元素

// 比较操作
R.equals(a, b)  // 判断 b 是否等于 a 
R.gt(2, 1) => true  // 判断第一个参数是否大于第二个参数
R.lt(2, 1) => false // 判断第一个参数是否小于第二个参数

// 排序操作
R.sort(func)    // 根据某个排序函数排序
R.ascend(func)    // 根据 func 转换后的值，生成一个升序比较函数
R.descend(func)    // 根据 func 转换后的值，生成一个降序比较函数
// 例子：
R.sort(R.ascend(R.prop('age')))  // 根据 age 进行升序排序 

// 必备函数
R.pipe()   //compose 的反向，从前往后组合
R.compose()  // 从后到前组合
R.curry()  // 柯里化
```

可以想想看，如果是你会如何写这些函数，我这里提供了一个 [codepen 的模板](https://codepen.io/voidsky/pen/wvwKNwe)，可以在这里写你的答案，会自动测试。

![](https://p1.music.126.net/jGhtcp6Y-Vc5SRXe1-hw_A==/109951164344653780.png)

（我的答案放在文章后面，请先思考完再看）

# 附录

## Hindly Milner 类型签名

之前我们遇到了类似这样的说明：

```
:: String -> Object
```

这叫类型签名，最早是在 Hindley-Milner 类型系统中提出来的。

你也能在 Ramda 的官网上看到类似的类型签名：

![](https://p1.music.126.net/oBW106Mx5ERd72qeJ-QH0g==/109951164344660062.png)

引入它的好处显而易见，短短一行，就能暴露函数的行为和目的，方便我们了解语义。有时候一个函数可能很长，光从代码上很难理解它到底做了什么：

```javascript
const replace = reg => sub => str => str.replace(reg, sub);
```

而加上类型签名，我们至少能知道每一步它做了哪些转换，最后输出一个什么样的结果。

例如这个 replace ，通过类型签名我们知道它接受一个 `正则表达` 式和两个 `String`，最后会返回一个 `String`。

```javascript
//  replace :: Regex -> String -> String -> String
const replace = reg => sub => str => str.replace(reg, sub);
```

这样的连续箭头看起来可能很头疼，其实稍微组合一下可以发现，它就是柯里化的意思：先传一个 `正则表达式` 会返回一个函数，如果再传一个 `String`，也会返回函数……直到你输入了最后一个 `String`，就会返回一个 `String` 的结果。

```javascript
//  replace :: Regex -> （String -> （String -> String))
```

同时类型签名可以避免我们在合并函数的时候输入和输出的类型不一致。

例如 join 函数通过类型签名很明显是传入一个 String 的配置，然后就可以将一个 `String 数组` 转换成 `String`。

```javascript
// join :: String -> [String] -> String
const join = curry((sep, arr) => arr.join(sep));
```

同样，下面这个函数，它接受一个 `String`，然后经过 strLen 转换能返回一个 `Number`。

```javascript
// strLen :: String -> Number
const strLen = str => str.length();
```

那我们很容易知道，以上两个函数完全可以组合，因为他们输入和输出类型一致，通过组合我们可以完成一个 `String 数组` 到 `Number` 的流水线。

```javascript
const joinDash = join('-');
const lengthWithDash = compose(strLen, joinDash);
lengthWithDash(['abc', 'def']);  // 7
```

当然还有时候你的函数可能不是接受特定的类型，而只是做一些通用的事情，此时我们可以用 a, b, c…… 这些来替代一些通用类型，例如 `map` ，它传入一个可以把 a 转换成 b 的函数，然后把`a 数组` 转换成`b 数组`。

```javascript
//  map :: (a -> b) -> [a] -> [b]
var map = curry(function(f, xs){
  return xs.map(f);
});

//  head :: [a] -> a
var head = function(xs){ return xs[0]; }
```

现在你就学会了类型签名的使用了，我们推荐你写的每个函数都加上类型签名，方便他人，方便自己。

## Pointfree 编程风格

我之前提过一下 Pointfree 这种编程风格，它其实就是强调在整个函数编写过程中不出现参数（point），而只是通过函数的组合生成新的函数，实际数据只需要在最后使用函数的时候再传入即可。

```javascript
// Pointfree  没有出现需要操作的参数
const upperLastItem = compose(toUpperCase, head, reverse);

// 非 Pointfree 出现了需要操作的参数
const upperLastItem = arr => {
  const reverseArr = arr.reverse();
  const head = reverseArr[0];
  return head.toUpperCase();
}
```

我们在使用函数式编程的时候，其实自然就会形成这种风格，它有什么好处呢？

- **无需考虑参数命名**：能减轻不少思维负担，毕竟参数命名也是个很费事的过程。
- **关注点集中**：你无需考虑数据，只需要把所有的注意力集中在转换关系上。
- **代码精简**：可以省去通过中间变量不断的去传递数据的过程。
- **可读性强**：一眼就可以看出来数据的整个的转换关系。

刚开始使用这种编程风格肯定会有很多不适应，但是当你能合理运用这种编程风格后确实会让代码更加简洁和易于理解了。但是凡事无绝对，学了 Pointfree 这种风格并不意味着你要强迫自己做到一个参数都不能出现（比如很多基础函数，他们本身的编写就不是 Pointfree 的），函数式编程也不是所有场合都完全适用的，**具体情况具体分析**。

记住，你学习各种编程范式的**最终目的都是为了让自己的编码更加高效，易懂，同时减少出错概率**，不能因为学了一种编程范式，反而导致自己的编程成本大大增加，这就有点本末倒置了。

## 实战答案

当你写完函数，你可以看一下，你写的函数是不是足够的通用？如果我现在需求由获取男性用户变成获取所有的女性用户，如果我现在要取所有年龄前 10 名的用户，你的函数是否可以很好的复用呢？答案的 [codepen 地址](https://codepen.io/voidsky/pen/PoYPJqm)，我这里的答案也不一定是最优的，只是提供一个思路（就像 `update`，你可以不用 `map`，而用 `R.update` 直接更新数组元素）。

如果在不看答案前，你能写出所有这些操作，那说明你对函数的组合应用的很好了！

# 总结

前面介绍了很多函数式编程的概念可以总结出函数式编程的优点：

- **代码简洁，开发快速**：函数式编程大量使用函数的组合，函数的复用率很高，减少了代码的重复，因此程序比较短，开发速度较快。Paul Graham 在《黑客与画家》一书中写道：同样功能的程序，极端情况下，Lisp 代码的长度可能是 C 代码的二十分之一。
- **接近自然语言，易于理解**：函数式编程大量使用声明式代码，基本都是接近自然语言的，加上它没有乱七八糟的循环，判断的嵌套，因此特别易于理解。
- **易于"并发编程"**：函数式编程没有副作用，所以函数式编程不需要考虑“死锁”（Deadlock），所以根本不存在“锁”线程的问题。
- **更少的出错概率**：因为每个函数都很小，而且相同输入永远可以得到相同的输出，因此测试很简单，同时函数式编程强调使用纯函数，没有副作用，因此也很少出现奇怪的 Bug。

因此，如果用一句话来形容函数式编程，应该是：`Less code, fewer bugs` 。因为写的代码越少，出错的概率就越小。人是最不可靠的，我们应该尽量把工作交给计算机。

一眼看下来好像函数式可以解决所有的问题，但是实际上，函数式编程也不是什么万能的灵丹妙药。正因为函数式编程有以上特点，所以它天生就有以下缺陷：

- **性能**：函数式编程相对于指令式编程，性能绝对是一个短板，因为它往往会对一个方法进行过度包装，从而产生上下文切换的性能开销。同时，在 JS 这种非函数式语言中，函数式的方式必然会比直接写语句指令慢（引擎会针对很多指令做特别优化）。就拿原生方法 `map` 来说，它就要比纯循环语句实现迭代慢 8 倍。

- **资源占用**：在 JS 中为了实现对象状态的不可变，往往会创建新的对象，因此，它对垃圾回收（Garbage Collection）所产生的压力远远超过其他编程方式。这在某些场合会产生十分严重的问题。

- **递归陷阱**：在函数式编程中，为了实现迭代，通常会采用递归操作，为了减少递归的性能开销，我们往往会把递归写成尾递归形式，以便让解析器进行优化。但是众所周知，JS 是不支持尾递归优化的（虽然 ES6 中将尾递归优化作为了一个规范，但是真正实现的少之又少，[传送门](http://kangax.github.io/compat-table/es6/)）
-  ……

因此，在性能要求很严格的场合，函数式编程其实并不是太合适的选择。

但是换种思路想，软件工程界从来就没有停止过所谓的银弹之争，却也从来没诞生过什么真正的银弹，各种编程语言层出不穷，各种框架日新月异，各种编程范式推陈出新，结果谁也没有真正的替代谁。

学习函数式编程真正的意义在于：让你意识到在指令式编程，面向对象编程之外，还有一种全新的编程思路，一种用函数的角度去**抽象**问题的思路。学习函数式编程能大大丰富你的武器库，不然，***当你手中只有一个锤子，你看什么都像钉子***。

我们完全可以在日常工作中将函数式编程作为一种辅助手段，在条件允许的前提下，借鉴函数式编程中的思路，例如：

- 多使用纯函数减少副作用的影响。
- 使用柯里化增加函数适用率。
- 使用 Pointfree 编程风格，减少无意义的中间变量，让代码更且可读性。
- ……

最后，还是那句老生常谈的话：

> 没有最好的，只有最适合的

希望大家在实际项目中，能根据自己的需求选择最适合自己的编程范式，也希望通过学习这种新的编程范式，可以让我们在二进制的世界行走得更加游刃有余。

# 参考文章

[mostly-adequate-guide-chinese](https://legacy.gitbook.com/book/llh911001/mostly-adequate-guide-chinese)

[百度百科：函数式编程](https://baike.baidu.com/item/%E5%87%BD%E6%95%B0%E5%BC%8F%E7%BC%96%E7%A8%8B/4035031?fr=aladdin)

[百度百科：范畴学](https://baike.baidu.com/item/%E8%8C%83%E7%95%B4%E8%AE%BA/8281114?fr=aladdin)

[clojure-flavored-javascript](https://oyanglul.us/clojure-flavored-javascript/zh/)

[https://en.wikipedia.org/wiki/Currying](https://en.wikipedia.org/wiki/Currying)

[https://en.wikipedia.org/wiki/Partial_application](https://en.wikipedia.org/wiki/Partial_application)

[why you should learn functional programming](https://dev.to/allanmacgregor/you-should-learn-functional-programming-in-2018-4nff)

[未来属于声明式编程](http://djyde.github.io/blog/declarative-programming-is-the-future/)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，欢迎自由转载，转载请保留出处。我们对人才饥渴难耐，快来 [加入我们](mailto:grp.music-fe@corp.netease.com)！
