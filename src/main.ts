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

// Helper to recursively check if a target value is present anywhere in an object
function hasTargetValue(obj: any, targets: any[]): boolean {
  let found = false;
  
  function check(item: any) {
    if (found || item === null || item === undefined) return;
    if (typeof item === 'object') {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          check(item[key]);
        }
      }
    } else {
      const valStr = String(item).toLowerCase();
      for (const target of targets) {
        if (item === target || String(item) === String(target) || valStr === String(target).toLowerCase()) {
          found = true;
          return;
        }
      }
    }
  }
  
  check(obj);
  return found;
}

// Helper to recursively detect the event source, looking for 'Ring' or 'Glasses'
function detectEventSource(obj: any): 'Glasses Left' | 'Glasses Right' | 'Ring' | 'Unknown' {
  if (obj === null || obj === undefined) return 'Unknown';
  
  let hasRing = false;
  let hasGlassesL = false;
  let hasGlassesR = false;

  function traverse(item: any, parentKey?: string) {
    if (item === null || item === undefined) return;
    if (typeof item === 'object') {
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          traverse(item[key], key);
        }
      }
    } else {
      const valStr = String(item).toLowerCase();
      if (valStr.includes('ring')) {
        hasRing = true;
      }
      if (parentKey === 'eventSource') {
        if (item === EventSourceType.TOUCH_EVENT_FROM_RING || item === 2 || item === '2' || valStr.includes('ring')) {
          hasRing = true;
        } else if (item === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L || item === 3 || item === '3' || valStr.includes('glasses_l')) {
          hasGlassesL = true;
        } else if (item === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R || item === 1 || item === '1' || valStr.includes('glasses_r')) {
          hasGlassesR = true;
        }
      }
    }
  }

  traverse(obj);

  if (hasRing) return 'Ring';
  if (hasGlassesL) return 'Glasses Left';
  if (hasGlassesR) return 'Glasses Right';
  
  return 'Unknown';
}

// Get readable labels for eventType and eventSource
function getEventSourceLabel(event: any): string {
  return detectEventSource(event);
}

function getEventTypeLabel(event: any): string {
  if (!event) return 'undefined';
  
  if (
    event.sysEvent?.double_click === true ||
    hasTargetValue(event, [OsEventTypeList.DOUBLE_CLICK_EVENT, 3, 'DOUBLE_CLICK_EVENT', 'DOUBLE_CLICK'])
  ) {
    return 'DOUBLE_CLICK_EVENT';
  }
  if (hasTargetValue(event, [OsEventTypeList.SCROLL_TOP_EVENT, 1, 'SCROLL_TOP_EVENT', 'SCROLL_TOP'])) {
    return 'SCROLL_TOP_EVENT';
  }
  if (hasTargetValue(event, [OsEventTypeList.SCROLL_BOTTOM_EVENT, 2, 'SCROLL_BOTTOM_EVENT', 'SCROLL_BOTTOM'])) {
    return 'SCROLL_BOTTOM_EVENT';
  }
  if (hasTargetValue(event, [OsEventTypeList.CLICK_EVENT, 0, 'CLICK_EVENT', 'CLICK', 'RING_CLICK_EVENT', 'RING_CLICK'])) {
    return 'CLICK_EVENT';
  }
  
  return 'undefined';
}

// Normalize Even G2 gestures
function parseG2Event(event: any): 'click' | 'double_click' | 'swipe_up' | 'swipe_down' | null {
  if (!event) return null;

  // 1. Double Click checks
  if (
    event.sysEvent?.double_click === true ||
    hasTargetValue(event, [OsEventTypeList.DOUBLE_CLICK_EVENT, 3, 'DOUBLE_CLICK_EVENT', 'DOUBLE_CLICK'])
  ) {
    return 'double_click';
  }

  // 2. Swipe Up checks
  if (hasTargetValue(event, [OsEventTypeList.SCROLL_TOP_EVENT, 1, 'SCROLL_TOP_EVENT', 'SCROLL_TOP'])) {
    return 'swipe_up';
  }

  // 3. Swipe Down checks
  if (hasTargetValue(event, [OsEventTypeList.SCROLL_BOTTOM_EVENT, 2, 'SCROLL_BOTTOM_EVENT', 'SCROLL_BOTTOM'])) {
    return 'swipe_down';
  }

  // 4. Click checks
  if (hasTargetValue(event, [OsEventTypeList.CLICK_EVENT, 0, 'CLICK_EVENT', 'CLICK', 'RING_CLICK_EVENT', 'RING_CLICK'])) {
    return 'click';
  }

  // 5. Fallback click anomaly (e.g. if we have a sysEvent or ring source, but type is undefined, treat as click)
  if (event.sysEvent !== undefined || detectEventSource(event) === 'Ring') {
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
      
      const typeLabel = getEventTypeLabel(event);
      const sourceLabel = getEventSourceLabel(event);
      
      // Update HTML diagnostic UI
      const stateLastEventEl = document.getElementById('state-last-event');
      if (stateLastEventEl) {
        stateLastEventEl.textContent = `Type: ${typeLabel} | Source: ${sourceLabel}`;
      }

      // Display raw event data on the screen
      const rawEventLogEl = document.getElementById('raw-event-log');
      if (rawEventLogEl) {
        rawEventLogEl.textContent = JSON.stringify(event, null, 2);
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
