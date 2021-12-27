---
title: Android隐私合规静态检查（二）
date: 2021-12-27T03:46:24.217Z
description: 之前分享了一篇关于 Android 隐私静态合规检查的文章，今天我们继续分享一下如何针对 so 调用、查找隐私方法调用入口等场景进行静态检查工作。
---

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12195272929/34d3/7924/ef23/a019fe44e0bf085fe985ebaa73331689.jpg)

> 本文作者：[烧麦](http://github.com/shaomaicheng)

# 前言

笔者之前在云音乐大前端公众号分享了 Android 隐私合规静态检查的一部分实现。
[Android隐私合规静态检查](https://mp.weixin.qq.com/s/U06HZb1P5Z2bK_ibtJk9KA)

上一篇文章通过反编译 APP 的方式，扫描了 APP 内对隐私方法调用的检查。但存在一些问题：

* 无法检查到 so 文件里是否可能存在隐私方法的调用。
* 当我们全量扫描出某个地方存在隐私方法调用的时候，我们不知道它实际的调用的入口究竟在哪里。


# so 文件里的调用

有时候我们有一些隐私方法是通过 JNI 反射执行 Java 层代码调用的，无法通过扫描 Java 层文件找到。所以需要针对 so 文件做一个特殊处理。

我们来梳理一下我们的需求：对于 APP 业务方，一般来说只需要知道某些隐私方法有没有通过 so 调用。在哪个 so 里可能会存在调用。剩下的，我们交给 so 的开发者去排查就行了。

需求明确了，那我们怎么知道 so 文件里是否调用了某个方法呢？在 Java 中，如果通过反射调用方法，类名+方法名的字符串肯定是作为字符串常量存在 class 文件的常量池内。那么 so 里是否会有类似的存储方式呢？

答案是肯定的，linux C 程序的字符串可能存在于以下 2 个区域：
* .text  代码段，通常是指用来存放程序执行代码的一块内存区域。这部分区域的大小在程序运行前就已经确定，并且内存区域通常属于只读,某些架构也允许代码段为可写，即允许修改程序。在代码段中，也有可能包含一些只读的常数变量，例如字符串常量等。
* .rodata 该段也叫常量区，用于存放常量数据，ro 就是 ReadOnly 的意思。存放 C 中的字符串和 #define 定义的常量.

我们可以通过 linux 的 `strings` 命令，来获取 so 文件里面使用到的字符串：

```
strings xx.so
```

我们检查 apk 文件里每个 so 文件的字符串，如果能匹配上配置的隐私方法名，那么就把当前的 so 标记为可疑的调用。检查的流程如下图：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12189102816/853e/793c/a302/1629aee4571ef134acbe5ba17213c030.png)


检查输出结果参考下面的 demo 示图：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12189121445/cee2/5bcb/bbe4/bce38ada3c0ae49e8f53250ad0b7bf38.png)


# 方法调用链分析

很多时候我们不知道是哪里调用了某个 Android API， 一般只能通过运行时去处理一下，例如 hook 这个方法替换它的实现。但是运行时检查覆盖不了所有的场景。所以静态检查 apk 的方法调用链是很必要的。至少我们可以看到某个敏感方法的调用源头是哪个类，从而进行溯源和归因。

笔者在上一篇分享的技术方案基础之上，进一步分析了方法调用链。上篇文章我们说到了通过反编译 apk，我们能转换生成相关的 smali 文件，smali 文件里会存在相关的方法调用信息。我们可以通过这些方法信息将整个 app 的方法调用关系组织起来。

### 方法收集

在 smali 文件的开头，会标记当前类的相关信息:

```
.class public final Lokhttp3/OkHttp;
.super Ljava/lang/Object;
```

我们会获取到当前一个类的修饰符和完整的类型描述符。

smali 里的 `.method` 指令则描述了当前 class 里有哪些方法：

```
.method constructor <init>(Lokhttp3/Call$Factory;Lokhttp3/HttpUrl;Ljava/util/List;Ljava/util/List;Ljava/util/concurrent/Executor;Z)V

.method private validateServiceInterface(Ljava/lang/Class;)V

.method public baseUrl()Lokhttp3/HttpUrl;
```


这里以 `Retrofit` 为例，我们可以看到 `Retrofit.smali` 里面的方法描述：

* 构造方法，传入的参数为 Factory、HttpUrl、List、List、Executor 和 boolean
* 私有方法 validateServiceInterface，参数为 Class，返回 void
* 公开方法 baseUrl，无参数，返回 HttpUrl

通过上述这些信息，我们可以收集到一个 APP 内，所有的方法。我们需要为每个方法建立自己的可识别性，我们通过下面这些字段来进行判断：

