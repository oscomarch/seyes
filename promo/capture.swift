import AppKit
import WebKit

/*
 * Renders a scene as raw 1080 x 1920 RGBA frames on stdout, for ffmpeg to
 * read directly: capture <scene.html> <fps> <seconds> [<css width> <css height>]
 * Frames are twice the CSS size, 540 x 960 by default, so 1080 x 1920.
 *
 * The page exposes renderAt(t), and this asks for every frame in turn, so
 * the result never depends on how fast the machine is. The window is on
 * screen but fully transparent: WebKit stops drawing pages it thinks are
 * hidden, and a transparent window still counts as shown.
 */
let args = CommandLine.arguments
let scene = URL(fileURLWithPath: args[1])
let fps = Double(args[2])!
let seconds = Double(args[3])!
let out = FileHandle.standardOutput
let (cw, ch) = args.count > 5 ? (Int(args[4])!, Int(args[5])!) : (540, 960)
let (pw, ph) = (cw * 2, ch * 2)
var pixels = [UInt8](repeating: 0, count: pw * ph * 4)
let context = CGContext(data: &pixels, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: pw * 4,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
func log(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }
let frames = Int((seconds * fps).rounded(.up))

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let size = NSSize(width: cw, height: ch)
let window = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless], backing: .buffered, defer: false)
window.alphaValue = 0
window.ignoresMouseEvents = true
window.orderBack(nil)

final class Loader: NSObject, WKNavigationDelegate {
    let done: () -> Void
    init(_ done: @escaping () -> Void) { self.done = done }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { done() }
}

let web = WKWebView(frame: NSRect(origin: .zero, size: size))
window.contentView = web
// Snapshot width is in points, so on a Retina screen 540 points is 1080 pixels.
let config = WKSnapshotConfiguration()
config.snapshotWidth = NSNumber(value: Double(pw) / (NSScreen.main?.backingScaleFactor ?? 2))

func frame(_ i: Int) {
    if i >= frames { log("\(frames) frames"); exit(0) }
    let t = Double(i) / fps
    web.evaluateJavaScript("renderAt(\(t))") { _, error in
        if let error = error { log("renderAt failed: \(error)"); exit(1) }
        web.takeSnapshot(with: config) { image, _ in
            guard let cg = image?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
            context.draw(cg, in: CGRect(x: 0, y: 0, width: pw, height: ph))
            out.write(Data(pixels))
            if i % 300 == 0 { log("  frame \(i)/\(frames)") }
            frame(i + 1)
        }
    }
}

let loader = Loader { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { frame(0) } }
web.navigationDelegate = loader
web.loadFileURL(scene, allowingReadAccessTo: scene.deletingLastPathComponent())
app.run()
