---
title: 结构化文本处理利器 unified 生态介绍
date: 2022-01-24T02:37:46.404Z
description: 本文将对 unified 的相关插件生态、工作原理作介绍，并对一些使用例子作解析，帮助读者了解 unified 体系的能力、原理和用途。
---

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/12249606658/e8e5/d6d5/b526/126ccf59d7dc4636ef817760dcafd364.png)

> 作者：[imyzf](https://github.com/imyzf)

## 概述

> Content as structured data. <br>
> —— unified 官网题词

unified 是一套文本处理相关的生态体系，结合其生态上的相关插件，能够处理 Markdown、HTML、自然语言等。而 unified 库本身又作为一个统一的执行接口，担任执行器的角色，调用其生态上相关的插件完成处理任务。

从 [unified 官网](https://unifiedjs.com) 上可以看到，目前 unified 的使用非常广泛，包括 Prettier、Node.js 官网、Gatsby 都运用了 unified 的能力完成了一些功能。

![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12203967253/cff4/abc4/3e6b/09023197df73332d8a4c7247fea08ae0.png)

图：unified 官网的使用举例

常见的使用场景包括：

* 基于 Markdown 生成 HTML 页面和站点
* Markdown/HTML 内容加工处理
* Markdown 语法检查、格式化
* 作为底层库，封装特定场景的工具

鉴于目前国内对 unified 体系的介绍文章非常少，本文将对 unified 的相关插件生态、工作原理作介绍，并对一些使用例子作解析，帮助读者了解 unified 体系的能力、原理和用途。

## 插件生态

![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12203966847/06a2/5cd4/c849/f85f6a8fa49b1d9b46d4f0d8d5db3437.png)

图：unified 生态相关插件

### remark

[remark](https://github.com/remarkjs/remark) 是 Markdown 相关的插件集合，提供了 Markdown 的解析、修改、转换为 HTML 等能力。

目前提供的一些常用插件：

* [remark-parse](https://www.npmjs.com/package/remark-parse): 提供解析 Markdown 的能力
* [remark-gfm](https://github.com/remarkjs/remark-gfm): 提供 GFM (GitHub flavored markdown) 支持
* [remark-lint](https://github.com/remarkjs/remark-lint): 提供 Markdown 的代码检查能力
* [remark-toc](https://github.com/remarkjs/remark-toc): 提供 Markdown 文档目录生成功能
* [remark-html](https://github.com/remarkjs/remark-html) 提供将 Markdown 编译为 HTML 的能力

完整的插件列表可以参考[此处](https://github.com/remarkjs/remark/blob/main/doc/plugins.md#list-of-plugins)，大约有 150 多个插件可供选择。

我们可以在项目中使用这种便捷的方式调用 remark：

```js
remark() // 一键初始化 Markdown 解析器
  .processSync('# Hello, world!') // 同步处理文本
```

等价于如下方式：

```js
unified() // 使用 unified 统一的接口
  .use(remarkParse)  // 使用 Markdown 解析器插件
  .use(remarkStringify) // 使用 Markdown 文本序列化插件
  .processSync('# Hello, world!')
```

![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12203965902/bf03/af16/c204/a00247f66bec98789fda351843dcce8e.png)

图：remark 使用和转换示例

另外需要注意的是，GitHub 上目前有一个同名项目 [gnab/remark](https://github.com/remarkjs/remark)，其官网为 [remarkjs.com](https://remarkjs.com/)，虽然也是与 Markdown 相关的工具，但其与 unified 生态下的 remark 没有任何关系，本文提到的 remark 的官网为 [remark.js.org](https://remark.js.org/)，通过搜索引擎搜索相关资料时需要避免混淆。

### rehype

与 remark 类似，[rehype](https://github.com/rehypejs/rehype) 是 HTML 相关的插件集合，提供了 HTML 的格式化、压缩、文档生成等能力。

相比之下，rehype 的插件相对较少，只有 40 多个，详细的插件列表可以参考[插件列表文档](https://github.com/rehypejs/rehype/blob/main/doc/plugins.md)

同时，我们也可以使用[rehype-remark](https://www.npmjs.com/package/rehype-remark)和[remark-rehype](https://www.npmjs.com/package/remark-rehype)，实现两种语言的插件体系之间的互相转换。例如下面的例子，可以实现将 stdin 输入的 HTML 内容转换为 Markdown：

```js
import { unified } from 'unified'
import { stream } from 'unified-stream'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'

const processor = unified()
  .use(rehypeParse)     // 解析 HTML
  .use(rehypeRemark)    // 转换到 remark 体系
  .use(remarkStringify) // 将语法树转换为 Markdown 字符串

process.stdin.pipe(stream(processor)).pipe(process.stdout)
```


### 其他

[retext](https://github.com/retextjs/retext) 和 [redot](https://github.com/redotjs/redot) 是两个比较小众的体系，使用量较少，开发也不如前述两个体系活跃，其用途如下：

* retext: 提供自然语言的处理能力，包括拼写检查、错误修正、可读性检查等
* redot: 提供 graphviz 的解析能力

另外在 Markdown 领域，有两个命名非 `re` 开头的体系，[mdx](https://github.com/mdx-js/mdx) 和 [micromark](https://github.com/micromark/micromark)，分别对应特定的 Markdown 使用场景：

* mdx: 提供在 Markdown 文档中编写 JSX 的能力，实现在文档中引入各类组件，编写可交互的文档
* micromark: 一个极简的 Markdown 转换库，支持少量扩展插件，适合简单的 Markdown 转 HTML 场景，同时 remark 也复用了 micromark 的解析能力

具体的信息可以查看项目文档了解，这里不再赘述。

## 工作原理

unified 的核心机制是基于 AST（abstract syntax trees，抽象语法树），在执行插件时 AST 会被传递给插件，可以对其进行各种处理。同时，也可以基于 AST 进行各种语言的转换，例如将 Markdown 文档解析后，转换为 HTML 进行处理，之后再转回 Markdown。

![](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12486937793/6339/ae27/ba60/6695fadf676bf7bc8bcfa3069686961c.png)

图：unified 工作流程

例如我们可以在插件中遍历 AST，将所有 `heading` 节点打印出来：

```js
module.exports = () => tree => {
  visit(tree, 'heading', node => {
    console.log(node)
  })
}
```

上面例子中的 `visit` 方法来自 unist-util-visit 工具，提供了遍历节点的功能。unified 使用了一种称为 unist 或者 UST 的 AST 标准，使得相同的工具能够在不同的语言上使用。例如针对 Markdown 和 HTML 语言的 AST，由于他们基于相同的标准，我们可以使用同样的 `visit` API 实现同样的功能：

```js
visit(markdownAST, 'images', transformImages)
visit(htmlAST, 'img', transformImgs)
```

## 场景举例

接下来将列举一些基于 unified 生态的使用场景，帮助大家进一步了解其用途。

### Node.js 官网

Node.js 官网主要在语法检查、文档构建两个方面使用了 unified：

* 使用 remark-cli 检查 Markdown 文档，参考其 [package.json](https://github.com/nodejs/nodejs.org/blob/main/package.json#L18) 中的脚本配置
* 使用 unified 进行文档构建，参考 [generate.mjs](https://github.com/nodejs/node/blob/master/tools/doc/generate.mjs) 中的代码

### dumi

[dumi](https://d.umijs.org/zh-CN) 是一款为组件开发场景定制的文档工具，其核心功能就是将 Markdown 文档转换为 HTML 页面。查看其源码，我们会发现其使用了 unified 作为转换器，在 [remark/index.ts](https://github.com/umijs/dumi/blob/master/packages/preset-dumi/src/transformer/remark/index.ts) 中引入了 unified，并调用了一些列自定义的或者社区提供的插件进行处理。

由于使用了非常多的自定义插件，dumi 源码可以作为极佳的 unified 插件开发参考例子。例如参考 [link.ts](https://github.com/umijs/dumi/blob/master/packages/preset-dumi/src/transformer/remark/link.ts)，可以了解如何将 Markdown 中的外部链接，通过修改 AST，在生成的页面中增加一个链接小图标，提示用户这是一个指向外部站点的链接。

文档源码：

```markdown
[云音乐官网](https://music.163.com/)
```

转换为：

```html
<a target="_blank" rel="noopener noreferrer" href="https://music.163.com/">
  云音乐官网
  <svg class="__dumi-default-external-link-icon">……</svg>
</a>
```

### react-markdown

[react-markdown](https://github.com/remarkjs/react-markdown) 作为 remark 体系的一部分，是基于 unified 生态的上层封装，提供了一个能够渲染 Markdown 的 React 组件。在 React 框架中，比起直接使用 remark 将 Markdown 转换为 HTML 再使用 `dangerouslySetInnerHTML` 渲染，使用 react-markdown 更加安全可靠，使用方式也更加简单便捷。

![](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/12486746944/8939/d40a/1d71/8ce67df7efef7788d7d27077af47053e.png)

图：react-markdown 工作原理

上图展示了 react-markdown 的工作原理，流程如下：

1. 通过 remark 将 Markdown 转换为对应的 AST —— mdast
2. 使用 remark 插件对 mdast 进行处理
3. 通过 remark-rehype 将 mdast 转换为 HTML 的 AST —— hast
4. 使用 rehype 插件对 hast 进行处理
5. 使用 React 组件渲染 hast 为 React 元素

以上整个流程其实是 Markdown 渲染为 HTML 的通用处理流程 ，我们在实现类似的库时，也可以作为参考。

## 关于作者

目前 unified 生态总共有 333 个开源项目（截至 2022.01.05），其核心开发者为 Titus Wormer。从 Wormer 的[个人网站](https://wooorm.com/)可以了解到，他来自荷兰，毕业于阿姆斯特丹应用科学大学，并且曾经担任过该大学的讲师。作为一名全职开源贡献者，总共维护了 535 多个项目，其中有 50% 的时间精力投入到 unified 项目上。能够凭一己之力，对开源社区作出如此大的贡献，非常值得敬佩。关于他是如何管理 unified 组织的，可以参考 [unified collective](https://github.com/unifiedjs/collective) 文档作进一步了解。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
