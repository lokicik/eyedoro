# 👁️ Eye Doro - Desktop Eye Health App

A beautiful desktop application built with Electron that helps protect your eyes by enforcing regular breaks from screen time.

## ✨ Features

- **🔄 Automatic Break Reminders**: Customizable work/break intervals (default: 20 min work, 5 min break)
- **🖥️ Full Screen Blocking**: Immersive break screen that blocks all input during rest time
- **⚙️ System Tray Integration**: Runs quietly in the background with tray controls
- **🎨 Beautiful UI**: Modern, gradient-based interface with smooth animations
- **📚 Eye Health Tips**: Educational content during breaks with the 20-20-20 rule
- **🌙 Dark Mode Support**: Toggle between light and dark themes
- **💾 Persistent Settings**: Configuration saved in JSON format
- **🚨 Emergency Exit**: Ctrl+Alt+Shift+E to exit break early
- **🔔 Smart Notifications**: Optional pre-break warnings
- **🌐 Cross-Platform**: Works on Windows, macOS, and Linux

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd eyedoro
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Build for production:

```bash
# For current platform
npm run build

# For specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 🎯 How to Use

1. **First Launch**: The app starts minimized in the system tray
2. **Access Settings**: Right-click the tray icon → "Settings" or double-click the tray icon
3. **Configure Timers**: Adjust work and break durations using the sliders
4. **Customize Experience**: Enable/disable notifications, sounds, and dark mode
5. **Control Breaks**: Use tray menu to pause/resume or take an immediate break
6. **Emergency Exit**: Press Ctrl+Alt+Shift+E during a break to exit early

## ⚙️ Configuration Options

### Timer Settings

- **Work Duration**: 1-120 minutes (default: 20 minutes)
- **Break Duration**: 1-30 minutes (default: 5 minutes)

### Notifications

- **Pre-break Warnings**: Get notified 30 seconds before break starts
- **Sound Alerts**: Audio notifications for break start/end

### Appearance

- **Dark Mode**: Toggle between light and dark themes
- **Auto-start**: Launch with system startup (future feature)

## 🔧 System Tray Controls

- **Pause/Resume**: Temporarily disable break reminders
- **Settings**: Open the configuration window
- **Take Break Now**: Start an immediate break
- **Quit**: Exit the application completely

## 💡 Health Tips

The app follows the **20-20-20 rule**:

- Every **20 minutes**
- Look at something **20 feet away**
- For at least **20 seconds**

Additional features include:

- 🔄 Eye movement exercises
- 😌 Blinking reminders
- 💧 Hydration tips
- 🖥️ Proper display positioning

## 🏗️ Technical Architecture

### Built With

- **Electron**: Cross-platform desktop framework
- **React**: Modern UI library
- **Vite**: Fast build tool and dev server
- **CSS3**: Modern styling with gradients and animations

### Project Structure

```
src/
├── main/           # Electron main process
│   └── index.js    # System tray, timers, break logic
├── preload/        # Secure IPC bridge
│   └── index.js    # API exposure to renderer
└── renderer/       # React frontend
    ├── src/
    │   ├── components/
    │   │   ├── SettingsScreen.jsx
    │   │   ├── BreakScreen.jsx
    │   │   └── *.css
    │   ├── App.jsx   # Main app with routing
    │   └── main.jsx  # React entry point
    └── index.html
```

### Key Features Implementation

- **Timer Management**: Precise setTimeout-based scheduling with pause/resume
- **Multi-display Support**: Break screens appear on all monitors
- **Input Blocking**: Fullscreen overlay prevents interaction during breaks
- **Config Persistence**: JSON file in user data directory
- **Emergency Escape**: Global keyboard shortcut registration

## 🔒 Security

The app follows Electron security best practices:

- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC communication through preload scripts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the 20-20-20 rule for eye health
- Built with modern web technologies and Electron
- Icons and emojis for enhanced user experience

---

**Stay healthy! Your eyes will thank you! 👁️✨**
