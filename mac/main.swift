import AppKit
@preconcurrency import WebKit

/*
 * A Mac wrapper around the Seyes server.
 *
 * The app owns the server: it starts it on launch, waits for it to answer,
 * shows it in a plain window, and stops it again on quit. Nothing is left
 * running after the window closes, which is the whole point of having an
 * icon instead of a terminal.
 */

let fallbackPaths = [
    "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin",
    NSHomeDirectory() + "/.npm-global/bin",
]

func findSeyes() -> String? {
    for dir in fallbackPaths {
        let candidate = dir + "/seyes"
        if FileManager.default.isExecutableFile(atPath: candidate) { return candidate }
    }
    return nil
}

/// A port nothing else is sitting on, so a stray server elsewhere cannot make
/// the app show someone else's page.
func freePort(from start: Int) -> Int {
    for port in start..<(start + 40) {
        let sock = socket(AF_INET, SOCK_STREAM, 0)
        if sock < 0 { continue }
        var yes: Int32 = 1
        setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = UInt16(port).bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        let bound = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        close(sock)
        if bound == 0 { return port }
    }
    return start
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var server: Process?
    var port = 3000
    var status: NSTextField!

    func applicationDidFinishLaunching(_ note: Notification) {
        port = freePort(from: 3000)
        buildMenu()
        buildWindow()
        startServer()
    }

    /// The page runs edge to edge under a transparent titlebar, so the app's
    /// own chrome bar is the top of the window and there is no second strip.
    /// That costs two things, both handed back below: the traffic lights
    /// would land on the page's leftmost bar (the injected `data-mac` insets
    /// it), and the web view covers the titlebar and eats the drag that moves
    /// the window (the page reports drags on its chrome to `dragWindow`).
    func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1080, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        window.title = "Seyes"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        // An empty toolbar in the compact style is what gives the title bar
        // its taller, Apple-standard height with the traffic lights centred
        // in it. The page's own top bar is then sized to that same strip
        // (see chromeMetrics), so the lights and the bar share one centre line.
        window.toolbar = NSToolbar(identifier: "seyes")
        window.toolbarStyle = .unifiedCompact
        window.titlebarSeparatorStyle = .none
        window.minSize = NSSize(width: 640, height: 480)
        // Deliberately NOT movableByWindowBackground: in a text editor that
        // turns a drag begun on empty page background into a window move
        // instead of a text selection. The chrome bar is the handle.
        // Paper in light, ink in dark, so the frame matches the page instead
        // of flashing the wrong colour while the server comes up.
        window.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? NSColor(red: 0.078, green: 0.063, blue: 0.047, alpha: 1)
                : NSColor(red: 0.969, green: 0.961, blue: 0.937, alpha: 1)
        }

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "chrome")
        config.userContentController.addUserScript(
            WKUserScript(source: chromeMetrics() + Self.chromeScript,
                         injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        webView.translatesAutoresizingMaskIntoConstraints = false

        status = NSTextField(labelWithString: "Starting Seyes…")
        status.font = NSFont(name: "Courier New", size: 13) ?? NSFont.systemFont(ofSize: 13)
        status.textColor = NSColor.secondaryLabelColor
        status.alignment = .center
        status.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView()
        container.addSubview(webView)
        container.addSubview(status)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            status.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            status.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
        window.contentView = container

        // Restore where it was last, and only centre it the very first time.
        window.setFrameAutosaveName("SeyesWindow")
        if !window.setFrameUsingName("SeyesWindow") { window.center() }

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func startServer() {
        guard let seyes = findSeyes() else {
            status.stringValue = "Could not find the `seyes` command.\nRun: npm i -g seyes-app"
            status.maximumNumberOfLines = 3
            return
        }

        let task = Process()
        task.executableURL = URL(fileURLWithPath: seyes)
        var env = ProcessInfo.processInfo.environment
        // A GUI app inherits no shell PATH, and the launcher shells out to
        // node and npx, so it has to be handed one.
        env["PATH"] = fallbackPaths.joined(separator: ":")
        env["PORT"] = String(port)
        // The app is the window; the launcher must not also open a browser tab.
        env["SEYES_NO_OPEN"] = "1"
        task.environment = env
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        do { try task.run() } catch {
            status.stringValue = "Seyes could not start."
            return
        }
        server = task
        waitForServer(attempt: 0)
    }

    /// The first launch after an upgrade builds the app, which takes a while;
    /// every launch after that answers almost at once.
    func waitForServer(attempt: Int) {
        let url = URL(string: "http://127.0.0.1:\(port)/")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 2
        URLSession.shared.dataTask(with: request) { _, response, _ in
            DispatchQueue.main.async {
                if (response as? HTTPURLResponse)?.statusCode != nil {
                    self.status.isHidden = true
                    self.webView.load(URLRequest(url: url))
                    return
                }
                if attempt == 8 {
                    self.status.stringValue = "Building Seyes. This happens once after an update…"
                }
                if attempt > 600 {
                    self.status.stringValue = "Seyes did not start."
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.waitForServer(attempt: attempt + 1)
                }
            }
        }.resume()
    }

    func applicationWillTerminate(_ note: Notification) { stopServer() }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    /// Terminating the launcher is not enough. It starts the server through a
    /// chain of processes (launcher → npm → next-server), and killing only the
    /// ends of that chain strands the `npm` link in the middle: reparented to
    /// launchd, holding ~34MB, invisible, one more of them after every quit.
    /// Both the port holder and the npm wrapper are matched here, each scoped
    /// to this window's own port so nothing else on the machine is touched.
    func stopServer() {
        // Walk the tree from the launcher down, killing children before their
        // parent so nothing gets reparented to launchd and survives. Matching
        // on the command line instead (pkill -f) is a trap: the pattern also
        // appears in this very shell's own arguments, so it kills the shell
        // before it does its job.
        let pid = server?.processIdentifier ?? 0
        let kill = Process()
        kill.executableURL = URL(fileURLWithPath: "/bin/sh")
        kill.arguments = ["-c", """
            all=""
            collect() {
              all="$all $1"
              for child in $(pgrep -P $1 2>/dev/null); do collect $child; done
            }
            [ \(pid) -gt 0 ] && collect \(pid)
            all="$all $(lsof -nP -iTCP:\(port) -sTCP:LISTEN -t 2>/dev/null)"
            [ -n "$(echo $all)" ] || exit 0
            # The whole tree is collected BEFORE anything dies, because once a
            # parent goes its children reparent to launchd and are no longer
            # reachable from it. TERM first, then KILL the survivors: npm's
            # wrapper process ignores TERM in some states and would otherwise
            # be left behind holding ~34MB after every quit.
            kill $all 2>/dev/null
            sleep 0.3
            kill -9 $all 2>/dev/null
            exit 0
            """]
        try? kill.run()
        kill.waitUntilExit()
        server?.terminate()
    }

    /// Where macOS actually put the traffic lights, measured rather than
    /// assumed, handed to the page as CSS variables: the bar height that
    /// centres on them, and how far in the page's content must start to clear
    /// them. If a future macOS moves the lights, the page follows.
    func chromeMetrics() -> String {
        window.layoutIfNeeded()
        guard let zoom = window.standardWindowButton(.zoomButton) else { return "" }
        let lights = zoom.convert(zoom.bounds, to: nil)
        let bar = ((window.frame.height - lights.midY) * 2).rounded()
        let inset = (lights.maxX + 10).rounded()
        return """
        document.documentElement.style.setProperty('--mac-bar', '\(Int(bar))px');
        document.documentElement.style.setProperty('--mac-inset', '\(Int(inset))px');

        """
    }

    /// Injected before the page runs. It marks the document so the stylesheet
    /// can inset the leftmost bar past the traffic lights, and it reports
    /// mouse-downs that land on the chrome bars themselves (never on one of
    /// their buttons) so the window can be dragged by them the way a titlebar
    /// would be. It only listens; it never swallows the event, so the page's
    /// own handlers still see everything.
    static let chromeScript = """
    (function () {
      document.documentElement.setAttribute('data-mac', '1')
      function post(name) {
        try { window.webkit.messageHandlers.chrome.postMessage(name) } catch (e) {}
      }
      function onChrome(target) {
        if (!(target instanceof Element)) return false
        if (target.closest('button, a, input, textarea, select, [contenteditable]')) return false
        return Boolean(target.closest('.topbar, .sidebar-head'))
      }
      document.addEventListener('mousedown', function (e) {
        // detail === 1 keeps the second click of a double-click from also
        // starting a drag, so double-click still zooms.
        if (e.button === 0 && e.detail === 1 && onChrome(e.target)) post('drag')
      }, true)
      document.addEventListener('dblclick', function (e) {
        if (onChrome(e.target)) post('zoom')
      }, true)
    })()
    """

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any], body["type"] as? String == "pickFolder" {
            pickFolder(id: body["id"] as? String ?? "", prompt: body["prompt"] as? String ?? "",
                       start: body["start"] as? String)
            return
        }
        switch message.body as? String {
        case "drag": dragWindow()
        case "zoom": window.zoom(nil)
        default: break
        }
    }

    /// The page asks for a folder (to write in, or to move the writing folder
    /// into). A web page can't see real paths, so the app shows the standard
    /// macOS picker as a sheet on the window and hands the path back.
    func pickFolder(id: String, prompt: String, start: String?) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = prompt
        panel.prompt = "Choose"
        if let start = start { panel.directoryURL = URL(fileURLWithPath: start, isDirectory: true) }
        panel.beginSheetModal(for: window) { response in
            let path = response == .OK ? panel.url?.path : nil
            let detail: [String: Any] = ["id": id, "path": path ?? NSNull()]
            guard let data = try? JSONSerialization.data(withJSONObject: detail),
                  let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('seyes:picked', { detail: \(json) }))")
        }
    }

    // A WKWebView shows nothing for alert(), confirm() or prompt() unless the
    // app draws them, and confirm() quietly answers "no". These draw them as
    // sheets, so no page dialog can silently vanish.

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        field.stringValue = defaultText ?? ""
        alert.accessoryView = field
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = field
        alert.beginSheetModal(for: window) {
            completionHandler($0 == .alertFirstButtonReturn ? field.stringValue : nil)
        }
    }

    /// AppKit's own titlebar drag never fires here, because the web view is
    /// drawn over the titlebar and takes the mouse first.
    ///
    /// `performDrag(with:)` looks like the right call and is not: the message
    /// from the page arrives asynchronously, so by then the mouse-down it
    /// wants has usually been consumed, and handing it a stale event moves the
    /// window by the wrong amount or not at all. Tracking the mouse against
    /// its own start position is a few lines more and is exact.
    func dragWindow() {
        let startMouse = NSEvent.mouseLocation
        let startOrigin = window.frame.origin
        while let event = NSApp.nextEvent(matching: [.leftMouseDragged, .leftMouseUp],
                                          until: .distantFuture,
                                          inMode: .eventTracking, dequeue: true) {
            if event.type == .leftMouseUp { break }
            let now = NSEvent.mouseLocation
            window.setFrameOrigin(NSPoint(x: startOrigin.x + (now.x - startMouse.x),
                                          y: startOrigin.y + (now.y - startMouse.y)))
        }
    }

    /// Without a menu, the standard editing keys do not reach the web view and
    /// a writing app loses copy, paste, undo and select-all.
    func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Seyes", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Seyes", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Seyes", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit

        let viewItem = NSMenuItem()
        main.addItem(viewItem)
        let view = NSMenu(title: "View")
        view.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
        let full = view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        full.keyEquivalentModifierMask = [.command, .control]
        viewItem.submenu = view

        let windowItem = NSMenuItem()
        main.addItem(windowItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowItem.submenu = windowMenu

        NSApp.mainMenu = main
        NSApp.windowsMenu = windowMenu
    }

    @objc func reload() { webView.reload() }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
