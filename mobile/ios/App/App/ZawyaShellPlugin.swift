import Foundation
import UIKit
import WebKit
import SafariServices
import Capacitor

/// الطبقة الأصلية لتطبيق زاوية على iOS — نفس دور ZawyaShellPlugin.java على أندرويد:
/// حقن طبقة التطبيق، توجيه الروابط، لون الأشرطة، والحفظ والمشاركة والطباعة.
@objc(ZawyaShellPlugin)
public class ZawyaShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZawyaShellPlugin"
    public let jsName = "ZawyaShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setChrome", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openFile", returnType: CAPPluginReturnPromise)
    ]

    private static let appHosts: Set<String> = ["www.zawyaeg.site", "zawyaeg.site"]

    /// مواقع ليها تطبيقات — بتتفتح في تطبيقها (أو Safari لو مش متسطّب)
    private static let systemHosts: Set<String> = [
        "wa.me", "api.whatsapp.com", "chat.whatsapp.com", "web.whatsapp.com", "whatsapp.com", "www.whatsapp.com",
        "t.me", "telegram.me", "m.me", "maps.google.com", "maps.app.goo.gl", "goo.gl", "maps.apple.com",
        "apps.apple.com", "play.google.com", "facebook.com", "www.facebook.com", "m.facebook.com",
        "instagram.com", "www.instagram.com", "tiktok.com", "www.tiktok.com", "youtube.com", "www.youtube.com",
        "youtu.be", "x.com", "twitter.com", "snapchat.com", "www.snapchat.com"
    ]

    private var toolbarTint = UIColor(red: 0.388, green: 0.294, blue: 0.604, alpha: 1)

    override public func load() {
        injectLayer()
    }

    // MARK: - حقن طبقة التطبيق

    /// الإضافات بتتحمّل قبل ما الـWebView يحمّل أول صفحة، فالسكربت بيلحقها.
    private func injectLayer() {
        guard let url = Bundle.main.url(forResource: "zawya-app", withExtension: "js", subdirectory: "public"),
              let source = try? String(contentsOf: url, encoding: .utf8),
              let webView = bridge?.webView else {
            CAPLog.print("⚡️ ZawyaShell: app layer missing — run `npm run sync`")
            return
        }
        let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(script)
    }

    // MARK: - توجيه الروابط

    @objc override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url,
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = url.host?.lowercased() else {
            return nil
        }
        /* الإطارات الداخلية (معاينة الثيم) بتحمّل عادي */
        if let frame = navigationAction.targetFrame, !frame.isMainFrame {
            return nil
        }
        let opensNewWindow = navigationAction.targetFrame == nil

        if Self.appHosts.contains(host) {
            let isPreview = url.query?.contains("preview=1") ?? false
            /* واجهة المتجر فيها أكواد التاجر — بتتفتح بعيد عن جسر التطبيق */
            if url.path.hasPrefix("/s/") && !isPreview {
                openInApp(url)
                return NSNumber(value: true)
            }
            /* رابط للمنصة بـtarget=_blank: يفضل في نفس الشاشة بدل ما يطلع لـSafari */
            if opensNewWindow {
                DispatchQueue.main.async { [weak self] in
                    _ = self?.bridge?.webView?.load(navigationAction.request)
                }
                return NSNumber(value: true)
            }
            return nil
        }

        if Self.systemHosts.contains(host) {
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            return NSNumber(value: true)
        }

        openInApp(url)
        return NSNumber(value: true)
    }

    private func openInApp(_ url: URL) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let presenter = self.bridge?.viewController else { return }
            let safari = SFSafariViewController(url: url)
            safari.preferredControlTintColor = self.toolbarTint
            safari.dismissButtonStyle = .close
            presenter.present(safari, animated: true)
        }
    }

    // MARK: - ألوان الأشرطة

    @objc func setChrome(_ call: CAPPluginCall) {
        let top = UIColor(zawyaHex: call.getString("top") ?? "")
        let bottom = UIColor(zawyaHex: call.getString("bottom") ?? "")
        DispatchQueue.main.async { [weak self] in
            if let controller = self?.bridge?.viewController as? ZawyaViewController, let top = top, let bottom = bottom {
                controller.applyChrome(top: top, bottom: bottom)
            }
            call.resolve()
        }
    }

    // MARK: - الطباعة

    @objc func print(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "زاوية"
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.bridge?.webView, let controller = self?.bridge?.viewController else {
                call.reject("WebView unavailable")
                return
            }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = title.isEmpty ? "زاوية" : title
            let printer = UIPrintInteractionController.shared
            printer.printInfo = info
            printer.printFormatter = webView.viewPrintFormatter()
            let done: UIPrintInteractionController.CompletionHandler = { _, completed, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["completed": completed])
                }
            }
            if UIDevice.current.userInterfaceIdiom == .pad {
                let rect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
                printer.present(from: rect, in: controller.view, animated: true, completionHandler: done)
            } else {
                printer.present(animated: true, completionHandler: done)
            }
        }
    }

    // MARK: - الملفات

    /// الحفظ على iOS = شاشة المشاركة، وفيها «حفظ في الملفات» — ده المتوقَّع هنا.
    @objc func saveFile(_ call: CAPPluginCall) {
        guard let data = call.getString("data"), let bytes = Data(base64Encoded: data, options: .ignoreUnknownCharacters) else {
            call.reject("Missing data")
            return
        }
        do {
            let url = try writeTemporary(name: call.getString("name") ?? "zawya-file", bytes: bytes)
            presentShare(items: [url], call: call)
        } catch {
            call.reject("Save failed: \(error.localizedDescription)")
        }
    }

    @objc func shareFiles(_ call: CAPPluginCall) {
        let files = call.getArray("files", JSObject.self) ?? []
        var items: [Any] = []
        do {
            for file in files {
                guard let data = file["data"] as? String,
                      let bytes = Data(base64Encoded: data, options: .ignoreUnknownCharacters) else { continue }
                items.append(try writeTemporary(name: (file["name"] as? String) ?? "zawya-file", bytes: bytes))
            }
        } catch {
            call.reject("Share failed: \(error.localizedDescription)")
            return
        }
        if items.isEmpty {
            call.reject("No files")
            return
        }
        if let text = call.getString("text"), !text.isEmpty {
            items.append(text)
        }
        presentShare(items: items, call: call)
    }

    /// على أندرويد بتفتح الملف بعد حفظه. على iOS شاشة المشاركة بتغني عنها.
    @objc func openFile(_ call: CAPPluginCall) {
        call.resolve()
    }

    private func writeTemporary(name: String, bytes: Data) throws -> URL {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("zawya-files", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let clean = name.components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|")).joined(separator: "-")
        let url = folder.appendingPathComponent(clean.isEmpty ? "zawya-file" : clean)
        try bytes.write(to: url, options: .atomic)
        return url
    }

    private func presentShare(items: [Any], call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.bridge?.viewController else {
                call.reject("No view controller")
                return
            }
            let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
            if let popover = activity.popoverPresentationController {
                popover.sourceView = controller.view
                popover.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.maxY - 80, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            activity.completionWithItemsHandler = { _, completed, _, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else if completed {
                    call.resolve(["completed": true])
                } else {
                    call.reject("Share canceled")
                }
            }
            controller.present(activity, animated: true)
        }
    }
}

extension UIColor {
    convenience init?(zawyaHex: String) {
        var hex = zawyaHex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}
