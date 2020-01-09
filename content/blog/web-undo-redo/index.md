---
title: Web 应用的撤销重做实现
date: "2019-08-22T00:00:00.000Z"
description: "前不久，我参与开发了团队中的一个 web 应用，过程中让用户能够进行操作的**撤销、重做**会提高编辑效率，大大提高用户体验，而本文要讲的正是在这个功能实现中的探索与总结。"
---

![header.png](https://p1.music.126.net/kPh7uDkk3AzGU9lK-YkSEA==/109951164305172513.png)

### 背景

前不久，我参与开发了团队中的一个 web 应用，其中的一个页面操作如下图所示：

![demo.gif](https://p1.music.126.net/oo9XzhvmIfZvEZXh6S84MQ==/109951164293216185.gif)

这个制作间页面有着类似 PPT 的交互：从左侧的工具栏中选择元素放入中间的画布、在画布中可以删除、操作（拖动、缩放、旋转等）这些元素。

在这个编辑过程中，让用户能够进行操作的**撤销、重做**会提高编辑效率，大大提高用户体验，而本文要讲的正是在这个功能实现中的探索与总结。

### 功能分析

用户的一系列操作会改变页面的状态：

![state.png](https://p1.music.126.net/opf3w_dnhE1LiHzfk4mtWg==/109951164300204465.png)

在进行了某个操作后，用户有能力回到之前的某个状态，即**撤销**：

![undo.png](https://p1.music.126.net/8yMqFNDtZxyKlXHx9GabyQ==/109951164300221846.png)

在撤销某个操作后，用户有能力再次恢复这个操作，即**重做**：

![redo.png](https://p1.music.126.net/FCxbMX-UWdhE9HuVwlhP-w==/109951164300209970.png)

当页面处于某个历史状态时，这时用户进行了某个操作后，这个状态后面的状态会被抛弃，此时产生一个新的状态分支：
![branch.png](https://p1.music.126.net/rGhZveBuHGSUYb_N5PPv8A==/109951164300259778.png)

下面，开始实现这些逻辑。

### 功能初实现
基于以上的分析，实现撤销重做功能需要实现：

* 保存用户的每个操作；
* 针对每个操作设计与之对应的一个撤销逻辑；
* 实现撤销重做的逻辑；

#### 第一步：数据化每一个操作

操作造成的状态改变可以用语言来描述，如下图，页面上有一个绝对定位的 `div` 和 一个 `button`，每次点击 `button` 会让 `div` 向右移动 `10px`。这个点击操作可以被描述为：`div` 的样式属性 `left` 增加 `10px`。

![div.png](https://p1.music.126.net/XjG7u720WlyIS_iipVHRwA==/109951164298493717.png)

显然，JavaScript 并不认识这样的描述，需要将这份描述翻译成 JavaScript 认识的语言：

```JavaScript
const action = {
    name: 'changePosition',
    params: {
        target: 'left',
        value: 10,
    },
};
```
上面代码中使用变量 `name` 表示操作具体的名称，`params` 存储了该操作的具体数据。不过 JavaScript 目前仍然不知道如何使用这个它，还需要一个执行函数来指定如何使用上面的数据：
```javascript
function changePosition(data, params) {
    const { property, distance } = params;
    data = { ...data };
    data[property] += distance;
    return data;
}
```
其中，`data` 为应用的状态数据，`params` 为 `action.params`。

#### 第二步：编写操作对应的撤销逻辑

撤销函数中结构与执行函数类似，也应该能获取到 `data` 和 `action`：
```javascript
function changePositionUndo(data, params) {
    const { property, distance } = params;
    data = { ...data };
    data[property] -= distance;
    return data;
}
```
所以，`action` 的设计应当同时满足执行函数和撤销函数的逻辑。

#### 第三步：撤销、重做处理

上述的 `action`、执行函数、撤销函数三者作为一个整体共同描述了一个操作，所以存储时三者都要保存下来。

这里基于约定进行绑定：执行函数名等于操作的 `name` ，撤销函数名等于 `name + 'Undo'`，这样就只需要存储 `action`，隐式地也存储了执行函数和撤销函数。

编写一个全局模块存放函数、状态等：`src/manager.js`：
```javascript
const functions = {
    changePosition(state, params) {...},
    changePositionUndo(state, params) {...}
};

export default {
    data: {},
    actions: [],
    undoActions: [],
    getFunction(name) {
        return functions[name];
    }
};
```
那么，点击按钮会产生一个新的操作，我们需要做的事情有三个：

* 存储操作的 `action`；
* 执行该操作；
* 如果处于历史节点，需要产生新的操作分支；

```javascript
import manager from 'src/manager.js';

buttonElem.addEventListener('click', () => {
    manager.actions.push({
        name: 'changePosition',
        params: { target: 'left', value: 10 }
    });

    const execFn = manager.getFunction(action.name);
    manager.data = execFn(manager.data, action.params);

    if (manager.undoActions.length) {
        manager.undoActions = [];
    }
});
```
其中，`undoActions` 存放的是撤销的操作的 `action`，这里清空表示抛弃当前节点以后的操作。将 `action` 存进 `manager.actions` ，这样需要撤销操作的时候，直接取出 `manager.actions` 中最后一个 `action`，找到对应撤销函数并执行即可。
```javascript
import manager from 'src/manager.js';

function undo() {
    const action = manager.actions.pop();
    const undoFn = manager.getFunction(`${action.name}Undo`);
    manager.data = undoFn(manager.data, action.params);
    manager.undoActions.push(action);
}
```
需要重做的时候，取出 `manager.undoActions` 中最后的 `action`，找到对应执行函数并执行。
```javascript
import manager from 'src/manager.js';

function redo() {
    const action = manager.undoActions.pop();
    const execFn = manager.getFunction(action.name);
    manager.data = execFn(manager.data, action.params);
}
```

### 模式优化：命令模式

以上代码可以说已经基本满足了功能需求，但是在我看来仍然存在一些问题：

* 管理分散：某个操作的 `action`、执行函数、撤销函数分开管理。当项目越来越大时将会维护困难；
* 职责不清：并没有明确规定执行函数、撤销函数、状态的改变该交给业务组件执行还是给全局管理者执行，这不利于组件和操作的复用；

想有效地解决以上问题，需要找到一个合适的新模式来组织代码，我选择了命令模式。

#### 命令模式简介

简单来说，命令模式将方法、数据都封装到单一的对象中，对调用方与执行方进行解耦，达到职责分离的目的。

以顾客在餐厅吃饭为例子：

* 顾客点餐时，选择想吃的菜，提交一份点餐单
* 厨师收到这份点餐单后根据内容做菜

期间，顾客和厨师之间并没有见面交谈，而是通过一份点餐单来形成联系，这份点餐单就是一个命令对象，这样的交互模式就是命令模式。

#### action + 执行函数 + 撤销函数 = 操作命令对象

为了解决**管理分散**的问题，可以把一个操作的 `action`、执行函数、撤销函数作为一个整体封装成一个命令对象：

```javascript
class ChangePositionCommand {
    constructor(property, distance) {
        this.property = property; // 如：'left'
        this.distance = distance; // 如： 10
    }

    execute(state) {
        const newState = { ...state }
        newState[this.property] += this.distance;
        return newState;
    }

    undo(state) {
        const newState = { ...state }
        newState[this.property] -= this.distance;
        return newState;
    }
}
```

#### 业务组件只关心命令对象的生成和发送

在状态数据处理过程中往往伴随着一些副作用，这些与数据耦合的逻辑会大大降低组件的复用性。因此，业务组件不用关心数据的修改过程，而是专注自己的职责：生成操作命令对象并发送给状态管理者。

```javascript
import manager from 'src/manager';
import { ChangePositionCommand } from 'src/commands';

buttonElem.addEventListener('click', () => {
    const command = new ChangePositionCommand('left', 10);
    manager.addCommand(command);
});
```
#### 状态管理者只关心数据变更和操作命令对象治理

```javascript
class Manager {
    constructor(initialState) {
        this.state = initialState;
        this.commands = [];
        this.undoCommands = [];
    }

    addCommand(command) {
        this.state = command.execute(this.state);
        this.commands.push(command);
        this.undoCommands = []; // 产生新分支
    }

    undo() {
        const command = this.commands.pop();
        this.state = command.undo(this.state);
        this.undoCommands.push(command);
    }

    redo() {
        const command = this.undoCommands.pop();
        this.state = command.execute(this.state);
        this.commands.push(command);
    }
}

export default new Manger({});
```
这样的模式已经可以让项目的代码变得健壮，看起来已经很不错了，但是能不能更好呢？

### 模式进阶：数据快照式

命令模式要求开发者针对每一个操作都要额外开发一个撤销函数，这无疑是麻烦的。接下来要介绍的数据快照式就是要改进这个缺点。

数据快照式通过保存每次操作后的数据快照，然后在撤销重做的时候通过历史快照恢复页面，模式模型如下：

![1.jpeg](https://p1.music.126.net/8wMOq3EA39MvXj8rldB_2w==/109951164226906444.png)

要使用这种模式是有要求的：

* 应用的状态数据需要集中管理，不应该分散在各个组件；
* 数据更改流程中有统一的地方可以做数据快照存储；

这些要求不难理解，既然要产生数据快照，集中管理才会更加便利。基于这些要求，我选择了市面上较为流行的 [Redux](https://redux.js.org/) 来作为状态管理器。

#### 状态数据结构设计

按照上面的模型图，Redux 的 `state` 可以设计成：

```javascript
const state = {
    timeline: [],
    current: -1,
    limit: 1000,
};
```
代码中，各个属性的含义为：

* `timeline`：存储数据快照的数组；
* `current`：当前数据快照的指针，为 `timeline` 的索引；
* `limit`：规定了 `timeline` 的最大长度，防止存储的数据量过大；
#### 数据快照生成的方式

假设应用初始的状态数据为：
```javascript
const data = { left: 100 };
const state = {
    timeline: [data],
    current: 0,
    limit: 1000,
};
```
进行了某个操作后，`left` 加 100，有些新手可能会直接这么做：
```javascript
cont newData = data;
newData.left += 100;
state.timeline.push(newData);
state.current += 1;
```
这显然是错误的，因为 JavaScript 的对象是引用类型，变量名只是保存了它们的引用，真正的数据存放在堆内存中，所以 `data` 和 `newData` 共享一份数据，所以历史数据和当前数据都会发生变化。

##### 方式一：使用深拷贝

深拷贝的实现最简单的方法就是使用 JSON 对象的原生方法：

```javascript
const newData = JSON.parse(JSON.stringify(data));
```

或者，借助一些工具比如 lodash：

```javascript
const newData = lodash.cloneDeep(data);
```
不过，深拷贝可能出现循环引用而引起的死循环问题，而且，深拷贝会拷贝每一个节点，这样的方式带来了无谓的性能损耗。

##### 方式二：构建不可变数据

假设有个对象如下，需要修改第一个 `component` 的 `width` 为 `200`：
```javascript
const state = {
    components: [
        { type: 'rect', width: 100,  height: 100 },
        { type: 'triangle': width: 100, height: 50}
    ]
}
```
目标属性的在对象树中的路径为：`['components', 0, 'width']`，这个路径上有些数据是引用类型，为了不造成共享数据的变化，这个引用类型要先变成一个新的引用类型，如下：
```javascript
const newState = { ...state };
newState.components = [...state.components];
newState.components[0] = { ...state.components[0] };
```
这时你就可以放心修改目标值了：
```javascript
newState.components[0].width = 200;
console.log(newState.components[0].width, state.components[0].width); // 200, 100
```
这样的方式只修改了目标属性节点的路径上的引用类型值，其他分支上的值是不变的，这样节省了不少内存。为了避免每次都一层一层去修改，可以将这个处理封装成一个工具函数：
```javascript
const newState = setIn(state, ['components', 0, 'width'], 200)
```
`setIn` 源码：[https://github.com/cwajs/cwa-immutable/blob/master/src/setIn.js](https://github.com/cwajs/cwa-immutable/blob/master/src/setIn.js)
#### 数据快照处理逻辑

进行某个操作，`reducer` 代码为：

```javascript
function operationReducer(state, action) {
    state = { ...state };
    const { current, limit } = state;
    const newData = ...; // 省略过程
    state.timeline = state.timeline.slice(0, current + 1);
    state.timeline.push(newData);
    state.timeline = state.timeline.slice(-limit);
    state.current = state.timeline.length - 1;
    return state;
}
```
有两个地方需要解释：

* `timline.slice(0, current + 1)`：这个操作是前文提到的，进行新操作时，应该抛弃当前节点后的操作，产生一个新的操作分支；
* `timline.slice(-limit)`：表示只保留最近的 `limit` 个数据快照；
#### 使用高阶 reducer

在实际项目中，通常会使用 [combineReducers](https://redux.js.org/api/combinereducers) 来模块化 `reducer`，这种情况下，在每个 `reducer` 中都要重复处理以上的逻辑。这时候就可以使用高阶 `reducer` 函数来抽取公用逻辑：

```javascript
const highOrderReducer = (reducer) => {
  return (state, action) => {
    state = { ...state };
    const { timeline, current, limit } = state;
    // 执行真实的业务reducer
    const newState = reducer(timeline[current], action);
    // timeline处理
    state.timeline = timeline.slice(0, current + 1);
    state.timeline.push(newState);
    state.timeline = state.timeline.slice(-limit);
    state.current = state.timeline.length - 1;
    return state;
  };
}

// 真实的业务reducer
function reducer(state, action) {
    switch (action.type) {
        case 'xxx':
            newState = ...;
            return newState;
    }
}

const store = createStore(highOrderReducer(reducer), initialState);
```
这个高阶 `reducer` 使用 `const newState = reducer(timeline[current], action)` 来对业务 `reducer` 隐藏数据快照队列的数据结构，使得业务 `reducer` 对撤销重做逻辑无感知，实现功能可拔插。

#### 增强高阶 reducer，加入撤销重做逻辑

撤销重做时也应该遵循 Redux 的数据修改方式使用 `store.dispatch`，为：

* `store.dispatch({ type: 'undo' })` ;
* `store.dispatch({ type: 'redo' })`;

这两种 `action` 不应该进入到业务 `reducer`，需要进行拦截：

```javascript
const highOrderReducer = (reducer) => {
  return (state, action) => {
    // 进行 undo、redo 的拦截
    if (action.type === 'undo') {
        return {
            ...state,
            current: Math.max(0, state.current - 1),
        };
    }
    // 进行 undo、redo 的拦截
    if (action.type === 'redo') {
        return {
            ...state,
            current: Math.min(state.timeline.length - 1, state.current + 1),
        };
    }

    state = { ...state };
    const { timeline, current, limit } = state;
    const newState = reducer(timeline[current], action);
    state.timeline = timeline.slice(0, current + 1);
    state.timeline.push(newState);
    state.timeline = state.timeline.slice(-limit);
    state.current = state.timeline.length - 1;
    return state;
  };
}
```
#### 使用 react-redux 在组件中获取状态

我在项目中使用的是 [React](https://reactjs.org) 和 [react-redux](https://react-redux.js.org/)，由于 `state`  的数据结构发生了变化，所以在组件中获取状态的写法也要相应作出调整：
```javascript
import React from 'react';
import { connect } from 'react-redux';

function mapStateToProps(state) {
    const currentState = state.timeline[state.current];
    return {};
}

class SomeComponent extends React.Component {}

export default connect(mapStateToProps)(SomeComponent);
```
然而，这样的写法让组件感知到了撤销重做的数据结构，与上面所说的功能可拔插明显相悖，我通过重写 `store.getState` 方法来解决：
```javascript
const store = createStore(reducer, initialState);

const originGetState = store.getState.bind(store);

store.getState = (...args) => {
    const state = originGetState(...args);
    return state.timeline[state.current];
}
```



### 总结

本文围绕撤销重做功能实现的讲解到此结束，在实现该功能后引入了命令模式来使得代码结构更加健壮，最后改进成数据快照式，从而让整个应用架构更加优雅。

### 参考资料

* 《JavaScript设计模式》Addy Osmani著
* [Redux Documentation](https://redux.js.org/introduction/getting-started)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们对人才饥渴难耐，快来 [加入我们](mailto:grp.music-fe@corp.netease.com)！
