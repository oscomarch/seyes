import AppKit

/*
 * Exports what the fake desktop needs from this Mac, as PNGs: icons <out dir>
 *
 * The Dock's app icons come from the apps themselves and the Trash from the
 * Dock, so they match the macOS the video is made on. The menu bar's Apple
 * logo and status icons are SF Symbols, drawn in white and in black for
 * dark and light wallpapers. They are Apple's, so they are made on the fly
 * into promo/.build and never committed.
 */
let out = CommandLine.arguments[1]
// Draw in the light appearance, whatever this Mac is set to.
NSApplication.shared.appearance = NSAppearance(named: .aqua)
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)

func save(_ image: NSImage, _ name: String, _ px: Int) {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    // The classic light icons, whatever appearance this Mac is set to.
    NSAppearance(named: .aqua)!.performAsCurrentDrawingAppearance {
        image.draw(in: NSRect(x: 0, y: 0, width: px, height: px))
    }
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/\(name).png"))
}

let apps = [
    ("finder", "/System/Library/CoreServices/Finder.app"),
    ("safari", "/System/Cryptexes/App/System/Applications/Safari.app"),  // the real app, not the alias in /Applications
    ("messages", "/System/Applications/Messages.app"),
    ("mail", "/System/Applications/Mail.app"),
    ("photos", "/System/Applications/Photos.app"),
    ("music", "/System/Applications/Music.app"),
]
for (name, path) in apps {
    // The app's own .icns holds its classic light icon. NSWorkspace would give
    // the variant for this Mac's icon style, which may be dark or tinted.
    let bundle = Bundle(path: path)
    let file = (bundle?.object(forInfoDictionaryKey: "CFBundleIconFile") as? String) ?? "AppIcon"
    let icns = "\(path)/Contents/Resources/\((file as NSString).deletingPathExtension).icns"
    let icon = NSImage(contentsOfFile: icns) ?? NSWorkspace.shared.icon(forFile: path)
    icon.size = NSSize(width: 256, height: 256)
    save(icon, name, 256)
}
if let trash = NSImage(contentsOfFile: "/System/Library/CoreServices/Dock.app/Contents/Resources/s-trashempty@2x.png") {
    save(trash, "trash", 256)
}

// Status symbols, drawn to the exact width of their glyph, tinted.
func symbol(_ name: String, _ file: String, points: CGFloat, weight: NSFont.Weight) {
    for (suffix, color) in [("white", NSColor.white), ("black", NSColor(white: 0.1, alpha: 1))] {
        let config = NSImage.SymbolConfiguration(pointSize: points, weight: weight)
            .applying(.init(paletteColors: [color]))
        guard let img = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config) else {
            FileHandle.standardError.write("no symbol \(name)\n".data(using: .utf8)!); continue
        }
        let scale: CGFloat = 4
        let w = Int(img.size.width * scale), h = Int(img.size.height * scale)
        let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                                   samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                   bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        img.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
        NSGraphicsContext.restoreGraphicsState()
        try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/\(file)-\(suffix).png"))
        print("\(file) \(Double(img.size.width))x\(Double(img.size.height))")
    }
}
symbol("apple.logo", "apple", points: 14, weight: .medium)
symbol("wifi", "wifi", points: 13, weight: .medium)
symbol("battery.100percent", "battery", points: 13, weight: .regular)
symbol("magnifyingglass", "search", points: 12.5, weight: .medium)
symbol("switch.2", "controls", points: 12.5, weight: .medium)
