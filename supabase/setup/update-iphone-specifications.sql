begin;
set local lock_timeout = '5s';

-- Apple manufacturer options describe the hardware. Store inventory is managed separately.
with specs as (
  select * from jsonb_to_recordset($apple_specs$
[
  {
    "key": "iphone-16",
    "source": "https://support.apple.com/en-us/121029",
    "specifications": {
      "Manufacturer storage options": "128GB, 256GB, 512GB",
      "Manufacturer finishes": "Black, White, Pink, Teal, Ultramarine",
      "Display": "6.1-inch Super Retina XDR OLED, 2556 × 1179 at 460 ppi, HDR and True Tone",
      "Processor": "A18, 6-core CPU, 5-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6, sensor-shift stabilization), 12 MP Ultra Wide (13 mm, f/2.2); 2× optical-quality crop",
      "Front cameras": "12 MP TrueDepth (f/1.9) with autofocus; 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 60 fps; macro video",
      "Battery playback": "Up to 22 hours of video playback or 18 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; MagSafe up to 25 W with 30 W adapter or higher; Qi2 up to 15 W",
      "Dimensions": "147.6 × 71.6 × 7.8 mm (H × W × D)",
      "Weight": "170 g",
      "Build materials": "Aluminum frame, Ceramic Shield front, glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 5.3, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 2 up to 480 Mb/s",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 18 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-16-plus",
    "source": "https://support.apple.com/en-us/121030",
    "specifications": {
      "Manufacturer storage options": "128GB, 256GB, 512GB",
      "Manufacturer finishes": "Black, White, Pink, Teal, Ultramarine",
      "Display": "6.7-inch Super Retina XDR OLED, 2796 × 1290 at 460 ppi, HDR and True Tone",
      "Processor": "A18, 6-core CPU, 5-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6, sensor-shift stabilization), 12 MP Ultra Wide (13 mm, f/2.2); 2× optical-quality crop",
      "Front cameras": "12 MP TrueDepth (f/1.9) with autofocus; 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 60 fps; macro video",
      "Battery playback": "Up to 27 hours of video playback or 24 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; MagSafe up to 25 W with 30 W adapter or higher; Qi2 up to 15 W",
      "Dimensions": "160.9 × 77.8 × 7.8 mm (H × W × D)",
      "Weight": "199 g",
      "Build materials": "Aluminum frame, Ceramic Shield front, glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 5.3, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 2 up to 480 Mb/s",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 18 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-16-pro",
    "source": "https://support.apple.com/en-us/121031",
    "specifications": {
      "Manufacturer storage options": "128GB, 256GB, 512GB, 1TB",
      "Manufacturer finishes": "Black Titanium, White Titanium, Natural Titanium, Desert Titanium",
      "Display": "6.3-inch Super Retina XDR OLED, 2622 × 1206 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A18 Pro, 6-core CPU, 6-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (24 mm, f/1.78), 48 MP Ultra Wide (13 mm, f/2.2), 12 MP 5× telephoto (120 mm, f/2.8); LiDAR",
      "Front cameras": "12 MP TrueDepth (f/1.9) with autofocus; 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; ProRes and Log",
      "Battery playback": "Up to 27 hours of video playback or 22 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; MagSafe up to 25 W with 30 W adapter or higher; Qi2 up to 15 W",
      "Dimensions": "149.6 × 71.5 × 8.25 mm (H × W × D)",
      "Weight": "199 g",
      "Build materials": "Titanium design, Ceramic Shield front, textured matte glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 5.3, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 18 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-16-pro-max",
    "source": "https://support.apple.com/en-us/121032",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB",
      "Manufacturer finishes": "Black Titanium, White Titanium, Natural Titanium, Desert Titanium",
      "Display": "6.9-inch Super Retina XDR OLED, 2868 × 1320 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A18 Pro, 6-core CPU, 6-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (24 mm, f/1.78), 48 MP Ultra Wide (13 mm, f/2.2), 12 MP 5× telephoto (120 mm, f/2.8); LiDAR",
      "Front cameras": "12 MP TrueDepth (f/1.9) with autofocus; 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; ProRes and Log",
      "Battery playback": "Up to 33 hours of video playback or 29 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; MagSafe up to 25 W with 30 W adapter or higher; Qi2 up to 15 W",
      "Dimensions": "163 × 77.6 × 8.25 mm (H × W × D)",
      "Weight": "227 g",
      "Build materials": "Titanium design, Ceramic Shield front, textured matte glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 5.3, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 18 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-16e",
    "source": "https://support.apple.com/en-us/122208",
    "specifications": {
      "Manufacturer storage options": "128GB, 256GB, 512GB",
      "Manufacturer finishes": "Black, White",
      "Display": "6.1-inch Super Retina XDR OLED, 2532 × 1170 at 460 ppi, HDR and True Tone",
      "Processor": "A18, 6-core CPU, 4-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6), stabilized; 12 MP optical-quality 2× crop",
      "Front cameras": "12 MP TrueDepth (f/1.9) with autofocus; 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 60 fps",
      "Battery playback": "Up to 26 hours of video playback or 21 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; Qi wireless charging",
      "Dimensions": "146.7 × 71.5 × 7.8 mm (H × W × D)",
      "Weight": "167 g",
      "Build materials": "Aluminum frame, Ceramic Shield front, glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "Apple C1 modem; 5G sub-6 GHz, Gigabit LTE, Wi-Fi 6, Bluetooth 5.3 and NFC",
      "USB port": "USB-C, USB 2 up to 480 Mb/s",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 18 at introduction",
      "Key features": "Face ID, Action button, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-17",
    "source": "https://www.apple.com/iphone-17/specs/",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB",
      "Manufacturer finishes": "Black, White, Mist Blue, Sage, Lavender",
      "Display": "6.3-inch Super Retina XDR OLED, 2622 × 1206 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A19, 6-core CPU, 5-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6, sensor-shift stabilization), 48 MP Ultra Wide (13 mm, f/2.2); 2× optical-quality crop",
      "Front cameras": "18 MP Center Stage (f/1.9); 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 60 fps; Dual Capture and macro video",
      "Battery playback": "Up to 30 hours of video playback or 27 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 20 min with 40 W or higher; MagSafe and Qi2 up to 25 W",
      "Dimensions": "149.6 × 71.5 × 7.95 mm (H × W × D)",
      "Weight": "177 g",
      "Build materials": "Aluminum frame, Ceramic Shield 2 front, glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 6, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 2 up to 480 Mb/s",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 26 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-17-pro",
    "source": "https://support.apple.com/en-us/125090",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB",
      "Manufacturer finishes": "Silver, Cosmic Orange, Deep Blue",
      "Display": "6.3-inch Super Retina XDR OLED, 2622 × 1206 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A19 Pro, 6-core CPU, 6-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (24 mm, f/1.78), 48 MP Ultra Wide (13 mm, f/2.2), 48 MP 4× telephoto (100 mm, f/2.8); 8× optical-quality crop and LiDAR",
      "Front cameras": "18 MP Center Stage (f/1.9); 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; ProRes RAW, Apple Log 2 and genlock",
      "Battery playback": "Up to 33 hours of video playback or 30 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 20 min with 40 W or higher; MagSafe and Qi2 up to 25 W",
      "Dimensions": "150 × 71.9 × 8.75 mm (H × W × D)",
      "Weight": "206 g",
      "Build materials": "Aluminum unibody, Ceramic Shield 2 front, Ceramic Shield back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 6, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 26 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS; vapor-chamber cooling",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-17-pro-max",
    "source": "https://support.apple.com/en-us/125091",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB, 2TB",
      "Manufacturer finishes": "Silver, Cosmic Orange, Deep Blue",
      "Display": "6.9-inch Super Retina XDR OLED, 2868 × 1320 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A19 Pro, 6-core CPU, 6-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (24 mm, f/1.78), 48 MP Ultra Wide (13 mm, f/2.2), 48 MP 4× telephoto (100 mm, f/2.8); 8× optical-quality crop and LiDAR",
      "Front cameras": "18 MP Center Stage (f/1.9); 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; ProRes RAW, Apple Log 2 and genlock",
      "Battery playback": "Up to 39 hours of video playback or 35 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 20 min with 40 W or higher; MagSafe and Qi2 up to 25 W",
      "Dimensions": "163.4 × 78 × 8.75 mm (H × W × D)",
      "Weight": "233 g",
      "Build materials": "Aluminum unibody, Ceramic Shield 2 front, Ceramic Shield back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Wi-Fi 7, Bluetooth 6, second-generation Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 26 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS; vapor-chamber cooling",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-17e",
    "source": "https://www.apple.com/iphone-17e/specs/",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB",
      "Manufacturer finishes": "Black, White, Soft Pink",
      "Display": "6.1-inch Super Retina XDR OLED, 2532 × 1170 at 460 ppi, HDR and True Tone",
      "Processor": "A19, 6-core CPU, 4-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6), stabilized; 12 MP optical-quality 2× crop",
      "Front cameras": "12 MP TrueDepth (f/1.9) with autofocus; 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 60 fps",
      "Battery playback": "Up to 26 hours of video playback or 21 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; MagSafe and Qi2 up to 15 W",
      "Dimensions": "146.7 × 71.5 × 7.8 mm (H × W × D)",
      "Weight": "169 g",
      "Build materials": "Aluminum frame, Ceramic Shield 2 front, glass back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "Apple C1X modem; 5G sub-6 GHz, Gigabit LTE, Wi-Fi 6, Bluetooth 5.3 and NFC",
      "USB port": "USB-C, USB 2 up to 480 Mb/s",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 26 at introduction",
      "Key features": "Face ID, Action button, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-air",
    "source": "https://www.apple.com/iphone-air/specs/",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB",
      "Manufacturer finishes": "Space Black, Cloud White, Light Gold, Sky Blue",
      "Display": "6.5-inch Super Retina XDR OLED, 2736 × 1260 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A19 Pro, 6-core CPU, 5-core GPU and 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6), sensor-shift stabilization and 12 MP optical-quality 2× crop",
      "Front cameras": "18 MP Center Stage (f/1.9); 4K Dolby Vision video up to 60 fps",
      "Video recording": "4K Dolby Vision up to 60 fps; Dual Capture",
      "Battery playback": "Up to 27 hours of video playback or 22 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 30 min with 20 W or higher; MagSafe and Qi2 up to 20 W",
      "Dimensions": "156.2 × 74.7 × 5.64 mm (H × W × D)",
      "Weight": "165 g",
      "Build materials": "Titanium design, Ceramic Shield 2 front, Ceramic Shield back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "Apple C1X modem; 5G sub-6 GHz, Gigabit LTE, Wi-Fi 7, Bluetooth 6, Ultra Wideband, Thread and NFC",
      "USB port": "USB-C, USB 2 up to 480 Mb/s",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 26 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-18-pro",
    "source": "https://www.apple.com/iphone-18-pro/specs/",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB, 2TB",
      "Manufacturer finishes": "Silver, Burgundy, Glacier, Black",
      "Display": "6.3-inch Super Retina XDR OLED, 2622 × 1206 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A20 Pro, 6-core CPU, 7-core GPU and dual 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main with variable aperture, 48 MP Ultra Wide, and 48 MP Fusion telephoto; LiDAR",
      "Front cameras": "18 MP Center Stage; 4K Dolby Vision",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; ProRes RAW and Apple Log 2",
      "Battery playback": "Up to 36 hours of video playback or 33 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 15 min with compatible 60 W AVS adapter; MagSafe and Qi2 up to 25 W",
      "Dimensions": "150 × 71.9 × 8.75 mm (H × W × D)",
      "Weight": "211 g",
      "Build materials": "Aluminum unibody, Ceramic Shield 2 front, Ceramic Shield back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Apple N1 wireless chip, Wi-Fi 7, Bluetooth 6, second-generation Ultra Wideband, Thread and NFC; Apple C2 modem",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 27 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS; Siri AI",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-18-pro-max",
    "source": "https://www.apple.com/iphone-18-pro/specs/",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB, 2TB",
      "Manufacturer finishes": "Silver, Burgundy, Glacier, Black",
      "Display": "6.9-inch Super Retina XDR OLED, 2868 × 1320 at 460 ppi, HDR and True Tone, adaptive refresh up to 120 Hz and always-on",
      "Processor": "A20 Pro, 6-core CPU, 7-core GPU and dual 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main with variable aperture, 48 MP Ultra Wide, and 48 MP Fusion telephoto; LiDAR",
      "Front cameras": "18 MP Center Stage; 4K Dolby Vision",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; ProRes RAW and Apple Log 2",
      "Battery playback": "Up to 45 hours of video playback or 40 hours streamed (Apple testing)",
      "Charging": "USB-C, up to 50% in approximately 15 min with compatible 60 W AVS adapter; MagSafe and Qi2 up to 25 W",
      "Dimensions": "163.4 × 78 × 8.75 mm (H × W × D)",
      "Weight": "249 g",
      "Build materials": "Aluminum unibody, Ceramic Shield 2 front, Ceramic Shield back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Apple N1 wireless chip, Wi-Fi 7, Bluetooth 6, second-generation Ultra Wideband, Thread and NFC; Apple C2 modem",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 27 at introduction",
      "Key features": "Face ID, Action button, Camera Control, Dynamic Island, Apple Intelligence and satellite SOS; Siri AI",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  },
  {
    "key": "iphone-duo",
    "source": "https://www.apple.com/iphone-duo/specs/",
    "specifications": {
      "Manufacturer storage options": "256GB, 512GB, 1TB, 2TB",
      "Manufacturer finishes": "Night Sky, Star White",
      "Display": "7.6-inch inner folding OLED, 1878 × 2670 at 430 ppi; 5.4-inch outer OLED, 1398 × 2034 at 460 ppi. Both Super Retina XDR with adaptive refresh up to 120 Hz",
      "Processor": "A20 Pro, 6-core CPU, 7-core GPU and dual 16-core Neural Engine",
      "Rear cameras": "48 MP Fusion main (26 mm, f/1.6), 48 MP Ultra Wide (13 mm, f/2.2); 2× optical-quality crop",
      "Front cameras": "Outer 12 MP Center Stage (f/2.2); inner under-display FaceTime camera (f/1.8)",
      "Video recording": "4K Dolby Vision up to 120 fps on main camera; Dual Capture and macro video",
      "Battery playback": "Up to 44 hours outer or 31 hours inner video playback; up to 37 hours outer or 26 hours inner streamed",
      "Charging": "USB-C, up to 50% in approximately 20 min with compatible 60 W adapter; MagSafe and Qi2 up to 25 W",
      "Dimensions": "164.6 × 117.8 × 5.2 mm open; 84.1 × 117.8 × 11.3 mm closed (W × H × D)",
      "Weight": "254 g",
      "Build materials": "Titanium foldable design, Ceramic Shield 2 front, Ceramic Shield back",
      "Water and dust resistance": "IP68 (IEC 60529; tested at up to 6 m for 30 min)",
      "Network and wireless": "5G sub-6 GHz and mmWave (US), Gigabit LTE, Apple N1 wireless chip, Wi-Fi 7, Bluetooth 6, second-generation Ultra Wideband, Thread and NFC; Apple C2 modem",
      "USB port": "USB-C, USB 3 up to 10 Gb/s, DisplayPort",
      "SIM (US model)": "Dual eSIM; no physical SIM tray",
      "Operating system": "iOS 27 at introduction",
      "Key features": "Touch ID, Camera Control, Dynamic Island, Apple Pencil (USB-C) support, Apple Intelligence, Siri AI and satellite SOS",
      "In the box": "iPhone, USB-C charge cable and documentation"
    }
  }
]
$apple_specs$::jsonb) as row(key text,source text,specifications jsonb)
)
update public.products p
set specifications=s.specifications, verification_source=s.source, verified_at=now()
from specs s
where p.catalogue_key=s.key and p.published
  and (p.specifications is distinct from s.specifications or p.verification_source is distinct from s.source);
commit;
