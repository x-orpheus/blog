---
title: AGP 升级之旅
date: 2021-09-02T03:46:24.217Z
description: 本文将介绍 AGP 由 3.5.0 升级到 4.1.3 的适配过程，对遇到的问题进行分析，并给出相应的解决方案。
---

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/9711204442/1312/1fa0/ebb3/be3eb242c45c5d08a514927483f3f201.jpg)

> 本文作者：履坎(xjy2061)

## 起源
近期，由于引入的新工具依赖 Android Gradle Plugin（后面都简写为 AGP）4.1 或以上版本，而项目当前使用的 AGP 版本为 3.5.0，需进行升级。考虑到一些第三方库尚未对最新的 AGP 4.2 版本提供支持，决定将 AGP 升级到 4.1 中的最高版本 4.1.3，遂开启了本次 AGP 升级之旅。

## 依据官方文档适配
升级的第一步当然是阅读官方 [Android Gradle 插件版本说明](https://developer.android.com/studio/releases/gradle-plugin) 文档，根据文档所列版本变更进行适配。

### AGP 3.6 适配
AGP 3.6 引入了如下行为变更：
> 默认情况下，原生库以未压缩的形式打包

该变更使原生库（native library）以未压缩方式打包，会增加 APK 大小，带来的收益有限，且部分收益依赖 Google Play，如评估后认为弊大于利，可在 `AndroidManifest.xml` 中添加如下配置改为压缩原生库：
````xml
<application
    android:extractNativeLibs="true"
    ... >
</application>
````

### AGP 4.0 适配
AGP 4.0 引入了如下新特性：
> 依赖项元数据

该变更会将应用依赖项的元数据进行压缩加密后存储于 APK 签名块中，Google Play 会使用这些依赖项来做问题提醒，收益有限，但会增加 APK 大小，如 App 不在 Google Play 上架，可在 `build.gradle` 中添加如下配置来关闭这个特性：
````groovy
android {
    dependenciesInfo {
        // Disables dependency metadata when building APKs.
        includeInApk = false
        // Disables dependency metadata when building Android App Bundles.
        includeInBundle = false
    }
}
````

### AGP 4.1 适配
AGP 4.1 引入了如下行为变更：
> 从库项目中的 BuildConfig 类中移除了版本属性

该变更从库模块（library module）的 `BuildConfig` 类中删除了 `VERSION_NAME` 和 `VERSION_CODE` 字段。一般而言在库模块中获取版本号是希望获取 App 的版本号，而库模块中的 `BuildConfig.VERSION_NAME` 和 `BuildConfig.VERSION_CODE` 为库模块自身的版本号，此时不应该使用库模块中的这 2 个字段，可用如下代码来在库模块中获取 App 的版本号：
````kotlin
private var appVersionName: String = ""
private var appVersionCode: Int = 0

fun getAppVersionName(context: Context): String {
  if (appVersionName.isNotEmpty()) return appVersionName
  return runCatching {
    context.packageManager.getPackageInfo(context.packageName, 0).versionName.also {
      appVersionName = it
    }
  }.getOrDefault("")
}

fun getAppVersionCode(context: Context): Int {
  if (appVersionCode > 0) return appVersionCode
  return runCatching {
    PackageInfoCompat.getLongVersionCode(
      context.packageManager.getPackageInfo(context.packageName, 0)
    ).toInt().also { appVersionCode = it }
  }.getOrDefault(0)
}
````

## 遇到的问题
按官方文档适配后，不出意料地还是遇到了不少问题，这些问题部分由未在官方文档中明确指出的行为变更导致，部分由不规范做法命中了新版 AGP 更严格的限制导致，下面介绍这些问题的表现、原因分析和解决方案。

### `BuildConfig.APPLICATION_ID` 找不到
我们的部分组件库模块中使用了 `BuildConfig.APPLICATION_ID` 字段，编译时出现 **Unresolved reference** 错误。

原因是库模块中的 `BuildConfig.APPLICATION_ID` 字段名存在歧义，其值是库模块的包名，并不是应用的包名，因此该字段从 AGP 3.5 开始被废弃，替换为 `LIBRARY_PACKAGE_NAME` 字段，且从 AGP 4.0 开始被彻底删除。

我们原来在 App 模块中的部分代码使用 `APPLICATION_ID` 获取 App 包名，在后面的组件化拆分过程中将 App 模块中的代码抽取到组件库时，为避免错误地用库模块的包名作为 App 包名，应该同步修改获取 App 包名方式，但遗漏了，没有修改，导致本次 AGP 升级后编译失败。

针对这个问题，将库模块中获取 App 包名方式改为使用 `Context.getPackageName()` 方法即可。

### R 和 ProGuard mapping 文件找不到
我们会备份构建发布包时产生的 R 和 ProGuard mapping 文件以备后面需要时使用，升级后备份失败。

这是因为从 AGP 3.6 开始，构建产物中这 2 个文件的路径会改变：
* `R.txt`：`build/intermediates/symbols/${variant.dirName}/R.txt` -> `build/intermediates/runtime_symbol_list/${variant.name}/R.txt`
* `mapping.txt`：`build/outputs/mapping/${variant.dirName}/mapping.txt` -> `build/outputs/mapping/${variant.name}/mapping.txt`

其中 `${variant.dirName}` 为 `$flavor/$buildType`（例如 full/release），`${variant.name}` 为 `$flavor${buildType.capitalize()}`（例如 fullRelease）。

可按如下方式将备份逻辑中的文件路径修改为上述新路径来解决这个问题：
````groovy
afterEvaluate {
    android.applicationVariants.all { variant ->
        def variantName = variant.name
        def variantCapName = variant.name.capitalize()

        def assembleTask = tasks.findByName("assemble${variantCapName}")
        assembleTask.doLast {
            copy {
                from "${buildDir}/outputs/mapping/${variantName}/mapping.txt"
                from "${buildDir}/intermediates/runtime_symbol_list/${variantName}/R.txt"
                into backPath
            }
        }
    }
}
````

### 固定资源 id 失效
为避免 App 升级覆盖安装后可能出现 inflate 通知等 `RemoteView` 时，由于通过资源 id 找到错误的资源文件，导致崩溃的问题，我们在构建时进行了固定资源 id 处理，使部分资源文件的 id 在多次构建之间始终不变，升级后这部分资源 id 发生了变化。

原固定资源 id 的实现方式是在 `afterEvaluate` 后，使用 `tasks.findByName` 方法获取 `process${variant.name.capitalize()}Resouces`（例如 processFullReleaseResources）任务对象，然后在 AGP 3.5 以前使用调 `getAaptOptions` 方法，在 AGP 3.5 中使用反射的方式获取任务对象中的 `aaptOptions` 属性对象，然后向其 `additionalParameters` 属性对象添加 `--stable-ids` 参数及对应的资源 id 配置文件路径值。但在 AGP 4.1 中，处理资源任务类不再有 `aaptOptions` 属性，导致固定失效。

对于 AGP 4.1，可换成如下直接设置 `android.aaptOptions.additionalParameters` 的方式来固定资源 id：
````groovy
afterEvaluate {
    def additionalParams = android.aaptOptions.additionalParameters
    if (additionalParams == null) {
        additionalParams = new ArrayList<>()
        android.aaptOptions.additionalParameters = additionalParams
    }
    def index = additionalParams.indexOf("--stable-ids")
    if (index > -1) {
        additionalParams.removeAt(index)
        additionalParams.removeAt(index)
    }
    additionalParams.add("--stable-ids")
    additionalParams.add("${your stable ids file path}")
}
````

### Manifest 文件修改失败
我们会在构建过程中修改 `AndroidManifest.xml` 文件加入额外信息，升级后修改失败。

在分析本次升级包含的各版本 AGP 构建日志后，发现 AGP 4.1 针对 Manifest 处理新增了 `process${variant.name.capitalize()}ManifestForPackage`（例如 processFullReleaseManifestForPackage）任务，该任务在原 Manifest 处理任务 `process${variant.name.capitalize()}Manifest`（例如 processFullReleaseManifest）后执行，其产物[1]跟原任务不同。而原来向 Manifest 添加额外信息的方式是在原 Manifest 处理任务执行后，执行自定义 Manifest 处理任务 `cmProcess${variant.name.capitalize()}Manifest`（例如 cmProcessFullReleaseManifest），向原 Manifest 处理任务的产物[2]写入信息。升级后，如果 2 个处理 Manifest 的任务都命中了缓存（执行状态为 `FROM-CACHE`），那么最终 APK 内的 Manifest 文件中的额外信息会是以前编译写入的旧信息。

[1]: processFullReleaseManifestForPackage 任务的产物为 build/intermediates/packaged_manifests/fullRelease/AndroidManifest.xml

[2]: processFullReleaseManifest 任务的产物为 build/intermediates/merged_manifests/fullRelease/AndroidManifest.xml

因此，写入信息的方式应如下图所示，改为在新增的 Manifest 处理任务执行后，向其产物文件写入信息。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10010555695/7fb6/47aa/53ef/521b1da29dbcc6ee86d00ae556fb9e08.png)

