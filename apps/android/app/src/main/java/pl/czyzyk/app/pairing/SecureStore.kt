package pl.czyzyk.app.pairing

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Pairing state kept in EncryptedSharedPreferences (device-pairing). Never logged. */
class SecureStore(private val prefs: SharedPreferences) {

    enum class State { NOT_PAIRED, PAIRED, REVOKED }

    var pairing: Pairing?
        get() {
            val server = prefs.getString(KEY_SERVER, null) ?: return null
            val token = prefs.getString(KEY_TOKEN, null) ?: return null
            return Pairing(server, token)
        }
        private set(value) {
            prefs.edit().apply {
                if (value == null) remove(KEY_SERVER).remove(KEY_TOKEN)
                else putString(KEY_SERVER, value.serverUrl).putString(KEY_TOKEN, value.token)
            }.apply()
        }

    val state: State
        get() = when {
            prefs.getBoolean(KEY_REVOKED, false) -> State.REVOKED
            pairing != null -> State.PAIRED
            else -> State.NOT_PAIRED
        }

    fun pair(value: Pairing) {
        pairing = value
        prefs.edit().putBoolean(KEY_REVOKED, false).apply()
    }

    /** Server answered 401: the admin revoked this device. */
    fun markRevoked() {
        pairing = null
        prefs.edit().putBoolean(KEY_REVOKED, true).apply()
    }

    companion object {
        private const val FILE = "czyzyk_secure"
        private const val KEY_SERVER = "server"
        private const val KEY_TOKEN = "token"
        private const val KEY_REVOKED = "revoked"

        @Volatile private var instance: SecureStore? = null

        fun get(context: Context): SecureStore = instance ?: synchronized(this) {
            instance ?: SecureStore(open(context.applicationContext)).also { instance = it }
        }

        private fun open(context: Context): SharedPreferences {
            val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                FILE,
                key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
    }
}
