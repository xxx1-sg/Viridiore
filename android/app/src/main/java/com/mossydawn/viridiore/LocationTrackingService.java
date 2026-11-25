package com.mossydawn.viridiore;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;

/**
 * 轨迹记录前台服务。
 * 用系统 LocationManager 持续采集（GPS + 网络），即使锁屏 / App 在后台也能继续跑，
 * 采集点写入 LocationBridge，等 WebView 回到前台后由 JS 取走。
 */
public class LocationTrackingService extends Service implements LocationListener {

    private static final String TAG = "XMQLocationService";

    public static final String CHANNEL_ID = "xmq_track_location";
    public static final int NOTIFICATION_ID = 4711;

    public static final String ACTION_START = "com.mossydawn.viridiore.action.START_TRACK";
    public static final String ACTION_STOP = "com.mossydawn.viridiore.action.STOP_TRACK";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";

    private static volatile boolean running = false;

    private LocationManager locationManager;

    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String text = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
        Notification notification = buildNotification(
                title != null ? title : "晓山青 · 正在记录轨迹",
                text != null ? text : "后台持续定位中，回到 App 点「结束并保存」"
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
        }

        startUpdates();
        running = true;
        return START_NOT_STICKY;
    }

    private void startUpdates() {
        if (locationManager == null) {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        }
        try {
            // 只在「刚刚」的已知点才先塞一个，避免几小时前异地缓存点把轨迹拉出直线
            Location last = null;
            try {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                }
                if (last == null && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    last = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                }
            } catch (Exception ignored) {
            }
            long ageMs = last != null ? (System.currentTimeMillis() - last.getTime()) : Long.MAX_VALUE;
            boolean fresh = ageMs >= 0 && ageMs < 20000L && (!last.hasAccuracy() || last.getAccuracy() <= 100f);
            if (fresh) {
                onLocationChanged(last);
            }

            // 1 秒 / 1 米，优先 GPS；网络定位兜底
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER, 1000L, 1f, this, Looper.getMainLooper());
            }
            try {
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER, 2000L, 1f, this, Looper.getMainLooper());
                }
            } catch (Exception ignored) {
            }
        } catch (SecurityException se) {
            Log.e(TAG, "location permission missing", se);
        } catch (Exception e) {
            Log.e(TAG, "startUpdates failed", e);
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;
        LocationBridge.push(
                location.getLatitude(),
                location.getLongitude(),
                location.hasAltitude() ? location.getAltitude() : Double.NaN,
                location.hasAccuracy() ? location.getAccuracy() : -1f,
                location.hasSpeed() ? location.getSpeed() : -1f,
                location.hasBearing() ? location.getBearing() : -1f,
                location.getTime()
        );
    }

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onDestroy() {
        running = false;
        try {
            if (locationManager != null) {
                locationManager.removeUpdates(this);
            }
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, "轨迹记录", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("后台记录徒步轨迹时显示的常驻通知");
                channel.setShowBadge(false);
                nm.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, open, piFlags);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        int icon = getApplicationInfo().icon;
        if (icon == 0) icon = android.R.drawable.ic_menu_mylocation;
        builder.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(icon)
                .setOngoing(true)
                .setContentIntent(pendingIntent);
        return builder.build();
    }
}
