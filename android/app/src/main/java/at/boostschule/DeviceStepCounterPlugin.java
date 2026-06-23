package at.boostschule;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "DeviceStepCounter",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class DeviceStepCounterPlugin extends Plugin {
    private static final String TAG = "DeviceStepCounter";

    // ── Sensor step counter ───────────────────────────────────────────────────

    @PluginMethod
    public void getCurrentCounter(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Context ctx = getContext();
            if (ctx == null) {
                JSObject ret = new JSObject();
                ret.put("supported", false);
                ret.put("permissionGranted", false);
                ret.put("value", 0);
                call.resolve(ret);
                return;
            }
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION)
                    != PackageManager.PERMISSION_GRANTED) {
                try {
                    requestPermissionForAlias("activity", call, "handlePermissionResult");
                } catch (Exception e) {
                    Log.w(TAG, "Could not request permission: " + e.getMessage());
                    JSObject ret = new JSObject();
                    ret.put("supported", true);
                    ret.put("permissionGranted", false);
                    ret.put("value", 0);
                    call.resolve(ret);
                }
                return;
            }
        }
        readCurrentCounter(call);
    }

    @PermissionCallback
    private void handlePermissionResult(PluginCall call) {
        if (getPermissionState("activity") == PermissionState.GRANTED) {
            readCurrentCounter(call);
        } else {
            JSObject ret = new JSObject();
            ret.put("supported", true);
            ret.put("permissionGranted", false);
            ret.put("value", 0);
            call.resolve(ret);
        }
    }

    private void readCurrentCounter(PluginCall call) {
        Context ctx = getContext();
        SensorManager sensorManager = ctx != null ? (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE) : null;
        Sensor stepCounter = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) : null;

        if (sensorManager == null || stepCounter == null) {
            JSObject ret = new JSObject();
            ret.put("supported", false);
            ret.put("permissionGranted", true);
            ret.put("value", 0);
            call.resolve(ret);
            return;
        }

        Handler handler = new Handler(Looper.getMainLooper());
        final boolean[] resolved = { false };
        final double[] latestValue = { 0 };

        SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                latestValue[0] = event.values[0];
                if (resolved[0]) return;
                resolved[0] = true;
                sensorManager.unregisterListener(this);
                resolveCounter(call, latestValue[0]);
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };

        boolean registered = sensorManager.registerListener(listener, stepCounter, SensorManager.SENSOR_DELAY_NORMAL);
        if (!registered) {
            JSObject ret = new JSObject();
            ret.put("supported", false);
            ret.put("permissionGranted", true);
            ret.put("value", 0);
            call.resolve(ret);
            return;
        }

        handler.postDelayed(() -> {
            if (resolved[0]) return;
            resolved[0] = true;
            sensorManager.unregisterListener(listener);
            if (latestValue[0] > 0) {
                resolveCounter(call, latestValue[0]);
            } else {
                JSObject ret = new JSObject();
                ret.put("supported", true);
                ret.put("permissionGranted", true);
                ret.put("timedOut", true);
                ret.put("value", 0);
                ret.put("bootTime", System.currentTimeMillis() - SystemClock.elapsedRealtime());
                call.resolve(ret);
            }
        }, 5000);
    }

    private void resolveCounter(PluginCall call, double value) {
        Log.d(TAG, "TYPE_STEP_COUNTER value=" + value);
        JSObject ret = new JSObject();
        ret.put("supported", true);
        ret.put("permissionGranted", true);
        ret.put("value", Math.floor(value));
        ret.put("bootTime", System.currentTimeMillis() - SystemClock.elapsedRealtime());
        call.resolve(ret);
    }
}
