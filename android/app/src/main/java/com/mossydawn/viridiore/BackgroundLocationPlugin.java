package com.mossydawn.viridiore;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * 后台定位插件（应用内本地插件，非 npm 包）。
 * JS 侧只用到 start / stop / getLocations / clear。
 * 数据通过原生缓冲 + drain 拉取，避免 WebView 后台暂停导致丢点。
 */
@CapacitorPlugin(
        name = "BackgroundLocation",
        permissions = {
                @Permission(
                        alias = "location",
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }
                ),
                @Permission(
                        alias = "background",
                        strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }
                )
        }
)
public class BackgroundLocationPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            doStart(call);
        } else {
            call.reject("需要「精确位置」权限才能记录轨迹，请在系统设置中允许");
        }
    }

    private void doStart(PluginCall call) {
        String title = call.getString("title", "晓山青 · 正在记录轨迹");
        String text = call.getString("text", "后台持续定位中，结束后点「结束并保存」");

        LocationBridge.clear();

        Intent intent = new Intent(getContext(), LocationTrackingService.class);
        intent.setAction(LocationTrackingService.ACTION_START);
        intent.putExtra(LocationTrackingService.EXTRA_TITLE, title);
        intent.putExtra(LocationTrackingService.EXTRA_TEXT, text);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("启动后台定位失败：" + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), LocationTrackingService.class);
            intent.setAction(LocationTrackingService.ACTION_STOP);
            getContext().startService(intent);
        } catch (Exception ignored) {
        }
        try {
            getContext().stopService(new Intent(getContext(), LocationTrackingService.class));
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void getLocations(PluginCall call) {
        List<LocationBridge.Fix> fixes = LocationBridge.drain();
        List<JSObject> list = new ArrayList<>();
        for (LocationBridge.Fix f : fixes) {
            JSObject o = new JSObject();
            o.put("latitude", f.latitude);
            o.put("longitude", f.longitude);
            if (!Double.isNaN(f.altitude)) o.put("altitude", f.altitude);
            if (f.accuracy >= 0) o.put("accuracy", f.accuracy);
            if (f.speed >= 0) o.put("speed", f.speed);
            if (f.bearing >= 0) o.put("bearing", f.bearing);
            o.put("ts", f.time);
            list.add(o);
        }
        JSObject ret = new JSObject();
        ret.put("locations", new JSArray(list));
        call.resolve(ret);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        LocationBridge.clear();
        call.resolve();
    }

    @PluginMethod
    public void isTracking(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("tracking", LocationTrackingService.isRunning());
        call.resolve(ret);
    }
}
