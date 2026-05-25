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
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "DeviceStepCounter",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class DeviceStepCounterPlugin extends Plugin {
    private static final String TAG = "DeviceStepCounter";
    private Double lastCounterValue = null;

    @PluginMethod
    public void getCurrentCounter(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasActivityRecognitionPermission()) {
            JSObject ret = new JSObject();
            ret.put("supported", true);
            ret.put("permissionGranted", false);
            ret.put("value", 0);
            call.resolve(ret);
            return;
        }

        readCurrentCounter(call);
    }

    private void readCurrentCounter(PluginCall call) {
        SensorManager sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor stepCounter = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) : null;

        if (sensorManager == null || stepCounter == null) {
            JSObject ret = new JSObject();
            ret.put("supported", false);
            ret.put("permissionGranted", true);
            ret.put("value", 0);
            call.resolve(ret);
            return;
        }

        if (lastCounterValue != null) {
            resolveCounter(call, lastCounterValue);
            return;
        }

        Handler handler = new Handler(Looper.getMainLooper());
        final boolean[] resolved = { false };
        SensorEventListener listener = new SensorEventListener() {

            @Override
            public void onSensorChanged(SensorEvent event) {
                if (resolved[0]) return;
                resolved[0] = true;
                sensorManager.unregisterListener(this);
                lastCounterValue = (double) event.values[0];
                resolveCounter(call, lastCounterValue);
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
            JSObject ret = new JSObject();
            ret.put("supported", true);
            ret.put("permissionGranted", true);
            ret.put("timedOut", true);
            ret.put("value", lastCounterValue == null ? 0 : Math.floor(lastCounterValue));
            ret.put("bootTime", System.currentTimeMillis() - SystemClock.elapsedRealtime());
            call.resolve(ret);
        }, 3000);
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

    private boolean hasActivityRecognitionPermission() {
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED;
    }
}
