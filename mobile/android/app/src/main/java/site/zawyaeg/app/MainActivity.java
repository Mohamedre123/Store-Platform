package site.zawyaeg.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* لازم قبل super: الجسر بيتبني جوّاه وبيحمّل أول صفحة على طول */
        registerPlugin(ZawyaShellPlugin.class);
        super.onCreate(savedInstanceState);
        /* شاشة الافتتاح المتحركة فوق الـWebView من أول فريم — الطبقة بتقفلها لما اللوحة تجهز */
        LaunchOverlay.show(this);
    }
}