### Transform 插件执行失败
我们在构建过程中加入了一些 Transform 插件，升级后其中一个使用 ASM 进行代码插桩的插件在执行时出现如下错误：
````
Execution failed for task ':app:transformClassesWithxxx'.
> java.lang.ArrayIndexOutOfBoundsException (no error message)
````
上面错误提示中的异常也可能是 `java.lang.IllegalArgumentException: Invalid opcode 169`。

为找到异常的具体来源，加入 `--stacktrace` 参数重新构建，定位异常由插件中引入的第三方库 Hunter 触发。这个插件运行时使用的 ASM 是 AGP 自带的，AGP 3.5 使用的是 ASM 6，而从 AGP 3.6 开始使用的是 ASM 7，应该是引入的 Hunter 在 ASM 7 上存在缺陷，导致升级后出现异常。

考虑到 Hunter 只是对使用 ASM 的 Transform 做了些简单封装，且这个插件实现的功能比较简单，所以采用移除 Hunter 重新实现的方式解决这个问题。

### Cannot change dependencies of dependency configuration
我们使用了 `resolutionStrategy.dependencySubstitution` 来实现组件库源码切换，升级后，如果将组件库切成了源码，在 Android Studio 中点击 Run 按钮构建时会出现如题错误。

在排查问题的过程中发现在命令行中执行 `./gradlew assembleRelease` 能构建成功，而通过 Android Studio Run 构建与上述命令行构建的区别仅仅是所执行的任务前增加了模块前缀（`:app:assembleRelease`）。从这个区别出发，最终找到问题的原因是在 `gradle.properties` 中开启了 `org.gradle.configureondemand` 这个孵化中的特性，使 gradle 只配置跟请求的任务相关的 project，导致以指定 module 方式执行任务时，切为源码的 project 没有配置。

