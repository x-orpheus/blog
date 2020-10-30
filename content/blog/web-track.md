---
title: 前端组件化埋点的实践
date: 2020-10-30T03:02:38.035Z
description: 在流量红利逐渐消失的现在，数据的采集、分析和精细化的运营显得更加重要，所以埋点在互联网产品中是很常见的，它可以更好的辅助我们去迭代、完善产品功能。
---

![](https://p1.music.126.net/sdgWwquduqdO4nUMSm2f4Q==/109951165005471367.jpg)


> 本文作者 杨运心

> 头图来自[Carlos Muza](https://unsplash.com/@kmuza?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/)

## 1、前言
开始正文前先介绍一下相关概念，熟悉的读者可以略过。

**前端埋点**：一种收集产品数据的方式，它的目的是上报相关行为数据，相关人员以数据为依据来分析产品在用户端的使用情况，根据分析出来的结果辅助产品优化、迭代。

**BI**：商业智能，公司内部做数据分析相关的部门。

## 2、背景
> 在流量红利逐渐消失的现在，数据的采集、分析和精细化的运营显得更加重要，所以埋点在互联网产品中是很常见的，它可以更好的辅助我们去迭代、完善产品功能。

平时我们在完成基础的业务需求之后，还需要开发完成埋点需求。所以我们追求的是简单快捷的做好埋点工作，且不会占用我们太多的精力。但是现实却不那么美好，目前我们团队在前端埋点方面存在一些痛点：

- 在构造埋点字段的时候需要根据 BI 的规则，把若干个字段拼接成一个，这样费时费力还有错误的风险；
- 一些曝光场景下的点不好打比如：分页列表、虚拟列表；他们的的曝光埋点实现较为繁琐；
- 逻辑复用问题：特别是曝光相关的点需要在业务代码里面做额外的处理，所以逻辑复用很困难，对现有代码的侵入也很严重；

所以我们需要一种适合我们的埋点方案解决我们目前的问题，提升我们的开发效率，不再为埋点而困扰。

## 3、常见前端埋点方案
我们对目前市场上几种埋点方案进行了一些调研，常规有 3 种方案：

**手动代码埋点**：用户触发某个动作后手动上报数据
- 优点：是最准确的，可以满足很多定制化的需求。
- 缺点：埋点逻辑与业务代码耦合到一起，不利于代码维护和复用。

**可视化埋点**：通过可视化工具配置采集节点，指定自己想要监测的元素和属性。核心是查找 dom 然后绑定事件，业界比较有名的是 [Mixpanel](https://mixpanel.com/)
- 优点：可以做到按需配置，又不会像全埋点那样产生大量的无用数据。
- 缺点：比较难加载一些运行时参数；页面结构发生变化的时候，可能就需要进行部分重新配置。


**无埋点**：也叫“全埋点”，前端自动采集全部事件并上报埋点数据，在后端数据计算时过滤出有用数据
- 优点：收集用户的所有端上行为，很全面。
- 缺点：无效的数据很多、上报数据量大。


## 4、埋点方案

在调研完这些方案后，我认为上述方案并不完全适合我们，我们需要的方案是准确、快速埋点，同时把埋点的代码与业务逻辑解耦，并且我们的音街移动站可以相对平滑的迁移到我们新的埋点库上面来。结合我们目前的技术栈 React，以及现状和运营、产品侧的需求我们决定采用**声明式的组件化埋点 + 缓冲队列**方案，这里阐述一下我们的大致思路。


* 为了解决埋点代码与业务逻辑耦合的问题，我们认为可以在视图层处理，埋点可以归纳为两大类，点击与曝光埋点。我们可以抽象出两个组件分别处理这两种场景。

* 在一些场景下快速滑动、频繁点击会在短时间打出大量的点，造成频繁的接口调用，这在移动端是要避免的，针对这种场景我们引入了缓冲队列，产生的点位信息先进入队列，通过定时任务分批次上报数据，针对不同类型的点也可以应用不同的上报频率。

* 目前对于一些字段采用的是人工拼接，比如 BI 定义的 _mspm2 等相关通用字段，类似这种我们完全可以在库统一处理，既不容易出错，也方便后期拓展。

* 对于页面级曝光，我们可以在埋点库初始化后自动注册关于页面曝光的相关事件，不需要使用者关心。

* 以页面为维度管理埋点配置
  * 我们的站点是同构应用，跟我们的架构比较契合
  * 更加清晰，便于维护
  * 目前也是采用这种方案管理，迁移成本会更小



## 5、关键节点
 
### 5.1 流程梳理
这里存在一个问题，可能库还没初始化完毕，一些点已经产生了，比如曝光类的，如果这时候生成对应的点进入缓冲队列，就是属于无效的点因为没有加载到坑位信息、配置参数等，所以针对这种场景下产生的点位信息，我们新开一个队列存储，等到初始化完成再去处理;

流程图：

![avatar](https://p1.music.126.net/FRBRMaM9mHYqIE38WrHvwQ==/109951165005487881.png)


### 5.2 点击埋点

点击埋点我们开始的思考是提供一个组件，包裹需要进行点击埋点的 `dom` 元素，也有可能是`组件`，然后给子元素绑定点击事件，当用户触发事件时进行埋点相关处理。 

按照上述思路我们就必须绑定点击事件到 dom 上，但是我们又不想引入额外的 dom 元素，因为这会增加 dom 结构层级，给使用者带来麻烦，这样留给我们的操作空间就剩下 `props.children` ，所以我们去递归 `TrackerClick` 组件的 `children`，找到最外层的dom元素，同时要求 `TrackerClick` 下面必须有一个 `container` 元素，按照这个思路我们进行了处理。

```jsx
export default function TrackerClick({
    name,
    extra,
    immediate,
    children,
}) {
    handleClick = () => {
        // todo append queue
    };

    function AddClickEvent(ele) {
        return React.cloneElement(ele, {
            onClick: (e) => {
                const originClick = ele.props.onClick || noop;
                originClick.call(ele, e);
                handleClick();
            }
        });
    }

    function findHtmlElement(ele) {
        if (typeof ele.type === 'function') {
            if (ele.type.prototype instanceof React.Component) {
                ele = new ele.type(ele.props).render();
            } else {
                ele = ele.type(ele.props);
            }
        }
        if (typeof ele.type === 'string') {
            return AddClickEvent(ele);
        }
        return React.cloneElement(ele, {
            children: findHtmlElement(ele.props.children)
        });
    }
    
    return findHtmlElement(React.Children.only(children));
}


// case1
<TrackerClick name='namespace.click'>
    <button>点击</button>
</TrackerClick>

// case2
<TrackerClick name='namespace.click'>
    <CustomerComp>
        <button>点击</button>
    </CustomerComp>
</TrackerClick>
```

从使用上来说很简便，达到了我们的目的。但是经过我们的实践也发现了一些问题，比如使用者并不清楚里面的实现细节，有可能里面没有一个  `container` 包裹，也可能使用了 `React.Fragment` 造成一些不可预估的行为、同时也无形的增加了dom结构层级（虽然我们没有引入，但是我们在告诉用户，你最好有个 `container` ）。

我们又在反思这种方案的合理性，虽然使用上带来了便捷，但是带来了不确定性。经过讨论我们决定把绑定的工作交给组件使用者，我们只需要明确告诉他可以使用哪些方法，这是确定性的工作。使用方只需要把触发的回调绑定到对应的事件上即可。

改造后如下：

```jsx
<TrackerClick name='namespace.click'>
{
    ({ handleClick }) => <button onClick={handleClick}>点击坑位</button>
}
</TrackerClick>
```

### 5.3 曝光埋点

曝光对于我们来说一直是比较麻烦的，我们先来看看曝光埋点的一些要求：

* 元素出现在视窗内一定的比例才算一次合法的曝光
* 元素在视窗内停留的时长达到一定的标准才算曝光
* 统计元素曝光时长

站在前端的角度看实现这三点就比较复杂了，再加上一些分页、虚列表的场景就更加繁琐，带着这些问题调研了 [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver)。
>IntersectionObservers calculate how much of a target element overlaps (or "intersects with") the visible portion of a page, also known as the browser's "viewport"

>`IntersectionObservers`计算目标元素与页面可见部分的重叠程度（或 "相交"），也被称为浏览器的 "视口"。

![visiblitychange](https://p1.music.126.net/fJoWhGjXEYXK2tPHOkvUPg==/109951165005789725.png)


```js
const intersectionObserver = new IntersectionObserver(function(entries) {
  // If intersectionRatio is 0, the target is out of view
  // and we do not need to do anything.
  if (entries[0].intersectionRatio <= 0) return;

  console.log('Loaded new items');
}, {
    // 曝光阈值
    threshold: 0
});
// start observing
intersectionObserver.observe(document.querySelector('.scrollerFooter'));
```
上面是 MDN 的一个例子，所以我们是可以知道元素什么时候进入以及什么时候离开 viewport，间接的上面三点需求我们都可以实现。


经过调研，在能力方面可以满足我们的需求、兼容性方面有对应的[intersection-observer polyfill](https://www.npmjs.com/package/intersection-observer); 对于分页、虚列表，我们只需要关注我们需要观测的`列表item`，所以我们需要实现一个高性能的 `ReactObserver` 组件来提供 `intersection-observer` 的能力并对外提供相应的回调。如何实现一个高性能的Observer此处不做赘述。

下面是曝光组件绑定 dom 的两种方式
```jsx
// case1: 直接绑定dom
render() {
    return (
        <div styleName='tracker-exposure'>
            {
                arr.map((item, i) => (
                    <TrackerExposure
                        name='pagination.impress'
                        extra={{ modulePosition: i + 1 }}
                    >
                        {({ addRef }) => <div ref={addRef}>{i + 1}</div>}
                    </TrackerExposure>
                ))
            }
        </div>
    );
}


// case2: 自定义组件
const Test = React.forwardRef((props, ref) => (<div ref={ref} style={{
        width: '150px',
        height: '150px',
        border: '1px solid gray'
    }}>TEST</div>)
)

render() {
    return (<div styleName="tracker-exposure">
        {
            arr.map((item, i) => <TrackerExposure
                name="pagination.impress"
                extra={{ modulePosition: i + 1 }}>
                {
                    ({ addRef }) => <Test ref={addRef} />
                }
            </TrackerExposure>
            )
        }

    </div>)
}
```

使用上我们仅提供一个 addRef 用以获取 dom 执行监听工作，其他工作都交给库来处理，曝光变得如此简单。针对上述3点要求，我们提供配置如下：

- **threshold**： 曝光阈值，当 element 出现在视窗多少比例触发
- **viewingTime**：元素曝光时长，用来判断是否是一次时长合规的曝光
- **once**：是否重复打曝光埋点

### 5.4 运行时参数
一般固定的参数我们会放在config配置文件中管理，当然也有一些运行时的参数，比如 `userId，modulePosition` 等运行时字段，针对这种场景我们提供 `extra props` 通过组件的 `props` 传递，在组件内部拼装，使用时只需要传入对应业务字段即可。

### 5.5 appendQueue
一些场景下我们没法绑定事件到dom上，比如原生的元素：`audio、video`，以及封装层级很深的业务组件，类似这种只对外提供了回调，针对这种场景我们提供了 `appendQueue` 方法，把点加入到缓冲队列中。
```js
appendQueue({
    name: 'module.click',
    action: 'click',
    extra: {
        userId: 'xxx',
    }
})
```

### 5.6 定时任务
我们的设计是所有产生的点都会进入缓冲队列中，通过定时任务上报。目前策略是点击类上报频率 1000ms，曝光类 3000ms，当然这个间隔也不是凭空想象的，经过跟算法、BI 讨论商定出来的，兼顾了前端的需求与算法那边实时性的要求，目前这两个值也是支持配置的。

关于定时任务的时间间隔，我们取点击和曝光上报频率的最大公约数，以减少执行次数。

### 5.7 页面曝光
我们在初始化的时候会根据配置文件中约定的字段判断是否需要处理页面曝光；

页面曝光的关键是采集页面曝光的时机，浏览器的页面生命周期标准和规范才开始制定没多久，各个厂商支持的都不是很好，参考 Chrome 的页面生命周期中的 visibilitychange 事件作为采集页面曝光的时机。

![page life](https://p1.music.126.net/aqh41yijZVXLnazc0nHmbA==/109951164893411921.jpg)

**visiblitychange** 的浏览器兼容情况

![visiblitychange](https://p1.music.126.net/luZmKZajv1RLAyhEhIizxQ==/109951164893602993.png)

## 6、使用
```js
import Tracker, {
    TrackerExposure,
    appendQueue
} from 'music/tracker';

const generateConfig = () => ({
    opus: {
        mspm: 'xxxx091781c235b0c828xxxx'
    },
    'playstart': {
        mspm: 'xxxx91981c235b0c8286xxxx',
        _resource_1_id: '',
        _resource_1_type: 'school'
    },
    viewstart: {
        mspm: 'xxxxd091781c235b0c828xxx',
        type: 'page'
    },
    viewend: {
        mspm: 'xxxx17b1b200b0c2e3xxxxxx',
        type: 'page',
        _time: ''
    }
});

export default Tracker;
export {
    generateConfig,
    TrackerExposure,
    appendQueue
};

```

```jsx
import React, { useEffect, useState } from 'react';
import Tracker, { generateConfig, TrackerExposure, appendQueue } from './tracker.js';

const Demo = () => {
    const [opusList, setOpusList] = useState([]);

    useEffect(() => {
        Tracker.init({
            common: {
                osVer: 'xxx',
                activityId: 'xxx',
            },
            config: generateConfig()
        });

        // fetch opuslist
        setOpusList(opus);
    }, []);

    const handleStart = () => {
        appendQueue({
            name: 'playstart',
            action: 'playstart'
        });
    }

    return <>
        {
            opusList.map(opus => <TrackerExposure 
                    start="opus"
                    startExtra={{opusId: opus.id}}
                    threshold={0.5}>
                {
                    ({ addRef }) => <div ref={addRef} >{opus.name}</div>
                }
            </TrackerExposure>)
        }
        <Player onStart={handleStart}>
    <>;
}
```


## 7、总结
我们在音街移动站中进行了迁移、在多个运营活动中进行了使用，达到了我们预期的目标；在提效方面，埋点库把费时的部分处理了，我们需要做的就是从埋点平台把坑位信息放入配置文件，业务开发的时候使用对应的组件就可以了，几乎没有太大的成本，且对于代码复用和维护来说也达到了目的。

在使用过程中发现对于点击类埋点 appendQueue 使用频率远高于 TrackerClick 组件，因为大部分元素的点击事件都有他自己的回调函数，但是我们使用 TrackerClick 的初衷是埋点代码和业务代码解耦，这个也要根据实际场景去选择。


## 8、参考资料

- [MDN/IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver)
- [react-intersection-observer](https://github.com/researchgate/react-intersection-observer)
- [page-lifecycle](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#managing-cross-browsers-differences)

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
