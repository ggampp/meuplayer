package com.meuplayer.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.SharedPreferences
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Android TV / box shell: fullscreen WebView pointing at MeuPlayer server
 * (VPS, LAN Docker, or desktop machine). DPAD is passed through to the page
 * spatial-nav; MENU / long-BACK opens server URL settings.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MeuPlayerTV"
        private const val PREFS = "meuplayer"
        private const val KEY_SERVER_URL = "server_url"
        private const val DEFAULT_HINT = "http://192.168.0.10:3000"
    }

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var progress: ProgressBar
    private lateinit var root: FrameLayout

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE)

        root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0b0b12"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#0b0b12"))
            isFocusable = true
            isFocusableInTouchMode = true
            requestFocus()
        }

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                8,
                Gravity.TOP
            )
        }

        root.addView(webView)
        root.addView(progress)
        setContentView(root)

        configureWebView()
        injectTvEnvBridge()

        val url = prefs.getString(KEY_SERVER_URL, null)
        if (url.isNullOrBlank()) {
            showUrlDialog(getString(R.string.prompt_server_url))
        } else {
            loadServer(url)
        }
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString + " MeuPlayerTV/1.2"
            // Streaming embeds may open secondary windows; keep single WebView for TV
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            // Hardware acceleration for video
            // (activity/window level also helps)
        }

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                // TV: keep navigation inside the same WebView
                Log.d(TAG, "Popup blocked (single WebView policy)")
                return false
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                injectTvEnvBridge()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    showUrlDialog(getString(R.string.error_connect))
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val serverUrl = prefs.getString(KEY_SERVER_URL, "").orEmpty()
                if (serverUrl.isEmpty()) return false

                val serverHost = android.net.Uri.parse(serverUrl).host
                val targetHost = request.url.host
                // Allow same host + common streaming hosts loaded inside player iframe/webview
                if (request.isForMainFrame &&
                    serverHost != null &&
                    targetHost != null &&
                    !targetHost.equals(serverHost, ignoreCase = true)
                ) {
                    // Main-frame leave: block (keeps TV shell on MeuPlayer)
                    Log.d(TAG, "Blocked main-frame leave to $targetHost")
                    return true
                }
                return false
            }
        }
    }

    /** Expose Android TV context to the hub/spatial-nav scripts. */
    private fun injectTvEnvBridge() {
        val js = """
            (function () {
              window.__MEUPLAYER_ENV = Object.assign({}, window.__MEUPLAYER_ENV || {}, {
                isElectron: false,
                isAndroidTv: true,
                platform: 'android-tv',
                version: '1.2.0'
              });
              window.__MEUPLAYER_TV = true;
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun loadServer(url: String) {
        var normalized = url.trim()
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            normalized = "http://$normalized"
        }
        prefs.edit().putString(KEY_SERVER_URL, normalized).apply()
        progress.visibility = View.VISIBLE
        webView.loadUrl(normalized)
    }

    private fun showUrlDialog(message: String) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 24, 48, 8)
        }

        val hint = TextView(this).apply {
            text = getString(R.string.server_url_help)
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 13f
            setPadding(0, 0, 0, 16)
        }
        layout.addView(hint)

        val input = EditText(this).apply {
            this.hint = DEFAULT_HINT
            setText(prefs.getString(KEY_SERVER_URL, "") ?: "")
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#64748b"))
            setSingleLine()
        }
        layout.addView(input)

        AlertDialog.Builder(this)
            .setTitle(R.string.app_name)
            .setMessage(message)
            .setView(layout)
            .setCancelable(false)
            .setPositiveButton(R.string.connect) { _, _ ->
                val value = input.text?.toString()?.trim().orEmpty()
                if (value.isNotEmpty()) {
                    loadServer(value)
                } else {
                    Toast.makeText(this, R.string.invalid_url, Toast.LENGTH_SHORT).show()
                    showUrlDialog(message)
                }
            }
            .setNeutralButton(R.string.clear_cache) { _, _ ->
                webView.clearCache(true)
                CookieManager.getInstance().removeAllCookies(null)
                Toast.makeText(this, R.string.cache_cleared, Toast.LENGTH_SHORT).show()
                showUrlDialog(message)
            }
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                if (webView.canGoBack()) {
                    webView.goBack()
                    return true
                }
            }
            KeyEvent.KEYCODE_MENU -> {
                showUrlDialog(getString(R.string.change_server_url))
                return true
            }
            // Forward media/DPAD to page so spatial-nav / workbench handle focus
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> {
                // Let WebView handle; also notify page for custom handlers
                dispatchDpadToPage(keyCode)
            }
            KeyEvent.KEYCODE_CHANNEL_UP -> {
                webView.evaluateJavascript(
                    "window.meuPlayerSelectAdjacentChannel && window.meuPlayerSelectAdjacentChannel(-1);",
                    null
                )
                return true
            }
            KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                webView.evaluateJavascript(
                    "window.meuPlayerSelectAdjacentChannel && window.meuPlayerSelectAdjacentChannel(1);",
                    null
                )
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun dispatchDpadToPage(keyCode: Int) {
        val key = when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> "ArrowUp"
            KeyEvent.KEYCODE_DPAD_DOWN -> "ArrowDown"
            KeyEvent.KEYCODE_DPAD_LEFT -> "ArrowLeft"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "ArrowRight"
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "Enter"
            else -> return
        }
        val js = """
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: '$key', bubbles: true, cancelable: true
            }));
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    override fun onKeyLongPress(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            showUrlDialog(getString(R.string.change_server_url))
            return true
        }
        return super.onKeyLongPress(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        root.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }
}
