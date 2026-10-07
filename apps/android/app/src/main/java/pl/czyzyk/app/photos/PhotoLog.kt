package pl.czyzyk.app.photos

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** A screened document waiting for upload; the JPEG lives in the app's private files. */
data class PendingDocument(
    val rowId: Long,
    val idempotencyKey: String,
    val fileName: String,
    val screening: Screening,
    val text: String,
    val imagePath: String?,
    val attempts: Int,
    val createdAt: Long,
)

/**
 * Local memory of the photo flow (document-import): photo notices (time and tracked message
 * only), WhatsApp image files already handled, and documents waiting for upload.
 */
class PhotoLog(context: Context, name: String? = DB_NAME) : SQLiteOpenHelper(context, name, null, VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("create table notes (key text primary key, seen_at integer not null, tracked_key text, group_name text)")
        db.execSQL("create index notes_seen_idx on notes (seen_at)")
        db.execSQL("create table handled (media_id integer primary key, handled_at integer not null)")
        createV2(db)
        db.execSQL(
            """
            create table outbox (
              id integer primary key autoincrement,
              idempotency_key text not null,
              file_name text not null,
              screening text not null,
              text text not null,
              image_path text,
              attempts integer not null default 0,
              created_at integer not null,
              unique (idempotency_key, file_name)
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) createV2(db)
    }

    /** Version 2: notification previews of tracked photos, and messages that already got a file. */
    private fun createV2(db: SQLiteDatabase) {
        db.execSQL("create table if not exists previews (key text primary key, path text not null, seen_at integer not null)")
        db.execSQL("create table if not exists matched (key text primary key, matched_at integer not null)")
    }

    /** A tracked photo's notification preview, copied to private storage (null when already known). */
    fun addPreview(key: String, path: String, now: Long = System.currentTimeMillis()): Boolean {
        val values = ContentValues().apply {
            put("key", key)
            put("path", path)
            put("seen_at", now)
        }
        return writableDatabase.insertWithOnConflict("previews", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }

    fun hasPreview(key: String): Boolean =
        readableDatabase.rawQuery("select 1 from previews where key = ?", arrayOf(key)).use { it.moveToFirst() }

    /** Previews seen before [before], oldest first: (key, path). */
    fun previewsBefore(before: Long): List<Pair<String, String>> =
        readableDatabase.rawQuery("select key, path from previews where seen_at <= ? order by seen_at", arrayOf(before.toString())).use { c ->
            buildList { while (c.moveToNext()) add(c.getString(0) to c.getString(1)) }
        }

    fun removePreview(key: String) {
        writableDatabase.delete("previews", "key = ?", arrayOf(key))
    }

    /** The message got its photo from "WhatsApp Images"; its preview is not needed. */
    fun markMatched(key: String, now: Long = System.currentTimeMillis()) {
        val values = ContentValues().apply {
            put("key", key)
            put("matched_at", now)
        }
        writableDatabase.insertWithOnConflict("matched", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun isMatched(key: String): Boolean =
        readableDatabase.rawQuery("select 1 from matched where key = ?", arrayOf(key)).use { it.moveToFirst() }

    /** Tracked photo notices since [since] (for a photo shared by hand). */
    fun trackedNotesSince(since: Long): List<PhotoNote> = notesBetween(since, Long.MAX_VALUE).filter { it.trackedKey != null }

    /** The first sighting counts: a re-shown notification keeps its original time. */
    fun addNote(note: PhotoNote): Boolean {
        val values = ContentValues().apply {
            put("key", note.key)
            put("seen_at", note.seenAt)
            put("tracked_key", note.trackedKey)
            put("group_name", note.groupName)
        }
        return writableDatabase.insertWithOnConflict("notes", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }

    fun notesBetween(from: Long, to: Long): List<PhotoNote> =
        readableDatabase.rawQuery(
            "select key, seen_at, tracked_key, group_name from notes where seen_at between ? and ? order by seen_at",
            arrayOf(from.toString(), to.toString()),
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(PhotoNote(c.getString(0), c.getLong(1), c.getString(2).takeUnless { c.isNull(2) }, c.getString(3).takeUnless { c.isNull(3) }))
                }
            }
        }

    fun isHandled(mediaId: Long): Boolean =
        readableDatabase.rawQuery("select 1 from handled where media_id = ?", arrayOf(mediaId.toString())).use { it.moveToFirst() }

    fun markHandled(mediaId: Long, now: Long = System.currentTimeMillis()) {
        val values = ContentValues().apply {
            put("media_id", mediaId)
            put("handled_at", now)
        }
        writableDatabase.insertWithOnConflict("handled", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun enqueueDocument(idempotencyKey: String, fileName: String, screening: Screening, text: String, imagePath: String?, now: Long = System.currentTimeMillis()): Boolean {
        val values = ContentValues().apply {
            put("idempotency_key", idempotencyKey)
            put("file_name", fileName)
            put("screening", screening.name)
            put("text", text)
            put("image_path", imagePath)
            put("created_at", now)
        }
        return writableDatabase.insertWithOnConflict("outbox", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }

    fun pendingDocuments(limit: Int = 20): List<PendingDocument> =
        readableDatabase.rawQuery("select * from outbox order by id limit ?", arrayOf(limit.toString())).use { c ->
            buildList {
                while (c.moveToNext()) {
                    val col = { n: String -> c.getColumnIndexOrThrow(n) }
                    add(
                        PendingDocument(
                            rowId = c.getLong(col("id")),
                            idempotencyKey = c.getString(col("idempotency_key")),
                            fileName = c.getString(col("file_name")),
                            screening = Screening.valueOf(c.getString(col("screening"))),
                            text = c.getString(col("text")),
                            imagePath = if (c.isNull(col("image_path"))) null else c.getString(col("image_path")),
                            attempts = c.getInt(col("attempts")),
                            createdAt = c.getLong(col("created_at")),
                        ),
                    )
                }
            }
        }

    fun removeDocument(rowId: Long) {
        writableDatabase.delete("outbox", "id = ?", arrayOf(rowId.toString()))
    }

    fun markAttempt(rowId: Long) {
        writableDatabase.execSQL("update outbox set attempts = attempts + 1 where id = ?", arrayOf(rowId))
    }

    /** Notices and handled files older than [KEEP_MILLIS] are no longer needed for matching. */
    fun prune(now: Long = System.currentTimeMillis()) {
        writableDatabase.delete("notes", "seen_at < ?", arrayOf((now - KEEP_MILLIS).toString()))
        writableDatabase.delete("handled", "handled_at < ?", arrayOf((now - KEEP_MILLIS * 7).toString()))
        writableDatabase.delete("matched", "matched_at < ?", arrayOf((now - KEEP_MILLIS).toString()))
    }

    companion object {
        const val DB_NAME = "photos.db"
        private const val VERSION = 2
        /** WhatsApp images older than this are not looked at. */
        const val KEEP_MILLIS = 2 * 24 * 60 * 60 * 1000L

        @Volatile private var instance: PhotoLog? = null

        fun get(context: Context): PhotoLog = instance ?: synchronized(this) {
            instance ?: PhotoLog(context.applicationContext).also { instance = it }
        }
    }
}