* 方法定义所在的类，需要是完整的包名+类名
* 一个方法签名内需要的字段，包括：
    
    * 方法名
    * 传入的参数


在 smali 中，方法的描述符是使用的 jvm 的描述符，我们需要解析描述符里的信息，来保存我们的每个字段以备输出显示。
方法的描述符规则会把符号和类型对应起来，基本类型的关系为：


|符号|类型|
|---|---| 
|V|void|
|Z|boolean|
|S|short|
|C|char|
|I|int|
|J|long|
|F|float|
|D|double|

对象则表示为完整的包名和类名，`L` 开头，使用文件描述符间隔，使用分号结尾，例如 Strig:

LJava/lang/String;


### 方法关系建立

收集到了所有的方法，我们建立调用链就还需要知道，方法调用了谁，以及方法被谁调用了。
在 smali 中，我们可以通过 `invoke-` 指令找到某个方法内调用了哪些其他方法：

`invoke-` 包括 
* `invoke-direct` 直接调用某个方法
* `invoke-static` 调用某个 static 方法
* `invoke-virtual` 调用某个虚方法
* `invoke-super` 直接调用父类的虚方法
* `invoke-interface` 调用某个接口的方法

除了 `invoke-interface` 需要在运行时确认调用对象，其他几个是可以通过 `invoke-` 后面的描述部分知道当前方法调用了哪些方法：

```
invoke-virtual {v2, p2, v1}, Ljava/util/HashMap;->put(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;
```

`invoke-` 后半段指令描述了具体调用的类名和方法，使用 -> 分隔开。解析这部分指令，我们可以获取到被调用方法的完整信息。

我们可以通过对整个 app 内反编译出的 smali 文件的调用关系进行一个收集，收集过程中，每个方法都会被存储下来，每个方法除了自己的方法信息，还包括被调用的列表：
* calleds: 调用了自己的方法列表

当某个方法调用被扫描到的时候，我们会把这个方法添加到当前调用者的 callers 里面，同时也把调用者添加到自己的 calleds 里面去。最终方法关系就建立成如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12195016576/5dd4/9fff/b805/ef339fadb0c14c9e6b59afa519dc519f.png)

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12194987432/e2a4/1f75/95d9/37550b3ade462e27ef8480e049687e06.png)

我们最终建立了一颗多叉树的图结构，这张图里，我们可以把我们需要检查调用链的隐私方法看做是树的叶子节点。

当然，我们也可以再新增一个 callers 数组，来表示每个方法调用的方法列表，这样我们还可以建立一个节点点存在双向绑定关系的树结构：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12194773650/93be/9503/d86a/2a56e28c95c13c946c49c675af5861ad.png)


在双向绑定的树结构中，我们既可以根据某个方法去分析出这个方法的调用链。也可以从顶层开始，分析某些入口所有可能存在的调用链。
例如，当我们怀疑某些页面存在不合规的调用时，我们可以把这些 Activity 的类找到，从上往下去寻找是否调用了隐私方法。


### 调用链遍历

方法调用的关系建立完毕后，我们需要遍历出所有的调用链并输出给使用方。这里就比较简单了，我们可以使用深度优先遍历来寻找我们的所有可能的路径：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12195054954/de75/1b0d/b52d/cad43ffcd6303c1aaab627613d1d79b1.png)

这里存在一种特殊情况，在递归的时候，有可能会出现 A 被 B 调用， B 又被 A 调用的情况，反映到当前的数据结构就是图结构形成了环。所以我们需要针对是否存在环进行判断。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12195111303/e653/8069/067f/cdcc8eba2b574664831ee75e8b2730ea.png)

当我们判断到当前调用链上存在重复节点的时候，就可以认定为存在环。这时候可以直接结束这条链上的递归，实际上也并不会影响我们事后分析这条调用链的合规性。

这部分逻辑可以用伪代码来表示：

```
fun traversal(method) {
    val paths = []
    dfs(method, [], paths)
}

fun dfs(method, path, temp) {
    if (method.calleds.isNotEmpty) {
        for (called in method.calleds) {
            if (path.contains(called)) {
                temp.add(path)
                continue
            } else {
                newPath = []
                newPath.addAll(path)
                newPath.add(0, method)
                dfs(called.method, newPath, temp)
            }
        }
    } else {
        path.add(0, method)
        temp.add(path)
    }
}
```

调用链分析最后的效果如下图：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12194277462/efac/7a39/157c/b97aac5685c3861fd03de6c69b34af91.png)


# 总结
到这里静态检查 Android 隐私合规调用就分享的差不多了，但是隐私合规相关的工作能做的还有很多。
静态的检查也只是辅助我们定位和检查可能存在的问题。我们仍然可以探索很多运行时的监测方案，两者互补之后的效果也会更好。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
