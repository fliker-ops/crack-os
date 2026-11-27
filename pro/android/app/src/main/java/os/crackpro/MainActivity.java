package os.crackpro;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

/** Crack Pro: contenedor nativo (WebView) de la caja de herramientas, con puente al teléfono. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int REQ_FILE = 41, REQ_LOC = 42, REQ_PERM = 43;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPerm;
    private String pendingLocationCb;
    private TextToSpeech tts;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(0xFF000000);
        setContentView(web);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net").setHttpAllowed(true)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return loader.shouldInterceptRequest(r.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (r.getUrl().toString().startsWith(ORIGIN)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception ignored) {}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); } catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
            @Override public void onPermissionRequest(final PermissionRequest request) {
                ui.post(() -> { pendingPerm = request; requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}, REQ_PERM); });
            }
        });
        web.addJavascriptInterface(new Bridge(), "CrackNative");
        web.loadUrl(ORIGIN + "/assets/index.html");
    }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else finish(); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE && fileCallback != null) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) { out = new Uri[data.getClipData().getItemCount()]; for (int i = 0; i < out.length; i++) out[i] = data.getClipData().getItemAt(i).getUri(); }
                else if (data.getData() != null) out = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(out); fileCallback = null;
        }
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        if (req == REQ_LOC && pendingLocationCb != null) {
            String cb = pendingLocationCb; pendingLocationCb = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) findLocation(cb);
            else reply(cb, "{\"error\":\"permiso de ubicación negado\"}");
        } else if (req == REQ_PERM && pendingPerm != null) {
            final PermissionRequest r = pendingPerm; pendingPerm = null;
            ui.post(() -> r.grant(r.getResources()));
        }
    }

    private void reply(String cb, String json) { ui.post(() -> web.evaluateJavascript("window.__crkCb(" + JSONObject.quote(cb) + "," + JSONObject.quote(json) + ")", null)); }

    @SuppressWarnings("MissingPermission")
    private void findLocation(final String cb) {
        final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        Location best = null;
        for (String p : lm.getProviders(true)) { Location l = lm.getLastKnownLocation(p); if (l != null && (best == null || l.getTime() > best.getTime())) best = l; }
        final Location last = best;
        String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER : lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : null;
        if (provider == null) { if (last != null) reply(cb, locJson(last)); else reply(cb, "{\"error\":\"ubicación desactivada\"}"); return; }
        final boolean[] done = {false};
        final LocationListener ll = new LocationListener() {
            @Override public void onLocationChanged(Location l) { if (!done[0]) { done[0] = true; lm.removeUpdates(this); reply(cb, locJson(l)); } }
            @Override public void onStatusChanged(String p, int st, Bundle b) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
        };
        lm.requestLocationUpdates(provider, 0, 0, ll, Looper.getMainLooper());
        ui.postDelayed(() -> { if (done[0]) return; done[0] = true; lm.removeUpdates(ll); if (last != null) reply(cb, locJson(last)); else reply(cb, "{\"error\":\"sin señal de GPS\"}"); }, 12000);
    }
    private String locJson(Location l) { try { JSONObject o = new JSONObject(); o.put("lat", l.getLatitude()); o.put("lon", l.getLongitude()); o.put("acc", l.getAccuracy()); o.put("alt", l.hasAltitude() ? l.getAltitude() : JSONObject.NULL); o.put("speed", l.getSpeed()); o.put("src", l.getProvider()); return o.toString(); } catch (Exception e) { return "{\"error\":\"ubicación inválida\"}"; } }

    private class Bridge {
        @JavascriptInterface public String appVersion() { return "1.0"; }
        @JavascriptInterface public String deviceName() { return Build.MANUFACTURER + " " + Build.MODEL; }
        @JavascriptInterface public String deviceInfo() {
            try { JSONObject o = new JSONObject(); o.put("maker", Build.MANUFACTURER); o.put("model", Build.MODEL); o.put("android", Build.VERSION.RELEASE);
                File d = Environment.getDataDirectory(); o.put("free", d.getFreeSpace()); o.put("total", d.getTotalSpace()); return o.toString(); } catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public void vibrate(long ms) { Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE); if (v != null && v.hasVibrator()) v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(ms, 1000)), VibrationEffect.DEFAULT_AMPLITUDE)); }
        @JavascriptInterface public void pattern(String json) { try { org.json.JSONArray a = new org.json.JSONArray(json); long[] p = new long[a.length()]; for (int i = 0; i < a.length(); i++) p[i] = a.getLong(i); Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE); if (v != null) v.vibrate(VibrationEffect.createWaveform(p, -1)); } catch (Exception ignored) {} }
        @JavascriptInterface public void keepAwake(final boolean on) { ui.post(() -> { if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); }); }
        @JavascriptInterface public void brightness(final float v) { ui.post(() -> { WindowManager.LayoutParams lp = getWindow().getAttributes(); lp.screenBrightness = v; getWindow().setAttributes(lp); }); }
        @JavascriptInterface public void copy(String text) { ClipboardManager c = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); if (c != null) c.setPrimaryClip(ClipData.newPlainText("Crack Pro", text)); }
        @JavascriptInterface public String paste() { ClipboardManager c = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); if (c != null && c.hasPrimaryClip() && c.getPrimaryClip().getItemCount() > 0) { CharSequence t = c.getPrimaryClip().getItemAt(0).getText(); return t == null ? "" : t.toString(); } return ""; }
        @JavascriptInterface public void openUrl(String u) { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception ignored) {} }
        @JavascriptInterface public void shareText(String t) { Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, t); try { startActivity(Intent.createChooser(i, "Compartir")); } catch (Exception ignored) {} }
        @JavascriptInterface public void torch(final boolean on, final String cb) {
            try { CameraManager cm = (CameraManager) getSystemService(Context.CAMERA_SERVICE); String id = cm.getCameraIdList()[0]; for (String c : cm.getCameraIdList()) { Boolean f = cm.getCameraCharacteristics(c).get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE); if (Boolean.TRUE.equals(f)) { id = c; break; } } cm.setTorchMode(id, on); reply(cb, "true"); }
            catch (Exception e) { reply(cb, "{\"error\":\"Este teléfono no tiene linterna disponible\"}"); }
        }
        @JavascriptInterface public String battery() { try { BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE); Intent i = registerReceiver(null, new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED)); JSONObject o = new JSONObject(); o.put("level", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)); int st = i == null ? 0 : i.getIntExtra(BatteryManager.EXTRA_STATUS, -1); o.put("charging", st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL); if (i != null) { o.put("temp", i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) / 10.0); o.put("voltage", i.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)); } return o.toString(); } catch (Exception e) { return "{\"level\":-1}"; } }
        @JavascriptInterface public void speak(final String text, final float rate) { ui.post(() -> { if (tts == null) tts = new TextToSpeech(MainActivity.this, st -> { if (st == TextToSpeech.SUCCESS) { tts.setLanguage(new Locale("es", "ES")); tts.setSpeechRate(rate); tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cp"); } }); else { tts.setSpeechRate(rate); tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cp"); } }); }
        @JavascriptInterface public void stopSpeak() { ui.post(() -> { if (tts != null) tts.stop(); }); }
        @JavascriptInterface public void location(final String cb) { ui.post(() -> { if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) findLocation(cb); else { pendingLocationCb = cb; requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC); } }); }
        @JavascriptInterface public void saveFile(final String b64, final String name, final String mime, final String cb) {
            new Thread(() -> {
                try {
                    byte[] data = Base64.decode(b64, Base64.DEFAULT);
                    boolean image = mime != null && mime.startsWith("image/");
                    String where;
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name); cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                        String rel = (image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/CrackPro";
                        cv.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
                        Uri col = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                        Uri uri = getContentResolver().insert(col, cv);
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(data); }
                        where = rel + "/" + name;
                    } else {
                        File dir = new File(Environment.getExternalStoragePublicDirectory(image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS), "CrackPro");
                        if (!dir.exists() && !dir.mkdirs()) dir = getExternalFilesDir(null);
                        File f = new File(dir, name); try (FileOutputStream os = new FileOutputStream(f)) { os.write(data); } where = f.getAbsolutePath();
                    }
                    reply(cb, new JSONObject().put("path", where).toString());
                } catch (Exception e) { reply(cb, "{\"error\":" + JSONObject.quote("no se pudo guardar: " + e.getMessage()) + "}"); }
            }).start();
        }
    }
}
