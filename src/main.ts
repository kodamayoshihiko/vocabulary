import { 
  waitForEvenAppBridge, 
  TextContainerProperty, 
  CreateStartUpPageContainer, 
  TextContainerUpgrade,
  OsEventTypeList,
  EventSourceType
} from '@evenrealities/even_hub_sdk';
import { VocabApp } from './app';
import { clearStorageData, getEverWrongWordIds, getStorageData } from './storage';

// Initialize core application logic
const app = new VocabApp();

// HTML Elements for Browser Simulator
const g2ContentEl = document.getElementById('g2-content');
const stateScreenEl = document.getElementById('state-screen');
const stateSeenEl = document.getElementById('state-seen-words');
const stateWrongEl = document.getElementById('state-wrong-count');

// Interactive Buttons in Browser Developer Console
const btnSwipeUp = document.getElementById('btn-swipe-up');
const btnSwipeDown = document.getElementById('btn-swipe-down');
const btnClick = document.getElementById('btn-click');
const btnDoubleClick = document.getElementById('btn-double-click');
const btnResetStorage = document.getElementById('btn-reset-storage');

let bridge: any = null;

// Get readable labels for eventType and eventSource
function getEventSourceLabel(source: any): string {
  const norm = EventSourceType.fromJson(source);
  switch (norm) {
    case EventSourceType.TOUCH_EVENT_FROM_GLASSES_L:
      return 'Glasses Left';
    case EventSourceType.TOUCH_EVENT_FROM_GLASSES_R:
      return 'Glasses Right';
    case EventSourceType.TOUCH_EVENT_FROM_RING:
      return 'Ring';
    default:
      return source !== undefined ? String(source) : 'Unknown';
  }
}

function getEventTypeLabel(type: any): string {
  const norm = OsEventTypeList.fromJson(type);
  if (norm !== undefined) {
    return OsEventTypeList[norm] || String(type);
  }
  return type !== undefined ? String(type) : 'undefined';
}

// Normalize Even G2 gestures
function parseG2Event(event: any): 'click' | 'double_click' | 'swipe_up' | 'swipe_down' | null {
  if (!event || !event.sysEvent) return null;
  const sys = event.sysEvent;
  
  // Safely normalize eventType using SDK methods
  let normType = OsEventTypeList.fromJson(sys.eventType);
  
  // Fallback for single tap tap/click anomaly on physical hardware
  if (normType === undefined && sys.eventType === undefined) {
    normType = OsEventTypeList.CLICK_EVENT;
  }
  
  // Check double_click flag
  if (sys.double_click === true || normType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    return 'double_click';
  }
  
  if (normType === OsEventTypeList.SCROLL_TOP_EVENT) {
    return 'swipe_up';
  }
  
  if (normType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    return 'swipe_down';
  }
  
  if (normType === OsEventTypeList.CLICK_EVENT) {
    return 'click';
  }
  
  return null;
}

// Function to update both G2 glasses display and local simulator
async function updateUI() {
  const text = app.getDisplayText();
  
  // Update browser simulator preview
  if (g2ContentEl) {
    g2ContentEl.textContent = text;
  }

  // Update diagnostic info panel
  if (stateScreenEl) stateScreenEl.textContent = app.getScreenState();
  
  const stats = getStorageData();
  const seenCount = Object.keys(stats).length;
  const wrongCount = getEverWrongWordIds().length;

  if (stateSeenEl) stateSeenEl.textContent = String(seenCount);
  if (stateWrongEl) stateWrongEl.textContent = String(wrongCount);

  // Send update to physical Even G2 glasses via SDK
  if (bridge) {
    try {
      const upgrade = new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        contentOffset: 0,
        contentLength: 2000,
        content: text
      });
      await bridge.textContainerUpgrade(upgrade);
    } catch (e) {
      console.warn('Failed upgrading text container using class, trying plain object fallback:', e);
      try {
        await bridge.textContainerUpgrade({
          containerID: 1,
          containerName: 'main',
          contentOffset: 0,
          contentLength: 2000,
          content: text
        } as any);
      } catch (innerErr) {
        console.error('Failed G2 text container update:', innerErr);
      }
    }
  }
}

// Attach SDK and App Lifecycle
async function start() {
  // Bind UI refresh callback
  app.bindStateChange(updateUI);

  // Load quiz data and initialize
  await app.init();
  updateUI();

  try {
    // Await G2 bridge connection
    bridge = await waitForEvenAppBridge();
    console.log('Even App Bridge initialized successfully!');

    // Initialize startup container layout on the glasses screen (576 x 288)
    const mainTextContainer = new TextContainerProperty({
      containerID: 1,
      containerName: 'main',
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 4,
      content: app.getDisplayText(),
      isEventCapture: 1 // Required to capture gesture inputs
    });

    await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [mainTextContainer]
      })
    );

    // Listen for hardware interactions
    bridge.onEvenHubEvent((event: any) => {
      const gesture = parseG2Event(event);
      
      const sys = event?.sysEvent || {};
      const typeLabel = getEventTypeLabel(sys.eventType);
      const sourceLabel = getEventSourceLabel(sys.eventSource);
      
      // Update HTML diagnostic UI
      const stateLastEventEl = document.getElementById('state-last-event');
      if (stateLastEventEl) {
        stateLastEventEl.textContent = `Type: ${typeLabel} | Source: ${sourceLabel}`;
      }
      
      // Log details to console
      console.log('G2 Event Received - Gesture:', gesture, 'Type:', typeLabel, 'Source:', sourceLabel, 'Raw Event:', event);

      switch (gesture) {
        case 'swipe_up':
          app.handleSwipeUp();
          break;
        case 'swipe_down':
          app.handleSwipeDown();
          break;
        case 'click':
          app.handleClick();
          break;
        case 'double_click':
          app.handleDoubleClick();
          break;
      }
    });

  } catch (e) {
    console.warn('Even Hub SDK failed to initialize (expected in standalone browser preview):', e);
  }
}

// --- Browser Simulation Event Listeners ---

// Keyboard controls
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      app.handleSwipeUp();
      break;
    case 'ArrowDown':
      e.preventDefault();
      app.handleSwipeDown();
      break;
    case 'Enter':
      e.preventDefault();
      app.handleClick();
      break;
    case 'Escape':
      e.preventDefault();
      app.handleDoubleClick();
      break;
  }
});

// Click handlers for Developer Console buttons
btnSwipeUp?.addEventListener('click', () => app.handleSwipeUp());
btnSwipeDown?.addEventListener('click', () => app.handleSwipeDown());
btnClick?.addEventListener('click', () => app.handleClick());
btnDoubleClick?.addEventListener('click', () => app.handleDoubleClick());

// Reset localStorage
btnResetStorage?.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear your learning stats?')) {
    clearStorageData();
    updateUI();
  }
});

// Run application
start();
