import UIKit
import WebKit
import Capacitor

/// شاشة التطبيق الرئيسية على iOS.
///
/// المحتوى بيترسم بين شريط الحالة وشريط الآيفون (`contentInset: always`)، والشريطين
/// دول لوحين أصليين فوق الـWebView بياخدوا لون أعلى وأسفل الصفحة من طبقة التطبيق —
/// فالمحتوى بيعدّي تحتهم وقت التمرير بدل ما يبان من ورا الساعة والبطارية.
class ZawyaViewController: CAPBridgeViewController {

    private let topBar = UIView()
    private let bottomBar = UIView()

    private static let initialBackground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x14 / 255.0, green: 0x16 / 255.0, blue: 0x2A / 255.0, alpha: 1)
            : UIColor(red: 0xF6 / 255.0, green: 0xF6 / 255.0, blue: 0xF9 / 255.0, alpha: 1)
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ZawyaShellPlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()

        let background = Self.initialBackground
        view.backgroundColor = background
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        webView?.underPageBackgroundColor = background

        /* السحب من طرف الشاشة للرجوع — زي أي تطبيق iOS */
        webView?.allowsBackForwardNavigationGestures = true

        for bar in [topBar, bottomBar] {
            bar.isUserInteractionEnabled = false
            bar.backgroundColor = background
            bar.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(bar)
        }

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),

            bottomBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    func applyChrome(top: UIColor, bottom: UIColor) {
        UIView.animate(withDuration: 0.2) {
            self.topBar.backgroundColor = top
            self.bottomBar.backgroundColor = bottom
        }
        /* لون المساحة اللي بتبان لما الصفحة تتسحب أبعد من أولها */
        webView?.scrollView.backgroundColor = top
        webView?.underPageBackgroundColor = top
    }
}
