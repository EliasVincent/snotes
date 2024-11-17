# Tauri + Vanilla TS

This template should help get you started developing with Tauri in vanilla HTML, CSS and Typescript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# Android Build
https://v2.tauri.app/start/prerequisites/#android

    Use the SDK Manager in Android Studio to install the following:

    Android SDK Platform
    Android SDK Platform-Tools
    NDK (Side by side)
    Android SDK Build-Tools
    Android SDK Command-line Tools


`export JAVA_HOME=/opt/android-studio/jbr`

```
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
```

`rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`