package pl.czyzyk.app.queue

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import pl.czyzyk.app.capture.CapturedMessage

data class QueuedMessage(val rowId: Long, val message: CapturedMessage, val attempts: Int)

/**
 * Persistent outbox (notification-capture: delivery despite no network). Every captured
 * message is stored here before any upload attempt and removed only when the server has
 * answered for it, so it survives offline periods, process death and reboots.
 * The idempotency key is unique, so a re-shown notification is stored once.
 */
class MessageQueue(context: Context, name: String? = DB_NAME) :
    SQLiteOpenHelper(context, name, null, VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            create table pending (
              id integer primary key autoincrement,
              idempotency_key text not null unique,
              wa_package text not null,
              group_name text not null,
              author text not null,
              text text not null,
              sent_at integer not null,
              has_attachment integer not null,
              attempts integer not null default 0,
              created_at integer not null
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    /** Returns true when the message was new. */
    fun enqueue(m: CapturedMessage, now: Long = System.currentTimeMillis()): Boolean {
        val values = ContentValues().apply {
            put("idempotency_key", m.idempotencyKey)
            put("wa_package", m.waPackage)
            put("group_name", m.groupName)
            put("author", m.author)
            put("text", m.text)
            put("sent_at", m.sentAtMillis)
            put("has_attachment", if (m.hasAttachment) 1 else 0)
            put("created_at", now)
        }
        return writableDatabase.insertWithOnConflict("pending", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }

    fun oldest(limit: Int): List<QueuedMessage> =
        readableDatabase.rawQuery("select * from pending order by id limit ?", arrayOf(limit.toString())).use { c ->
            buildList {
                while (c.moveToNext()) {
                    val col = { n: String -> c.getColumnIndexOrThrow(n) }
                    add(
                        QueuedMessage(
                            rowId = c.getLong(col("id")),
                            attempts = c.getInt(col("attempts")),
                            message = CapturedMessage(
                                waPackage = c.getString(col("wa_package")),
                                groupName = c.getString(col("group_name")),
                                author = c.getString(col("author")),
                                text = c.getString(col("text")),
                                sentAtMillis = c.getLong(col("sent_at")),
                                hasAttachment = c.getInt(col("has_attachment")) == 1,
                                idempotencyKey = c.getString(col("idempotency_key")),
                            ),
                        ),
                    )
                }
            }
        }

    fun remove(rowId: Long) {
        writableDatabase.delete("pending", "id = ?", arrayOf(rowId.toString()))
    }

    fun markAttempt(rowId: Long) {
        writableDatabase.execSQL("update pending set attempts = attempts + 1 where id = ?", arrayOf(rowId))
    }

    fun size(): Int = readableDatabase.rawQuery("select count(*) from pending", null).use { c ->
        c.moveToFirst()
        c.getInt(0)
    }

    companion object {
        const val DB_NAME = "outbox.db"
        private const val VERSION = 1

        @Volatile private var instance: MessageQueue? = null

        fun get(context: Context): MessageQueue = instance ?: synchronized(this) {
            instance ?: MessageQueue(context.applicationContext).also { instance = it }
        }
    }
}
