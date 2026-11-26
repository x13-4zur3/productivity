# Productivity for Android

The Android app bundles the same interface, Python storage code, and public account-service address as the desktop build. Open Productivity from the Android launcher, then sign in, create an account, or choose **Use local data**. Local journals and tasks stay in the app's private storage on that device. Account workspaces use the existing HTTPS service.

## Run in Android Studio

1. Extract the ZIP. Open the extracted `Productivity-Android` folder in Android Studio. It contains `settings.gradle` and the `shared/` folder with the Python and interface files.
2. Let Gradle sync. In **SDK Manager**, install **Android 16 (API 36)** and **Android SDK Build-Tools 35.0.0** if Studio prompts you. Use Android Studio's bundled JDK for Gradle.
3. Connect an ARM64 Android phone with USB debugging enabled or create a 64-bit emulator. The app supports Android 7.0 or newer on ARM64 and x86-64. On the phone, approve the USB debugging prompt.
4. Select the `app` configuration and your device in Android Studio, then click **Run**. Try creating a journal entry with **Use local data** and signing into an existing account from **Settings → Account**.

## Build the test APK from a terminal

With the SDK set up, run this from the `Productivity-Android/` directory on Windows.

```powershell
.\gradlew.bat :app:assembleDebug
```

Use this command from the same directory on Linux or macOS.

```sh
./gradlew :app:assembleDebug
```

The output is `app/build/outputs/apk/debug/app-debug.apk`. With a test device connected, install it using Android Studio or `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

## Prepare a public release

Use Android Studio's **Build → Generate Signed App Bundle or APK** to make a release APK for GitHub or an Android App Bundle for Google Play. Save the Android signing key securely for future updates. For Google Play, add a way to request deletion of an account and its data from inside the app and from a public web page, then complete the privacy policy and Data safety disclosures. [Android signing guide](https://developer.android.com/studio/publish/app-signing) · [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
