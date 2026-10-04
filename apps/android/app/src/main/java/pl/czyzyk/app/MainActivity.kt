package pl.czyzyk.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { CzyzykApp() }
    }
}

@Composable
fun CzyzykApp() {
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(AppInfo.NAME, style = MaterialTheme.typography.headlineMedium)
                Text(AppInfo.TAGLINE, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

object AppInfo {
    const val NAME = "Czyżyk"
    const val TAGLINE = "Źródło danych dla asystenta przedszkolnego"
}

@Preview
@Composable
private fun CzyzykAppPreview() = CzyzykApp()
