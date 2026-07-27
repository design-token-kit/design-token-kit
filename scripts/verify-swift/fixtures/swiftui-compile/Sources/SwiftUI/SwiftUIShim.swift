// Minimal SwiftUI stand-ins so generated tokens type-check on non-Apple
// platforms. This target is literally named `SwiftUI`, so the generated
// code's `import SwiftUI` and `SwiftUI.Color`/`SwiftUI.Font` references
// resolve to these types on Linux and to the real framework on Apple
// platforms (where this target is excluded). Signatures mirror the subset
// the generator emits.
import Foundation

public typealias CGFloat = Double
public typealias TimeInterval = Double

public enum RGBColorSpace {
    case sRGB
    case linearSRGB
    case displayP3
}

public struct Color {
    public init(_ space: RGBColorSpace = .sRGB, red: Double, green: Double, blue: Double, opacity: Double = 1) {}
}

public struct UnitPoint {
    public init(x: Double, y: Double) {}
}

public struct UnitCurve {
    public static func bezier(startControlPoint: UnitPoint, endControlPoint: UnitPoint) -> UnitCurve { UnitCurve() }
    init() {}
}

public struct Font {
    public enum Weight {
        case ultraLight, thin, light, regular, medium, semibold, bold, heavy, black
    }
    public static func system(size: CGFloat, weight: Weight = .regular) -> Font { Font() }
    public static func custom(_ name: String, size: CGFloat) -> Font { Font() }
    init() {}
}

public struct Gradient {
    public struct Stop {
        public init(color: Color, location: CGFloat) {}
    }
    public init(stops: [Stop]) {}
}
