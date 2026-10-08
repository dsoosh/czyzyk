package pl.czyzyk.app.capture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import pl.czyzyk.app.MainActivity
import pl.czyzyk.app.R
import pl.czyzyk.app.work.Deps

/**
 * Keeps Czyżyk Connect running (notification-capture): a foreground service with a quiet
 * notification, so Android does not kill the process and unbind the notification reader.
 * Every few minutes it also checks that the reader is still bound.
 */
class ReaderService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val check = object : Runnable {
        override fun run() {
            ListenerWatchdog.ensureBound(this@ReaderService)
            handler.postDelayed(this, CHECK_MILLIS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!Deps.state(this).readerServiceEnabled) {
            stopSelf()
            return START_NOT_STICKY
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification(),
            if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0,
        )
        handler.removeCallbacks(check)
        handler.postDelayed(check, CHECK_MILLIS)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(check)
        super.onDestroy()
    }

    private fun notification() = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(R.drawable.ic_stat_reader)
        .setContentTitle("Czyżyk czyta powiadomienia")
        .setContentText("Dzięki temu Android nie wyłącza odczytu wiadomości z grup.")
        .setPriority(NotificationCompat.PRIORITY_MIN)
        .setOngoing(true)
        .setShowWhen(false)
        .setContentIntent(
            PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
        )
        .build()

    companion object {
        private const val TAG = "ReaderService"
        private const val CHANNEL = "reader"
        private const val NOTIFICATION_ID = 41
        private const val CHECK_MILLIS = 5 * 60 * 1000L

        /** Starts the service when the user keeps it on and notification access is granted; never throws. */
        fun start(context: Context) {
            if (!Deps.state(context).readerServiceEnabled || !ListenerWatchdog.hasAccess(context)) return
            createChannel(context)
            try {
                context.startForegroundService(Intent(context, ReaderService::class.java))
            } catch (e: Exception) {
                // Android 12+ refuses some background starts; the next app start or sync tries again.
                Log.w(TAG, "reader service not started: ${e.javaClass.simpleName}")
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ReaderService::class.java))
        }

        private fun createChannel(context: Context) {
            val channel = NotificationChannel(CHANNEL, "Odczyt powiadomień", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Stałe powiadomienie, które chroni odczyt wiadomości z grup przed wyłączeniem przez system."
                setShowBadge(false)
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
