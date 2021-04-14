---
title: Wakeup in XNU
date: 2021-04-14T03:11:44.792Z
description: 苹果在 iOS 中加入了新的性能指标`wakeup`，这里让我们来看看其原理与解决思路。
---

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/8164541348/933d/887d/8c5b/b9a431ed80df98324669aed4106ee24c.jpg)

> 本文作者：[段家顺](http://djs66256.github.io/)


苹果在iOS13的时候，在内核中加入了一个新的性能衡量指标`wakeup`，同时由于这个指标而被系统杀死的应用数不胜数，其中也包括我们常用的微信淘宝等。而这个指标完全是由 XNU 内核统计的，所以我们很难通过日志等普通手段去准确的定位问题，所以这里通过另一种思路去解决这个问题。

## 为什么要统计 wakeup

要定位这个问题，首先我们需要知道这个指标的目的是什么。

XNU 中，对性能的指标有CPU、内存、IO，而`wakeup`属于 CPU 的性能指标，同时属于 CPU 指标的还有 CPU 使用率，下面是XNU中对其限制的定义。

```c
/*
 * Default parameters for CPU usage monitor.
 *
 * Default setting is 50% over 3 minutes.
 */
#define         DEFAULT_CPUMON_PERCENTAGE 50
#define         DEFAULT_CPUMON_INTERVAL   (3 * 60)
```

```c
#define TASK_WAKEUPS_MONITOR_DEFAULT_LIMIT              150 /* wakeups per second */
#define TASK_WAKEUPS_MONITOR_DEFAULT_INTERVAL   300 /* in seconds. */

/*
 * Level (in terms of percentage of the limit) at which the wakeups monitor triggers telemetry.
 *
 * (ie when the task's wakeups rate exceeds 70% of the limit, start taking user
 *  stacktraces, aka micro-stackshots)
 */
#define TASK_WAKEUPS_MONITOR_DEFAULT_USTACKSHOTS_TRIGGER        70
```

总结来说，当 CPU 使用率在3分钟内均值超过50%，就认为过度使用CPU，当`wakeup`在300秒内均值超过150次，则认为唤起次数过多，同时在阈值的70%水位内核会开启监控。

CPU 使用率我们很容易理解，使用率越高，电池寿命越低，而且并不是线性增加的。那么`wakeup`又是如何影响电池寿命的呢？

首先我们需要看看ARM架构中对于 CPU 功耗问题的描述：

```
Many ARM systems are mobile devices and powered by batteries. In such systems, optimization of power use, and total energy use, is a key design constraint. Programmers often spend significant amounts of time trying to save battery life in such systems. 
```

由于ARM被大量使用于低功耗设备，而这些设备往往会由电池来作为驱动，所以 ARM 在硬件层面就对功耗这个问题进行了优化设计。

```
Energy use can be divided into two components: 

- Static 
Static power consumption, also often called leakage, occurs whenever the core logic or RAM blocks have power applied to them. In general terms, the leakage currents are proportional to the total silicon area, meaning that the bigger the chip, the higher the leakage. The proportion of power consumption from leakage gets significantly higher as you move to smaller fabrication geometries. 

- Dynamic 
Dynamic power consumption occurs because of transistor switching and is a function of the core clock speed and the numbers of transistors that change state per cycle. Clearly, higher clock speeds and more complex cores consume more power. 
```

功耗可以分为2种类型，即静态功耗与动态功耗。

静态功耗指的是只要 CPU 通上电，由于芯片无法保证绝对绝缘，所以会存在“漏电”的情况，而且越大的芯片这种问题越严重，这也是芯片厂家为什么拼命的研究更小尺寸芯片的原因。这部分功耗由于是硬件本身决定的，所以我们无法去控制，而这种类型功耗占比不大。

动态功耗指的是 CPU 运行期间，接通时钟后，执行指令所带来的额外开销，而这个开销会和时钟周期频率相关，频率越高，耗电量越大。这也就说明了苹果为什么会控制 CPU 使用率，而相关研究（Facebook 也做过）也表明，CPU 在20以下和20以上的能耗几乎是成倍的增加。

CPU 使用率已经能够从一定程度上限制电池损耗问题了，那么`wakeup`又是什么指标呢？

## wakeup 是什么

要了解`wakeup`是什么，首先要知道ARM低功耗模式的2个重要指令`WFI`和`WFE`。

```
ARM assembly language includes instructions that can be used to place the core in a low-power state. The architecture defines these instructions as hints, meaning that the core is not required to take any specific action when it executes them. In the Cortex-A processor family, however, these instructions are implemented in a way that shuts down the clock to almost all parts of the core. This means that the power consumption of the core is significantly reduced so that only static leakage currents are drawn, and there is no dynamic power consumption. 
```

通过这2个指令进入低功耗模式后，时钟将会被关闭，这个 CPU 将不会再执行任何指令，这样这个 CPU 的动态能耗就没有了。这个能力的实现是由和 CPU 核心强绑定的空转线程`idle thread`实现的，有意思的是XNU中的实现较为复杂，而`Zircon`中则非常直接暴力：

```c
__NO_RETURN int arch_idle_thread_routine(void*) {
  for (;;) {
    __asm__ volatile(“wfi”);
  }
}
```

在 XNU 中，一个 CPU 核心的工作流程被概括为如下状态机：

```c
/*
 *           -------------------- SHUTDOWN
 *          /                     ^     ^
 *        _/                      |      \
 *  OFF_LINE ---> START ---> RUNNING ---> IDLE ---> DISPATCHING
 *         \_________________^   ^ ^______/           /
 *                                \__________________/
 */
```

而`wakeup`则表示的是，从低功耗模式唤起进入运行模式的次数。

## wakeup 如何统计的

#### ARM异常系统

CPU 时钟被关闭了，那么又要怎么唤起呢？这就涉及到 CPU 的异常系统。

在 ARM 中，异常和中断的概念比较模糊，他把所有会引起 CPU 执行状态变更的事件都称为异常，其中包括软中断，debug 中断，硬件中断等。

从触发时机上可以区分为同步异常与异步异常。这里指的同步异步并不是应用程序的概念，这里同步指的是拥有明确的触发时机，比如系统调用，缺页中断等，都会发生在明确的时机，而异步中断，则完全无视指令的逻辑，会强行打断指令执行，比如 FIQ 和 IRQ，这里比较典型的是定时器中断。

异常系统有很多能力，其中一个重要的能力就是内核态与用户态切换。ARM的执行权限分为4个等级，EL0，EL1，EL2，EL3。其中 EL0 代表用户态，而 EL1 代表内核态，当用户态想要切换至内核态的时候，必须通过异常系统进行切换，而且异常系统只能向同等或更高等级权限进行切换。

![](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/8164492614/022a/b9ed/3937/a2fc781c495309109eca4056161bc83b.png)

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/8164491778/1b99/ae96/daa5/712c17b0d593030b8a7e9e4500cb74e0.png)