关闭 `org.gradle.configureondemand` 特性即可解决这个问题。

### Entry name 'xxx' collided
升级后构建，在执行打包任务 `package${variant.name.capitalize()}`（例如 packageFullRelease） 时会出现如题错误。

由官方文档可知 AGP 3.6 引入了如下新功能：
> 新的默认打包工具

该功能会在构建 debug 版时，使用新打包工具 zipflinger 来构建 APK，且从 AGP 4.1 开始，构建 release 版时也会使用这个新打包工具。

错误发生在打包生成 APK 的任务中，很容易联想到跟上述新功能有关。使用官方文档提供的方式，在 `gradle.properties` 文件中添加 `android.useNewApkCreator=false` 配置恢复使用旧打包工具后，可以成功构建。但生成的 APK 中缺失 Java 资源文件，导致运行时出现各种问题（如 OkHttp 缺少 publicsuffixes.gz 文件，导致请求一直不返回）。

现在解决问题的方向有 2 个：解决 Java 资源文件缺失问题和解决如题构建错误。为解决这些问题，需要先分析问题产生的原因，通过调试 AGP 构建过程，分析 AGP 源码，发现打包任务对应的实现类为 `PackageApplication`，主要实现逻辑在其父类 `PackageAndroidArtifact` 中，向 APK 文件写入 Android 和 Java 资源文件的调用过程如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10141121598/3bd4/19fd/6ee7/d5c3db719a78a8cfbedfef96f08cff8b.png)

