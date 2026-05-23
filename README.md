# Vocab Quiz (Even G2 Smart Glasses App)

A 4-choice synonym vocabulary quiz app designed for the Even G2 smart glasses.

## Requirements

Ensure `public/oxford_5000_quiz.json` is placed in the project root's `public` directory. (Note: This file is already configured inside this workspace and does not need to be modified).
The format of the JSON should be:
```json
[
  {
    "id": "b2_0001",
    "word": "absorb",
    "pos": "v.",
    "answer": "take in",
    "choices": ["take in", "trigger", "discard", "include"]
  }
]
```

## Setup & Running

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Local Development Server**
   ```bash
   npm run dev
   ```

## Browser Simulator & Preview

Open the development server URL (usually `http://localhost:5173`) in your web browser.
- **Left Side**: Simulator preview representing exactly what will be shown on the Even G2 HUD (576 x 288 layout, green monochrome text).
- **Right Side**: Developer Console displaying diagnostic information and action triggers.

### Keyboard Controls (Simulator)

- <kbd>▲ ArrowUp</kbd> : Scroll/Swipe Up (Navigate menu / choices up)
- <kbd>▼ ArrowDown</kbd> : Scroll/Swipe Down (Navigate menu / choices down)
- <kbd>Enter</kbd> : Single Click (Select menu item / Submit answer / Go to next question)
- <kbd>Escape</kbd> : Double Click (Instantly go back to Home from any screen)

Alternatively, you can click the buttons in the **Developer Console** on the right side of the screen.

---

## Testing on Even G2 Device

To run the application on your physical Even G2 glasses:

1. Ensure your computer and your phone (with the Even App) are connected to the same Wi-Fi network.
2. In your terminal, run the sideloading helper (using Even Hub CLI):
   ```bash
   npx evenhub qr
   ```
   *Note: If `evenhub` is installed globally, you can run `evenhub qr`.*
3. A QR code will be generated in your terminal.
4. Open the **Even App** on your phone, navigate to the **Even Hub Developer** section, and scan the QR code to load the app onto your Even G2 glasses.
5. Use the temple touchpads or R1 Control Ring to navigate:
   - **Swipe Up / Scroll Up**: Move selection up.
   - **Swipe Down / Scroll Down**: Move selection down.
   - **Single Click**: Confirm / Next.
   - **Double Click**: Back to Home.
