---
title: android agp 对 R 文件内联支持
date: 2021-07-20T10:58:34.515Z
description: 本文介绍android agp 4.1.0 如何支持 R 文件内联以及 R 文件的一些历史问题。 
---

![header.png](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9643935463/2a84/cdc0/8d0c/98671353a55992e35e7249737e26dc6a.jpg)

> 本文作者：[郑超](https://www.jianshu.com/u/086364200d62)


## 背景
最近团队升级静态代码检测能力，依赖的相关编译检测能力需要用到较新的agp，而且目前云音乐agp版本用的是 3.5.0，对比现在 4.2.0 有较大差距，所以我们集中对 agp 进行了一次升级。在升级前通过官方文档，发现在 agp3.6.0 和 4.1.0 版本分别对 R 文件的处理方式进行了相应的升级,具体升级如下。

## agp 3.6.0 变更

**Simplified R class generation**

The Android Gradle plugin simplifies the compile classpath by generating only one R class for each library module in your project and sharing those R classes with other module dependencies. This optimization should result in faster builds, but it requires that you keep the following in mind:

* Because the compiler shares R classes with upstream module dependencies, it’s important that each module in your project uses a unique package name.
* The visibility of a library's R class to other project dependencies is determined by the configuration used to include the library as a dependency. For example, if Library A includes Library B as an 'api' dependency, Library A and other libraries that depend on Library A have access to Library B's R class. However, other libraries might not have access to Library B's R class If Library A uses the implementation dependency configuration. To learn more, read about dependency configurations.


从字面意思理解 `agp3.6.0` 简化了 R 的生成过程，每一个 module 直接生成 `R.class` (在 3.6.0 之前 R.class 生成的过程是为每个 module 先生成  R.java -> 再通过 javac 生成 R.class ,现在是省去了生成 R.java 和通过 javac 生成 R.class)

现在我们来验证一下这个结果，建一个工程，工程中会建立 android library module。分别用 agp3.5.0 和 agp3.6.0 编译，然后看构建产物。

#### agp 3.5.0 构建产物如下：
![image](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9540496829/89a8/534c/13c4/e4fc60e69bde4b92ec45245c1a1e5bd9.jpg)
#### agp 3.6.0 构建产物如下：
![image](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9540496693/45e9/8e18/9bcd/463aa2248681a8815b185fc4a4b6b7af.jpg)

从构建产物上来看也验证了这个结论，agp 3.5.0 到 3.6.0 通过减少 R 生成的中间过程，来提升 R 的生成效率（先生成 R.java 再通过 javac 生成 R.class 变为直接生成 R.class）；


## agp 4.1.0升级如下：

**App size significantly reduced for apps using code shrinking**

Starting with this release, fields from R classes are no longer kept by default, which may result in significant APK size savings for apps that enable code shrinking. This should not result in a behavior change unless you are accessing R classes by reflection, in which case it is necessary to add keep rules for those R classes.


从标题看 `apk 包体积有显著减少`（这个太有吸引力了），通过下面的描述，大致意思是不再保留 R 的 keep 规则，也就是 app 中不再包括 R 文件？（要不怎么减少包体积的）

在分析这个结果之前先介绍下 apk 中，R 文件冗余的问题；
### R 文件冗余问题
android 从 ADT 14 开始为了解决多个 library 中 R 文件中 id 冲突，所以将 Library 中的 R 的改成 static 的非常量属性。

在 apk 打包的过程中，module 中的 R 文件采用对依赖库的R进行累计叠加的方式生成。如果我们的 app 架构如下：

![image](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9543238292/c17a/0a39/2dfb/2aaa68ec576e7247a840e965ae31e2ff.jpg)

编译打包时每个模块生成的 R 文件如下：
1. R_lib1 = R_lib1;
2. R_lib2 = R_lib2;
3. R_lib3 = R_lib3;
4. R_biz1 = R_lib1 + R_lib2 + R_lib3 + R_biz1(biz1本身的R)
5. R_biz2 = R_lib2 + R_lib3 + R_biz2(biz2本身的R)
6. R_app = R_lib1 + R_lib2 + R_lib3 + R_biz1 + R_biz2 + R_app(app本身R)

在最终打成 apk 时,除了 R_app（因为 app 中的 R 是常量，在 javac 阶段 R 引用就会被替换成常量，所以打 release 混淆时，app 中的 R 文件会被 shrink 掉），其余的 R 文件全部都会打进 apk 包中。这就是 apk 中 R 文件冗余的由来。而且如果项目依赖层次越多，上层的业务组件越多，将会导致 apk 中的 R 文件将急剧的膨胀。

### R 文件内联（解决冗余问题）
系统导致的冗余问题，总不会难住聪明的程序员。在业内目前已经有一些R文件内联的解决方案。大致思路如下：
> 由于 R_app 是包括了所有依赖的的 R，所以可以自定义一个 transform 将所有 library module 中 R 引用都改成对 R_app 中的属性引用，然后删除所有依赖库中的 R 文件。这样在 app 中就只有一个顶层 R 文件。(这种做法不是非常彻底，在 apk 中仍然保留了一个顶层的 R，更彻底的可以将所有代码中对 R 的引用都替换成常量，并在 apk 中删除顶层的 R )

## agp 4.1.0 R 文件内联
首先我们分别用 agp 4.1.0 和 agp 3.6.0 构建 apk 进行一个对比，从最终的产物来确认下是否做了 R 文件内联这件事。
测试工程做了一些便于分析的配置，配置如下：
1. 开启 proguard
```
buildTypes {
    release {
        minifyEnabled true // 打开
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```
2. 关闭混淆，仅保留压缩和优化（避免混淆打开，带来的识别问题）
```
// proguard-rules.pro中配置
-dontobfuscate
```
构建 release 包。
先看下 agp 3.6.0 生成的 apk：

![image](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9543995348/a4cd/ef4a/4d3c/1d78b4f6951622a8ce9997420963ebe3.jpg)

从图中可以看到 `bizlib` module 中会有 R 文件,查看 `SecondActivity` 的 byte code ，会发现内部有对 R 文件的引用。

接着再来看 agp 4.1.0 生成的 apk：

![image](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9543989375/4f8a/6d85/ad31/df20e4b82c86d071102cdf3a3b01099b.jpg)

可以看到，`bizlib` module 中已经没有 R 文件，并且查看 `SecondActivity` 的 byte code ，会发现内部的引用已经变成了一个常量。

由此可以确定，agp 4.1.0 是做了对 R 文件的内联，并且做的很彻底，不仅删除了冗余的 R 文件，并且还把所有对 R 文件的引用都改成了常量。

### 具体分析
现在我们来具体分析下 agp 4.1.0 是如何做到 R 内联的，首先我们大致分析下，要对 R 做内联，基本可以猜想到是在 class 到 dex 这个过程中做的。确定了大致阶段，那接下看能不能从构建产物来缩小相应的范围，最好能精确到具体的 task。（题外话：分析编译相关问题一般四板斧：1. 先从 app 的构建产物里面分析相应的结果；2.涉及到有依赖关系分析的可以将所有 task 的输入输出全部打印出来；3. 1、2满足不了时，会考虑去看相应的源码；4. 最后的大招就是调试编译过程；）

首先我们看下构建产物里面的 dex，如下图：

![image](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9552333734/d35f/fcef/b005/9808a1c930a8043bb143e9142b6b81ce.jpg)

接下来在 app module 中增加所有 task 输入输出打印的 gradle 脚本来辅助分析，相关脚本如下：
```groovy
gradle.taskGraph.afterTask { task ->
    try {
        println("---- task name:" + task.name)
        println("-------- inputs:")
        task.inputs.files.each { it ->
            println(it.absolutePath)
        }
        println("-------- outputs:")
        task.outputs.files.each { it ->
            println(it.absolutePath)
        }
    } catch (Exception e) {

    }
}
```
`minifyReleaseWithR8` 相应的输入输出如下：

![image](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9552381148/cc46/1b51/4fa9/744e8880cf08288d0d69cf38faea9a87.jpg)

从图中可以看出，输入有整个 app 的 R 文件的集合（R.jar）,所以基本明确 R 的内联就是在 `minifyReleaseWithR8` task 中处理的。

接下来我们就具体分析下这个 task。
具体的逻辑在 `R8Task.kt` 里面.

创建 `minifyReleaseWithR8` task 代码如下:
```kotlin
class CreationAction(
        creationConfig: BaseCreationConfig,
        isTestApplication: Boolean = false
    ) : ProguardConfigurableTask.CreationAction<R8Task, BaseCreationConfig>(creationConfig, isTestApplication) {
        override val type = R8Task::class.java
        // 创建 minifyReleaseWithR8 task
        override val name =  computeTaskName("minify", "WithR8")
    .....
}
```
task 执行过程如下（由于代码过多，下面仅贴出部分关键节点）：
```kotlin
    // 1. 第一步，task 具体执行
    override fun doTaskAction() {
    ......
        // 执行 shrink 操作
        shrink(
            bootClasspath = bootClasspath.toList(),
            minSdkVersion = minSdkVersion.get(),
            ......
        )
    }
    
    // 2. 第二步，调用 shrink 方法，主要做一些输入参数和配置项目的准备
    companion object {
        fun shrink(
            bootClasspath: List<File>,
            ......
        ) {
            ......
            // 调用 r8Tool.kt 中的顶层方法，runR8
            runR8(
                filterMissingFiles(classes, logger),
                output.toPath(),
                ......
            )
        }
    // 3. 第三步,调用 R8 工具类，执行混淆、优化、脱糖、class to dex 等一系列操作
    fun runR8(
        inputClasses: Collection<Path>,
        ......
    ) {
        ......
        ClassFileProviderFactory(libraries).use { libraryClasses ->
            ClassFileProviderFactory(classpath).use { classpathClasses ->
                r8CommandBuilder.addLibraryResourceProvider(libraryClasses.orderedProvider)
                r8CommandBuilder.addClasspathResourceProvider(classpathClasses.orderedProvider)
                // 调用 R8 工具类中的run方法
                R8.run(r8CommandBuilder.build())
            }
        }
    }
```
至此可以知道实际上 agp 4.1.0 中是通过 R8 来做到 R 文件的内联的。那 R8 是如果做到的呢？这里简要描述下，不再做具体代码的分析：

> R8 从能力上是包括了 Proguard 和 D8（java脱糖、dx、multidex），也就是从 class 到 dex 的过程，并在这个过程中做了脱糖、Proguard 及 multidex 等事情。在 R8 对代码做 shrink 和 optimize 时会将代码中对常量的引用替换成常量值。这样代码中将不会有对 R 文件的引用，这样在 shrink 时就会将 R 文件删除。
当然要达到这个效果 agp 在 4.1.0 版本里面对默认的 keep 规则也要做一些调整，4.1.0 里面删除了[默认对 R 的 keep 规则](https://issuetracker.google.com/issues/142449264)，相应的规则如下：
> ```
> -keepclassmembers class **.R$* {
>    public static <fields>;
> }
> ```

## 总结
1. 从 agp 对 R 文件的处理历史来看，android  编译团队一直在对R文件的生成过程不断做优化，并在 agp 4.1.0 版本中彻底解决了 R 文件冗余的问题。
2. 编译相关问题分析思路：
    1. 先从 app 的构建产物里面分析相应的结果；
    2. 涉及到有依赖关系分析的可以将所有 task 的输入输出全部打印出来；
    3. 1、2满足不了时，会考虑去看相应的源码；
    4. 最后的大招就是调试编译过程；

3. 从云音乐 app 这次 agp 升级的效果来看，app 的体积降低了接近 7M，编译速度也有很大的提升，特别是 release 速度快了 10 分钟+（task 合并），整体收益还是比较可观的。

文章中使用的[测试工程](https://github.com/sunday1937/AgpTest2)；

## 参考资料
1. [Shrink, obfuscate, and optimize your app](https://developer.android.com/studio/build/shrink-code)
2. [r8](https://r8.googlesource.com/r8/)
3. [Android Gradle plugin release notes](https://developer.android.com/studio/releases/gradle-plugin#4-1-0)


> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
