package io.github.x13_4zur3.productivity;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.window.OnBackInvokedDispatcher;

import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private final ExecutorService startup = Executors.newSingleThreadExecutor();
    private FrameLayout root;
    private LinearLayout status;
    private TextView message;
    private Button retry;
    private WebView webView;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        status = new LinearLayout(this);
        status.setOrientation(LinearLayout.VERTICAL);
        status.setGravity(Gravity.CENTER);
        message = new TextView(this);
        message.setGravity(Gravity.CENTER);
        message.setTextSize(18);
        status.addView(message);
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(view -> startProductivity());
        status.addView(retry);
        root.addView(status, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                return WindowInsets.CONSUMED;
            });
            root.requestApplyInsets();
        }
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
        startProductivity();
    }

    private void startProductivity() {
        message.setText(R.string.opening);
        retry.setVisibility(View.GONE);
        status.setVisibility(View.VISIBLE);
        File data = new File(getNoBackupFilesDir(), "productivity");
        startup.execute(() -> {
            try {
                String url;
                synchronized (Python.class) {
                    if (!Python.isStarted()) {
                        Python.start(new AndroidPlatform(getApplicationContext()));
                    }
                    url = Python.getInstance().getModule("android_runtime")
                            .callAttr("new_window", data.getAbsolutePath()).toString();
                }
                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed()) {
                        openWindow(url);
                    }
                });
            } catch (RuntimeException error) {
                Log.e("Productivity", "Could not start the local app", error);
                runOnUiThread(this::showOpenError);
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void openWindow(String url) {
        int port = Uri.parse(url).getPort();
        WebView view = new WebView(this);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
        view.setWebViewClient(new WebViewClient() {
            private boolean isAppOrigin(Uri target) {
                return "http".equals(target.getScheme()) && "127.0.0.1".equals(target.getHost())
                        && target.getPort() == port && target.getUserInfo() == null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView ignored, WebResourceRequest request) {
                return !isAppOrigin(request.getUrl());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView ignored, WebResourceRequest request) {
                if (isAppOrigin(request.getUrl())) {
                    return null;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public void onReceivedError(WebView failedView, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    failedView.post(() -> {
                        if (webView == failedView) {
                            showOpenError();
                        }
                    });
                }
            }
        });
        webView = view;
        root.addView(view, new FrameLayout.LayoutParams(-1, -1));
        status.setVisibility(View.GONE);
        view.loadUrl(url);
    }

    private void showOpenError() {
        if (isFinishing() || isDestroyed()) {
            return;
        }
        closeWindow();
        message.setText(R.string.open_error);
        retry.setVisibility(View.VISIBLE);
        status.setVisibility(View.VISIBLE);
    }

    private void closeWindow() {
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBack();
    }

    private void goBack() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        startup.shutdown();
        closeWindow();
        super.onDestroy();
    }
}
