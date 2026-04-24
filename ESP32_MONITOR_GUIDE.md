# ESP32 Serial Monitor Guide

This guide will help you monitor serial logs from your ESP32 device via USB.

## Prerequisites

✅ **Already Installed:**
- Node.js
- `serialport` package
- `@serialport/parser-readline` package

## Quick Start

### Step 1: Connect Your ESP32
1. Connect your ESP32 to your computer via USB cable
2. Wait for Windows to recognize the device (you might hear a USB connection sound)

### Step 2: Find Your COM Port

Run the monitor script without arguments to list all available ports:

```bash
npm run esp32
```

Or directly:

```bash
node scripts/esp32Monitor.js
```

This will display something like:
```
Available Serial Ports:

[1] COM3
    Manufacturer: Silicon Labs
    Serial Number: 0001

[2] COM5
    Manufacturer: Microsoft
```

**Common ESP32 manufacturers:**
- Silicon Labs (CP210x chipset - very common)
- FTDI
- CH340/CH341 (WCH)
- Prolific

### Step 3: Start Monitoring

Once you identify your ESP32's COM port (e.g., COM3), run:

```bash
npm run esp32 COM3
```

Or:

```bash
node scripts/esp32Monitor.js COM3
```

### Step 4: View Logs

You should now see real-time logs from your ESP32:

```
ESP32 Serial Monitor
==================================================
Port: COM3
Baud Rate: 115200
==================================================

Press Ctrl+C to exit

✓ Connected to COM3

[10:30:45] ESP32 Boot...
[10:30:45] WiFi connecting...
[10:30:46] WiFi connected
[10:30:46] IP address: 192.168.1.100
```

### Step 5: Stop Monitoring

Press `Ctrl+C` to stop monitoring and close the connection.

## Configuration

### Change Baud Rate

If your ESP32 uses a different baud rate, edit `scripts/esp32Monitor.js`:

```javascript
const BAUD_RATE = 115200; // Change to 9600, 57600, 230400, etc.
```

Common ESP32 baud rates:
- 9600 (slow, reliable)
- 57600
- **115200** (default, most common)
- 230400
- 460800 (fast, may have errors on some USB cables)

## Troubleshooting

### ❌ "No serial ports found"

**Solutions:**
1. **Install USB-to-UART drivers:**
   - **CP210x (most common):** Download from [Silicon Labs](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - **CH340/CH341:** Search for "CH340 driver Windows" and download from a trusted source
   - **FTDI:** Download from [FTDI website](https://ftdichip.com/drivers/vcp-drivers/)

2. **Check Device Manager:**
   - Press `Win + X` and select "Device Manager"
   - Look under "Ports (COM & LPT)" for your device
   - If you see a yellow exclamation mark, right-click and update driver

3. **Try a different USB cable:** Some cables are charge-only and don't support data transfer

4. **Try a different USB port:** Preferably USB 2.0 ports work best

### ❌ "Error: Access denied" or "Port is busy"

**Solutions:**
1. Close any other programs using the COM port:
   - Arduino IDE Serial Monitor
   - PuTTY
   - TeraTerm
   - Another instance of this monitor

2. Unplug and replug the ESP32

3. Restart your computer (if above doesn't work)

### ❌ Gibberish/Random Characters

**Solutions:**
1. Wrong baud rate - change `BAUD_RATE` in the script to match your ESP32 configuration
2. Bad USB cable - try a different cable
3. Electrical interference - move away from power supplies or motors

### ❌ No output but connected

**Solutions:**
1. Your ESP32 might not be sending data - flash it with a simple test program:
   ```cpp
   void setup() {
     Serial.begin(115200);
     Serial.println("ESP32 is working!");
   }

   void loop() {
     Serial.println("Hello from ESP32");
     delay(1000);
   }
   ```

2. Press the RESET button on your ESP32

## Alternative Tools

If you prefer GUI tools instead of command-line:

1. **Arduino IDE Serial Monitor** (recommended for beginners)
   - Open Arduino IDE → Tools → Serial Monitor
   - Select correct COM port and baud rate

2. **PuTTY** (Windows)
   - Download from putty.org
   - Select "Serial" connection type
   - Enter COM port and baud rate

3. **TeraTerm** (Windows)
   - Download from ttssh2.osdn.jp
   - Select "Serial" and choose your COM port

4. **VS Code with Serial Monitor Extension**
   - Install "Serial Monitor" extension
   - Click on the serial monitor icon in the status bar

## Advanced Usage

### Save logs to file

```bash
node scripts/esp32Monitor.js COM3 > esp32_logs.txt
```

### Filter specific messages (PowerShell)

```powershell
node scripts/esp32Monitor.js COM3 | Select-String "ERROR"
```

### Monitor multiple ESP32 devices

Open multiple terminal windows and run the script with different COM ports:

**Terminal 1:**
```bash
node scripts/esp32Monitor.js COM3
```

**Terminal 2:**
```bash
node scripts/esp32Monitor.js COM5
```

## Tips

- Always ensure your ESP32's baud rate matches the monitor's baud rate
- Use good quality USB cables with data pins (not just charging cables)
- If logs appear corrupted, try lowering the baud rate for stability
- The monitor automatically adds timestamps to each line for easier debugging

## Need Help?

If you're still having issues:
1. Check that your ESP32 is properly flashed with firmware
2. Verify the ESP32 is powered (LED should be on)
3. Try the ESP32 on a different computer to rule out hardware issues
4. Check ESP32 forums for device-specific issues
