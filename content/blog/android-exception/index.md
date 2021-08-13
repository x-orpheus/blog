---
title: Android 开发，如何写出符合规范的异常处理代码？
date: 2021-08-13T08:46:36.483Z
description: 本文介绍了 Java 和 Kotlin 相关的异常知识，对于现实开发中经常遇到的一些关于异常处理的问题（如何抛出异常，如何捕捉异常，Java 和 Kotlin 异常对齐），并阐明了云音乐对这块的态度和规范。 
---

![header.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10119359306/127f/5259/f68a/e1803e5917c21eda74c42860611136eb.jpg)

> 本文作者：一痕

# Android 开发，如何写出符合规范的异常处理代码？
## 基础知识
### Java 异常
#### 异常层次结构
在 Java 中，异常明确的分为两种：`Checked Exception` 和 `Unchecked Exception`。下图中的红色部分表示 `Unchecked Exception`  异常，蓝色的表示 `Checked Exception`。结构图如下：

![image](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10118697316/5dc5/79de/c979/6bdd02aa111f719ffa183561b7fa721e.png)

#### `Checked Exception`

`Checked Exception` 必须被显式地捕获或者传递,否则在编译期就会显示的报错。
一般而言，`Checked Exception` 指的都是不受程序直接控制的错误。它们通常都是由于与外部资源、网络交互而发生的，例如数据库问题、网络连接错误、文件丢失等问题。

`Checked Exception` 常是 Exception 类的子类。

`Checked Exception` 的例子如：`ClassNotFoundException`、`IOException`、`SQLException` 等。

#### `Unchecked Exception`
`Unchecked Exception` 即开发者不必显示的捕获或传递而在编译期是不会报错的。

编译器不会强制要求使用方对 `Unchecked Exception` 进行显示的捕捉。

`Unchecked Exception`：
1. `RuntimeException` 的子类。eg:`NullPointerException`、`AritheticException`、`ArrayStoreException`、`ClassCastException`等。
2. `Error` 的子类。eg:`StackOverflowError`、`OutOfMemoryError`等。

### Kotlin 异常
Kotlin 的所有异常类都是 Throwable 类的子孙类，这点和 Java 类似，但是 Kotlin 中没有 `Checked Exception`，所以 Kotlin 中所有的 Exception 都是 `Unchecked Exception`，也就意味着编译器不会强迫捕获任何异常。

## 背景
- 问题一：在什么情况下适合抛出异常？

平时大家在开发时，会有一些在执行逻辑或者参数不符合预期时，会直接抛出一个异常，如下代码比较常见：
```java
public boolean open(xxx) {
    if (xxx) {
        xxxx
    } else {
        throw new IllegalArgumentException("xxxx");
    }
    return xxxx;
}
```
如果代码执行匹配上了异常逻辑，在运行时调用方没有捕捉相应的异常，应用就会直接崩溃，对用户造成不友好的体验。

- 问题二：捕捉异常的代码应该如何写？

我们平时开发时，对于需要捕捉异常的场景，我们又该如何规范的书写呢？比如下面的代码写的合理吗？
```java
try {
    xxxx
} catch (Throwable e) {
    e.printStackTrace();
}
```
- 问题三： `Kotlin` 和 `Java` 混合开发的问题
`Java` 和 `Kotlin` 在对异常的设计理念就有差异，所以在互调时应该怎样对齐两者的差异？最大的差异是 `Kotlin` 没有 `Checked Exception` 这个概念，这样在项目使用 Kotlin 和 Java 混合开发时就会存在一些争议性的问题：
  - 捕捉异常争议

  在 Kotlin 调用 Java 代码时，如果 Java 抛出了 `Checked Exception` ，Kotlin 应该主动捕捉还是不主动捕捉？我们第一反应是应该捕捉，既然要捕捉但是在开发阶段 ide 又不会给予显示的提示，并且不捕捉在编译期又不会报错。

  - 抛异常争议

  Kotlin 在需要抛出异常的场景应该怎么写？只是把异常抛出来？抛出来，调用者又很难感知到异常，所以就存在代码命中相关异常崩溃的风险。

