---
title: 前端 DSL 实践指南（上）—— 内部 DSL
date: "2020-02-20T01:28:04.656Z"
description: "本文作者由于工作经历上的特殊性，积累了一些关于前端 DSL 的实践经验（主要是外部 DSL），在所维护的开源项目中也有一些体现，同时作者在社区也有过一些不成体系的回答如《如何写一个类似 LESS 的编译工具》。这次我会尝试从前端开发的视角来完整探讨下 DSL 这个「难以细说」的议题。"
---

![](https://p1.music.126.net/Q8E0TTueLF3B-97bZ1Pu7g==/109951164718518922.png)

## 前言

近几年，前端社区中 DSL 这个词开始频繁出镜，这和环境的变化有很大关系：

1. React、Vue、Angular 等现代框架的表现层设计往往和 DSL 有较强的关联，透过这些优秀作品我们可以得到一些实践指引。
2. 前端相关语言的转编译工具链趋于成熟，如 [babel](https://babeljs.io/)，[postcss](https://postcss.org/) 等工具可以帮助开发者以扩展插件的方式低成本地参与到语言构建流程中。
3. 社区的解析器生成工具开始普及，如 [jison](https://github.com/zaach/jison)、[PEG.js](https://pegjs.org/) 等，可以帮助开发者快速实现全新的编程语言（一般是模板等外部 DSL）。

虽然在「术」的实践中我们开始百花齐放，但同时也产生了一些误区或迷思，比如会将 DSL 和转编译这种纯技术议题划上等号，比如会分不清内部 DSL 和库（接口）的边界等等，**DSL** 因此成了一个人人都在说但却又很陌生的词汇。

同时市面上的权威著作如 Martin Fowler 的《领域特定语言》虽然会偏向于「道」的解答，但里面充斥着诸如「格兰特小姐的密室控制器」以及「蹦蹦高证券公司」等等对国内前端开发者而言会水土不服的晦涩案例。实际上前端的日常工作已经和 DSL 有着千丝万缕的关系，作为开发者已经不需要通过这些生涩案例来学习 DSL。

本文作者由于工作经历上的特殊性，积累了一些关于前端 DSL 的实践经验（主要是外部 DSL），在所维护的[开源项目](https://github.com/leeluolee)中也有一些体现，同时作者在社区也有过一些不成体系的回答如[《如何写一个类似 LESS 的编译工具》](https://www.zhihu.com/question/20140718/answer/114360444)。这次我会尝试从前端开发的视角来完整探讨下 DSL 这个 **「难以细说」** 的议题。

由于篇幅关系，本文会分为两个部分：

- 第一部分：DSL 初识 + 内部 DSL；
- 第二部分：外部 DSL + 前端 DSL 实践总结。

## DSL 初识

> 和很多计算机领域的概念一样，DSL 其实也算是先有实践再有定义。

DSL 即「Domain Specific Language」，中文一般译为「领域特定语言」，在[《领域特定语言》](https://book.douban.com/subject/21964984/)这本书中它有了一个定义：

> 一种为**特定领域**设计的，具有**受限表达性**的**编程语言**

编程语言的发展其实是一个不断抽象的过程，比如从机器语言到汇编语言然后到 C 或 Ruby 这类高级语言：

![](https://p1.music.126.net/r-ABJCj5yjZpkyKi0dTHCg==/109951164487803327.png)

如上图所示，汇编语言通过助记符代替机器指令操作码，极大的增强了机器语言的可读性和可维护性。但本质上它仍是一门面向处理器和寄存器等硬件系统的低级编程语言。高级语言的出现解决了这个问题，真正脱离了对机器指令集的直接关联，以上层抽象的语句(流程控制、循环等)和数据结构等更趋近自然语言和数学公式的方式完成编码工作，大大提升了程序开发的效率。

但在高级语言层面，抽象带来的效率提升似乎有了天花板。无论是从 C 到 Java，抑或是各种编程范式下衍生的抽象度更高的编程语言，解决的都是通用编程问题，它们都有充分的过程抽象和数据抽象，导致大量的概念产生，进而影响了编程效率。

而在一些专有领域的任务处理上其实不需要那么多语言特性，DSL 就是在这种矛盾中产生的破局方案，它是为了解决特定任务的语言工具，比如文档编写有 markdown，字符串匹配有 RegExp，任务控制有 make、gradle，数据查找有 SQL，Web 样式编码有 CSS 等等。它的本质其实和我们很多软件工程问题的解决思路一样，**通过限定问题域边界，从而锁定复杂度，提高编程效率**。

我们先来个简单的例子，比如表示**2周前的时间**：

**解法一**

```js
new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 2);
```

**解法二**

```ts
2 weeks ago
```

**解法三**

```ts
(2).weeks().ago();
```

解法一是符合通用编程思维的解答，但即使作为程序员的我们也无法一眼看出其含义。

解法二和解法三其实就是 DSL 的两种不同类型——外部 DSL 和内部 DSL，它们的直观性显然更高（不信可以问问你的女朋友），但它却无法直接运行，假如你尝试在 JavaScript 环境下运行它，将会获得完全不同的错误：

- `2 weeks ago` 会得到 `Uncaught SyntaxError: Unexpected identifier` 的**语法错误**。
- `(2).weeks().ago()` 则会得到一个 `Uncaught TypeError: 2.weeks is not a function` 的**运行时类型错误**。

> 其实从错误类型上我们就可以看到它们是有本质不同的。


#### **外部 DSL 简述**

解法二称之为**外部 DSL** ，它是一种独立的编程语言，需要从解析器开始实现自己的编译工具，实现成本较高。但它的语法的灵活性更高，更容易达到用户的表现力需求。

外部 DSL 的直接对应就是 GPPL，由于受限语法特性更少，一般不要求图灵完备，所以它实现难度会低于 GPPL。

>GPPL 即 「General Purpose Programming Language」，又称通用编程语言，例如我们常用的 JavaScript，它们被设计用来解决通用编程问题。


前端常用的模板引擎如 [mustache](http://mustache.github.io/) 以及 React、Vue 支持的 JSX 语法都属于外部 DSL。

**mustache 的例子**：
```html
<h2>Names</h2>
{{#names}}
  <strong>{{name}}</strong>
{{/names}}
```

_这可比手动拼装字符串高效多了。_

#### **内部 DSL 简述**

解法三我们称之为 **内部 DSL（Embedded DSL or Internal DSL）** ，它是建立在其它宿主语言之上（一般为 GPPL）的特殊 DSL，它与宿主语言共享编译与调试工具等基础设施，学习成本更低，也更容易被集成。他在语法上与宿主语言同源，但在运行时上需要做额外的封装。

你也可以将内部DSL视为针对特定任务的特殊接口封装风格，比如 jQuery 就可以认为是针对 DOM 操作的一种内部 DSL。

内部 DSL 的语法灵活度和语法噪音（syntactic noise）往往取决于宿主语言的选择，本篇的例子我们会围绕 JavaScript 来展开。

> **syntactic noise** is syntax within a programming language that makes the programming language more difficult to read and understand for humans.

_简而言之：看着蛋疼，写着蛋疼。_

最后我们来看下内部 DSL 以及外部 DSL 与一般通用语言 GPPL 的关系：

![](https://p1.music.126.net/3GtdKqgxbkzEY_-Z7AH8Uw==/109951164714003301.png)

其中内部 DSL 的定义一直是社区辩论的焦点，为了理解内部 DSL 究竟是什么，我们先来熟悉下内部 DSL 的典型构建风格。

## 内部 DSL 风格指南（JavaScript 描述）

结合 JavaScript 构建内部 DSL 其实有一些可套用的风格可循。

### 风格 1：级联方法

级联方法是内部 DSL 的最常用模式，我们先以原生 DOM 操作作为反面案例：

```js
const userPanel = document.querySelector('#user_panel');

userPanel.addEventListener('click', hidePanel);

slideDown(userPanel); //假设这是一个已实现的动画封装

const followButtons = userPanel.querySelectorAll('button');

followButtons.forEach(node => {
  node.innerHTML = 'follow';
});
```

相信大家很难一眼看出做了什么，但假如我们使用远古框架 jQuery 来实现等价效果：

```js
$('#user_panel')
  .click(hidePanel)
  .slideDown()
  .find('button')
  .html('follow');
```

就很容易理解其中的含义：

1. 找到 `#user_panel` 节点；
2. 设置点击后隐藏它；
2. 向下动效展开；
4. 然后找到它下面的所有 button 节点；
5. 为这些按钮填充 follow 内容。

级联方法等链式调用风格的核心在于**调用不再设计特定返回值，而是直接返回下一个上下文（通常是自身）**，从而实现级联调用。

### 风格 2：级联管道

级联管道只是一种级联方法的特殊应用，代表案例就是 [gulp](https://gulpjs.com/)：

> gulp 是一种类似 make 构建任务管理工具，它将文件抽象为一种叫 [Vinyl](https://github.com/gulpjs/vinyl)(Virtual file format) 的类型，抽象文件使用 pipe 方法依次通过 transformer 从而完成任务。

```js
gulp.src('./scss/**/*.scss')
  .pipe(plumber())
  .pipe(sass())
  .pipe(rename({ suffix: '.min' }))
  .pipe(postcss())
  .pipe(dest('./css'))
```

很多人会觉得 `gulp` 似曾相识，因为它的设计哲学是衍生自 Unix 命令行中的管道，上例可以直接类比以下命令：

```bash
cat './scss/**/*.scss' | plumber | sass | rename --suffix '.min' | postcss | dest './css/'
```

上述针对 Pipeline 的抽象也有用常规级联调用的方式来构建 DSL，比如 [chajs](https://github.com/chajs/cha)：

```js
cha()
  .glob('./scss/**/*.scss')
  .plumber()
  .sass()
  .rename({ suffix: '.min' })
  .postcss()
  .dest('./css')
```

> 上述只是 DSL 的语法类比，chajs 不一定有 `plumber` 等功能模块。


由于减少了多个 `pipe`，代码显然是有减少的，但流畅度上并没有更大的提升。

其次 `chajs` 的风格要求这些扩展方法都注册到实例中，这就平添了集成成本，这些集成代码也会影响到 DSL 的流畅度。

```js
cha
  .in('glob', require('task-glob'))
  .in('combine', require('task-combine'))
  .in('replace', require('task-replace'))
  .in('writer', require('task-writer'))
  .in('uglifyjs', require('task-uglifyjs'))
  .in('copy', require('task-copy'))
  .in('request', require('task-request'))
```

相比之下，`gulp` 将扩展统一抽象为一种外部 `transformer`，显然设计的更加优雅。


### 风格 3：级联属性

级联方法如文章开篇的 `(2).weeks().ago()` ，其实还不够简洁，存在明显的语法噪音，`(2).weeks.ago` 显然是个更好的方式，我们可以通过属性静态代理来实现，核心就是 `Object.defineProperty()`，它可以劫持属性的 `setter` 与 `getter`：

```js
const hours = 1000 * 60 * 60;
const days = hours * 24;
const weeks = days * 7;
const UNIT_TO_NUM = { hours, days, weeks };

class Duration {
  constructor(num, unit) {
    this.number = num;
    this.unit = unit;
  }
  toNumber() {
    return UNIT_TO_NUM[this.unit] * this.number;
  }
  get ago() {
    return new Date(Date.now() - this.toNumber());
  }
  get later() {
    return new Date(Date.now() + this.toNumber());
  }
}
Object.keys(UNIT_TO_NUM).forEach(unit => {
  Object.defineProperty(Number.prototype, unit, {
    get() {
      return new Duration(this, unit);
    }
  });
});
```

将上述代码粘贴到控制台后，再输入 `(2).weeks.ago` 试试吧，可以看到级联属性可以比级联方法拥有更简洁的表述，但同时也丢失了参数层面的灵活性。

> 可能有人会疑问为何不是 `2.weeks.ago`，这就是 JavaScript 的一个「**Feature**」了。唯一的解决方式就是去使用诸如 CoffeeScript 那些语法噪音更小的宿主语言吧。


在 DSL 风格中，无论是级联方法、级联管道还是级联属性，本质都是链式调用风格，链式调用的核心是上下文传递，所以每一次**调用的返回实体是否符合用户的心智**是 DSL 设计是否成功的重要依据。


### 风格 4：嵌套函数

开发中也存在一些层级抽象的场景，比如 DOM 树的生成，以下是纯粹命令式使用 DOM API 来构建的例子：

```js
const container = document.createElement('div');
container.id = 'container';
const h1 = document.createElement('h1');
h1.innerHTML = 'This is hyperscript';
const list = document.createElement('ul');
list.setAttribute('title', title);
const item1 = document.createElement('li');
const link = document.createElement('a');
link.innerHTML = 'One list item';
link.href = href;
item1.appendChild(link1);
const item2 = document.createElement('li');
item2.innerHTML = 'Another list item';
list.appendChild(item1);
list.appendChild(item2);

container.appendChild(h1);
container.appendChild(list);
```

这种写法略显晦涩，很难一眼看出最终的 HTML 结构，那如何构建内部 DSL 来流畅解决这种层级抽象呢？


有人就尝试用类似链式调用的方式去实现，比如 [concat.js](https://github.com/hoho/concat.js)：

```js

builder(document.body)
  .div('#container')
    .h1().text('This is hyperscript').end()
    .ul({title})
      .li()
        .a({href:'abc.com'}).text('One list item').end()
      .end()
      .li().text('Another list item').end()
    .end()
  .end()
```

这似乎比命令式的写法好了不少，但构建这种 DSL 存在不少问题：

1. 因为链式调用的关键是上下文传递，在层级抽象中需额外的 `end()` 出栈动作实现上下文切换。
2. 可读性强依赖于手动缩进，而往往编辑器的自动缩进往往会打破这种和谐。

所以一般层级结构抽象很少使用链式调用风格来构建 DSL，而会更多的使用基本的**嵌套函数**来实现。

我们以另一个骨灰开源项目 [DOMBuilder](https://github.com/insin/DOMBuilder) 为例：

> 这里先抛开 `with` 本身的使用问题

```js
with(DOMBuilder.dom) {
  const node =
    div('#container',
      h1('This is hyperscript'),
      ul({title},
        li(
            a({herf:'abc.com'}, 'One list item')
        ),
        li('Another list item')
    )
}
```

可以看到层级结构抽象使用嵌套函数来实现会更流畅。

如果使用 CoffeeScript 来描述，语法噪音可以降到更低，可以接近 [pug](https://pugjs.org/api/getting-started.html) 这种外部 DSL 的语法：

```coffeescript
div '#container',
  h1 'This is hyperscript'
  ul {title},
    li(
      a href:'abc.com', 'One list item'
    )
    li 'Another list item'
```

> CoffeeScript 是一门编译到 JavaScript 的语言，它旨在去除 JavaScript 语言设计上的糟粕，并增加了很多语法糖，影响了很多 JavaScript 后续标准的演进，目前完成了它的历史任务，逐步销声匿迹中。

嵌套函数本质上是将在链式调用中需要处理的上下文切换隐含在了函数嵌套操作中，所以它在层级抽象场景是非常适用的。

另外，嵌套函数在 DSL 的应用类似解析树，因为其符合语法树生成思路，往往可直接映射转换为对应外部 DSL，比如 JSX：

```jsx
<div id='container'>
  <h1 id='heading'> This is hyperscript </h1>
  <ul title={title} >
    <li><a href={href} > One list item </a></li>
    <li> Another list item </li>
  </ul>
</div>
```

**嵌套函数**并不是万金油，它天然不适合流程、时间等顺序敏感的场景。

如果将风格 2 的级联管道修改为嵌套函数：

![](https://p1.music.126.net/lRAJ6WrVWL30Tk2zk8AhGQ==/109951164714996074.png?param=480x0)


执行逻辑与阅读顺序显然不一致，并且会加重书写负担(同时要关心开闭逻辑)，极大影响读写流畅度。


### 风格 5：对象字面量

业界很多 DSL 都类似于配置文件，例如 JSON、[YAML](https://yaml.org/) 等外部 DSL，它们在嵌套数据展现中有很强的表达力。

而 JavaScript 也有一个适合在此场景构建 DSL 的特性，那就是**字面量对象**，实际上，[JSON](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON)（全称 JavaScript Object Notation）正是衍生自它的这个特性，成为了一种标准数据交换格式。

例如在项目 [puer](https://github.com/leeluolee/puer) 中，路由配置文件选择了 JS 的对象字面量而不是 JSON：

```js
module.exports = {
    'GET /homepage': './view/static.html'
    'GET /blog': {
        title: 'Hello'
    }
    'GET /user/:id': (req, res)=>{
        res.render('user.vm')
    }
}
```

因为 JSON 有一个天然缺陷就是要求可序列化，这极大的限制了它的表达力（不过也使它成为了最流行的跨语言数据交换格式），比如上例最后一条还引入了函数，虽然从 DSL 角度来说变得“不纯粹”了，但功能性却上了一个台阶。这也是为什么一些构建任务相关的 DSL（make、rake、cake、gradle 等）几乎全部都是内部 DSL 的原因。

除此之外，因为对象 key 值的存在，对象字面量也能提高参数可读性，比如：

```js
div({id: 'container', title: 'This is a tip' })

// CoffeeScript Version
div id: 'container', title: 'This is a tip'
```

显然比用词更少的下例可读性更佳：

```js
div('container', 'This is a tip')
```

> 构造 DSL 并非越简洁越好，提高流畅度才是关键。

对象字面量的结构性较强，一般只用来做配置等数据抽象的场景，不适合用在过程抽象的场景。


### 风格 6：动态代理

之前所列举内部 DSL 的构造方式有一个典型缺陷就是它们都是静态定义的属性或方法，没有动态性。

如上节 **[风格4: 嵌套函数]** 中的提到 [concat.js](https://github.com/hoho/concat.js)，它的所有类似 `div`、`p` 等方法都是[静态具名定义](https://github.com/hoho/concat.js/blob/master/concat.js#L22)的。而实际上因为 [custom elements](https://developer.mozilla.org/zh-CN/docs/Web/Web_Components/Using_custom_elements) 特性的存在，这种静态穷举的方式显然是有坑的，更别说 html 标准本身也在不断增加新标签。

而在外部 DSL，这个问题是不存在的，比如我早期写的 [regularjs/regular](https://github.com/regularjs/regular)，它内置的模板引擎在词法解析阶段把类似`/<(\w+)/`的文本匹配为统一的[`TAG` 词法元素](https://github.com/regularjs/regular/blob/master/lib/parser/Lexer.js#L261)，这样就可以避免穷举。

内部 DSL 要实现这种特性，就强依赖宿主语言的元编程能力了。
Ruby 作为典型宿主语言经常会用来证明其强大元编程能力的特性就是 [`method_missing`](https://www.leighhalliday.com/ruby-metaprogramming-method-missing)，这个方法可以动态接收所有未定义的方法，最直接功能就是动态命名方法（或元方法），这样就可以解决上面提到的内部 DSL 都是具名静态定义的问题。

值得庆幸的是在 JavaScript 中也有了一个更强大的语言特性，就是 [Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)，它可以代理属性获取，从而解决上文 concat.js 的穷举问题。

> 以下并非完整代码，只是简单演示

```js
function tag(tagName){
    return {tag: tagName}
}

const builder = new Proxy(tag, {
  get (target, property) {
    return tag.bind(null, property)
  }
})

builder.h1() // {tag: 'h1'}
builder.tag_not_defined()  // {tag: 'tag_not_defined'}
```


Proxy 使得 JavaScript 具备了极强的元编程能力，它除了可以轻松模拟出 [Ruby 沾沾自喜的 method_missing 特性](https://www.cnblogs.com/htoooth/p/11367829.html)外，也可以有很多[其它动态代理能力](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy#%E4%B8%80%E4%B8%AA%E5%AE%8C%E6%95%B4%E7%9A%84_traps_%E5%88%97%E8%A1%A8%E7%A4%BA%E4%BE%8B)，这些都是实现内部 DSL 的重要工具。


### 风格 7：Lambda 表达式

市面上有大量的查询库使用链式风格，它们非常接近 SQL 本身的写法，比如：
```js
const users = User.select('name') 
  .where('id==1');
  .where('age > 1');
  .sortBy('create_time')
```

为了将 `id==1` 等表达式转化为可运行的过滤条件，我们不得不去实现完整的表达式解析器，以最终编译得到等价函数

```js
function(user){
    return user.id === 1
}
```

实现成本非常高，而使用 lambda 表达式可以更低成本地解决这种需求

```js
const users = User.select('name')
  .where(user => user.id === 1);
  .where(user => user.age > 20);
  .sortBy('create_time')
```

这种应用案例其实早就存在了，比如基于`C#`的[LINQ](https://docs.microsoft.com/en-us/dotnet/csharp/linq/)(Language-Integrated Query)，这也是最常活跃在内部 DSL 技术圈的典型案例。

```c#

var result = products
    .Where(p => p.UnitPrice >= 20)
    .GroupBy(p => p.CategoryName)
    .OrderByDescending(g => g.Count())
    .Select(g => new { Name = g.Key, Count = g.Count() });

```
Lambda 表达式本质上是一种直观易读且**延迟执行**的逻辑表达能力，从而避免额外的解析工作，不过它强依托宿主的语言特性支持(匿名函数 + 箭头表示)，并且也会引入一定的语法噪音。
### 风格 8：自然语言抽象

自然语言抽象即以更贴近自然语言的方式去设计 DSL 的语法，它行得通的基本逻辑是领域专家基本都是和你我一样的自然人，更容易接受自然语言的语法。

自然语言抽象的本质是一些语法糖，和一般 GPPL 的语法糖不一样，
DSL 的语法糖并不一定是最简洁的，反而会加入一些「冗余」的非功能性语法词汇。

举个栗子，在云音乐团队开源的 [svrx(Server-X)](https://github.com/svrxjs/svrx/) 项目（一个插件化 dev-server 平台）中，路由是个高频使用的功能，为此我们设计了一套[内部 DSL](https://docs.svrx.io/zh/guide/route.html#%E8%AF%AD%E6%B3%95) 来方便开发者使用，如下例所示：

```js
get('/blog/:id').to.send('Demo Blog')

put('/api/blog/:id').to.json({code: 200})

get('/(.*)').to.proxy('https://music.163.com')
```

其中 `to` 就是个非功能性词汇，但却使得整个语句更容易被自然人（当然也包括我们程序员）所理解使用。

通过自然语言抽象，内部 DSL 的优势在单元测试场景中被发挥的淋漓尽致，比如如果我们裸用类似 [assert](http://nodejs.cn/api/assert.html#assert_assert_value_message) 的断言方法，单元测试用例可能是这样的：

```js
var foo = '43';

assert(typeof foo === 'number', 'expect foo to be a number');
assert(
  tea.flavors && tea.flavors.length === 3,
  'c should have property flavors with length of 3'
)
```

有几个显著待优化的问题：

1. 命令式的断言语句阅读不直观；
2. 为了 report 的可读性，需要传入额外的提示语（如`expect foo to be a number`）。

如果这个 case 基于 [chai](https://www.chaijs.com/) 来书写的话，可读性会立马上一个台阶：

```js
var foo = '43'

// AssertionError: '43' should be a 'number'.
foo.should.be.a('number');

tea.should.have.property('flavors').with.lengthOf(3);

```

可以发现测试用例变得更加易读易写了，而且当断言失败，也会自动根据链式调用产生的状态，自动拼装出更友好的错误信息，特别是当与 mocha 等测试框架结合时，可以直接生成直观的测试报告：

![](https://p1.music.126.net/oyk8W_V__TqGisx3feAGJg==/109951164681295531.png)


> 通过增加类似自然语言的辅助语法(动、名、介、副等)，可以使得程序语句更直观易懂。

### 风格总结

本文并未囊括所有内部 DSL 实现风格(比如也有些基于 Decorator 装饰器的玩法)，且所列风格都不是银弹，都有其适用场景，它们之间存在互补效应。
![](https://p1.music.126.net/-_kmmM-JS6llFaqdE8cIJQ==/109951164697390126.png)

## 内部 DSL 的一些迷思

通过上面的一些惯用风格的介绍，我们建立了对前端内部 DSL 的一些了解，本节会针对「Why」的问题做下深入讨论：

### 为何选择 JavaScript 作为宿主语言

从风格案例可以看到，宿主语言直接决定了内部 DSL 的「语法」优化的上限。正如 ROR 之于 Ruby、Gradle 之于 Groovy，典型的前期选择大于后天努力。而前端开发最趁手的语言 JavaScript 其实在构建内部 DSL 时具备了很大的优势，因为它那些大杂烩般的语言特性：

- 借鉴 Java 语言的数据类型和内存管理，抽象度高。
- 基于对象，且拥有方便的对象字面量表示等，数据表达力一流。
- 函数为第一等公民（first class），可以有一些泛 FP 的应用。
- 使用基于原型（prototype）的继承机制，并且可扩展原始类型如 Number。
- Proxy、Reflect 等新特性加持下具备了极强的[元编程能力](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Meta_programming)。

放荡不羁的语言特性使得它几乎可以 Hold 住任何内部 DSL 的构建风格，另外它那活跃到离谱的社区也奠定了天然的开发者基础。

JavaScript 存在的天然缺陷就是它那衍生自 C 的语法，导致噪音较强，使用一些变种语言（如 CoffeeScript）可以扭转一些这种劣势。

### 库（接口）还是内部 DSL

外部 DSL 的边界问题往往是 DSL 与 GPPL 的区别，这个在社区中的争议并不算很大。而关于内部 DSL 的讨论，特别是与库（接口）的差异问题就一直都没消停过，确实存在模糊的部分。

实际上 DSL 也有个别名叫**流畅接口**，所以它本身也属于接口封装或库封装的一种模式，目标是极限表达力。但它相较于传统接口封装，有几个显著设计差异点：

- 语言性。
- 不受传统编程最佳实践的束缚：如命令-查询分离、迪米特法则等。

比如在内部 DSL 中，得到代码如 `foo.should.be.a.number` 就像是一个在既定语法下有关联的整句，而不是命令式代码的集合。而 jQuery 中 `html` 即是查询方法（`.html()`）也是命令方法（`.html('content to set')`），这显然背离了命令查询分离的原则。它们设计的首要目标是「极限流畅的表现力」，而非职责清晰、降低耦合度等传统的封装抽象准则。

其实本文更认同松本行弘先生在[《代码的未来》](https://book.douban.com/subject/24536403/)中引述的观点，这也算最终解开了作者对于内部 DSL 的疑惑和心结：

> 库设计就是语言设计

**编程语言只确定了基本语法框架和少量词汇，库设计应该将其与充当词汇池的类、方法、属性甚至变量相结合，并将它们按语义有机结合起来**，最终真正实现「在限定任务下，编程工作者只需要关注 What，而无需关注 How」的设计目标。这也就是 `2.weeks.ago` 的魔力所在，编程（语言）的发展方向就应该如此，才能达到更高的抽象维度。

所以与其尝试去为内部 DSL 划分一个明确的边界，不如根据它的要求去改善你的接口设计。这里引申另一个更激进的观点：

> **Programming is a process of designing DSL for your own application.**






### 内部 DSL 实践的一些坑

除了由于依赖于宿主语言，导致功能性缺失和额外的语法噪音之外，内部 DSL 也存在其它不可忽视的问题。


#### 不友好的异常

在 **[风格3: 级联属性]** 案例中，其实我们没有定义 `minutes` 这个单位, 如果错误的使用`(5).minutes.later`，将得到以下错误提示：

```shell
Uncaught TypeError: Cannot read property 'later' of undefined
```

而不是我们预期的类似报错信息：

```js
Uncaught SyntaxError: Unexpected unit minutes
```

这是由于异常处理机制也遵循宿主语言，在库封装层面做 DSL 抽象依然无法逃脱这个限制，这也是外部 DSL 的优势所在，不过基于 **[风格6：动态代理]** 提到的 Proxy，我们仍能做一些微不足道的小优化：

```js
const UNITS = ['days','weeks','hours'];

const five = new Proxy(new Number(5), {
  get (target, property) {
    if(UNITS.indexOf(property) === -1){
        throw TypeError(`Invalid unit [${property}] after ${target}`)
    }else{
       // blablabla
    }
  }
})
```

粘贴到控制台并输入 `five.minutes`，你将看到更友好的错误提示：

```js
Uncaught TypeError: invalid units [minutes] after 5
```


#### 容易忽视冰山之下的设计

内部 DSL 的设计要点在于表现层是否流畅，而缺乏对底层领域模型的抽象封装要求，这可能导致 DSL 的「核」是缺乏有效设计的。在实践 DSL 时，我们在领域模型这层仍然要遵循最佳编程实践，比如本文 `2.weeks.later` 背后的 `Duration` 等领域模型实体。

作者曾为内部一个历史悠久的庞大前端框架扩展了一个类似 jQuery 的流畅 API 的接口（2012 年勿喷），去掉注释仅仅花费了不到 [500 行代码](https://github.com/genify/nej/blob/master/src/util/chain/NodeList.js)，这个绝大部分归功于框架底层的深厚设计功底和一致性，而非我上层的 DSL 语法糖包装。

此外在 DSL 设计中，语法和语义同样重要，上述诸多例子也证明了：语法的简洁不一定带来流畅性，必须要结合语义模型来设计。

> 关于语法与语义：`a || b` 和 `a or b` 语法不同，但语义相同；而 `a > b`（Java）和`a > b`（Shell）语法相同，但语义不同

这部分建议在外部 DSL 的设计工作中也同样重要。


#### 编辑器支持

有些内部 DSL 依赖排版来达到最佳表现，绝大部分语言（包括外部 DSL）的自动格式化引擎都是基于语法树解析来实现的，但内部 DSL 就没那么幸运了，由于它在实际语法层面并没有定义，所以经常会发生在编辑器使用「Format Document」后前功尽弃的情况，这类现象在基于缩进的语言中会比较少。

特殊的代码高亮就更难了，即使是自动补全，也需要一些额外的工作才能被支持。

## 小结

常规编程解决思路下表达更多的是「How」即如何实现的细节，牵扯进的表达式、语句和数据结构等编程元素会影响到领域工作者对本源问题的理解。而 DSL 的秘诀在于它强调表达是「What」，将原本的命令式编程转化为极致的声明式表述，使得 DSL 具备强大的自解释性（self-explanatory），从而提高编程效率，甚至可以赋能给没有编程经验的用户。

本文主要针对内部DSL这个重要分支在前端的实践做了展开说明，并结合Javascript和前端领域的一些典型范例阐述了8种实现风格，并且强调这些风格并非独立的「银弹」，而是互为补充。

本文也对一些迷思展开了讨论，我们探讨了 Javascript 做为内部 DSL 宿主语言的可行性，并强调了「DSL的设计指引比它的边界定义更应该受到关注」这一观点，最后引出一些内部 DSL 设计过程中的常见坑。


## 进一步阅读

请关注本文的第二部分 —— 外部 DSL，同时以下书籍可以帮助你进一步学习：

- [《领域特定语言》](https://book.douban.com/subject/21964984/) - Martin Fowler
- [《领域专用语言实战》](https://book.douban.com/subject/25741352/) - Debasish Ghosh



###  相关资料

- [《代码的未来》](https://book.douban.com/subject/24536403/) - 松本行弘
- [Javascript诞生记](http://www.ruanyifeng.com/blog/2011/06/birth_of_javascript.html) 
- [Declarative programming is it a real thing?](https://blog.hellojs.org/declarative-programming-is-it-a-real-thing-e59fe5e893fd) 
- [谈谈 DSL 以及 DSL 的应用（以 CocoaPods 为例）](https://draveness.me/dsl) 
- [用流畅接口构造内部DSL](https://www.cnblogs.com/weidagang2046/archive/2011/10/30/2229293.html)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
