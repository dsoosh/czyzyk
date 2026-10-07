package pl.czyzyk.app.photos

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import pl.czyzyk.app.net.SendResult
import pl.czyzyk.app.pairing.Pairing
import pl.czyzyk.app.work.Deps
import java.io.File
import java.util.Base64

/**
 * Photos from tracked groups (document-import): new files in "WhatsApp Images" are matched to
 * photo notifications by time, screened on the phone, and only documents are sent – the image
 * when no people were found, otherwise just its text. Everything else stays on the phone.
 */
class PhotoWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val state = Deps.state(applicationContext)
        if (!state.photosEnabled) return Result.success()
        val pairing = Deps.store(applicationContext).pairing ?: return Result.success()
        val log = Deps.photos(applicationContext)
        log.prune()
        if (canReadImages(applicationContext)) screenNewImages(log)
        screenPreviews(log)
        return sendDocuments(pairing, log)
    }

    private fun screenNewImages(log: PhotoLog) {
        val now = System.currentTimeMillis()
        val images = whatsAppImages(applicationContext, now - PhotoLog.KEEP_MILLIS).filterNot { log.isHandled(it.id) }
        if (images.isEmpty()) return
        val screener = DocumentScreener(applicationContext.contentResolver)
        try {
            for (image in images.take(MAX_IMAGES_PER_RUN)) {
                val notes = log.notesBetween(image.addedAt - PhotoMatcher.BEFORE_MILLIS, image.addedAt + PhotoMatcher.AFTER_MILLIS)
                when (val match = PhotoMatcher.match(image, notes)) {
                    // The notice may not be handled yet; give it an hour.
                    PhotoMatch.NoNotification -> if (now - image.addedAt > NOTICE_GRACE_MILLIS) log.markHandled(image.id)
                    PhotoMatch.Ambiguous -> log.markHandled(image.id)
                    is PhotoMatch.Message -> {
                        val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, image.id)
                        log.markMatched(match.idempotencyKey)
                        keep(applicationContext, log, screener.screen(uri), match.idempotencyKey, image.name, "${image.id}")
                        log.markHandled(image.id)
                    }
                }
            }
        } finally {
            screener.close()
        }
    }

    /**
     * Notification previews of tracked photos (groups with chat privacy never save the file):
     * screened like files once WhatsApp had time to save the photo itself, which wins.
     */
    private fun screenPreviews(log: PhotoLog) {
        val ready = log.previewsBefore(System.currentTimeMillis() - PREVIEW_WAIT_MILLIS)
        if (ready.isEmpty()) return
        val screener = DocumentScreener(applicationContext.contentResolver)
        try {
            for ((key, path) in ready) {
                val file = File(path)
                if (!log.isMatched(key) && file.exists()) {
                    keep(applicationContext, log, screener.screen(android.net.Uri.fromFile(file)), key, "podglad-${key.take(8)}.jpg", "p-$key")
                }
                file.delete()
                log.removePreview(key)
            }
        } finally {
            screener.close()
        }
    }

    private fun sendDocuments(pairing: Pairing, log: PhotoLog): Result {
        val api = Deps.api()
        val state = Deps.state(applicationContext)
        val now = System.currentTimeMillis()
        for (doc in log.pendingDocuments()) {
            val file = doc.imagePath?.let(::File)
            val image = file?.takeIf { it.exists() }?.readBytes()
            if (doc.screening == Screening.IMAGE && image == null) {
                log.removeDocument(doc.rowId)
                continue
            }
            val result = api.sendDocument(pairing, doc, image?.let { Base64.getEncoder().encodeToString(it) })
            when (result) {
                SendResult.Delivered, is SendResult.Rejected -> {
                    if (result == SendResult.Delivered) state.incrementDocumentsSent()
                    file?.delete()
                    log.removeDocument(doc.rowId)
                }
                SendResult.Unauthorized -> {
                    Deps.store(applicationContext).markRevoked()
                    return Result.failure()
                }
                // 404 until the message itself is delivered; give up after a while.
                is SendResult.Retry -> {
                    if (doc.attempts + 1 >= MAX_ATTEMPTS || now - doc.createdAt > PhotoLog.KEEP_MILLIS) {
                        file?.delete()
                        log.removeDocument(doc.rowId)
                    } else {
                        log.markAttempt(doc.rowId)
                        return Result.retry()
                    }
                }
            }
        }
        return Result.success()
    }

    companion object {
        private const val MAX_IMAGES_PER_RUN = 100
        private const val MAX_ATTEMPTS = 30
        private const val NOTICE_GRACE_MILLIS = 60 * 60 * 1000L
        /** A saved photo is preferred; its preview is used only when no file came in this time. */
        private const val PREVIEW_WAIT_MILLIS = 60 * 1000L

        /** Queues a screened photo for upload; a withheld one only counts. */
        fun keep(context: Context, log: PhotoLog, screened: ScreenedPhoto, idempotencyKey: String, fileName: String, fileId: String) {
            if (screened.screening == Screening.WITHHELD) {
                Deps.state(context).incrementPhotosWithheld()
                return
            }
            val path = screened.jpeg?.let { bytes -> File(documentsDir(context), "$fileId.jpg").apply { writeBytes(bytes) }.absolutePath }
            log.enqueueDocument(idempotencyKey, fileName, screened.screening, screened.text, path)
        }

        fun canReadImages(context: Context): Boolean = ContextCompat.checkSelfPermission(context, imagePermission()) == PackageManager.PERMISSION_GRANTED

        fun imagePermission(): String =
            if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_IMAGES else Manifest.permission.READ_EXTERNAL_STORAGE

        private fun documentsDir(context: Context) = File(context.filesDir, "documents").apply { mkdirs() }

        /** Received WhatsApp images (not the "Sent" folder) added since [sinceMillis]. */
        fun whatsAppImages(context: Context, sinceMillis: Long): List<MediaImage> {
            val pathColumn = if (Build.VERSION.SDK_INT >= 29) MediaStore.Images.Media.RELATIVE_PATH else "_data"
            val projection = arrayOf(MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME, MediaStore.Images.Media.DATE_ADDED)
            val selection = "${MediaStore.Images.Media.DATE_ADDED} >= ? and $pathColumn like ? and $pathColumn not like ?"
            val args = arrayOf((sinceMillis / 1000).toString(), "%WhatsApp Images%", "%Sent%")
            return context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                args,
                "${MediaStore.Images.Media.DATE_ADDED} asc",
            )?.use { c ->
                buildList {
                    while (c.moveToNext()) add(MediaImage(c.getLong(0), c.getString(1) ?: "${c.getLong(0)}.jpg", c.getLong(2) * 1000))
                }
            }.orEmpty()
        }
    }
}