那么这么多类型的异常，又是如何响应的呢？这里就涉及到一个异常处理表（exception table），在系统启动的时候，需要首先就去注册这个表，在XNU中，这个表如下：

```asm
    .section __DATA_CONST,__const
    .align 3
    .globl EXT(exc_vectors_table)
LEXT(exc_vectors_table)
    /* Table of exception handlers.
         * These handlers sometimes contain deadloops. 
         * It's nice to have symbols for them when debugging. */
    .quad el1_sp0_synchronous_vector_long
    .quad el1_sp0_irq_vector_long
    .quad el1_sp0_fiq_vector_long
    .quad el1_sp0_serror_vector_long
    .quad el1_sp1_synchronous_vector_long
    .quad el1_sp1_irq_vector_long
    .quad el1_sp1_fiq_vector_long
    .quad el1_sp1_serror_vector_long
    .quad el0_synchronous_vector_64_long
    .quad el0_irq_vector_64_long
    .quad el0_fiq_vector_64_long
    .quad el0_serror_vector_64_long
```

#### wakeup 计数

那么我们回过头来看看`wakeup`计数的地方：

```c
/*
 *  thread_unblock:
 *
 *  Unblock thread on wake up.
 *  Returns TRUE if the thread should now be placed on the runqueue.
 *  Thread must be locked.
 *  Called at splsched().
 */
boolean_t
thread_unblock(
    thread_t                thread,
    wait_result_t   wresult)
{
	  // . . .
    boolean_t aticontext, pidle;
    ml_get_power_state(&aticontext, &pidle);

     /* Obtain power-relevant interrupt and “platform-idle exit" statistics.
     * We also account for “double hop” thread signaling via
     * the thread callout infrastructure.
     * DRK: consider removing the callout wakeup counters in the future
     * they’re present for verification at the moment.
     */

    if (__improbable(aticontext /* . . . */)) {
        // wakeup ++
    }
    // . . .
}
```

而这里的`aticontext`则是通过`ml_at_interrupt_context`获取的，其含义则是是否处于中断上下文中。

```c
/*
 *  Routine:        ml_at_interrupt_context
 *  Function:   Check if running at interrupt context
 */
boolean_t
ml_at_interrupt_context(void)
{
    /* Do not use a stack-based check here, as the top-level exception handler
     * is free to use some other stack besides the per-CPU interrupt stack.
     * Interrupts should always be disabled if we’re at interrupt context.
     * Check that first, as we may be in a preemptible non-interrupt context, in
     * which case we could be migrated to a different CPU between obtaining
     * the per-cpu data pointer and loading cpu_int_state.  We then might end
     * up checking the interrupt state of a different CPU, resulting in a false
     * positive.  But if interrupts are disabled, we also know we cannot be
     * preempted. */
    return !ml_get_interrupts_enabled() && (getCpuDatap()->cpu_int_state != NULL);
}
```