由于以上各种问题的存在，在认知层面所有开发者未达成一致的情况下，也就会存在 code review 时标准不一致，不规范的使用异常也会导致更多的线上崩溃，并且业内也没有一套比较可行的标准能直接使用，所以我们不得不针对这些问题制定一套行之有效的规则和流程来解决这些问题。

## 解决办法
对于 Java 和 Kotlin 异常的不一致，我们基于代码质量考虑，选择对齐 Java 的代码规范，所以 Kotlin 侧我们就定义类似 `
Checked Exception` 概念，对于需要显示提示出来的能力，借助 Lint 的能力实现（Kotlin 编译器不会强迫捕获任何异常）。

对于抛出异常，明确规定上层业务调用者不允许抛出异常，仅 API 提供方在不得不抛出异常的场景，才允许抛出异常，并且得抛出 `Checked Exception`。

对于捕获异常，原则上捕获是为了处理它，应该加上必要的处理逻辑，在捕获只是为了兜底的场景（可能会发生崩溃）提供对异常上报的工具类。其他使用规则对齐业内的标准。

最后对于所有制定的规则，提供 Lint 检测能力，在 MR 流程中进行卡点，保证代码的正确性。

接下来介绍下云音乐对 Java 与 Kotlin 异常使用规范。

## 规范
### Java 规范
#### 抛出异常（throw Exception）
1. 最顶层的调用者避免抛出异常；
  
    说明：最顶层的调用者如果抛出异常，在逻辑命中的情况下，app 会直接崩溃；
2. 对于需要抛出异常的场景，避免直接抛出`Unchecked Exception`（RuntimeException  子类，使用者无法显示感知，未做捕获处理，容易出现崩溃） ，更不允许直接抛出 Exception 或者 Throwable；抛出的异常应继承 Exception，即`Checked Exception`（使用者能显示的感知，即可对其进行处理），应使用有业务含义的自定义异常。推荐业界已定义 过的自定义异常，如:DAOException、 ServiceException 等；

3. 抛出更具体的异常;

    说明：你抛出的异常越具体、越明确越好。使用者可以根据具体的异常进行不同的补救措施。因此，你需要确保提供尽可能多的信息，这会使得你的 API 更易于理解。


#### 捕获异常（try catch）

1. 捕获异常是为了处理它，不要捕获了却什么都不处理而抛弃之，如果不想处理它，请
将该异常抛给它的调用者。最外层的业务使用者，必须处理异常，将其转化为用户可以理解的
内容。在一些兜底的捕获逻辑里，需要将相关的异常信息上报。

    上报相关接口如下(`Monitor`类)：
    ```java
    /**
     * 上报日志信息到异常监控平台
     */
     void logActiveReport(Throwable throwable);
    ```

    eg：
    ```java
    try {
        xxxxs
    } catch (IOException e) {
        // 上报后可在异常平台上查询到相关信息
        ServiceFacade.get(Monitor::class.java).logActiveReport(...)
    }
    ```

2. `catch` 时请分清稳定代码和非稳定代码，稳定代码指的是无论如何不会出错的代码。
对于非稳定代码的 `catch` 尽可能进行区分异常类型，再做对应的异常处理。

    说明：对大段代码进行  try-catch，使程序无法根据不同的异常做出正确的应激反应，也不利于定位问题，这是一种不负责任的表现。

    正例：用户注册的场景中，如果用户输入非法字符，或用户名称已存在，或用户输入密码过于
    简单，在程序上作出分门别类的判断，并提示给用户。

3. 不要在 `finally` 块中使用 `return`。
    
    说明：finally 块中的 return 返回后方法结束执行，不会再返回 try 块中的 return 语句的结果，即返回值被 finally 的返回值覆盖；

4. `try catch` 只处理应用能处理的异常，不要捕获 `Throwable`。

    说明：`Throwable` 是所有 `Exceptions` 和 `Errors` 的父类。如果你在 `catch` 子句中使用了 `Throwable` ，它将不仅捕获所有异常，还会捕获所有错误。这些错误是由 `JVM` 抛出的，用来表明不打算由应用处理的严重错误。`OutOfMemoryError`和`StackOverflowError`就是典型的例子，这两种情况都是由一些超出应用控制范围的情况导致的，无法处理。

    错误案例：
    ```java
    try {
        xxxxs
    } catch (Throwable e) {
        e.printStackTrace();
    }
    ```

