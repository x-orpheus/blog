---
title: 如何基于 TypeScript 实现控制反转
date: 2020-11-25T02:37:22.382Z
description: IoC（Inversion of Control）控制反转，是面向对象编程中的一种设计原则，用来降低计算机代码之间的耦合度。本文通过梳理控制反转的概念，优势以及基于 TypeScript 的实现，为大家在日常编码中写出可维护性更高的代码提供一些参考。
---

![header.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4711550686/9dbb/ae0f/b7ff/eb6b0f5b74d2bff541ca620192214b74.jpg)

> 图片来源：https://bz.zzzmh.cn/

> 本文作者：陈光通

## 一. 前言

最近接到任务，需要给团队封装一个基于 EggJS 的上层 NodeJS 框架，在这个过程中参考了 [NestJS](https://docs.nestjs.com/) 、[Midway](https://midwayjs.org/midway/ioc.html) 等开源项目，发现它们都引入了一项重要特性 —— IoC ，于是笔者借这个机会对 IoC 进行了一些学习和梳理。本文主要参考了 Midway 的源码，按自己的理解基于 TypeScript 实现了 IoC，希望能给大家提供一些参考。

## 二. IoC

按照[维基百科](https://zh.wikipedia.org/wiki/%E6%8E%A7%E5%88%B6%E5%8F%8D%E8%BD%AC)，IoC（Inversion of Control）控制反转，是面向对象编程中的一种设计原则，用来降低计算机代码之间的耦合度。

在传统面向对象的编码过程中，当类与类之间存在依赖关系时，通常会直接在类的内部创建依赖对象，这样就导致类与类之间形成了耦合，依赖关系越复杂，耦合程度就会越高，而耦合度高的代码会非常难以进行修改和单元测试。而 IoC 则是专门提供一个容器进行依赖对象的创建和查找，将对依赖对象的控制权由类内部交到容器这里，这样就实现了类与类的解耦，保证所有的类都是可以灵活修改。

### 2.1 耦合

直接看维基百科对 IoC 的解释可能会觉得云里雾里，到底什么是耦合呢？在这里我们举一个简单的例子，假设我们有 `A`、`B` 两个类，它们之间存在的依赖关系是 `A` 依赖 `B`，这种依赖关系在日常开发中很容易遇到，如果用传统的编码方式，我们一般会这么实现：

```ts
// b.ts
class B {
    constructor() {
    }
}

// a.ts
class A {
    b:B;
    constructor() {
        this.b = new B();
    }
}

// main.ts
const a = new A();
```

上述代码看上去似乎没有什么问题，然而，这时我们突然接到了新需求，处于最底层的 `B` 在初始化对象的时候需要传递一个参数 `p`：

```ts
// b.ts
class B {
    p: number;
    constructor(p: number) {
        this.p = p;
    }
}

```
修改完后，问题来了，由于 `B` 是在 `A` 的构造函数中进行实例化的，我们不得不在 `A` 的构造函数里传入这个 `p`，然而 `A` 里面的 `p` 怎么来呢？我们当然不能写死它，否则设定这个参数就没有意义了，因此我们只能将 `p` 也设定为 `A` 构造函数中的一个参数，如下：

```ts
// a.ts
class A {
    b:B;
    constructor(p: number) {
        this.b = new B(p);
    }
}

// main.ts
const a = new A(10);
console.log(a); // => A { b: B { p: 10 } }
```

更麻烦的是，当我们改完了 `A` 后，发现 `B` 所需要的 `p` 不能是一个 `number`，需要变更为 `string`，于是我们又不得不重新修改 `A` 中对参数 `p` 的类型修饰。这时我们想想，假设还有上层类依赖 `A`，用的也是同样的方式，那是否上层类也要经历同样的修改。这就是耦合所带来的问题，明明是修改底层类的一项参数，却需要修改其依赖链路上的所有文件，当应用程序的依赖关系复杂到一定程度时，很容易形成牵一发而动全身的现象，为应用程序的维护带来极大的困难。

### 2.2 解耦

事实上，我们可以发现，在上述例子中，真正需要参数 `p` 的仅仅只有 `B`，而 `A` 完全只是因为内部依赖的对象在实例化时需要 `p`，才不得不定义这个参数，实际上它对 `p` 是什么根本不关心。于是，我们可以考虑将类所依赖对象的实例化从类本身剥离出来，比如上面的例子我们可以这样改写：

```ts
// b.ts
class B {
    p: number;
    constructor(p: number) {
        this.p = p;
    }
}

// a.ts
class A {
    private b:B;
    constructor(b: B) {
        this.b = b;
    }
}

// main.ts
const b = new B(10);
const a = new A(b);
console.log(a); // A => { b: B { p: 10 } }
```

在上述例子中，`A` 不再接收参数 `p` ，而是选择直接接收其内部所依赖的对象，至于这个对象在哪里进行实例化则并不关心，这样有效解决了我们在上面遇到的问题，当我们需要修改参数 `p` 时，我们仅仅只要修改 `B` 即可，而不需要修改 `A` ，这个过程中我们就实现了类与类之间的解耦。

### 2.3 容器

虽然我们实现了解耦，但我们仍需要自己初始化所有的类，并以构造函数参数的形式进行传递。如果存在一个全局的容器，里面**预先注册**好了我们所需对象的类定义以及初始化参数，每个对象有一个唯一的 key。那么当我们需要用到某个对象时，我们只需要告诉容器它对应的 key，就可以直接从容器中**取出**实例化好的对象，开发者就不用再关心对象的实例化过程，也不需要将依赖对象作为构造函数的参数在依赖链路上传递。

也就是说，我们的容器必须具体两个功能，**实例的注册**和**获取**，这很容易让人联想到 Map，基于这个思路，我们首先简单实现一个容器：

```ts
// container.ts
export class Container {
    bindMap = new Map();

    // 实例的注册
    bind(identifier: string, clazz: any, constructorArgs: Array<any>) {
        this.bindMap.set(identifier, {
            clazz,
            constructorArgs
        });
    }

    // 实例的获取
    get<T>(identifier: string): T {
        const target = this.bindMap.get(identifier);
        const { clazz, constructorArgs } = target;
        const inst = Reflect.construct(clazz, constructorArgs);
    }
}
```

这里我们用到了 [Reflect.construct](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct)，它的行为有点像 new 操作符，帮助我们进行对象的实例化。有了容器之后，我们就可以彻底抛弃传参实现解耦，如下所示：

```ts
// b.ts
class B {
    constructor(p: number) {
        this.p = p;
    }
}

// a.ts
class A {
    b:B;
    constructor() {
        this.b = container.get('b');
    }
}

// main.ts
const container = new Container();
container.bind('a', A);
container.bind('b', B, [10]);

// 从容器中取出a
const a = container.get('a');
console.log(a); // A => { b: B { p: 10 } }
```

到这里为止，我们其实已经基本实现了 IoC，基于容器完成了类与类的解耦。但从代码量上看似乎并没有简洁多少，关键问题在于容器的初始化以及类的注册仍然让我们觉得繁琐，如果这部分代码能被封装到框架里面，所有类的注册都能够自动进行，同时，所有类在实例化的时候可以直接拿到依赖对象的实例，而不用在构造函数中手动指定，这样就可以彻底解放开发者的双手，专注编写类内部的逻辑，而这也就是所谓的 [DI（Dependency Injection）依赖注入](https://zh.wikipedia.org/wiki/%E4%BE%9D%E8%B5%96%E6%B3%A8%E5%85%A5)。

## 三. DI

很多人会混淆 DI 和 IoC，IoC 只是一种设计原则，而 DI 则是实现 IoC 的一种实现技术，简单来说就是我们可以将依赖注入给调用方，而不需要调用方来主动获取依赖。为了实现 DI，主要要解决以下两个问题：

- 需要注册到 IoC 容器中的类能够在程序启动时自动进行注册
- 在 IoC 容器中的类实例化时可以直接拿到依赖对象的实例，而不用在构造函数中手动指定

针对这两个问题其实也有不同的解决思路，比如大名鼎鼎的 [Java Spring](https://spring.io/why-spring) 需要开发者针对容器中的依赖关系定义一份 XML 文件，框架基于这份 XML 文件实例的注册和依赖的注入。但对于前端开发来说，基于 XML 的依赖管理显得太过繁琐，Midway 的 Injection 提供的思路是利用 TypeScript 具备的装饰器特性，通过对元数据的修饰来识别出需要进行注册以及注入的依赖，从而完成依赖的注入。

### 3.1 Reflect Metadata

要使用装饰器解决上述提到的两个问题，我们需要先简单了解下 [Reflect Metadata](https://jkchao.github.io/typescript-book-chinese/tips/metadata.html#%E5%9F%BA%E7%A1%80)。Reflect Metadata 是 ES7 的一个提案，它主要用来在声明的时候添加和读取元数据，TypeScript 在 1.5+ 的版本已经支持它。

元数据可以理解为针对类或类里面某个属性的描述信息，它本身不影响类的行为，但你可以在随时拿到某个类上定义的元数据，并根据这些元数据进行对类进行特定的操作。

Reflect Metadata 的使用非常简单，首先，你需要安装 reflect-metadata 库：

```
npm i reflect-metadata --save
```

在 tsconfig.json 里，emitDecoratorMetadata 需要配置为 `true`。

然后，我们就可以根据 Reflect.defineMetadata 和 Reflect.getMetadata 进行元数据的定义和获取，比如：

```ts
import 'reflect-metadata';

const CLASS_KEY = 'ioc:key';

function ClassDecorator() {
  return function (target: any) {
      Reflect.defineMetadata(CLASS_KEY, {
        metaData: 'metaData',
      }, target);
      return target;
  };
}

@ClassDecorator()
class D {
  constructor(){}
}

console.log(Reflect.getMetadata(CLASS_KEY, D)); // => { metaData: 'metaData' }
```

有了 Reflect，我们就可以对任意类进行标记，并对标记的类进行特殊的处理。更多有关元数据的内容可以参考 [Reflect Metadata](https://jkchao.github.io/typescript-book-chinese/tips/metadata.html#%E5%9F%BA%E7%A1%80)。

### 3.2 Provider

回到我们刚刚提到的问题，我们需要在应用启动的时候自动对所有类进行定义和参数的注册，问题是并不是所有的类都需要注册到容器中，我们并不清楚哪些类需要注册的，同时也不清楚需要注册的类，它的初始化参数是什么样的。

这里就可以引入元数据来解决这个问题，只要在定义的时候为这个类的元数据添加特殊的标记，就可以在扫描的时候识别出来。按照这个思路，我们先来实现一个装饰器标记需要注册的类，这个装饰器可以命名 Provider，代表它将会作为提供者给其他类进行消费。

```ts
// provider.ts
import 'reflect-metadata'

export const CLASS_KEY = 'ioc:tagged_class';

export function Provider(identifier: string, args?: Array<any>) {
    return function (target: any) {
        Reflect.defineMetadata(CLASS_KEY, {
            id: identifier,
            args: args || []
        }, target);
        return target;
    };
}
```

可以看到，这里的标记包含了 `id` 和 `args`，其中 `id` 是我们准备用来注册 IoC 容器的 `key`，而 `args` 则是实例初始化时需要的参数。Provider 可以以装饰器的形式直接进行使用，使用方式如下：

```ts
// b.ts
import { Provider } from 'provider';

@Provider('b', [10])
export class B {
    constructor(p: number) {
        this.p = p;
    }
}
```

标记完成后，问题又来了，如果在应用启动的时候拿到这些类的定义呢？

比较容易想到的思路是在启动的时候对所有文件进行扫描，获取每个文件导出的类，然后根据元数据进行绑定。简单起见，我们假设项目目录只有一级文件，实现如下：

```ts
// load.ts
import * as fs from 'fs';
import { CLASS_KEY } from './provider';

export function load(container) { // container 为全局的 IoC 容器
  const list = fs.readdirSync('./');

  for (const file of list) {
    if (/\.ts$/.test(file)) { // 扫描 ts 文件
      const exports = require(`./${file}`);
      for (const m in exports) {
        const module = exports[m];
        if (typeof module === 'function') {
          const metadata = Reflect.getMetadata(CLASS_KEY, module);
          // 注册实例
          if (metadata) {
            container.bind(metadata.id, module, metadata.args)
          }
        }
      }
    }
  }
}
```

那么现在，我们只要在 main 中运行 load 即可完成项目目录下所有被修饰的类的绑定工作，值得注意的是，load 和 Container 的逻辑是完全通用的，它们完全可以被封装成包，一个简化的 IoC 框架就成型了。

```ts
import { Container } from './container';
import { load } from './load';

// 初始化 IOC 容器，扫描文件
const container = new Container();
load(container);

console.log(container.get('a')); // A => { b: B { p: 10 } }
```

### 3.2 Inject

解决注册的问题后，我们来看上文中提到的第二个问题：如何在类初始化的时候能直接拿到它所依赖的对象的实例，而不需要手动通过构造函数进行传参。其实思路也很简单，我们已经将所有需要注册的类都放入了 IoC 容器，那么，当我们需要用到某个类时，在获取这个类的实例时可以递归遍历类上的属性，并从 IoC 容器中取出相应的对象并进行赋值，即可完成依赖的注入。

那么，又是类似的问题，如何区分哪些属性需要注入？同样，我们可以使用元数据来解决。只要定义一个装饰器，以此来标记哪些属性需要注入即可，这个装饰器命名为 Inject，代表该属性需要注入依赖。

```ts
// inject.ts
import 'reflect-metadata';

export const PROPS_KEY = 'ioc:inject_props';

export function Inject() {
    return function (target: any, targetKey: string) {
        const annotationTarget = target.constructor;
        let props = {};
        if (Reflect.hasOwnMetadata(PROPS_KEY, annotationTarget)) {
            props = Reflect.getMetadata(PROPS_KEY, annotationTarget);
        }

        props[targetKey] = {
            value: targetKey
        };

        Reflect.defineMetadata(PROPS_KEY, props, annotationTarget);
    };
}
```

需要注意的是，这里我们虽然是对属性进行修饰，但实际元数据是要定义在类上，以维护该类需要注入的属性列表，因此我们必须取 target.constructor 作为要操作的 target。另外，为了方便起见，这里直接用了属性名（targetKey）作为从 IoC 容器中实例对应的 key。

然后，我们需要修改 IoC 容器的 get 方法，递归注入所有属性：

```ts
// container.ts
import { PROPS_KEY } from './inject';

export class Container {
    bindMap = new Map();

    bind(identifier: string, clazz: any, constructorArgs?: Array<any>) {
        this.bindMap.set(identifier, {
            clazz,
            constructorArgs: constructorArgs || []
        });
    }

    get<T>(identifier: string): T {
        const target = this.bindMap.get(identifier);

        const { clazz, constructorArgs } = target;

        const props = Reflect.getMetadata(PROPS_KEY, clazz);
        const inst = Reflect.construct(clazz, constructorArgs);

        for (let prop in props) {
            const identifier = props[prop].value;
            // 递归获取注入的对象
            inst[ prop ] = this.get(identifier);
        }
        return inst;
    }
}

```

使用的时候，用 Inject 对需要的属性进行修饰即可：

```ts
// a.ts
import { Provider } from 'provider';

@Provider('a')
export class A {
    @Inject()
    b: B;
}

```

### 3.3 最终代码

经过上述调整后，最终我们的业务代码成了这样：

```ts
// b.ts
@Proivder('b', [10])
class B {
    constructor(p: number) {
        this.p = p;
    }
}

// a.ts
@Proivder('a')
class A {
    @Inject()
    private b:B;
}

// main.ts
const container = new Container();
load(container);

console.log(container.get('a'));  // => A { b: B { p: 10 } }
```

可以看到，代码中不会再有手动进行实例化的情况，无论要注册多少个类，框架层都可以自动处理好一切，并在这些类实例化的时候注入需要的属性。所有类可提供的实例都由类自身来维护，即使存在修改也不需要改动其他文件。

## 小结

本文从类的解耦开始描述了 IoC 的必要性，基于 TypeScript 实现了一个精简的 IoC 框架。事实上，除了解耦外，IoC 还可以给我们带来很多好处，比如基于容器快速进行单元测试，分析类与类之间的依赖关系等等。

虽然 IoC 最初是服务端提出的概念，但目前在前端领域也已经有了各种各样的应用，比如 AngularJS 就实现了自己的 IoC 框架来提升开发效率和模块化程度，有兴趣的读者可以通过官方的[案例](https://angular.cn/guide/dependency-injection)感受一下 IoC 给前端编码带来的好处。相信随着前端职能的扩张，应用复杂度的提升，这些经典的设计原则正在逐渐成为每个前端开发的必修课程。

## 参考资料

- [深入理解TypeScript](https://jkchao.github.io/typescript-book-chinese/tips/metadata.html#%E5%9F%BA%E7%A1%80)
- [控制反转-维基百科](https://zh.wikipedia.org/wiki/%E6%8E%A7%E5%88%B6%E5%8F%8D%E8%BD%AC)
- [MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct)
- [Midway](https://midwayjs.org/midway/ioc.html)
- [AngularJS DI](https://angular.cn/guide/dependency-injection)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！




