---
title: Android 隐私合规静态检查
date: 2021-11-01T09:41:32.608Z
description: 目前，国内对应用程序安全隐私问题监管变的越来越严格。各个应用市场对APP上架也有比较严格的检查。云音乐今年也在Google Play上上架了一些海外的社交类业务。Google Play在审核应用的时候，也有相应的政策。当我们每次遇到问题的时候，需要根据检查方的信息对一些代码逻辑进行排查。笔者开发了一个辅助定位隐私API调用的静态检查工具。在这里进行一个简单的分享。
---

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11160529617/2bc2/61f4/a8e5/6be3f7ce6a0222c849a92cae01040678.jpg)

> 本文作者：[烧麦](http://github.com/shaomaicheng)

目前，国内对应用程序安全隐私问题监管变的越来越严格。各个应用市场对APP上架也有比较严格的检查。云音乐今年也在Google Play上上架了一些海外的社交类业务。Google Play在审核应用的时候，也有相应的政策。当我们每次遇到问题的时候，需要根据检查方的信息对一些代码逻辑进行排查。

这是一个相对来说非常低效的过程。开发在平时写代码的时候一般不会使用敏感的API。大部分的敏感 API 调用都在一些三方 SDK 里面，或者一些敏感级别不是很高的 API，会存在多次调用的情况，

例如：

- 某应用在Google Play上架，云音乐内部的基础 SDK 里包括了一些国内的三方 SDK，这些SDK 使用了热修复或者动态下发 so 的功能。被 Google Play 发现拒审。
- 某应用在三方的检查中发现对地理位置的获取存在每 30 秒一次的频繁调用。

为了避免这类问题拖累 APP 上架，也为了提升检查的准确性和效率。笔者开发了一个针对 Android APK 的敏感方法调用的静态检查工具。

检查关键字，对于一些敏感 API 调用，例如 oaid、androidId 相关的调用。我们其实只要能检测到这些相关 API 里的一些关键字，找出整个 APP 里面有哪些地方直接调用了这些方法就可以了。

针对的上述的一些场景，这个工具具有两个方向的工作：

- APK 包的扫描，检查出整个APK中，哪些地方有对包含上面这些 API 关键字的直接调用。
- 运行时检查。针对运行时频繁调用这个场景，还是需要在运行时辅助检查特定API的调用情况。

## 工具方案

### 运行时

运行时的检测需要知道我们的方法在什么时候被调用了。那么被检测方法如果能有调用栈，那么我们在整改运行时的一些场景就会比较容易。这里我们用一个 Gradle 插件在 transfrom 里给我们需要检测的方法插入一行打印调用栈的代码即可。

这里利用 `Javassist` 给找到的方法插入一行调用栈打印就可以。

```kotlin
method.insertBefore(
	"android.util.Log.e(\"隐私方法调用栈\", android.util.Log.getStackTraceString(new Throwable()));"
)
```

### 产物扫描

对APK的扫描思路其实也很简单，我们的诉求就是检查所有的代码。但是我们这时候只有一个 APK 文件。那最直接并且扫描简单的的就是想办法把我们的包转成Java代码，逐行扫描我们的 Java 代码，检查是否有敏感的 API 调用。

如果我们平时想看一个APK包里面的代码我们会怎么做呢，最简单的就是反编译这个APK，然后把里面的 dex 文件转成 Java 去查看。我们可以用脚本把这个流程再实现一遍。

- 第一步先解压APK文件，把里面的dex文件单独拿出来。
- 使用 `dex2jar` 把 dex 文件转成 jar 文件。
- jar文件转成java文件
- 逐行扫描java文件

那么如何把jar文件转成java文件呢？我们平时点开Android Studio里面的jar或者aar就可以看到Java文件。我们也可以参考Android Studio的做法。

在 `IDEA` 的目录里面，我们其实可以找到相关功能依赖的 jar 包，也可以clone IDEA源码里面的相关模块自己打一个jar。

扫描工具的工作流程如图：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10270763380/8b4b/1dcc/e9a2/5ee11ab315d59e77eea6ac72297f1236.png)

*多APP配置*

