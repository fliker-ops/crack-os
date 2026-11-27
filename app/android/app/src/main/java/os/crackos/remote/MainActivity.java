package os.crackos.remote;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Crack Remote: contenedor nativo de la interfaz web (WebView) con un puente a funciones del telefono. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "http://appassets.androidplatform.net";
    private static final int REQ_FILE = 41, REQ_LOC = 42;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingLocationCb;
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
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (r.getUrl().toString().startsWith(ORIGIN)) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl()));
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    Intent i = p.createIntent();
                    if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(i, REQ_FILE);
                } catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "CrackNative");
        web.loadUrl(ORIGIN + "/assets/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.crkBack ? String(window.crkBack()) : 'false'", v -> {
            if (!"\"true\"".equals(v) && !"true".equals(v)) finish();
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE && fileCallback != null) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    out = new Uri[data.getClipData().getItemCount()];
                    for (int i = 0; i < out.length; i++) out[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) out = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(out);
            fileCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        if (req == REQ_LOC && pendingLocationCb != null) {
            String cb = pendingLocationCb; pendingLocationCb = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) findLocation(cb);
            else reply(cb, "{\"error\":\"permiso de ubicación negado\"}");
        }
    }

    private void reply(String cb, String json) {
        ui.post(() -> web.evaluateJavascript("window.__crkCb(" + JSONObject.quote(cb) + "," + JSONObject.quote(json) + ")", null));
    }

    @SuppressWarnings("MissingPermission")
    private void findLocation(final String cb) {
        final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        Location best = null;
        for (String p : lm.getProviders(true)) {
            Location l = lm.getLastKnownLocation(p);
            if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
        }
        final Location last = best;
        String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER
                : lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : null;
        if (provider == null) {
            if (last != null) reply(cb, locJson(last)); else reply(cb, "{\"error\":\"ubicación desactivada\"}");
            return;
        }
        final boolean[] done = {false};
        final LocationListener ll = new LocationListener() {
            @Override public void onLocationChanged(Location l) { if (!done[0]) { done[0] = true; lm.removeUpdates(this); reply(cb, locJson(l)); } }
            @Override public void onStatusChanged(String p, int s, Bundle b) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onProviderDisabled(String p) {}
        };
        lm.requestLocationUpdates(provider, 0, 0, ll, Looper.getMainLooper());
        ui.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true; lm.removeUpdates(ll);
            if (last != null) reply(cb, locJson(last)); else reply(cb, "{\"error\":\"sin señal de GPS\"}");
        }, 12000);
    }

    private String locJson(Location l) {
        try {
            JSONObject o = new JSONObject();
            o.put("lat", l.getLatitude()); o.put("lon", l.getLongitude()); o.put("acc", l.getAccuracy()); o.put("src", l.getProvider());
            return o.toString();
        } catch (Exception e) { return "{\"error\":\"ubicación inválida\"}"; }
    }

    private static Inet4Address localIPv4() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses())
                    if (ia.getAddress() instanceof Inet4Address && ia.getAddress().isSiteLocalAddress()) return (Inet4Address) ia.getAddress();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private class Bridge {
        @JavascriptInterface public String appVersion() { return "1.0"; }
        @JavascriptInterface public String deviceName() { return Build.MANUFACTURER + " " + Build.MODEL; }
        @JavascriptInterface public String demoHost() { return getIntent().getStringExtra("demo"); }

        @JavascriptInterface public void vibrate(long ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(ms, 1000)), VibrationEffect.DEFAULT_AMPLITUDE));
        }

        @JavascriptInterface public void keepAwake(final boolean on) {
            ui.post(() -> { if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }

        @JavascriptInterface public void setOrientation(final String mode) {
            ui.post(() -> setRequestedOrientation("landscape".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        }

        @JavascriptInterface public void localSubnet(final String cb) {
            Inet4Address a = localIPv4();
            if (a == null) { reply(cb, "null"); return; }
            String ip = a.getHostAddress();
            reply(cb, JSONObject.quote(ip.substring(0, ip.lastIndexOf('.'))));
        }

        /** Busca PCs con Crack OS: manda "CRACKOS_DISCOVER" por broadcast UDP y junta las respuestas. */
        @JavascriptInterface public void discover(final int port, final String cb) {
            new Thread(() -> {
                JSONArray out = new JSONArray();
                Set<String> seen = new HashSet<>();
                try (DatagramSocket sock = new DatagramSocket()) {
                    sock.setBroadcast(true);
                    sock.setSoTimeout(400);
                    byte[] msg = "CRACKOS_DISCOVER".getBytes();
                    Set<InetAddress> targets = new HashSet<>();
                    targets.add(InetAddress.getByName("255.255.255.255"));
                    for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces()))
                        for (InterfaceAddress ia : ni.getInterfaceAddresses()) if (ia.getBroadcast() != null) targets.add(ia.getBroadcast());
                    long end = System.currentTimeMillis() + 2000;
                    int round = 0;
                    while (System.currentTimeMillis() < end) {
                        if (round++ % 3 == 0) for (InetAddress t : targets) try { sock.send(new DatagramPacket(msg, msg.length, t, port)); } catch (Exception ignored) {}
                        byte[] buf = new byte[1024];
                        DatagramPacket p = new DatagramPacket(buf, buf.length);
                        try {
                            sock.receive(p);
                            String host = p.getAddress().getHostAddress();
                            if (seen.add(host)) {
                                JSONObject j = new JSONObject(new String(p.getData(), 0, p.getLength()));
                                JSONObject pc = new JSONObject();
                                pc.put("host", host); pc.put("port", j.optInt("port", port)); pc.put("name", j.optString("name", host)); pc.put("agent", j.optString("agent"));
                                out.put(pc);
                            }
                        } catch (SocketTimeoutException ignored) {}
                    }
                } catch (Exception e) {
                    reply(cb, "[]");
                    return;
                }
                reply(cb, out.toString());
            }).start();
        }

        @JavascriptInterface public void location(final String cb) {
            ui.post(() -> {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) findLocation(cb);
                else { pendingLocationCb = cb; requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC); }
            });
        }

        /** Guarda un archivo (base64) en Descargas o Imagenes/CrackOS del telefono. */
        @JavascriptInterface public void saveFile(final String b64, final String name, final String mime, final String cb) {
            new Thread(() -> {
                try {
                    byte[] data = Base64.decode(b64, Base64.DEFAULT);
                    boolean image = mime != null && mime.startsWith("image/");
                    String where;
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                        cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                        String rel = image ? Environment.DIRECTORY_PICTURES + "/CrackOS" : Environment.DIRECTORY_DOWNLOADS + "/CrackOS";
                        cv.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
                        Uri col = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                        Uri uri = getContentResolver().insert(col, cv);
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(data); }
                        where = rel + "/" + name;
                    } else {
                        File dir = new File(Environment.getExternalStoragePublicDirectory(image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS), "CrackOS");
                        if (!dir.exists() && !dir.mkdirs()) dir = getExternalFilesDir(null);
                        File f = new File(dir, name);
                        try (FileOutputStream os = new FileOutputStream(f)) { os.write(data); }
                        where = f.getAbsolutePath();
                    }
                    reply(cb, new JSONObject().put("path", where).toString());
                } catch (Exception e) {
                    reply(cb, "{\"error\":" + JSONObject.quote("no se pudo guardar: " + e.getMessage()) + "}");
                }
            }).start();
        }

        @JavascriptInterface public void share(final String b64, final String name, final String mime, final String cb) {
            saveFile(b64, name, mime, cb);
        }
    }
}