`updateSingleEntryJars` 方法写入 asset 文件，`addFiles` 方法写入其他 Android 资源文件和 Java 资源文件。调 `writeZip` 之前会根据 `android.useNewApkCreator` 配置决定使用哪个打包工具，值为 `true` 用 `ApkFlinger`，否则用 `ApkZFileCreator`，`android.useNewApkCreator` 默认值为 `true`。

如通过配置使用旧打包工具 `ApkZFileCreator`，它会用 `ZFile` 读资源缩减后生成的文件[3]，以及混淆后生成的文件[4]，将其中的 Android 和 Java 资源文件写入到 APK 文件中。

[3]: `build/intermediates/shrunk_processed_res/${varient.name}/resources-$flavor-$buildType-stripped.ap_`（例如 build/intermediates/shrunk_processed_res/fullRelease/resources-full-release-stripped.ap_）

[4]: `build/intermediates/shrunk_java_res/${varient.name}/shrunkJavaRes.jar`（例如 build/intermediates/shrunk_java_res/fullRelease/shrunkJavaRes.jar），如关闭了 R8，则是 `build/intermediates/shrunk_jar/${varient.name}/minified.jar`（例如 build/intermediates/shrunk_jar/fullRelease/minified.jar）

下面的源码片段展示了写入的主要逻辑，分为如下 3 步：
1. 创建 `ZFile` 对象，读取 zip 文件将 central directory 中的每项加入到 `entries` 中
2. 遍历 `ZFile` 中的 `entries`，将压缩的资源文件合并到 APK 文件中
3. 遍历 `ZFile` 中的 `entries`，将非压缩的资源文件写入到 APK 文件中
````java
// ApkZFileCreator.java
public void writeZip(
    File zip, @Nullable Function<String, String> transform, @Nullable Predicate<String> isIgnored)
    throws IOException {
  // ...
  try {
    ZFile toMerge = closer.register(ZFile.openReadWrite(zip));
    // ...
    Predicate<String> noMergePredicate =
        v -> ignorePredicate.apply(v) || noCompressPredicate.apply(v);

    this.zip.mergeFrom(toMerge, noMergePredicate);

    for (StoredEntry toMergeEntry : toMerge.entries()) {
      String path = toMergeEntry.getCentralDirectoryHeader().getName();
      if (noCompressPredicate.apply(path) && !ignorePredicate.apply(path)) {
        // ...
        try (InputStream ignoredData = toMergeEntry.open()) {
          this.zip.add(path, ignoredData, false);
        }
      }
    }
  } catch (Throwable t) {
    throw closer.rethrow(t);
  } finally {
    closer.close();
  }
}

// ZFile.java
private void readData() throws IOException {
  // ...
  readEocd();
  readCentralDirectory();
  // ...
  if (directoryEntry != null) {
    // ...
    for (StoredEntry entry : directory.getEntries().values()) {
      // ...
      entries.put(entry.getCentralDirectoryHeader().getName(), mapEntry);
      //...
    }

    directoryStartOffset = directoryEntry.getStart();
  } else {
    // ...
  }
  // ...
}

public void mergeFrom(ZFile src, Predicate<String> ignoreFilter) throws IOException {
  // ...
  for (StoredEntry fromEntry : src.entries()) {
    if (ignoreFilter.apply(fromEntry.getCentralDirectoryHeader().getName())) {
      continue;
    }
    // ...
  }
}
````

在调试过程中发现读取 `minified.jar` 文件创建的 `ZFile` 中的 `entries` 中没有 Java 资源文件，而在前面 `IncrementalSplitterRunnable.execute` 中调 `PackageAndroidArtifact.getChangedJavaResources` 获取改变的 Java 资源文件时，使用 `ZipCentralDirectory` 能正常读取到 Java 资源文件，说明 `ZFile` 存在缺陷。

