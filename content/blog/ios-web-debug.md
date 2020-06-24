---
title: 构建基于 iOS 模拟器的前端调试方案
date: "2020-06-24T01:50:19.002Z"
description: "本文将为大家介绍自动化控制 iOS 模拟器的原理，为开发基于 iOS 模拟器的前端调试方案提供帮助。"
---


![封面](https://p1.music.126.net/nupFrnwakHB27HcxWNEzLw==/109951165083764525.jpg)

> 作者：[imyzf](https://github.com/imyzf)

我们在开发 iOS App 内的前端页面时，有一个很大的痛点，页面无法使用 Safari Inspector 等工具调试。遇到了问题，我们只能想办法加 vConsole，或者注入 Weinre，或者盲改，实在不行就找客户端同学手动打包调试，总之排查问题的路途非常艰难。

在参考了 RN 和 Weex 等跨平台框架的开发工具后，我们发现使用模拟器调试是解决该问题的很好方法，我们将前端页面放到模拟器的 App 中运行，苹果就不会对其有限制，允许我们使用 Safari Inspector 调试了。

Safari Inspector 是和 Chrome Devtools 类似的调试工具，由 Safari 浏览器自带，支持以下功能：

![Safari Inspector 功能](https://p1.music.126.net/-03dEVrHXccS8Us1cbXD7w==/109951164988993048.png)

* 检查页面元素
* 查看网络请求
* 断点调试
* 存储管理（Local Storage，Cookies 等）
* ……

这些功能是 vConsole、Weinre 等工具无法比拟的，可以帮助我们快速定位问题。

基于这些原理，我们内部已经开发了一款工具，部分功能视频可以[点此预览](https://vodkgeyttp9c.vod.126.net/vodkgeyttp8/AFgSHXIV_2983686258_uhd.mp4?ts=1903399290&rid=7859AE92117216E8AD0E345795682128&rl=0&rs=STctySRAVdxsmldSQEmhbQBvLiuIOGGp&sign=a4d1c895b6f1d2b7c495f6ba5c9147a1&coverId=MnUYjQmLilWmfGfNgUN1WQ==/109951164945188805&infoId=198001)。但由于该工具和内部业务耦合较深，目前暂无开源计划。

## 前提条件

介绍这套方案之前，我们需要了解一下方案的前提条件：

* 装有 macOS 和 Xcode 的电脑：由于苹果的限制，模拟器和 Xcode 只能在 macOS 上运行。Xcode 直接在 App Store 中安装即可，十分简单，无需其他操作。
* 为模拟器构建的 App 包：由于模拟器是基于 x86 架构的，需要客户端开发同学提供为模拟器构建的包，和在手机上安装的包会有所不同。
* 支持 URL Scheme 唤起的 App：承载前端页面的 App 必须支持用协议唤起并打开页面，才能用工具实现自动化，否则只能在 App 内手动点击相关链路打开页面。


## 总体流程

![整体流程图](https://p1.music.126.net/x0TZaP60albCfucfnzut7g==/109951164974167797.png)

我们的模拟器调试方案整体流程如上图所示：

1. 获取设备列表，提供给用户选择
2. 检查模拟器状态，如果没有启动，就启动该模拟器
3. 检查是否安装对应的 App，如果没有安装，就下载安装包进行安装
4. 启动 App，并打开需要调试的页面
5. 根据页面类型，使用对应的工具进行调试（例如 Safari Inspector）

## 核心工具

我们在实现本方案时，主要基于以下工具：

* [xcrun](https://www.manpagez.com/man/1/xcrun/)：Xcode 提供了一个命令行工具`xcrun`对开发相关的功能进行控制，是一系列工具的集合。
* [simctl](https://medium.com/xcblog/simctl-control-ios-simulators-from-command-line-78b9006a20dc)：`xcrun`提供了一个子命令`simctl`用于控制模拟器，提供了模拟器的启动、关闭、安装应用、打开 URL 等功能。可以通过直接运行`xcrun simctl`查看帮助文档。
* [node-simctl](https://www.npmjs.com/package/node-simctl)：由 Appium 提供的`simctl` 工具的 JS 封装。由于前端的方案一般都是基于 node.js 开发的，所以可以使用  node-simctl 包更方便地控制模拟器。不过由于`node-simctl`只提供了部分功能的封装，我们依然需要手动调用`xcrun`命令来实现更多功能。

## 模拟器控制

在本方案中，最重要的部分就是对模拟器的控制。

### 前期准备

用户通过 App Store 安装完 Xcode 后，第一次运行需要同意苹果的许可协议，然后自动安装一些组件，之后才可以正常使用。为了提高易用性，我们希望自动处理这个过程，而不是告诉用户，安装 Xcode 后要采取一些操作。

首先我们可以尝试运行一次 `xcrun simctl`命令，如果用户第一次运行，错误信息中会提醒用户手动运行`xcodebuild -license`接受许可，所以我们可以在错误信息中搜索`xcodebuild -license`字符串，如果有找到，就自动动运行`xcodebuild -license accept`命令，帮助用户自动接受许可。这里要注意的是，运行该命令需要 root 权限，可以使用`sudo-prompt`等包提权运行命令。

![第一次运行](https://p1.music.126.net/45pMw5AOhypSHcAQXDZQ9w==/109951164945192462.png)

### 获取设备列表

我们可以直接使用 node-simctl 的`getDevices()`函数获取本地安装的所有设备列表，比调用命令行更方便，可以直接获取到一个对象，不需要自己解析，对象部分结构如下：

```javascript
{
    '13.4': [
        {
            sdk: '13.4',
            dataPath: '/Users/xx/Library/Developer/CoreSimulator/Devices/xxx/data',
            logPath: '/Users/xx/Library/Logs/xxx',
            udid: 'C1AA9736-XXX-YYY-ZZZ-2A4A674B6B21',
            isAvailable: true,
            deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-11-Pro-Max',
            state: 'Shutdown',
            name: 'iPhone 11 Pro Max',
            platform: 'iOS'
        }
    ]
]
```

这里不仅包含了 iPhone，还有 Apple Watch 和 Apple TV 等设备，我们可以遍历返回结果，通过`name`字段进行过滤，因为一般我们只需要在 iPhone 中进行调试。

### 启动设备

首先我们要判断设备是否已经启动，我们可以通过 `xcrun simctl bootstatus ${deviceId}`命令获取设备状态（这里的 deviceId 即上面获取设备列表得到的`udid`），但是如果设备没有启动，这个命令会一直等待，不会退出，所以我们可以通过这个特征，基于命令是否超时（例如 1000ms 未返回结果）来判断设备是否启动。

接下来，就可以直接用`xcrun instruments -w ${deviceId}`命令，启动对应的设备了。


代码示例：

```javascript
let status = '';
try {
    status = execSync(
        `xcrun simctl bootstatus ${deviceId}`,
        { timeout: 1000 }
    );
} catch (error) {
    // 如果模拟器未启动，会一直等待，然后超时 kill，抛出一个 ETIMEDOUT 异常
    if (error.code !== 'ETIMEDOUT') {
        throw error
    }
}
// 检查是否启动
if (status.indexOf('Device already booted') < 0) {
    console.log('正在启动模拟器……')
    execSync(`xcrun instruments -w ${deviceId}`)
}
```

### 安装 App

模拟器的安装包是一个以`.app`为结尾命名的文件夹，和 macOS 应用类似，而不是 iPhone 真机上安装使用的`.ipa`包。所以安装包需要先用`zip`等工具进行打包上传到服务器，安装前下载到本地解压，使用 node-simctl 的`installApp()`方法进行安装。

### App 检查和启动

对于用户是否安装了 App，其实是在通过分析唤起 App 的错误信息来判断的。如果 App 未安装，会在唤起的时候会报错，错误信息中包含了`domain=NSOSStatusErrorDomain`字符串，表示 App 没有安装，这个时候我们去调用上面的安装流程即可。

![NSOSStatusErrorDomain](https://p1.music.126.net/eVTcw7IOZ21fILmRhKVHwQ==/109951164945213535.png)

整个流程中最重要的一步是如何将我们的页面在 App 中打开，实际上很简单，只需要 App 本身支持类似 `cloudmusic://open?url=xxx`这样的 URL Scheme 即可。我们通过 node-simctl 的`openUrl()`方法直接调用 scheme，模拟器便会帮我们启动关联的 App，然后需要 App 根据接收到的 Scheme 参数，帮我们打开需要调试的页面。


代码示例：

```javascript
try {
    await simctl.openUrl(deviceId, url)
} catch (error) {
    // 没有安装 App，打开协议会报 NSOSStatusErrorDomain
    if (error.message.indexOf('domain=NSOSStatusErrorDomain') >= 0) {
        await simctl.installApp(deviceId, appPath)
        await simctl.openUrl(deviceId, url)
    } else {
        throw error
    }
}
```

### 启动调试器

在模拟器中打开调试页面以后，对于 RN 页面，我们可以用 React Native Debugger 等工具调试。对于 H5 页面，我们可以从 Safari 菜单中打开 Inspector调试（如果没有“开发”菜单，请在 Safari 偏好设置 - 高级 - 选中`在菜单栏中线显示“开发”菜单`）。

![Safari 开发菜单](https://p1.music.126.net/6w3fN5d0LuE-C3wB4mnYIA==/109951165081824820.png)

当然这一步也可以实现自动化，需要借助 Apple Script 搜索 Safari 菜单中的关键字并模拟点击，有点复杂，并且随着系统升级可能会失效，可以参考[网上的一些讨论](https://stackoverflow.com/questions/14669542/automatically-open-the-safari-debugger-when-the-iphone-simulator-is-launched)。

## 方案扩展

至此，我们已经了解了如何控制模拟器，实现最基本的功能，但是我们还可以对方案进行扩展实现，提高易用性。

### 接入 CI 服务

客户端会定期发布新版本，加入新的功能，所以我们也需要保持调试用的包为较新版本。一般客户端团队都会搭建自己的 CI 服务（例如 Jenkins）进行打包，所以我们可以进行接入，自动下载和安装最新的包。甚至我们可以拉取 CI 服务器上的包列表，实现安装历史版本，回归调试一些功能。

需要注意的是，客户端团队一般只针对 ARM 架构打包，所以需要在 CI 上新增 x86 构建目标，构建产物才能成功在模拟器上运行。

### 多 App 支持

随着公司业务范围的拓展，我们可能需要在多个 App 内调试页面，通过指定以下两点，可以实现多 App 的适配：

1. URL Scheme：通过指定不同的 Scheme，可以在不同的 App 中打开页面
2. Bundle ID：类似`com.netease.cloudmusic`这样的字符串，是 App 的唯一标识，可以通过这个 ID 来进行 App 的启动、终止、卸载等操作

## 总结

到此为止，我们介绍了构建一套基于 iOS 模拟器的前端调试方案的基本原理，基于以上内容，我们可以结合 commander 和 inquirer 开发出一套 CLI 工具，也可以结合 Electron 开发一套 GUI 工具，为开发提效。如果你有更多的想法或者相关经验，也欢迎在评论区与我们交流~


> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
