import Foundation
import Capacitor
import CoreLocation

/**
 * 后台定位插件（iOS 本地插件）
 *
 * 与 Android 端保持同一 JS 接口：start / stop / getLocations / clear / isTracking。
 * 采集点先存内存缓冲，JS 定时 drain；这样即使 WebView 在后台被挂起，
 * 只要本插件进程还活着，回到前台就能把整段真实轨迹取回。
 *
 * 接入 Xcode（一次性）：
 *   1. 把本文件拖进 Xcode 的 App 目标（App/App 分组），勾选 App target。
 *   2. 确认 Info.plist 已包含 UIBackgroundModes = location（已配置）。
 *   3. 首次「开始记录」时会申请「始终允许」定位；请在设置里选「始终」。
 *   Capacitor 6 会自动发现实现了 CAPBridgedPlugin 的本地插件，无需手动 registerPlugin。
 */
@objc(BackgroundLocationPlugin)
public class BackgroundLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {

    public let identifier = "BackgroundLocationPlugin"
    public let jsName = "BackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLocations", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isTracking", returnType: CAPPluginReturnPromise)
    ]

    private var manager: CLLocationManager?
    private var buffer: [[String: Any]] = []
    private let lock = NSLock()
    private var tracking = false

    override public func load() {
        manager = CLLocationManager()
        manager?.delegate = self
        manager?.desiredAccuracy = kCLLocationAccuracyBest
        manager?.distanceFilter = 1
        manager?.pausesLocationUpdatesAutomatically = false
        if #available(iOS 9.0, *) {
            manager?.allowsBackgroundLocationUpdates = true
        }
        if #available(iOS 11.0, *) {
            manager?.showsBackgroundLocationIndicator = true
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.lock.lock()
            self.buffer.removeAll()
            self.lock.unlock()

            let status: CLAuthorizationStatus
            if #available(iOS 14.0, *) {
                status = self.manager?.authorizationStatus ?? .notDetermined
            } else {
                status = CLLocationManager.authorizationStatus()
            }
            if status == .notDetermined {
                self.manager?.requestAlwaysAuthorization()
            } else if status == .authorizedWhenInUse {
                self.manager?.requestAlwaysAuthorization()
            }
            self.tracking = true
            self.manager?.startUpdatingLocation()
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.tracking = false
            self.manager?.stopUpdatingLocation()
            call.resolve()
        }
    }

    @objc func getLocations(_ call: CAPPluginCall) {
        lock.lock()
        let arr = buffer
        buffer.removeAll()
        lock.unlock()
        call.resolve(["locations": arr])
    }

    @objc func clear(_ call: CAPPluginCall) {
        lock.lock()
        buffer.removeAll()
        lock.unlock()
        call.resolve()
    }

    @objc func isTracking(_ call: CAPPluginCall) {
        call.resolve(["tracking": tracking])
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        lock.lock()
        for loc in locations {
            let ts = loc.timestamp.timeIntervalSince1970 * 1000.0
            var d: [String: Any] = [
                "latitude": loc.coordinate.latitude,
                "longitude": loc.coordinate.longitude,
                "accuracy": loc.horizontalAccuracy,
                "ts": ts
            ]
            if loc.altitude != 0 {
                d["altitude"] = loc.altitude
            }
            if loc.speed >= 0 {
                d["speed"] = loc.speed
            }
            if loc.course >= 0 {
                d["bearing"] = loc.course
            }
            buffer.append(d)
            if buffer.count > 30000 {
                buffer.removeFirst(buffer.count - 30000)
            }
        }
        lock.unlock()
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // 静默；偶发定位失败不影响后续更新
    }
}