那么`cpu_int_state`标记又是在什么时候设置上去的呢？只有在`locore.S`中，才会更新该标记：

```
str        x0, [x23, CPU_INT_STATE]            // Saved context in cpu_int_state
```

同时发现如下几个方法会配置这个标记：

```
el1_sp0_irq_vector_long
el1_sp1_irq_vector_long
el0_irq_vector_64_long
el1_sp0_fiq_vector_long
el0_fiq_vector_64_long
```

结合上述的异常处理表的注册位置，与ARM官方文档的位置进行对比，可以发现：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/8164491940/dbb6/8da0/bc6f/24f5b72bc0c2d89423922fa1ba2306c2.png)

这几个中断类型均为 FIQ 或者 IRQ，也就是硬中断。由此我们可以判断，`wakeup`必然是由硬中断引起的，而像系统调用，线程切换，缺页中断这种并不会引起`wakeup`。

#### 进程统计

由上可以看出，`wakeup`其实是对CPU核心唤起次数的统计，和应用层的线程与进程似乎毫不相干。但从程序执行的角度思考，如果一个程序一直在运行，就不会进入等待状态，而从等待状态唤醒，肯定是因为某些异常中断，比如网络，vsync 等。

在 CPU 核心被唤醒后，在当前 CPU 核心执行的线程会进行`wakeup++`，而系统统计维度是应用维度，也就是进程维度，所以会累计该进程下面的所有线程的`wakeup`计数。

```c
queue_iterate(&task->threads, thread, thread_t, task_threads) {
        info->task_timer_wakeups_bin_1 += thread->thread_timer_wakeups_bin_1;
        info->task_timer_wakeups_bin_2 += thread->thread_timer_wakeups_bin_2;
}
```

所以在我们代码中，如果在2个不同线程启用用同样的定时器，`wakeup`是同一个线程起2个定时器的2倍（同样的定时器在底层其实是一颗树，注册同样的定时器实际只注册了一个）。

用户层获取该统计值则可以通过如下方式：

```c
#include <mach/task.h>
#include <mach/mach.h>

BOOL GetSystemWakeup(NSInteger *interrupt_wakeup, NSInteger *timer_wakeup) {
    struct task_power_info info = {0};
    mach_msg_type_number_t count = TASK_POWER_INFO_COUNT;
    kern_return_t ret = task_info(current_task(), TASK_POWER_INFO, (task_info_t)&info, &count);
    if (ret == KERN_SUCCESS) {
        if (interrupt_wakeup) {
            *interrupt_wakeup = info.task_interrupt_wakeups;
        }
        if (timer_wakeup) {
            *timer_wakeup = info.task_timer_wakeups_bin_1 + info.task_timer_wakeups_bin_2;
        }
        return true;
    }
    else {
        if (interrupt_wakeup) {
            *interrupt_wakeup = 0;
        }
        if (timer_wakeup) {
            *timer_wakeup = 0;
        }
        return false;
    }
}
```

## wakeup 治理

从以上分析来看，我们只需要排查各种硬件相关事件即可。

从实际排查结果来看，目前只有定时器或者拥有定时能力的类型是最普遍的场景。

比如`NSTimer`，`CADisplayLink`，`dispatch_semaphore_wait`，`pthread_cond_timedwait`等。

关于定时器，我们尽量复用其能力，避免在不同线程去创建同样的定时能力，同时在回到后台的时候，关闭不需要的定时器，因为大部分定时器都是UI相关的，关闭定时器也是一种标准的做法。

关于 wait 类型的能力，从方案选择上避免轮询的方案，或者增加轮询间隔时间，比如可以通过 try_wait，runloop或者 EventKit 等能力进行优化。


## 监控与防劣化

一旦我们知道了问题原因，那么对问题的治理比较简单，而后续我们需要建立持续的管控等长效措施才可以。

在此我们可以简单的定义一些规则，并且嵌入线下监控能力中：

- 定时器时间周期小于1s的，在进入后台需要进行暂停
- wait 类型延迟小于1s，并且持续使用10次以上的情况需要进行优化

## 总结

`wakeup`由于是 XNU 内核统计数据，所以在问题定位排查方面特别困难，所以从另一个角度去解决这个问题反而是一种更好的方式。

同时从 XNU 中对 CPU 功耗的控制粒度可以看出，苹果在极致的优化方面做的很好，在自身的软件生态中要求也比较高。电量问题在短时间内应该不会有技术上的突破，所以我们自身也需要多思考如何减少电池损耗。


> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