上述 Java 资源文件缺失的问题是在关闭 R8 时出现的，后面开启 R8 测试正常，新建 demo 工程测试，无论是否开启 R8 都正常。因此，可得到如下结论：
* 如 `ZFile` 注释中所述，它不是通用的 zip 工具类，对 zip 格式和不支持的特性有严格的要求；它在某些特殊条件下存在限制，可能会出现读取文件缺失等问题
* 由于旧打包工具使用了 `ZFile` 可能导致存在生成的 APk 缺失 Java 资源文件等问题，且已被官方废弃，不应该再使用

现在解决问题的方向回到解决如题构建错误上来，新打包工具 `ApkFlinger` 写入 Android 或 Java 资源文件的调用过程如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10141128289/7139/d9f8/eab8/b8a85e7b1f0e80964837f98a6e83aa76.png)

从如下源码片段可看到，在 `ZipArchive.writeSource` 中会调 `validateName` 检查写入的 entry 名称的有效性，如果当前 zip 文件的 central directory 中已存在相同名字的内容，则抛出 `IllegalStateException` 异常，提示如题错误。
````java
// ZipArchive.java
private void writeSource(@NonNull Source source) throws IOException {
    // ...
    validateName(source);
    // ...
}

private void validateName(@NonNull Source source) {
    byte[] nameBytes = source.getNameBytes();
    String name = source.getName();
    if (nameBytes.length > Ints.USHRT_MAX) {
        throw new IllegalStateException(
                String.format("Name '%s' is more than %d bytes", name, Ints.USHRT_MAX));
    }

    if (cd.contains(name)) {
        throw new IllegalStateException(String.format("Entry name '%s' collided", name));
    }
}
````

从源码和调试结果来看，出现如题错误的原因一般是某些不规范的做法使 jar 文件中存在同名的 Android 资源文件，我们遇到的 2 例为：
* 某个第三方库的 aar 中存在 asset 文件，同时其 classes.jar 中也存在相同的 asset 文件
* 某个第三方库将另外一个第三方库的 aar 文件当做普通 jar 文件依赖，导致其 classes.jar 中存在 `AndroidManifest.xml` 文件

知道问题的原因后，可根据提示的文件名在 `shrunkJavaRes.jar` 或 `minified.jar` 中找到对应的文件，然后根据文件中的信息（如 `AndroidManifest.xml` 中的包名）定位到工程中的具体位置，再做相应的修改即可。

### so 文件没有 strip
升级后，构建生成的 APK 中的 so 文件没有 strip，使用 ndk 中的 nm 工具[5]（在 macOS 中也可用系统自带的 nm）查看，发现符号表和调试信息依然存在。

[5]: `toolchains/aarch64-linux-android-4.9/prebuilt/$HOST_TAG/aarch64-linux-android/bin/nm`，`HOST_TAG` 在不同操作系统中的值不同，在 macOS 中为 darwin-x86_64，在 Windows 中为 windows-x86_64

分析构建日志后发现 `strip${variant.name.capitalize()}Symbols`（例如 stripFullReleaseSymbols）任务有执行，接着分析 AGP 源码，调试构建过程，发现该任务通过 `StripDebugSymbolsRunnable` 对 so 进行 strip，从如下源码片段可看到其主要逻辑为：
1. 调 `SymbolStripExecutableFinder.stripToolExecutableFile` 获取 ndk 中的 strip 工具路径
2. 如果没有找到工具，则直接拷贝 so 到目标位置并返回
3. 调用这个工具对 so 进行 strip 并输出到目标位置
````kotlin
private class StripDebugSymbolsRunnable @Inject constructor(val params: Params): Runnable {

    override fun run() {
        // ...
        val exe =
            params.stripToolFinder.stripToolExecutableFile(params.input, params.abi) {
                UnstrippedLibs.add(params.input.name)
                logger.verbose("$it Packaging it as is.")
                return@stripToolExecutableFile null
            }

        if (exe == null || params.justCopyInput) {
            // ...
            FileUtils.copyFile(params.input, params.output)
            return
        }

        val builder = ProcessInfoBuilder()
        builder.setExecutable(exe)
        // ...
        val result =
            params.processExecutor.execute(
                builder.createProcess(), LoggedProcessOutputHandler(logger)
            )
        // ...
    }
    // ...
}
````

