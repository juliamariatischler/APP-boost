# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Capacitor ──────────────────────────────────────────────────────────────
# R8 darf die @CapacitorPlugin-/@Permission-Annotationen NICHT entfernen,
# sonst liefert getPermissionStates() null -> NullPointerException beim Start
# (z. B. PushNotifications.checkPermissions). Ohne diese Regeln stuerzt der
# minifizierte Release-Build sofort ab; der Debug-Build (ohne Minify) nicht.
-keepattributes *Annotation*, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keep public class com.getcapacitor.** { *; }
-keep public class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}

# Eigenes natives Plugin (Geraete-Schrittzaehler)
-keep class at.boostschule.** { *; }
