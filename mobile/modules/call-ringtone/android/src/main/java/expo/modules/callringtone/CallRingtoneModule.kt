package expo.modules.callringtone

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallRingtoneModule : Module() {
  private var player: MediaPlayer? = null
  private var focusRequest: AudioFocusRequest? = null

  override fun definition() = ModuleDefinition {
    Name("CallRingtone")

    Function("start") {
      startRingtone()
    }

    Function("stop") {
      stopRingtone()
    }

    Function("ensureIncomingCallChannel") {
      ensureIncomingCallChannel()
    }
  }

  private fun appContextOrNull(): Context? {
    return appContext.reactContext ?: appContext.currentActivity
  }

  private fun startRingtone() {
    val ctx = appContextOrNull() ?: return
    stopRingtone()

    val uri =
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ?: RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        ?: return

    val attrs =
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .setLegacyStreamType(AudioManager.STREAM_RING)
        .build()

    val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(attrs)
          .setOnAudioFocusChangeListener { }
          .build()
      focusRequest = request
      audioManager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(null, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }

    val next = MediaPlayer()
    next.setAudioAttributes(attrs)
    next.isLooping = true
    next.setVolume(1f, 1f)
    next.setDataSource(ctx, uri)
    next.setOnPreparedListener { prepared ->
      if (player === prepared) prepared.start()
    }
    next.setOnErrorListener { _, _, _ ->
      stopRingtone()
      true
    }
    player = next
    next.prepareAsync()
  }

  private fun stopRingtone() {
    val ctx = appContextOrNull()
    try {
      player?.stop()
    } catch (_: Throwable) {
    }
    try {
      player?.release()
    } catch (_: Throwable) {
    }
    player = null

    val audioManager = ctx?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager?.abandonAudioFocus(null)
    }
    focusRequest = null
  }

  private fun ensureIncomingCallChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val ctx = appContextOrNull() ?: return
    val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val id = CHANNEL_ID
    val ringtone =
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ?: RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE)
        ?: android.provider.Settings.System.DEFAULT_RINGTONE_URI

    val existing = manager.getNotificationChannel(id)
    if (existing != null && existing.sound == ringtone) return

    manager.deleteNotificationChannel(id)

    val attrs =
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .setLegacyStreamType(AudioManager.STREAM_RING)
        .build()

    val channel =
      NotificationChannel(id, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Incoming voice and video calls"
        setSound(ringtone, attrs)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
        enableLights(true)
        lightColor = Color.BLUE
      }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "incoming_calls"
  }
}
