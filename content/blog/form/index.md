---
title: 面向复杂场景的表单解决方案
date: 2020-08-20T01:23:21.851Z
description: 表单涉及到联动、校验、布局等复杂场景，经常是开发者的需要耗费精力去解决的点，虽然传统的开发表单的方式已经足够的灵活但是依然有提效的空间，所以针对复杂的表单开发场景我们总结了一套表单开发方案
---

![](https://p1.music.126.net/SU4ohKoFNTnO9UhUiZkFmg==/109951165097827439.jpg)

> 图片来源：https://unsplash.com/

> 本文作者：董健华

## 1. 背景

云音乐 B 端业务场景非常多，B 端业务相对于 C 端业务产品生命周期更长而且更注重场景的的梳理。很多时候开发 B 端业务都是拷贝之前的代码，这样增加了很多重复而且枯燥的工作量。

中后台系统其实可以拆分成几个比较通用的场景：表单、表格、图表，其中表单涉及到联动、校验、布局等复杂场景，经常是开发者的需要耗费精力去解决的点。

对比传统的 [Ant Design](https://ant.design/) 表单开发开发方式，我们认为有以下问题：

1. 首先代码无法被序列化，而且对于一些非前端的开发者更习惯用 `JSON` 方式描述表单，因为足够简单
2. 表单的校验并没有和校验状态做结合
3. `onChange` 实现的联动方式在复杂的联动情况下代码会变得难以维护，容易产生很多链表式的逻辑
4. 表单有许多互斥的状态可以整理，而且我们也希望用户可以很轻易的在这些状态间进行切换
5. 对于一些比较常用而且通用的场景，例如：表单列表，也可以抽离出一套可行的方案

所以虽然传统的表单开发方式已经足够的灵活，但是我也依然认为表单还有优化的空间，在灵活与效率上做了些权衡。

外界也有比较成熟的表单解决方案，例如： [Formliy](https://formilyjs.org/) 、 [FormRender](https://alibaba.github.io/form-render) 。虽然解决了上面某几个点的问题，但是依然不够全面，我们需要有自己 `style` 的方案。

所以为了提高中后台开发效率，让前端能够把时间投入到更有意义的事情里，我们总结了一套面向复杂场景的表单解决方案。

## 2. 技术方案

在技术方案上至关重要的一环就是Schema设计，框架架构等工作都是围绕这一环去实现的，所以我会沿袭这个思路给大家做介绍。

### 2.1 Schema设计

表单方案基于 `Ant Design` 开发，通过 `JSON` 方式配置 Schema，但是并非是 `JSON Schema`，外界很多基于 `JSON Schema` 的配置方案，其实也有考虑过，不过 `JSON Schema` 写起来有点麻烦，所以对 `JSON Schema` 的转换只作为一项附加的能力。

案例如下面代码所示，最简单的表单字段只要配置 `key`、`type` 和 `ui.label` 就可以了：

```javascript
const schema = [
    {
        "key": "name",
        "type": "Input",
        "ui": {
            "label": "姓名"
        }
    },
    {
        "key": "age",
        "type": "InputNumber",
        "ui": {
            "label": "年龄"
        },
        "props": {
            "placeholder": "请输入年龄"
        }
    },
    {
        "key": "gender",
        "type": "Radio",
        "value": "male",
        "ui": {
            "label": "性别"    
        },
        "options": [
            {
                "name": "男",
                "value": "male"
            },
            {
                "name": "女",
                "value": "female"
            }
        ]
    }
];

export default function () {
    const formRef = useRef(null);

    const onSubmit = () => {
        formRef.current.submit().then((data: any) => {
            console.log(data);
        });
    };

    const onReset = () => {
        formRef.current.reset();
    };

    return (
        <>
            <XForm
                ref={formRef}
                schema={schema}
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 12 }}
            />
            <div>
                <Button type="primary" onClick={onSubmit}>提交</Button>
                <Button onClick={onReset}>重置</Button>
            </div>
        </>
    );
}
```

因为方案是基于 `Ant Design` 的 `Form` 组件设计的，所以为了保留 `Ant Design` 的一些特性，设计了 `ui` 和 `props` 两个字段分别对应 `Form.Item` 的 `props` 和组件的 `props`。即使后续 `Ant Design` 表单增加了某些功能或者特性，这套表单方案也能做到无缝支持。

#### 2.1.1 校验方式

既然表单是基于 `Ant Design` 实现的，那么校验也沿用了它的校验类库 [async-validator](https://github.com/yiminghe/async-validator)，这个类库已经比较成熟而且强大，能够校验 `Array` 和 `Object` 等深层级的数据类型，满足复杂校验的需求，所以我们直接在这个库的基础上做调整。

通过 `rules` 字段进行配置，除了 `async-validator` 本来就就有的特性外，还额外增加了 `status`（校验状态）和 `trigger`（触发条件）枚举如下：

+ status：校验状态
    + error（默认）：错误
    + warning：警告
+ trigger：触发条件
    + submit（默认）：提交时候触发
    + change：值变化时候触发判断
    + blur：失去焦点时候触发判断

基本使用方式如下：

```json
{
    "key": "name",
    "type": "Input",
    "ui": {
        "label": "姓名"
    },
    "rules": [
        {
            "required": true,
            "message": "姓名必填",
            "trigger": "blur",
            "status": "error"
        }
    ]
}
```

#### 2.1.2 联动方式

除了校验，联动也是比较常用的功能，传统的联动通过组件 `onChange` 方式实现，当联动逻辑比较复杂的时候，看代码就像搜索链表一样麻烦，所以这块设计了一种 `反向监听` 的方式，字段的所有变化都维护在字段配置本身，降低后期维护成本。

通过 `listeners` 字段进行配置，设计了 `watch`（监听）、 `condition`（条件）、`set`（设置）三个字段组合实现联动功能。

`watch` 记录需要监听的字段，当监听字段有任何变化的时候，会触发 `condition` 条件的判断，只有条件判断通过才会接着触发 `set` 设置。

```json
[
    {
        "key": "name",
        "type": "Input"
    },
    {
        "key": "gender",
        "type": "Radio",
        "value": "male",
        "options": [
            {
                "name": "男",
                "value": "male"
            },
            {
                "name": "女",
                "value": "female"
            }
        ],
        "listeners": [
            {
                "watch": [ "name" ],
                "condition": "name.value === 'Marry'",
                "set": {
                    "value": "female"
                }
            }
        ]
    }
]
```

上述例子当名字为 Marry 的时候，性别默认调整成女。

#### 2.1.3 表单状态

我们发现有些联动场景是为了对字段做隐藏和显示的操作，为了方便用户切换状态，将4种互斥表单状态整理成一个 `status` 字段：

+ status：状态
    + edit（默认）：编辑
    + disabled：禁用
    + preview：预览
    + hidden：隐藏

`preview` 状态并不是组件本身具有的，但是预览的需求蛮多的，于是我们做了拓展，为所有基本的表单组件预置了预览的状态。即使自定义组件也会默认展示字段值，如果需要自行处理的话也提供了方案。

使用方式如下：

```json
[
    {
        "key": "edit",
        "type": "Input",
        "status": "edit",
        "value": "编辑",
        "ui": {
            "label": "编辑"
        }
    },
    {
        "key": "disabled",
        "type": "Input",
        "status": "disabled",
        "value": "禁用",
        "ui": {
            "label": "禁用"
        }
    },
    {
        "key": "preview",
        "type": "Input",
        "status": "preview",
        "value": "预览",
        "ui": {
            "label": "预览"
        }
    },
	{
		"key": "hidden",
        "type": "Input",
        "status": "hidden",
        "value": "隐藏",
        "ui": {
            "label": "隐藏"
        }
	}
]
```

效果图如下：

![](https://p1.music.126.net/T4vLxwj0af-Z8Bq-MSg0kg==/109951164808489561.png)

#### 2.1.4 Options设置

许多选择组件使用 `options` 字段设置选项，选项有时候通过异步接口获取。考虑到异步接口的情况，设计了 4 套方案 ：

1. `options` 为 `Array` 的情况

```json
{
    "key": "type",
    "type": "Select",
    "options": [
        {
            "name": "蔬菜",
            "value": "vegetables"
        },
        {
            "name": "水果",
            "value": "fruit"
        }
    ]
}
```

2. `options` 为 `string` 的情况，即接口链接

```json
{
    "key": "type",
    "type": "Select",
    "options": "//api.test.com/getList"
}
```

3. `options` 为 `object` 的情况，`action` 为接口链接，`nameProperty` 配置 `name` 字段，`valueProperty` 配置 `value` 字段，`path` 为获取选项路径，`watch` 配置监听字段

```json
{
    "key": "type",
    "type": "Select",
    "options": {
        "action": "//api.test.com/getList?name=${name.value}",
        "nameProperty": "label",
        "valueProperty": "value",
        "path": "data.list",
        "watch": [ "name" ]
    }
}
```

4. `action` 为 `function` 的情况

```javascript
{
    "key": "type",
    "type": "Select",
    "options": {
        "action": (field, form) => {
            return fetch('//api.test.com/getList')
                .then(res => res.json());
        },
        "watch": [ "name" ]
    }
}
```

#### 2.1.5 表单列表

表单列表是一种组合类型的表单，通常有 `Table` 和 `Card` 两种场景，具有增加和删除功能。

这种类型的表单值是以 `Array` 的形式返回的，所以设计了 `Array` 组件，根据 `props.type` 对 `Table` 和 `Card` 形态进行切换（貌似这种情况不多），`children` 配置子表单，使用方式如下：

```json
{
    "key": "array",
    "type": "Array",
    "ui": {
        "label": "表单列表"
    },
    "props": {
        "type": "Card"
    },
    "children": [
        {
            "key": "name",
            "type": "Input",
            "ui": {
                "label": "姓名"
            }
        },
        {
            "key": "age",
            "type": "InputNumber",
            "ui": {
                "label": "年龄"
            }
        },
        {
            "key": "gender",
            "type": "Radio",
            "ui": {
                "label": "性别"
            },
            "options": [
                {
                    "name": "男",
                    "value": "male"
                },
                {
                    "name": "女",
                    "value": "female"
                }
            ]
        }
    ]
}
```

效果图如下：

![](https://p1.music.126.net/TT4XdOVuq4-3oM0zNTChjQ==/109951164808500925.gif)

![](https://p1.music.126.net/124vG69upyx-HF72vWDwKA==/109951164808501026.gif)


### 2.2 框架架构

![](https://p1.music.126.net/kEPUU17UhVf-APwuo7JzZA==/109951165097997594.png)

围绕Schema设计思路，我们采用了基于分布式管理方案，将核心层和渲染层分离，字段信息维护在核心层，渲染层只负责渲染的工作，做到数据和界面代码的分离结构。

核心层与渲染层之间通过 `Sub/Pub` 方式进行通讯，渲染层通过监听核心层定义的一系列 `Event` 事件对界面作出调整。

这种数据状态的改变驱动界面的变化已经不是什么新鲜事了，在大多数框架中被广泛使用，其中优势有：

1. 方面各个字段之间数据与状态共享
2. 通过对事件的控制，能够合理的优化渲染次数，提高性能
3. 能够适配多框架的情况，只需复用一套核心层代码

核心层主要由 `Form`、`Field`、`ListenerManager`、`Validator`、`optionManager` 几部分组成如下图所示：

![](https://p1.music.126.net/3kqMDLuP3wMTtbQqZrfQ_Q==/109951165098735980.png)

其中 `Form` 是表单原型，下面承载了很多 `Field` 字段原型，由 `ListenerManager` 统一管理联动方面的功能，`Field` 下具有 `Validator` 和 `OptionManager` 分别管理校验和 `options` 选项功能

### 2.2.1 校验实现

主要还是通过 `async-validator` 类库实现，但是依然无法满足多校验状态和多触发条件的情况，所以在这个基础上做了些拓展，封装成一个 `Validator` 类。

`Validator` 只有一个 `Validator.validate` 方法，传递一个 `trigger` 参数，实例化 `Validator` 时候会去解析 `rules` 字段，根据 `trigger` 进行分类并创建对应的 `async-validator` 实例。

### 2.2.2 联动实现

`ListenerManager` 具有 `ListenerManager.add` 方法和 `ListenerManager.trigger` 方法，分别用于解析并添加 `listeners` 字段以及 `Field` 字段发生变化时触发联动效果。

具体流程是在初始化 `Field` 时，会将 `listeners` 字段通过 `listenerManager.add` 方法解析信息，根据 `watch` 中的 `key` 值进行分类并保存在其中，当 `Field` 信息发生变化的时候会通过 `ListenerManager.trigger` 触发联动，判断 `condition` 条件是否满足，如果满足即触发 `set` 内容。

### 2.2.3 表单列表实现

表单列表其实是由多个 `XForm` 实例构成，每一个自增项都是一个 `XForm` 实例，所以联动只能在同一行上进行，不能跨行联动。

当点击添加按钮的时候，会根据 `children` 提供的 `Schema` 模板创建一个 `XForm` 实例：

![](https://p1.music.126.net/rHBL8e3QqlBSYXHZkwiEPg==/109951165098838719.png)

### 2.2.4 布局实现

除了 `Ant Design` 的 Form 提供的三种布局方式（horizontal、vertical、inline），还需要提供一种更灵活的布局方式来满足更加复杂的情况。

布局真是一个很头疼的问题，特别是 `Schema` 在类似 `JSON` 的结构下实现复杂的布局很容易导致 `Schema` 嵌套层级深，这种是我们不愿意看到的。

最初方案是通过网格布局实现，通过设置 `Form` 的 `row.count` 或者 `col.count` 参数计算出网格的行数和列数再对字段进行分布，这种方式只适用于每行列数都一致的情况，但是这种方式难以满足每行列数不一致的情况：

![](https://p1.music.126.net/yiMCXwlaYectE7D1b31m4Q==/109951165095690437.png)

所以重新设计了一个 `ui.groupname` 的字段，同一个 `groupname` 的字段都会被一个 `div` 包裹住，并且 `div` 的 `className` 即 `groupname` ，用户要实现复杂的布局可以自己写样式去实现，这样的方案虽然简陋，但是实用。

## 3. 细节设计

### 3.1 忽略特定字段值

有些场景需要忽略 `status` 为 `hidden` 的字段的值，所以设计了一个 `ignoreValues` 字段，字段配置有下面几种情况：

+ hidden：忽略状态为 hidden 的情况
+ preview：忽略状态为 preview 的情况
+ disabled：忽略状态为 disabled 的情况
+ null：忽略值为 null 的情况
+ undefined：忽略值为 undefined 的情况
+ falseLike：忽略值 == false 的情况

通过配置 `ignoreValues` 字段，提交后返回的 `values` 就会忽略相应的字段：

```html
<XForm schema={schema} ignoreValues={['hidden', 'null']}/>
```

### 3.2 字段解构与重组

字段解构是指把一个字段的值拆成多个字段，字段重组是指把多个字段组合成一个字段，这块的具体功能还未实现，但是已经有了初步的想法。

字段解构例子如下，主要是通过 `key` 对字段进行拆分，最终返回 `values` 包含 `startTime` 和 `endTime` 两个字段：

```json
{
    "key": "[startTime, endTime]",
    "type": "RangePicker",
    "ui": {
        "label": "时间选择"
    }
}
```

发现许多场景需要由多个字段组合成一个字段，这种情况大多需要写自定义组件不然就是后期需要对数据进行处理，为了简化这一过程所以设计了字段重组的功能。通过 `Combine` 组件将多个字段重组成一个字段：

```json
{
    "key": "time",
    "type": "Combine",
    "ui": {
        "label": "时间选择"
    },
    "props": {
        "shape": "{startTime, endTime, type}"
    },
    "children": [
        {
            "key": "startTime",
            "type": "DatePicker"
        },
        {
            "key": "endTime",
            "type": "DatePicker"
        },
        {
            "key": "type",
            "type": "Select",
            "options": [
                {
                    "name": "发行时间",
                    "value": "publishTime"
                },
                {
                    "name": "上线时间",
                    "value": "onlineTime"
                }
            ]
        }
    ]
}
```

## 4. 结尾

完善表单这款产品的过程也是一个博采众长的过程，我们调研了业界竞品结合自身业务需求，开发出了这款产品。上面介绍了表单方案的思路和实现方式供大家参考，非常遗憾的是我们产品还未开源，相信会在合适的时候跟大家见面。

## 5. 相关资料

+ [Formily](http://formilyjs.org/)
+ [FormRender](https://alibaba.github.io/form-render/)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！