因此，so 没被 strip 的原因应该是没找到 ndk 中的 strip 工具。进一步分析源码可知 `SymbolStripExecutableFinder` 通过 `NdkHandler` 提供的 ndk 信息找 strip 工具路径，而 `NdkHandler` 通过 `NdkLocator.findNdkPathImpl` 这个顶层函数找 ndk 路径，所以 so 能否被 strip 最终取决于能否找到 ndk 路径。查找 ndk 主要逻辑如下：
````kotlin
const val ANDROID_GRADLE_PLUGIN_FIXED_DEFAULT_NDK_VERSION = "21.1.6352462"

private fun findNdkPathImpl(
    userSettings: NdkLocatorKey,
    getNdkSourceProperties: (File) -> SdkSourceProperties?,
    sdkHandler: SdkHandler?
): NdkLocatorRecord? {
    with(userSettings) {
        // ...
        val revisionFromNdkVersion =
            parseRevision(getNdkVersionOrDefault(ndkVersionFromDsl)) ?: return null
        
        // If android.ndkPath value is present then use it.
        if (!ndkPathFromDsl.isNullOrBlank()) {
            // ...
        }

        // If ndk.dir value is present then use it.
        if (!ndkDirProperty.isNullOrBlank()) {
            // ...
        }
        // ...
        if (sdkFolder != null) {
            // If a folder exists under $SDK/ndk/$ndkVersion then use it.
            val versionedNdkPath = File(File(sdkFolder, FD_NDK_SIDE_BY_SIDE), "$revisionFromNdkVersion")
            val sideBySideRevision = getNdkFolderRevision(versionedNdkPath)
            if (sideBySideRevision != null) {
                return NdkLocatorRecord(versionedNdkPath, sideBySideRevision)
            }

            // If $SDK/ndk-bundle exists and matches the requested version then use it.
            val ndkBundlePath = File(sdkFolder, FD_NDK)
            val bundleRevision = getNdkFolderRevision(ndkBundlePath)
            if (bundleRevision != null && bundleRevision == revisionFromNdkVersion) {
                return NdkLocatorRecord(ndkBundlePath, bundleRevision)
            }
        }
        // ...
    }
}

private fun getNdkVersionOrDefault(ndkVersionFromDsl : String?) =
    if (ndkVersionFromDsl.isNullOrBlank()) {
        // ...
        ANDROID_GRADLE_PLUGIN_FIXED_DEFAULT_NDK_VERSION
    } else {
        ndkVersionFromDsl
    }
````

上面源码片段对应的主要查找流程如下图所示：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10155827125/cdc0/b9e1/5bcb/6fcd66f4dad22b9f3c047ca1bccfb028.png)

根据上述 ndk 查找逻辑，可以知道 so 没被 strip 的根本原因是我们没有在 `build.gradle` 中配置 `android.ndkPath` 和 `android.ndkVersion`，在打包机上打包时也不存在 `local.properties` 文件，也就不存在 `ndk.dir` 属性，打包机上安装的 ndk 版本也不是 AGP 指定的默认版本 `21.1.6352462`，导致找不到 ndk 路径。