云音乐目前旗下APP比较多，不同的APP也有可能会有不同的扫描类型和不同的关键字规则。

配置如下：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10270756978/785a/b961/cd57/3da850bbefbabe0e69a189687229cf76.png)

每个 APP 目前最多会有两份配置：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10270762037/c796/b9e5/1b2e/373b65ca5b0535313bcce224a79a309f.png)

gp.json 和 privacy.json 分别对应 google play扫描和隐私合规扫描。

里面的配置包括

- keys  扫描的关键字。
- filterPackages  过滤掉的包名。如果我们关注是不是某些三方 SDK 写了一些不合规的代码，那么我们可以把自己的包名给过滤。避免输出结果太多。

扫描结果会输出一个 json 文件和 html 文件。json 文件可以对比上次的扫描结果，增量的输出新增的扫描结果。html 文件则用来展示扫描结果，辅助对应的排查人排查相关的问题。

例如，热修复等动态下发的相关技术，都会有关于 `getField`、`ClassLoader` 之类的关键字存在。
我们可以找到直接调用这些 API 的地方，从下图我们可以看到，很多调用都是在三方 SDK 里面找到的。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11316638434/aa8f/0d28/8718/71a40b645f3dc75bc9592fdf4972d093.png)

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11316675342/7bd7/9cc9/dde7/9f3b4b6062829fb89bd939074f97f8b9.png)

### 优化

第一版的合规扫描开发完后，在使用上还是有一些问题：

- 运行时：检查我们自己代码内的方法很容易，但是如果想要检测系统 API 的时候就无效了。因为Android Framework 的 API 不会参与打包。自然也不可能插入字节码。
- 产物扫描：jar 转 java 的过程非常的耗时。整体扫描时间会被拉到3-5分钟。
- jar 转 java 的过程实际上也是一种反编译过程。因为 java 和 kotlin 语法的问题，某些会decompile 失败。这种情况多了的话，其实扫描是会有遗漏的。
- 扫描 java 文件是逐行遍历，把其他地方的关键字也扫描进来了，比如 field、import。这些扫描结果实际上是多余的。

针对上面这些问题，进行了针对性的优化。

运行时如果要检测系统 API 的调用，想到两种方案：

- transform 处理每个 class 和 jar 文件的时候，都去看下 class 内部的 method 有没有去调用这个系统 API。但是这个依赖字节码操作库的支持。
- 用一个专门的手机，用 xposed 之类的插件去 hook 系统 API。

第二种实现成本会比较高，不适合。但是运气比较好的是使用的 javassist 是支持第一种思路的操作的。

javassist 的 `CtMethod` 继承自 `CtBehavior` 对象。包括一个 `instrument` 方法。这个方法会找到方法内的表达式并允许替换。这里的表达式就包括 `MethodCall` 。

这样我们通过这个功能找到所有的调用就可以给直接调用了系统 API 的这个方法插入调用栈的打印。

运行期的检查就变成了：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11160298637/b4bc/6a4d/b8aa/597ed43040cc19eac77a06c31da6b715.png)

完成这个优化之后，我们可以发现实际上在编译期的方法扫描，我们是通过直接读取 class 文件去做的。那么对于 APK 包，我们也可以采取类似的思路。用相同方法去读取 dex2jar 之后解压出来的 jar包里的 class 文件。

但是再仔细想想，Android 在 class 文件之后会有 dex 文件。Android 虚拟机直接执行的应该是 dex文件。而 dex 文件本质上只是一种二进制格式，最终会根据这个文件格式里的内容，按照汇编去执行。

思路到这里就清晰了，如果我们试着把 dex 文件直接反汇编成 smali 文件，去遍历 smali 文件可能效果会更好。

#### smail 语法介绍
一个 smail 文件对应一个 Java 的类，准确来说，是对应一个 .class 或者 .dex 文件。
内部类则会按照 `ClassName$InnerClassA`、`ClassName$InnerClassB` 的格式来命名。

smail 里面存在的基本类型，分别对应 Java 的基本类型，如下表所示：

| 类型关键字 |  Java 基本类型 |
| -- | -- |
| V |  void |
| Z | boolean |
| B | byte |
| S | short |
| C | char |
| I | int|
|J|long|
|F|float|
|D|double|

