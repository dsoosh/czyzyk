package pl.czyzyk.app.photos

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

/** Result of screening one photo: the decision, the text read and (for IMAGE) the JPEG to send. */
class ScreenedPhoto(val screening: Screening, val text: String, val jpeg: ByteArray?)

/**
 * On-device screening with ML Kit models bundled in the APK – nothing is downloaded or sent
 * while analysing (shared-document-screening). Any failure means WITHHELD.
 */
class DocumentScreener(private val resolver: ContentResolver) {
    private val faces = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
            .setMinFaceSize(0.05f)
            .build(),
    )
    private val labels = ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(0.2f).build())
    private val text = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    fun screen(uri: Uri): ScreenedPhoto = try {
        val bitmap = decode(uri)
        if (bitmap == null) {
            ScreenedPhoto(Screening.WITHHELD, "", null)
        } else {
            try {
                analyse(bitmap)
            } finally {
                bitmap.recycle()
            }
        }
    } catch (_: Exception) {
        ScreenedPhoto(Screening.WITHHELD, "", null)
    }

    private fun analyse(bitmap: Bitmap): ScreenedPhoto {
        val input = InputImage.fromBitmap(bitmap, 0)
        val recognised = await(text.process(input))
        val area = (bitmap.width.toFloat() * bitmap.height).coerceAtLeast(1f)
        val covered = recognised.textBlocks.sumOf { b -> b.boundingBox?.let { it.width().toLong() * it.height() } ?: 0L }
        val words = recognised.text.split(Regex("\\s+")).count { it.any(Char::isLetterOrDigit) }
        val facts = ScreeningFacts(
            width = bitmap.width,
            height = bitmap.height,
            words = words,
            textCoverage = (covered / area).coerceIn(0f, 1f),
            faces = await(faces.process(input)).size,
            personLabel = await(labels.process(input)).filter { it.text in ScreeningRule.PERSON_LABELS }.maxOfOrNull { it.confidence } ?: 0f,
        )
        val textOnly = if (recognised.text.isBlank()) ScreenedPhoto(Screening.WITHHELD, "", null) else ScreenedPhoto(Screening.TEXT_ONLY, recognised.text, null)
        return when (ScreeningRule.decide(facts)) {
            Screening.WITHHELD -> ScreenedPhoto(Screening.WITHHELD, "", null)
            Screening.TEXT_ONLY -> textOnly
            Screening.IMAGE -> jpeg(bitmap)?.let { ScreenedPhoto(Screening.IMAGE, recognised.text, it) } ?: textOnly
        }
    }

    /** Scaled to at most [MAX_SIDE] px; the original is not kept, so its EXIF (GPS) never travels. */
    private fun decode(uri: Uri): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null
        val longest = maxOf(decoded.width, decoded.height)
        if (longest <= MAX_SIDE) return decoded
        val scale = MAX_SIDE.toFloat() / longest
        return Bitmap.createScaledBitmap(decoded, (decoded.width * scale).toInt(), (decoded.height * scale).toInt(), true).also {
            if (it !== decoded) decoded.recycle()
        }
    }

    /** JPEG small enough for the server limit (lower quality, then smaller size). */
    private fun jpeg(bitmap: Bitmap): ByteArray? {
        var current = bitmap
        try {
            repeat(4) {
                for (quality in intArrayOf(85, 70, 55)) {
                    val out = ByteArrayOutputStream()
                    current.compress(Bitmap.CompressFormat.JPEG, quality, out)
                    if (out.size() <= MAX_JPEG_BYTES) return out.toByteArray()
                }
                val next = Bitmap.createScaledBitmap(current, current.width * 3 / 4, current.height * 3 / 4, true)
                if (current !== bitmap) current.recycle()
                current = next
            }
            return null
        } finally {
            if (current !== bitmap) current.recycle()
        }
    }

    fun close() {
        faces.close()
        labels.close()
        text.close()
    }

    private fun <T> await(task: Task<T>): T = Tasks.await(task, TIMEOUT_SECONDS, TimeUnit.SECONDS)

    companion object {
        const val MAX_SIDE = 2048
        /** Matches MAX_DOCUMENT_IMAGE_BYTES on the server (1.5 MB). */
        const val MAX_JPEG_BYTES = 1536 * 1024
        private const val TIMEOUT_SECONDS = 5L
    }
}