### Kotlin 规范
#### 抛出异常（throw Exception）
1. 尽量避免在 kotlin 代码中抛出异常，特别是最顶层的调用者；
  
    说明：最顶层的调用者如果抛出异常，在逻辑命中的情况下，app会直接崩溃；
2. 对于需要抛出异常的场景，在代码中抛出异常的同时，需要在方法申明处显示的抛出来（类似 `Checked Exception` 做法）。推荐业界已定义过的自定义异常，如:DAOException、 ServiceException 等；
正确做法：
    ```kotlin
    // 显示的抛出来
    @Throws(IOException::class)
    fun xxxx() {
        throw IOException("xxxx")
    }
    ```

3. 抛出更具体的异常;

    说明：你抛出的异常越具体、越明确越好。使用者可以根据具体的异常进行不同的补救措施。因此，你需要确保提供尽可能多的信息，这会使得你的 API 更易于理解。


#### 捕获异常（try catch）

1. 对于代码显示抛出的异常（Java `Checked Exception` 和 Kotlin  显示抛出的异常），应该进行相应的捕获。

2. 捕获异常是为了处理它，不要捕获了却什么都不处理而抛弃之，如果不想处理它，请
将该异常抛给它的调用者。最外层的业务使用者，必须处理异常，将其转化为用户可以理解的
内容。在一些兜底的捕获逻辑里，需要将相关的异常信息上报。

    上报相关接口如下(`Monitor`类)：
    ```java
    /**
     * 上报日志信息到异常平台
     */
     void logActiveReport(Throwable throwable);
    ```

2. `catch` 时请分清稳定代码和非稳定代码，稳定代码指的是无论如何不会出错的代码。
对于非稳定代码的 `catch` 尽可能进行区分异常类型，再做对应的异常处理。

    说明：对大段代码进行  try-catch ，使程序无法根据不同的异常做出正确的应激反应，也不利于定位问题，这是一种不负责任的表现。

    正例：用户注册的场景中，如果用户输入非法字符，或用户名称已存在，或用户输入密码过于
    简单，在程序上作出分门别类的判断，并提示给用户。

3. 不要在 `finally` 块中使用 `return`。
    
    说明：finally 块中的 return 返回后方法结束执行，不会再返回 try 块中的 return 语句的结果，即返回值被 finally 的返回值覆盖；
## 总结
1. 对比业内对 Java 和 Kotlin 的相关的代码规范，我们定义的会更加严格，业内的规范基本是对代码使用的一个指导意见，我们定义的代码规范更多是从保障app质量角度出发的代码编写准则。

2. 目前业内对 `Checked Exception` 的争论一直未停息，Kotlin  作者的观点是本就不该出现 `Checked Exception` ，但是 `Checked Exception` 确实对于我们的代码质量保证有一定的价值。本文也未对这块的观点进行讨论，我们选择 Kotlin 对齐 `Checked Exception` 也是出于统一 Java 和 Kotlin 的异常规范，提升 app 的质量角度出发。

3. 对于由于代码不规范的使用导致的崩溃问题，我们的做法基本都是制定标准加上相应的 Lint 来解决相应的问题。Kotlin 相关的代码规范目前业内还没有一套比较权威的规范，所以在大家使用 Kotlin 时需要更加的关注其潜在的一些代码问题导致的质量问题。
## 参考资料
1. [Checked or Unchecked Exceptions?](http://tutorials.jenkov.com/java-exception-handling/checked-or-unchecked-exceptions.html)
2. [Kotlin Exceptions](https://kotlinlang.org/docs/exceptions.html)
3. [阿里巴巴Java开发手册](https://github.com/alibaba/p3c/blob/master/Java%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C%EF%BC%88%E5%B5%A9%E5%B1%B1%E7%89%88%EF%BC%89.pdf)
4. [Java's checked exceptions were a mistake](https://radio-weblogs.com/0122027/stories/2003/04/01/JavasCheckedExceptionsWereAMistake.html)
5. [The Trouble with Checked Exceptions](https://www.artima.com/articles/the-trouble-with-checked-exceptions)


> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