smail一些常见的基本指令如下表：

| 指令 | 含义 |
| --| --|
|.class| 包名和类名|
|.super|父类|
|.source|源文件名称|
|.implements|接口实现|
|.field|变量|
|.method|方法|
|.end method|方法结束|
|.line|行数|
|.param|函数参数|
|.annotation|注解|
|.end annotation|注解结束|

方法的调用也分为以下几种指令：
| 指令 | 含义 |
| -- | -- |
| invoke-virtua | 调用虚方法 |
| invoke-static  | 调用静态方法 |
| invoke-direct | 调用没有被override的方法，例如private和构造方法|
| invoke-super | 调用父类的方法|
| invoke-interface| 调用接口方法|

我们看一个示例 `smali` 文件的格式：

```
.class public abstract Lcom/horcrux/svg/RenderableView;
.super Lcom/horcrux/svg/VirtualView;
.source "RenderableView.java"

# static fields
.field private static final CAP_BUTT:I = 0x0
.field static final CAP_ROUND:I = 0x1

# instance fields
.field public fillOpacity:F
.field public fillRule:Landroid/graphics/Path$FillType;

.method static constructor <clinit>()V
	.registers 1
	.line 97
	invoke-static {v0}, Ljava/util/regex/Pattern;->compile(Ljava/lang/String;)Ljava/util/regex/Pattern;
	return-void
.end method

.method resetProperties()V
	.registers 4
	.line 635
	invoke-virtual {p0}, Ljava/lang/Object;->getClass()Ljava/lang/Class;
	invoke-virtual {v1, v2}, Ljava/lang/Class;->getField(Ljava/lang/String;)Ljava/lang/reflect/Field;
	return-void
.end method
```

`smali` 文件的开头会告诉类名、父类、源文件名。
这个文件的类名就是 `com.horcrux.svg.RenderableView`。父类是 `com.horcrux.svg.VirtualView`，源文件名为 `RenderableView.java`。

里面的变量和方法都有开头和结束的标记。
在 `.method` 里，我们可以看到

- `line` 开头会标记行号
- `invoke-` 开头会标记方法的调用

上面例子里包括两个方法：
1. 构造方法。97行调了一个静态方法。
2. `resetProperties` 方法。在 635 行，调用了 getClass() 和 getField() 这两个虚函数。

对应的java代码则是：
```
// line 635
Field field = this.getClass().getField((String)this.mLastMergedList.get(i));
```

这里我们基本能定义出 smali 文件的扫描方式：

1. 逐行读取一个smali文件，读到前面三行的时候，读取类的基本信息。
2. 读取到 `.method` 和 `.end method` 的时候标记为读取到自己的方法。
3. 读取到 `.line` 和下一个 `.line` 的时候，标记为读取到方法内的具体行号。
4. 读取到 `invoke-` 开头的行，标记为读取到方法调用。如果此行末尾的方法签名满足我们的关键字匹配，就记录为扫描结果之一。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11160300025/2015/12ee/6d62/d619124d32dacc51bf262a5207d72cd0.png)

在实践中，我们可以使用开源的 `baksmali.jar`  进行dex转 smali的操作。使用上述规则直接扫描 smali 文件。避免了上面提到的缺陷。扫描时间也有很大的提升。基本上在半分钟左右都可以完成整个全量的扫描。省略了反编译jar包的巨长时间。

这个工具最终呈现为一个 jar 文件，通过命令行运行。在排查隐私合规可疑的 API 调用的时候，非常适用。

## 总结
通过这个工具， 在 APK 的隐私合规问题检查的时候，我们可以获取比较完整的可疑调用来辅助我们进行合规方面工作的处理。
这个工具的优势在于：
* APK 包是最终产物，扫描内容比较完整。
* 不在编译期进行扫描，不会降低开发效率。

但是这个工具还有一些不足之处，例如
* 不能精确定位到隐私函数调用具体归因在哪个模块或者 aar，难以集成在 CI/CD 进行归因处理。
* 比较难以获取完整的函数调用链。

所以我们还会继续进行编译期的合规检查工作。两者结合来完善相关的工作。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
