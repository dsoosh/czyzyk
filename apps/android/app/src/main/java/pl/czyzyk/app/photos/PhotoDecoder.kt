package pl.czyzyk.app.photos

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import java.io.IOException

/**
 * Photo as a software bitmap of at most `maxSide` px (document-import). The original is not
 * kept, so its EXIF (GPS) never travels. From Android 9 ImageDecoder also turns camera photos
 * upright (EXIF orientation) and reads HEIF.
 */
object PhotoDecoder {
    /** Null when the photo cannot be opened or read. */
    fun decode(resolver: ContentResolver, uri: Uri, maxSide: Int): Bitmap? {
        val decoded = try {
            if (Build.VERSION.SDK_INT >= 28) withImageDecoder(resolver, uri, maxSide) else withBitmapFactory(resolver, uri, maxSide)
        } catch (_: IOException) {
            null
        } ?: return null
        val longest = maxOf(decoded.width, decoded.height)
        if (longest <= maxSide) return decoded
        val scale = maxSide.toFloat() / longest
        return Bitmap.createScaledBitmap(decoded, (decoded.width * scale).toInt().coerceAtLeast(1), (decoded.height * scale).toInt().coerceAtLeast(1), true).also {
            if (it !== decoded) decoded.recycle()
        }
    }

    @RequiresApi(28)
    private fun withImageDecoder(resolver: ContentResolver, uri: Uri, maxSide: Int): Bitmap? =
        ImageDecoder.decodeBitmap(ImageDecoder.createSource(resolver, uri)) { decoder, info, _ ->
            // Software memory: ML Kit and JPEG encoding read the pixels.
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val longest = maxOf(info.size.width, info.size.height)
            if (longest > maxSide) {
                val scale = maxSide.toFloat() / longest
                decoder.setTargetSize((info.size.width * scale).toInt().coerceAtLeast(1), (info.size.height * scale).toInt().coerceAtLeast(1))
            }
        }

    private fun withBitmapFactory(resolver: ContentResolver, uri: Uri, maxSide: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        // With inJustDecodeBounds decodeStream always returns null: only the sizes in bounds count.
        val stream = resolver.openInputStream(uri) ?: return null
        stream.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        return resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        }
    }
}