虽然找到了原因，但还是有个疑问：为什么升级之前能正常 strip？为了寻找答案，再来看看 AGP 3.5 查找 ndk 的方式，其主要逻辑如下：
````kotlin
private fun findNdkPathImpl(
    ndkDirProperty: String?,
    androidNdkHomeEnvironmentVariable: String?,
    sdkFolder: File?,
    ndkVersionFromDsl: String?,
    getNdkVersionedFolderNames: (File) -> List<String>,
    getNdkSourceProperties: (File) -> SdkSourceProperties?
): File? {
    // ...
    val foundLocations = mutableListOf<Location>()
    if (ndkDirProperty != null) {
        foundLocations += Location(NDK_DIR_LOCATION, File(ndkDirProperty))
    }
    if (androidNdkHomeEnvironmentVariable != null) {
        foundLocations += Location(
            ANDROID_NDK_HOME_LOCATION,
            File(androidNdkHomeEnvironmentVariable)
        )
    }
    if (sdkFolder != null) {
        foundLocations += Location(NDK_BUNDLE_FOLDER_LOCATION, File(sdkFolder, FD_NDK))
    }
    // ...
    if (sdkFolder != null) {
        val versionRoot = File(sdkFolder, FD_NDK_SIDE_BY_SIDE)
        foundLocations += getNdkVersionedFolderNames(versionRoot)
            .map { version ->
                Location(
                    NDK_VERSIONED_FOLDER_LOCATION,
                    File(versionRoot, version)
                )
            }
    }
    // ...
    val versionedLocations = foundLocations
        .mapNotNull { location ->
            // ...
        }
        .sortedWith(compareBy({ -it.first.type.ordinal }, { it.second.revision }))
        .asReversed()
    // ...
    val highest = versionedLocations.firstOrNull()

    if (highest == null) {
        // ...
        return null
    }
    // ...
    if (ndkVersionFromDslRevision != null) {
        // If the user specified ndk.dir then it must be used. It must also match the version
        // supplied in build.gradle.
        if (ndkDirProperty != null) {
            val ndkDirLocation = versionedLocations.find { (location, _) ->
                location.type == NDK_DIR_LOCATION
            }
            if (ndkDirLocation == null) {
                // ...
            } else {
                val (location, version) = ndkDirLocation
                // ...
                return location.ndkRoot
            }
        }

        // If not ndk.dir then take the version that matches the requested NDK version
        val matchingLocations = versionedLocations
            .filter { (_, sourceProperties) ->
                isAcceptableNdkVersion(sourceProperties.revision, ndkVersionFromDslRevision)
            }
            .toList()
        
        if (matchingLocations.isEmpty()) {
            // ...
            return highest.first.ndkRoot
        }
        // ...
        val foundNdkRoot = matchingLocations.first().first.ndkRoot
        // ...
        return foundNdkRoot
    } else {
        // If the user specified ndk.dir then it must be used.
        if (ndkDirProperty != null) {
            val ndkDirLocation =
                versionedLocations.find { (location, _) ->
                    location.type == NDK_DIR_LOCATION
                }
            // ...
            val (location, version) = ndkDirLocation
            // ...
            return location.ndkRoot
        }
        // ...
        return highest.first.ndkRoot
    }
}
````

对应的大致流程如下图所示：

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/10155528344/65e2/c8ad/e9b8/8ec0d854f3f032974380767444d8a8bb.png)

可以看到在 AGP 3.5 中，如果没有配置 ndk 路径和版本，会取 ndk 目录中的最高版本，只要 ndk 目录中存在一个版本就能找到，所以升级前没问题。AGP 3.6 和 4.0 的查找逻辑跟 AGP 3.5 类似，只不过增加了在 `android.ndkVersion` 未配置时取 AGP 内置的默认版本逻辑，AGP 3.6 的默认版本为 `20.0.5594570`，AGP 4.0 的默认版本为 `21.0.6113669`。

通过上面的分析找到问题原因后，解决方式就呼之欲出了，为具备更广泛的适应性，可采用配置 `android.ndkVersion` 将 ndk 版本设置为跟打包机一致的方式来解决问题。

## 小结
本文介绍了 AGP 升级（3.5 到 4.1）过程，对所遇问题提供了原因分析和解决方式。虽然本次升级的初衷不是优化构建，但升级后，我们的构建速度提升了约 36%，包大小减少了约 5M。希望本文能够帮助需要升级的读者顺利完成升级，享受到官方对构建工具持续优化的成果。

至此，本次 AGP 升级之旅已到终点，而我们的开发之旅还将继续。

## 参考资料
* [Android Gradle 插件版本说明](https://developer.android.com/studio/releases/gradle-plugin)
* [Configuration on demand](https://docs.gradle.org/current/userguide/multi_project_configuration_and_execution.html#sec:configuration_on_demand)
* AGP 源码

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
