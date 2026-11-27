---
title: "std::async与std::future"
description: "CPP11增加的异步回调支持"
pubDate: 2026-08-17
tags: ["CPP11", "异步回调"]
draft: false
---

`std::thread` 把线程交给你自己管，启动、等待、回收都得手写。C++11 同时引入了 `std::async` 和 `std::future`，把「在后台算一个值，之后再取」这件事包装成了一个接口：调用 `std::async` 拿到一个 `std::future`，需要结果时 `get()` 一下就行。

## 背景

在 C++11 之前，想在后台跑一段代码并拿回结果，通常得自己搭一套：

```cpp
std::thread t([&] {
    result = compute();
    done = true;
});
// 自己用 mutex + condition_variable 等 done
t.join();
```

这套写法的问题不在于难，而在于容易漏：异常没法跨线程抛回来，等待条件写错就是死锁，`join` 忘了写程序直接 `std::terminate`。`std::async` / `std::future` 把这些样板收进了标准库。

## std::future：结果的占位符

`std::future<T>` 可以理解成一张取货单：

- 调用 `std::async` 时立刻拿到它，但此时结果可能还没算好。
- `get()` 会阻塞到结果就绪，然后返回 `T`。
- `get()` 只能调用一次，调用后 `valid()` 变成 `false`。
- `std::future` 只能移动，不能拷贝。需要多处读取同一个结果时用 `std::shared_future`。

一个最小的例子：

```cpp
#include <chrono>
#include <future>
#include <iostream>
#include <string>
#include <thread>

std::string fetch(const std::string& url) {
    std::this_thread::sleep_for(std::chrono::seconds(2));
    return "content of " + url;
}

int main() {
    std::future<std::string> result =
        std::async(std::launch::async, fetch, "https://example.com");

    std::cout << "等结果的同时可以做别的事\n";

    std::string data = result.get();  // 阻塞，直到 fetch 返回
    std::cout << data << '\n';
}
```

`std::async` 的第一个参数是启动策略，后面的参数和 `std::thread` 一样，是「可调用对象 + 实参」。

## 三种启动策略

| 策略 | 行为 |
| --- | --- |
| `std::launch::async` | 立刻在另一个线程上执行 |
| `std::launch::deferred` | 先不执行，等 `get()` / `wait()` 时才在调用线程上同步执行 |
| `std::launch::async \| std::launch::deferred` | 默认值，由实现自行决定用哪种 |

默认策略最容易踩坑：你写的是 `std::async(f)`，看起来是异步，但标准允许实现选择延迟执行。延迟执行时它根本不会开线程，`get()` 那一刻才在当前线程跑，等于白写。

所以只要确实想要并发，就显式传 `std::launch::async`：

```cpp
auto f = std::async(std::launch::async, [] { return 42; });
```

## 异常会通过 future 传回来

这是它比手写 `std::thread` 省事的地方之一。后台任务抛出的异常会被存进 `future`，在 `get()` 时重新抛出：

```cpp
auto f = std::async(std::launch::async, []() -> int {
    throw std::runtime_error("boom");
});

try {
    f.get();
} catch (const std::exception& e) {
    std::cerr << "捕获到：" << e.what() << '\n';
}
```

注意：如果一直不调用 `get()`，这个异常就被静默吞掉了。后台任务失败却没人发现，往往就是忘了取结果。

## 不阻塞地看进度：wait_for

`get()` 一定会阻塞。如果只想等一小会儿，用 `wait_for` / `wait_until`：

```cpp
if (f.wait_for(std::chrono::milliseconds(100)) == std::future_status::ready) {
    std::cout << f.get() << '\n';
} else {
    std::cout << "还没好，先干别的\n";
}
```

`wait_for` 的返回值有三种：

- `std::future_status::ready`：结果已就绪。
- `std::future_status::timeout`：超时了，任务还在跑。
- `std::future_status::deferred`：任务是延迟执行的，还没开始跑。

第三种经常被忽略。拿到 `deferred` 说明不管等多久都不会变 `ready`，必须调用 `get()` 才会真正执行。

## 几个必须知道的坑

### 1. 临时 future 会变成同步调用

```cpp
std::async(std::launch::async, doSomething);  // 危险
```

这里没有变量接住返回的 `future`，临时对象在语句结束时析构。而 `std::async` 产生的 `future` 在析构时会等待任务完成，所以这行代码实际是同步阻塞的，还白白开了一个线程。

正确写法是接住它：

```cpp
auto f = std::async(std::launch::async, doSomething);
// ...
f.get();  // 或者等 f 离开作用域
```

### 2. 延迟任务不 get 就永远不会执行

```cpp
std::async(std::launch::deferred, doSomething);  // 什么都不会发生
```

延迟执行的 `future` 析构时不会触发任务。任务被悄无声息地丢掉了。

### 3. get() 只有一次机会

```cpp
auto f = std::async(std::launch::async, [] { return 1; });
int a = f.get();  // ok
int b = f.get();  // 抛 std::future_error
```

想多次读取结果，用 `share()` 转成 `std::shared_future`：

```cpp
std::shared_future<int> sf = f.share();
int a = sf.get();
int b = sf.get();  // ok
```

### 4. 别把局部变量的引用交给后台任务

和 `std::thread` 一样，`std::async` 默认按值拷贝实参，但如果用 lambda 捕获引用，就要保证被引用的对象活得比任务久：

```cpp
std::future<void> f;
{
    std::string local = "临时数据";
    f = std::async(std::launch::async, [&] { use(local); });
}  // local 已销毁，任务还在跑

f.get();  // 未定义行为
```

## 和 std::thread 怎么选

- 只是「算一个值，之后取」：优先 `std::async` + `std::future`，异常传播和线程回收都不用操心。
- 需要长期运行的工作线程、线程池、精细控制线程生命周期：`std::thread` 或自己封装线程池。
- 需要多个任务共享同一个结果：`std::shared_future`。
- 需要组合多个 future：C++11 本身没有现成工具，得自己写等待逻辑（后续标准才补上）。

## 总结

`std::async` / `std::future` 解决的是「异步算一个值」这个最常见的场景，代价是几条容易忘的规则：

1. 想要并发就显式写 `std::launch::async`。
2. 一定要用变量接住 `future`，否则临时对象析构会阻塞。
3. 延迟任务必须 `get()`，否则不会执行。
4. `get()` 只取一次，有异常也只在这一刻抛出来。

把这四点记住，日常用起来比裸写 `std::thread` 稳得多。
