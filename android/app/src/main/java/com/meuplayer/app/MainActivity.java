package com.meuplayer.app;

import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "meuplayer";
    private static final String KEY_SERVER_URL = "server_url";

    private WebView webView;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()) {
                    showUrlDialog("Não foi possível conectar. Verifique a URL do servidor:");
                }
            }
        });

        String url = prefs.getString(KEY_SERVER_URL, null);
        if (url == null || url.isEmpty()) {
            showUrlDialog("Digite a URL do servidor MeuPlayer:");
        } else {
            webView.loadUrl(url);
        }
    }

    private void showUrlDialog(String message) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(48, 24, 48, 24);

        EditText input = new EditText(this);
        input.setHint("https://meuplayer.seudominio.com");
        String current = prefs.getString(KEY_SERVER_URL, "");
        if (!current.isEmpty()) {
            input.setText(current);
        }
        layout.addView(input);

        new AlertDialog.Builder(this)
            .setTitle("MeuPlayer")
            .setMessage(message)
            .setView(layout)
            .setCancelable(false)
            .setPositiveButton("Conectar", (dialog, which) -> {
                String url = input.getText().toString().trim();
                if (!url.isEmpty()) {
                    prefs.edit().putString(KEY_SERVER_URL, url).apply();
                    webView.loadUrl(url);
                } else {
                    Toast.makeText(this, "URL inválida", Toast.LENGTH_SHORT).show();
                    showUrlDialog(message);
                }
            })
            .show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showUrlDialog("Alterar URL do servidor:");
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            showUrlDialog("Alterar URL do servidor:");
            return true;
        }
        return super.onKeyLongPress(keyCode, event);
    }
}
