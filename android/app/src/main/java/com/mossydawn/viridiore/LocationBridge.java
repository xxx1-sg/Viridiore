package com.mossydawn.viridiore;

import java.util.ArrayList;
import java.util.List;

/**
 * 定位数据总线：前台服务写入，Capacitor 插件读取。
 * 采用「原生缓冲」而不是依赖 WebView 事件，是为了在 App 处于后台、
 * WebView 被系统暂停时依旧不丢点；回到前台后由 JS 一次性 drain 走。
 */
public final class LocationBridge {

    public static final class Fix {
        public final double latitude;
        public final double longitude;
        public final double altitude;
        public final float accuracy;
        public final float speed;
        public final float bearing;
        public final long time;

        Fix(double latitude, double longitude, double altitude, float accuracy, float speed, float bearing, long time) {
            this.latitude = latitude;
            this.longitude = longitude;
            this.altitude = altitude;
            this.accuracy = accuracy;
            this.speed = speed;
            this.bearing = bearing;
            this.time = time;
        }
    }

    private static final Object LOCK = new Object();
    private static final List<Fix> BUFFER = new ArrayList<>();
    private static final int MAX_BUFFER = 30000;

    private LocationBridge() {}

    public static void push(double lat, double lon, double alt, float acc, float spd, float bear, long time) {
        synchronized (LOCK) {
            BUFFER.add(new Fix(lat, lon, alt, acc, spd, bear, time));
            int extra = BUFFER.size() - MAX_BUFFER;
            if (extra > 0) {
                BUFFER.subList(0, extra).clear();
            }
        }
    }

    /** 取走并清空缓冲 */
    public static List<Fix> drain() {
        synchronized (LOCK) {
            List<Fix> copy = new ArrayList<>(BUFFER);
            BUFFER.clear();
            return copy;
        }
    }

    public static void clear() {
        synchronized (LOCK) {
            BUFFER.clear();
        }
    }
}
