---
title: cmake预设文件
description: c++构建系统
pubDate: 2026-08-17
tags: [CPP, cmake]
draft: false
---
## 好用的CMakePresets.json
CMakePresets.json是cmake官方的预设文件，用来把常用的配置参数保存下来，避免每次手动输入一长串命令。VS和vscode都能识别它，让你在IDE里一键切换不同的编译环境。
在没有CMakePresets.json（cmake预设文件之前），我们用每次cmake构建项目，必须手动输入以下命令：
```cmake
cmake -S . -B build/Debug -G Ninja \
-DCMAKE_BUILD_TYPE=Debug \
-DCMAKE_ExPORT_COMPILE_COMMANDS=NO \
-DCMAKE_TOOLCHAIN_FILE=D:/vcpkg/scripts/buildsystems/vcpkg.cmake 
```
而只要我们写了CMakePresets.json后，我们就只需要：
```cmake
cmake --presets Debug/Release
```
就会按照CMakePresets.json中的配置运行上述内容。

我们以前运行：
```cmake 
cmake --build build --target xxx
```
也可以改成
```cmake
cmake --build --preset Debug/Release --target xxx
```
