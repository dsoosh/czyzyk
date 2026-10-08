package pl.czyzyk.app.photos

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PhotoDecoderTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    private fun photo(width: Int, height: Int): Uri {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply { eraseColor(Color.WHITE) }
        val file = File(context.cacheDir, "photo-${width}x$height.jpg")
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        return Uri.fromFile(file)
    }

    @Test
    fun readsASharedPhotoAndScalesItDown() {
        // A camera-sized photo: wider than the limit, so it is scaled to 2048 px on the longer side.
        val bitmap = PhotoDecoder.decode(context.contentResolver, photo(4000, 3000), 2048)
        assertNotNull(bitmap)
        assertEquals(2048, bitmap!!.width)
        assertEquals(1536, bitmap.height)
    }

    @Test
    fun keepsASmallPhotoAsIsAndRejectsAMissingFile() {
        val bitmap = PhotoDecoder.decode(context.contentResolver, photo(800, 600), 2048)
        assertEquals(800, bitmap!!.width)
        assertNull(PhotoDecoder.decode(context.contentResolver, Uri.fromFile(File(context.cacheDir, "brak.jpg")), 2048))
    }
}
